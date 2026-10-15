"""`local`: run code with the programs installed on the SERVER's own machine.

    SECURITY WARNING. This is not a sandbox. It executes arbitrary code as the
    user the backend runs as, with that user's files, network and credentials in
    reach. Everything below limits accidents (a runaway loop, a flood of output,
    a hostile file name); none of it stops a malicious program. That is why it is
    OFF by default (`RUN_LOCAL_ENABLED=false`), why the use case demands an
    administrator session for it, and why it must never be turned on for a
    server that is reachable by people you do not trust. A serverless platform has
    no compilers anyway: this provider is for a laptop or a box of your own.

What it does, deliberately:

* a private temporary directory per run, deleted afterwards (also on failure);
* `subprocess` with an argument LIST - never a shell, so nothing in a file name,
  a flag or an argument is ever interpreted by one (names are also vetted by the
  use case: `[A-Za-z0-9_.-]`, no `..`, no leading `-`);
* a clean environment: a minimal `PATH` (the tool directories plus the system
  ones), `HOME` / `TMP` pointing at the temporary directory, nothing inherited
  (no API keys from `.env`, no tokens);
* a wall-clock timeout for every stage; on expiry the WHOLE process tree is
  killed (`killpg` on POSIX, `taskkill /T` on Windows), not just its first process;
* output read in a bounded way: each of stdout / stderr keeps at most 1 MiB, the
  rest is discarded, and the result says `truncated`;
* on POSIX also `rlimit`s: no core files, CPU seconds, file size, open files, and
  address space for native programs (not for the JVM or Node, which reserve far
  more than they use). None of this exists on Windows;
* at most two runs at the same time (a third is answered `run_busy`).

Tools are found with `shutil.which` (g++, gcc, javac + java, python, node) and
each can be overridden with `RUN_LOCAL_GCC` / `_GXX` / `_JAVAC` / `_JAVA` /
`_PYTHON` / `_NODE`. `subprocess` runs on a worker thread, not through asyncio's
subprocess support, which does not exist on the Windows selector event loop that
uvicorn picks when it reloads.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import signal as signal_module
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from src.adapter.output.run.common import java_main_class
from src.application.exceptions.exceptions import AppException
from src.application.exceptions.run_exceptions import RunProviderUnavailable
from src.application.ports.output.code_executor_port import CodeExecutorPort
from src.domain.utils.run_languages import LANGUAGES, source_files
from src.domain.vo.run_vo import MAX_OUTPUT_BYTES, ExecutionRequest, RunResult, StageResult, finish, not_run

try:  # POSIX only
    import resource
except ImportError:  # pragma: no cover - Windows
    resource = None  # type: ignore[assignment]

IS_WINDOWS = os.name == "nt"

#: Language -> the tools it needs (keys of `_TOOL_NAMES`).
REQUIRES: Dict[str, Tuple[str, ...]] = {
    "c": ("gcc",),
    "cpp": ("gxx",),
    "java": ("javac", "java"),
    "python": ("python",),
    "javascript": ("node",),
}
_TOOL_NAMES = {"gcc": "gcc", "gxx": "g++", "javac": "javac", "java": "java", "node": "node"}

MAX_CONCURRENT = 2
FILE_SIZE_LIMIT = 64 * 1024 * 1024
OPEN_FILES_LIMIT = 1024
NATIVE_MEMORY_LIMIT = 1024 * 1024 * 1024
VERSION_TIMEOUT_S = 8.0

_version_cache: Dict[str, str] = {}
_version_lock = threading.Lock()


@dataclass
class _Outcome:
    stdout: bytes
    stderr: bytes
    code: Optional[int]
    signal: Optional[str]
    timed_out: bool
    cut_out: bool
    cut_err: bool
    ms: int


# -------------------------------------------------------------------- process
def _kill_tree(process: subprocess.Popen) -> None:
    """End `process` and everything it started."""
    try:
        if IS_WINDOWS:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True, timeout=15, creationflags=subprocess.CREATE_NO_WINDOW,
            )
        else:
            os.killpg(process.pid, signal_module.SIGKILL)
    except Exception:  # noqa: BLE001 - already gone, or no permission: fall back below
        pass
    try:
        process.kill()
    except Exception:  # noqa: BLE001
        pass


def _drain(stream, limit: int, sink: bytearray, flags: List[bool]) -> None:
    """Read `stream` to the end, keeping the first `limit` bytes and dropping the rest.

    Reading on after the limit (instead of stopping) keeps the program from
    blocking on a full pipe, so its exit status stays meaningful.
    """
    try:
        while True:
            chunk = stream.read1(65536)
            if not chunk:
                return
            room = limit - len(sink)
            if room > 0:
                sink.extend(chunk[:room])
            if len(chunk) > room:
                flags[0] = True
    except (OSError, ValueError):
        return


def _feed(stream, data: bytes) -> None:
    try:
        if data:
            stream.write(data)
    except (OSError, ValueError):
        pass
    finally:
        try:
            stream.close()
        except (OSError, ValueError):
            pass


def _preexec(cpu_seconds: int, address_space: Optional[int]) -> Optional[Callable[[], None]]:
    if resource is None or IS_WINDOWS:
        return None

    def apply() -> None:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (FILE_SIZE_LIMIT, FILE_SIZE_LIMIT))
        resource.setrlimit(resource.RLIMIT_NOFILE, (OPEN_FILES_LIMIT, OPEN_FILES_LIMIT))
        if address_space:
            resource.setrlimit(resource.RLIMIT_AS, (address_space, address_space))

    return apply


def run_process(
    argv: Sequence[str],
    *,
    cwd: str,
    env: Mapping[str, str],
    stdin: bytes,
    timeout_s: float,
    address_space: Optional[int] = None,
    limit: int = MAX_OUTPUT_BYTES,
) -> _Outcome:
    """Start `argv` (no shell), feed it `stdin`, wait at most `timeout_s`, collect bounded output."""
    options: Dict[str, object] = {}
    if IS_WINDOWS:
        options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    else:
        options["start_new_session"] = True            # its own process group, for killpg
        hook = _preexec(max(1, int(timeout_s) + 1), address_space)
        if hook is not None:
            options["preexec_fn"] = hook

    started = time.perf_counter()
    process = subprocess.Popen(
        list(argv), cwd=cwd, env=dict(env), shell=False, close_fds=True,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options,
    )
    out, err = bytearray(), bytearray()
    cut_out, cut_err = [False], [False]
    threads = [
        threading.Thread(target=_drain, args=(process.stdout, limit, out, cut_out), daemon=True),
        threading.Thread(target=_drain, args=(process.stderr, limit, err, cut_err), daemon=True),
        threading.Thread(target=_feed, args=(process.stdin, stdin), daemon=True),
    ]
    for thread in threads:
        thread.start()

    timed_out = False
    try:
        process.wait(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_tree(process)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:  # pragma: no cover - a process that survives SIGKILL
            pass
    if not timed_out and not IS_WINDOWS:
        # The process is done, but descendants it left behind (`cmd &`) would
        # keep running after the request, and holding the pipes open; end them.
        try:
            os.killpg(process.pid, signal_module.SIGKILL)
        except Exception:  # noqa: BLE001 - nothing left to kill
            pass
    # A grandchild that outlived its parent can still hold the pipes (Windows
    # has no process group to end): give the readers a moment, then go on with
    # what was collected.
    deadline = time.monotonic() + 3
    for thread in threads:
        thread.join(timeout=max(0.0, deadline - time.monotonic()))

    code = process.returncode
    signal_name: Optional[str] = None
    if code is not None and code < 0 and not IS_WINDOWS:
        try:
            signal_name = signal_module.Signals(-code).name
        except ValueError:
            signal_name = f"signal {-code}"
    return _Outcome(
        stdout=bytes(out), stderr=bytes(err), code=code, signal=signal_name, timed_out=timed_out,
        cut_out=cut_out[0], cut_err=cut_err[0], ms=int((time.perf_counter() - started) * 1000),
    )


def _text(data: bytes) -> str:
    return data.decode("utf-8", errors="replace")


def _remove_tree(path: Path) -> None:
    """Delete `path`; on Windows a just-killed process may still hold a handle for a moment."""
    def make_writable(function, target, _info):
        try:
            os.chmod(target, 0o700)
            function(target)
        except OSError:
            pass

    for attempt in range(6):
        try:
            shutil.rmtree(path, onerror=make_writable)
        except OSError:
            pass
        if not path.exists():
            return
        time.sleep(0.1 * (attempt + 1))
    shutil.rmtree(path, ignore_errors=True)


# ------------------------------------------------------------------- executor
class LocalExecutor(CodeExecutorPort):
    id = "local"
    label = "Máy chủ (cục bộ)"
    kind = "local"
    needs_session = True

    def __init__(
        self,
        *,
        enabled: bool = False,
        tools: Optional[Mapping[str, str]] = None,
        work_root: Optional[str] = None,
        max_concurrent: int = MAX_CONCURRENT,
    ):
        self._enabled = enabled
        self._overrides: Dict[str, str] = {key: (value or "").strip() for key, value in (tools or {}).items()}
        self._work_root = work_root
        self._slots = threading.BoundedSemaphore(max(1, max_concurrent))

    # ---------------------------------------------------------------- tools
    def _tool(self, key: str) -> Optional[str]:
        override = self._overrides.get(key, "")
        if override:
            return shutil.which(override)
        if key == "python":
            for name in ("python3", "python"):
                found = shutil.which(name)
                # The Microsoft Store "alias" is a stub that opens the Store.
                if found and "WindowsApps" not in found:
                    return found
            return sys.executable or None
        return shutil.which(_TOOL_NAMES[key])

    def languages(self) -> Tuple[str, ...]:
        return tuple(
            language for language in LANGUAGES
            if language in REQUIRES and all(self._tool(tool) for tool in REQUIRES[language])
        )

    def multi_file_languages(self) -> Tuple[str, ...]:
        return self.languages()

    def availability(self) -> Tuple[bool, str]:
        if not self._enabled:
            return False, "Chạy bằng chương trình cài trên máy chủ đang tắt (RUN_LOCAL_ENABLED=false)"
        if not self.languages():
            return False, "Máy chủ không có trình biên dịch/thông dịch nào (g++, gcc, javac + java, python, node)"
        return True, ""

    # ------------------------------------------------------------- helpers
    def _environment(self, workdir: Path, tool_paths: Sequence[str]) -> Dict[str, str]:
        directories: List[str] = []
        for tool in tool_paths:
            directory = str(Path(tool).resolve().parent)
            if directory not in directories:
                directories.append(directory)
        if IS_WINDOWS:
            root = os.environ.get("SystemRoot", r"C:\Windows")
            directories += [os.path.join(root, "System32"), root]
        else:
            directories += ["/usr/local/bin", "/usr/bin", "/bin"]
        env = {
            "PATH": os.pathsep.join(directories),
            "HOME": str(workdir),
            "TMPDIR": str(workdir),
            "TMP": str(workdir),
            "TEMP": str(workdir),
            "LANG": "C.UTF-8",
        }
        if IS_WINDOWS:
            env["SystemRoot"] = os.environ.get("SystemRoot", r"C:\Windows")
            env["PATHEXT"] = ".COM;.EXE;.BAT;.CMD"
            env["USERPROFILE"] = str(workdir)
        return env

    def _version(self, tool: str, flag: str, env: Mapping[str, str], cwd: str) -> str:
        """First line of `tool flag`, remembered: asking costs a process start."""
        with _version_lock:
            if tool in _version_cache:
                return _version_cache[tool]
        try:
            outcome = run_process([tool, flag], cwd=cwd, env=env, stdin=b"", timeout_s=VERSION_TIMEOUT_S, limit=4096)
            text = _text(outcome.stdout or outcome.stderr).strip()
            version = text.splitlines()[0].strip() if text else ""
        except OSError:
            version = ""
        with _version_lock:
            _version_cache[tool] = version
        return version

    @staticmethod
    def _stage(outcome: _Outcome) -> StageResult:
        return StageResult(
            ran=True,
            ok=outcome.code == 0 and not outcome.timed_out and outcome.signal is None,
            stdout=_text(outcome.stdout),
            stderr=_text(outcome.stderr),
            code=outcome.code,
            signal=outcome.signal,
            ms=outcome.ms,
            timedOut=outcome.timed_out,
            truncated=outcome.cut_out or outcome.cut_err,
        )

    def _write_files(self, workdir: Path, request: ExecutionRequest) -> None:
        root = workdir.resolve()
        for file in request.files:
            target = (root / file.path).resolve()
            # The names were vetted already; this is the check that does not
            # trust that.
            if root != target and root not in target.parents:
                raise RunProviderUnavailable(self.id, "Tên tệp trỏ ra ngoài thư mục chạy.")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(file.content.encode("utf-8"))

    # ---------------------------------------------------------------- run
    async def execute(self, request: ExecutionRequest) -> RunResult:
        return await asyncio.to_thread(self._execute_sync, request)

    def _execute_sync(self, request: ExecutionRequest) -> RunResult:
        needed = REQUIRES.get(request.language)
        if not needed:
            raise RunProviderUnavailable(self.id, f"Chưa hỗ trợ {LANGUAGES[request.language].label} trên máy chủ.")
        tools = {key: self._tool(key) for key in needed}
        if not all(tools.values()):
            raise RunProviderUnavailable(self.id, "Máy chủ không có trình biên dịch/thông dịch cần thiết.")
        if not self._slots.acquire(blocking=False):
            raise AppException(
                "Máy chủ đang chạy mã khác — thử lại sau ít giây",
                status_code=429, code="run_busy", payload={"code": "run_busy"},
                headers={"Retry-After": "3"},
            )
        try:
            try:
                workdir = Path(tempfile.mkdtemp(prefix="run-", dir=self._work_root))
            except OSError as cause:
                raise RunProviderUnavailable(self.id, "Không tạo được thư mục tạm để chạy mã.") from cause
            try:
                self._write_files(workdir, request)
                return self._run(workdir, request, {key: str(path) for key, path in tools.items()})
            except OSError as cause:
                raise RunProviderUnavailable(self.id, "Không khởi động được chương trình trên máy chủ.") from cause
            finally:
                _remove_tree(workdir)
        finally:
            self._slots.release()

    def _run(self, workdir: Path, request: ExecutionRequest, tools: Dict[str, str]) -> RunResult:
        env = self._environment(workdir, list(tools.values()))
        cwd = str(workdir)
        paths = [file.path for file in request.files]
        stdin = request.stdin.encode("utf-8")
        run_timeout = request.run_timeout_ms / 1000
        compile_timeout = request.compile_timeout_ms / 1000
        language = request.language
        warnings: List[str] = []
        compile_stage: Optional[StageResult] = None

        def compile_with(argv: List[str]) -> Optional[RunResult]:
            """Run the compile step; a RunResult when it failed (nothing more to do)."""
            nonlocal compile_stage
            outcome = run_process(argv, cwd=cwd, env=env, stdin=b"", timeout_s=compile_timeout)
            compile_stage = self._stage(outcome)
            if compile_stage.ok:
                return None
            return finish(provider=self.id, language=language, version=version, compile=compile_stage,
                          run=not_run(), warnings=warnings)

        if language in ("c", "cpp"):
            tool = tools["gcc" if language == "c" else "gxx"]
            version = self._version(tool, "--version", env, cwd)
            program = str(workdir / ("prog.exe" if IS_WINDOWS else "prog"))
            flags = list(request.compile_args)
            if language == "cpp" and not any(flag.startswith("-std=") for flag in flags):
                flags.append("-std=c++17")
            argv = [tool, *flags, "-I.", "-o", program, *source_files(language, paths)]
            if language == "c":
                argv.append("-lm")
            failed = compile_with(argv)
            if failed is not None:
                return failed
            outcome = run_process([program, *request.args], cwd=cwd, env=env, stdin=stdin, timeout_s=run_timeout,
                                  address_space=None if IS_WINDOWS else NATIVE_MEMORY_LIMIT)
        elif language == "java":
            version = self._version(tools["javac"], "-version", env, cwd)
            if request.compile_args:
                warnings.append("Cờ biên dịch (compileArgs) chỉ áp dụng cho C/C++ nên đã bị bỏ qua.")
            failed = compile_with([tools["javac"], "-encoding", "UTF-8", "-d", ".", *source_files(language, paths)])
            if failed is not None:
                return failed
            main_class = java_main_class(request.main_file, request.files[0].content)
            outcome = run_process(
                [tools["java"], "-Xmx256m", "-XX:+UseSerialGC", "-Dfile.encoding=UTF-8",
                 "-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8", "-cp", ".", main_class, *request.args],
                cwd=cwd, env=env, stdin=stdin, timeout_s=run_timeout,
            )
        elif language == "python":
            version = self._version(tools["python"], "--version", env, cwd)
            if request.compile_args:
                warnings.append("Cờ biên dịch (compileArgs) chỉ áp dụng cho C/C++ nên đã bị bỏ qua.")
            outcome = run_process(
                [tools["python"], "-B", "-E", "-s", "-X", "utf8", request.main_file, *request.args],
                cwd=cwd, env=env, stdin=stdin, timeout_s=run_timeout,
            )
        else:  # javascript
            version = self._version(tools["node"], "--version", env, cwd)
            if request.compile_args:
                warnings.append("Cờ biên dịch (compileArgs) chỉ áp dụng cho C/C++ nên đã bị bỏ qua.")
            outcome = run_process([tools["node"], request.main_file, *request.args],
                                  cwd=cwd, env=env, stdin=stdin, timeout_s=run_timeout)

        return finish(provider=self.id, language=language, version=version, compile=compile_stage,
                      run=self._stage(outcome), warnings=warnings)
