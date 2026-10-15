"""Judge0 CE: `POST {RUN_JUDGE0_URL}/submissions?base64_encoded=true&wait=true`.

Judge0 (github.com/judge0/judge0) is a submission queue in front of `isolate`.
What this adapter relies on:

* a submission is `source_code`, `language_id`, `stdin`, `compiler_options`,
  `command_line_arguments`, `cpu_time_limit` / `wall_time_limit` (seconds) and
  `memory_limit` (KB). Text travels base64-encoded (`base64_encoded=true`),
  because stdout of a program is not necessarily valid UTF-8 and JSON would
  otherwise reject it;
* `wait=true` returns the finished submission in one call. Some servers disable
  it; then the adapter submits without it and polls `GET /submissions/{token}`;
* `status.id`: 3 accepted, 5 time limit, 6 compilation error, 7-12 runtime
  errors, 13 internal error, 14 exec format error;
* there is no per-submission compile timeout: `compileTimeoutMs` is not sent.

**Several files** use Judge0's "Multi-file program" (language id 89): the source
files travel in `additional_files`, a base64 ZIP that must contain two scripts,
`compile` and `run`. This adapter writes them per language (see `_scripts`), so
multi-file works for the languages in `MULTI_FILE_LANGUAGES` only; the scripts
assume `gcc`, `g++`, `javac`, `java`, `python3`, `node`, `ruby`, `php` and `bash`
are on the server's PATH, which holds for the official Judge0 image but is not
checked here.

Language ids differ between Judge0 releases; `RUN_JUDGE0_LANGUAGE_IDS`
(`cpp=105,python=100`) overrides the defaults below (those of CE 1.13.0, present
in every 1.13.x).
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import io
import shlex
import time
import zipfile
from typing import Any, Dict, Optional, Tuple

import httpx

from src.adapter.output.run.common import (
    HttpExecutor,
    clip_text,
    java_main_class,
    parse_overrides,
    seconds_to_ms,
    to_int,
)
from src.application.exceptions.run_exceptions import (
    RunProviderRejected,
    RunProviderTimeout,
    RunProviderUnavailable,
)
from src.domain.utils.run_languages import LANGUAGES, source_files
from src.domain.vo.run_vo import ExecutionRequest, RunResult, StageResult, finish, not_run

LANGUAGE_IDS: Dict[str, int] = {
    "c": 50,            # C (GCC 9.2.0)
    "cpp": 54,          # C++ (GCC 9.2.0)
    "java": 62,         # Java (OpenJDK 13.0.1)
    "python": 71,       # Python (3.8.1)
    "javascript": 63,   # JavaScript (Node.js 12.14.0)
    "typescript": 74,   # TypeScript (3.7.4)
    "go": 60,           # Go (1.13.5)
    "rust": 73,         # Rust (1.40.0)
    "csharp": 51,       # C# (Mono 6.6.0.161)
    "kotlin": 78,       # Kotlin (1.3.70)
    "php": 68,          # PHP (7.4.1)
    "ruby": 72,         # Ruby (2.7.0)
    "bash": 46,         # Bash (5.0.0)
}
#: What the default ids stand for, shown as `version`. An overridden id has no
#: entry here and reports an empty version rather than a guess.
DEFAULT_VERSIONS: Dict[int, str] = {
    50: "GCC 9.2.0", 54: "GCC 9.2.0", 62: "OpenJDK 13.0.1", 71: "Python 3.8.1", 63: "Node.js 12.14.0",
    74: "TypeScript 3.7.4", 60: "Go 1.13.5", 73: "Rust 1.40.0", 51: "Mono 6.6.0.161", 78: "Kotlin 1.3.70",
    68: "PHP 7.4.1", 72: "Ruby 2.7.0", 46: "Bash 5.0.0",
}
MULTI_FILE_ID = 89
MULTI_FILE_LANGUAGES: Tuple[str, ...] = ("c", "cpp", "java", "python", "javascript", "ruby", "php", "bash")

MEMORY_LIMIT_KB = 256_000
MAX_CPU_SECONDS = 15.0
MAX_WALL_SECONDS = 20.0

# Statuses that mean "the submission has not finished".
_PENDING = (1, 2)


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _unb64(value: Any) -> str:
    """A base64 field of the reply as text; null is empty, junk is kept as it came."""
    if not value or not isinstance(value, str):
        return ""
    try:
        return base64.b64decode(value, validate=False).decode("utf-8", errors="replace")
    except (binascii.Error, ValueError):
        return value


#: Judge0 runs on Linux: its signal numbers are Linux's, whatever platform THIS
#: server runs on (Windows has no SIGKILL in `signal.Signals`).
_LINUX_SIGNALS = {
    1: "SIGHUP", 2: "SIGINT", 3: "SIGQUIT", 4: "SIGILL", 6: "SIGABRT", 7: "SIGBUS", 8: "SIGFPE", 9: "SIGKILL",
    11: "SIGSEGV", 13: "SIGPIPE", 14: "SIGALRM", 15: "SIGTERM", 24: "SIGXCPU", 25: "SIGXFSZ",
}


def _signal_name(number: Optional[int]) -> Optional[str]:
    if not number:
        return None
    return _LINUX_SIGNALS.get(number, f"signal {number}")


# ----------------------------------------------------------------- multi-file
def _scripts(request: ExecutionRequest) -> Tuple[str, str]:
    """The `compile` and `run` scripts of a multi-file submission."""
    paths = [file.path for file in request.files]
    flags = " ".join(shlex.quote(flag) for flag in request.compile_args)
    args = " ".join(shlex.quote(arg) for arg in request.args)
    main = shlex.quote(request.main_file)
    sources = " ".join(shlex.quote(path) for path in source_files(request.language, paths))
    language = request.language

    compile_cmd = ""
    if language == "c":
        compile_cmd = f"gcc {flags} -o prog {sources} -lm"
        run_cmd = f"./prog {args}"
    elif language == "cpp":
        compile_cmd = f"g++ {flags} -o prog {sources}"
        run_cmd = f"./prog {args}"
    elif language == "java":
        compile_cmd = f"javac -encoding UTF-8 {sources}"
        main_content = next(file.content for file in request.files if file.path == request.main_file)
        run_cmd = f"java -Xmx200m -cp . {shlex.quote(java_main_class(request.main_file, main_content))} {args}"
    elif language == "python":
        run_cmd = f"python3 {main} {args}"
    elif language == "javascript":
        run_cmd = f"node {main} {args}"
    elif language == "ruby":
        run_cmd = f"ruby {main} {args}"
    elif language == "php":
        run_cmd = f"php {main} {args}"
    else:  # bash
        run_cmd = f"bash {main} {args}"

    header = "#!/bin/bash\n"
    return header + (compile_cmd or ":") + "\n", header + run_cmd.rstrip() + "\n"


def build_archive(request: ExecutionRequest) -> str:
    """The base64 ZIP of a multi-file submission: the two scripts and every source."""
    compile_script, run_script = _scripts(request)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, body in (("compile", compile_script), ("run", run_script)):
            info = zipfile.ZipInfo(name)
            info.external_attr = 0o755 << 16        # Judge0 executes them
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, body)
        for file in request.files:
            info = zipfile.ZipInfo(file.path)
            info.external_attr = 0o644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, file.content.encode("utf-8"))
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class Judge0Executor(HttpExecutor):
    id = "judge0"
    label = "Judge0"

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str = "",
        key_header: str = "X-Auth-Token",
        language_ids: str = "",
        http_timeout_s: float = 30.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        poll_interval_s: float = 0.5,
    ):
        super().__init__(base_url=base_url, api_key=api_key, http_timeout_s=http_timeout_s, transport=transport)
        self._key_header = (key_header or "X-Auth-Token").strip()
        self._ids: Dict[str, int] = dict(LANGUAGE_IDS)
        for language, value in parse_overrides(language_ids).items():
            number = to_int(value)
            if number:
                self._ids[language] = number
        self._poll_interval = poll_interval_s

    def languages(self) -> Tuple[str, ...]:
        return self._all_languages(self._ids)

    def multi_file_languages(self) -> Tuple[str, ...]:
        return tuple(language for language in MULTI_FILE_LANGUAGES if language in self._ids)

    def availability(self) -> Tuple[bool, str]:
        if not self._base:
            return False, "Chưa cấu hình địa chỉ Judge0 (RUN_JUDGE0_URL)"
        return True, ""

    # ------------------------------------------------------------- the call
    def _headers(self) -> Dict[str, str]:
        return {self._key_header: self._key} if self._key else {}

    def _payload(self, request: ExecutionRequest) -> Dict[str, Any]:
        run_seconds = request.run_timeout_ms / 1000
        payload: Dict[str, Any] = {
            "stdin": _b64(request.stdin),
            "cpu_time_limit": min(run_seconds, MAX_CPU_SECONDS),
            "wall_time_limit": min(run_seconds * 2 + 1, MAX_WALL_SECONDS),
            "memory_limit": MEMORY_LIMIT_KB,
        }
        if len(request.files) > 1:
            payload["language_id"] = MULTI_FILE_ID
            # Never blank: a server may insist on a source_code that the
            # multi-file mode then ignores.
            payload["source_code"] = _b64("# multi-file submission\n")
            payload["additional_files"] = build_archive(request)
            return payload
        payload["language_id"] = self._ids[request.language]
        payload["source_code"] = _b64(request.files[0].content)
        if request.args:
            payload["command_line_arguments"] = " ".join(shlex.quote(arg) for arg in request.args)
        if request.compile_args:
            payload["compiler_options"] = " ".join(request.compile_args)
        return payload

    async def execute(self, request: ExecutionRequest) -> RunResult:
        started = time.perf_counter()
        payload = self._payload(request)
        data = await self._submit(payload, request)
        return self.read_result(data, request, self._timed(started))

    async def _submit(self, payload: Dict[str, Any], request: ExecutionRequest) -> Dict[str, Any]:
        params = {"base64_encoded": "true", "fields": "*"}
        try:
            response = await self._send("POST", "/submissions", request, json_body=payload,
                                        params={**params, "wait": "true"}, headers=self._headers())
            data = self._json(response)
            if not self._pending(data):
                return data
        except RunProviderRejected as rejected:
            detail = str((rejected.payload or {}).get("detail", "")).lower()
            if "wait" not in detail:
                raise
            # `wait` is switched off on this server: submit without it.
            response = await self._send("POST", "/submissions", request, json_body=payload,
                                        params={"base64_encoded": "true"}, headers=self._headers())
            data = self._json(response)
        token = data.get("token")
        if not isinstance(token, str) or not token:
            raise RunProviderUnavailable(self.id, "Nhà cung cấp không trả mã theo dõi bài nộp.")
        return await self._poll(token, params, request)

    @staticmethod
    def _pending(data: Dict[str, Any]) -> bool:
        """True for a reply that is only a receipt (no status yet, or still queued/running)."""
        status = data.get("status")
        status_id = to_int(status.get("id")) if isinstance(status, dict) else None
        return status_id is None or status_id in _PENDING

    async def _poll(self, token: str, params: Dict[str, str], request: ExecutionRequest) -> Dict[str, Any]:
        deadline = time.monotonic() + (request.compile_timeout_ms + request.run_timeout_ms) / 1000 + 10
        while True:
            response = await self._send("GET", f"/submissions/{token}", request, params=params,
                                        headers=self._headers())
            data = self._json(response)
            if not self._pending(data):
                return data
            if time.monotonic() >= deadline:
                raise RunProviderTimeout(self.id)
            await asyncio.sleep(self._poll_interval)

    # ---------------------------------------------------------- the answer
    def read_result(self, data: Dict[str, Any], request: ExecutionRequest, elapsed_ms: int) -> RunResult:
        status = data.get("status")
        if not isinstance(status, dict) or to_int(status.get("id")) is None:
            raise RunProviderUnavailable(self.id, "Nhà cung cấp trả về dữ liệu không đúng định dạng.")
        status_id = to_int(status.get("id"))
        description = str(status.get("description") or "")

        if status_id == 13:
            raise RunProviderUnavailable(self.id, "Nhà cung cấp gặp lỗi nội bộ khi chạy bài nộp.")

        stdout, cut_out = clip_text(_unb64(data.get("stdout")))
        stderr, cut_err = clip_text(_unb64(data.get("stderr")))
        compile_output, _ = clip_text(_unb64(data.get("compile_output")))
        exit_code = to_int(data.get("exit_code"))
        exit_signal = to_int(data.get("exit_signal"))
        compiled = LANGUAGES[request.language].compiled

        compile_stage: Optional[StageResult] = None
        if status_id == 6:
            compile_stage = StageResult(ran=True, ok=False, stderr=compile_output,
                                        code=exit_code if exit_code is not None else 1)
            return finish(provider=self.id, language=request.language, version=self._version(request),
                          compile=compile_stage, run=not_run())
        if compiled:
            compile_stage = StageResult(ran=True, ok=True, stderr=compile_output, code=0)

        timed_out = status_id == 5
        measured = data.get("wall_time") if data.get("wall_time") is not None else data.get("time")
        run_ms = seconds_to_ms(measured) if measured is not None else elapsed_ms
        signal_name = _signal_name(exit_signal)
        if signal_name is None and "(SIG" in description:
            signal_name = description[description.index("(SIG") + 1:].rstrip(")")
        if exit_code is None and status_id in (3, 4):
            exit_code = 0
        run_stage = StageResult(
            ran=True,
            ok=status_id in (3, 4) and not timed_out,
            stdout=stdout,
            stderr=stderr,
            code=exit_code,
            signal=signal_name,
            ms=run_ms,
            timedOut=timed_out,
            truncated=cut_out or cut_err,
        )
        return finish(provider=self.id, language=request.language, version=self._version(request),
                      compile=compile_stage, run=run_stage)

    def _version(self, request: ExecutionRequest) -> str:
        if len(request.files) > 1:
            return "multi-file"
        return DEFAULT_VERSIONS.get(self._ids[request.language], "")
