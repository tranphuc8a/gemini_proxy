"""Wandbox: `POST {RUN_WANDBOX_URL}/compile.json` (default https://wandbox.org/api).

Wandbox (wandbox.org) needs no key. What this adapter relies on:

* a request names an exact `compiler` (`gcc-13.2.0`, `cpython-3.12.7`...), sends
  the main file as `code`, further files as `codes[{file, code}]`, and may add
  `compiler-option-raw` and `runtime-option-raw` (one option per line);
* the reply has `status` (the program's exit code, as a string), `signal`,
  `compiler_output` / `compiler_error` and `program_output` / `program_error`;
* **there is no explicit "compilation failed" flag.** A failed compilation is
  recognised by the reply having no `program_*` field at all while `status` is
  not 0; a program that exits non-zero after compiling carries them;
* the time limit is the service's own and cannot be set per request:
  `runTimeoutMs` / `compileTimeoutMs` are not sent.

Extra `.c` / `.cpp` files are given to the compiler by listing them as raw
options, since Wandbox compiles only the main file by itself.

Measured against the real service (not just the docs): it is **slow** (a Java or
Rust build takes 15-40 s), so the HTTP timeout is not derived from the request
(`_timeout_for`); and Java is compiled as `prog.java` and run as class `Main`,
so a top-level `public class` is rejected by javac. The adapter therefore drops
`public` from top-level Java types (reported in `warnings`) and refuses
`package` declarations, which cannot work in a flat directory. Compiler names
change when Wandbox retires a release; `RUN_WANDBOX_COMPILERS`
(`cpp=gcc-head,python=cpython-head`) overrides the table below, and a name
Wandbox no longer knows comes back as `run_provider_rejected`.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from src.adapter.output.run.common import HttpExecutor, clip_text, parse_overrides, to_int
from src.application.exceptions.exceptions import BadRequestError
from src.application.exceptions.run_exceptions import RunProviderUnavailable
from src.domain.utils.run_languages import LANGUAGES, source_files
from src.domain.vo.run_vo import ExecutionRequest, RunResult, StageResult, finish, not_run

#: Canonical language -> Wandbox compiler name. Kotlin has no Wandbox compiler.
COMPILER_MAP: Dict[str, str] = {
    "c": "gcc-13.2.0-c",
    "cpp": "gcc-13.2.0",
    "java": "openjdk-jdk-21+35",
    "python": "cpython-3.12.7",
    "javascript": "nodejs-20.17.0",
    "typescript": "typescript-5.6.2",
    "go": "go-1.23.2",
    "rust": "rust-1.82.0",
    "csharp": "mono-6.12.0.199",
    "php": "php-8.3.12",
    "ruby": "ruby-3.4.9",
    "bash": "bash",
}
MULTI_FILE_LANGUAGES: Tuple[str, ...] = ("c", "cpp", "python", "java")

_KILLED = ("Killed", "SIGKILL", "Terminated", "SIGTERM")

#: Slowest builds seen on the public service were ~40 s; the service enforces its own limits.
MIN_HTTP_TIMEOUT_S = 60.0

_PUBLIC_TYPE = re.compile(r"^public\s+(?=(?:(?:final|abstract|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record|@interface)\b)", re.M)
_PACKAGE = re.compile(r"^\s*package\s+[\w.]+\s*;", re.M)
_MAIN_CLASS = re.compile(r"\bclass\s+Main\b")


def java_for_wandbox(files):
    """Top-level `public` types made package-private (javac insists a public type lives in its own file).

    Returns (new contents, warnings). Raises BadRequestError for `package`, which a flat directory cannot run.
    """
    out, changed = [], False
    for file in files:
        if _PACKAGE.search(file.content):
            raise BadRequestError(
                "Wandbox không chạy được mã Java có khai báo package — hãy bỏ dòng package hoặc chọn nhà cung cấp khác",
                payload={"code": "run_multifile_unsupported", "file": file.path},
            )
        text, n = _PUBLIC_TYPE.subn("", file.content)
        changed = changed or n > 0
        out.append(text)
    warnings = []
    if changed:
        warnings.append("Wandbox biên dịch mọi tệp Java cùng một lần nên đã bỏ chữ “public” ở các lớp cấp cao.")
    if not any(_MAIN_CLASS.search(text) for text in out):
        warnings.append("Wandbox chạy lớp tên Main — hãy đặt tên lớp chứa main() là Main.")
    return out, warnings


class WandboxExecutor(HttpExecutor):
    id = "wandbox"
    label = "Wandbox"

    def __init__(
        self,
        *,
        base_url: str,
        compilers: str = "",
        http_timeout_s: float = 30.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        super().__init__(base_url=base_url, http_timeout_s=http_timeout_s, transport=transport)
        self._compilers: Dict[str, str] = {**COMPILER_MAP, **parse_overrides(compilers)}

    def languages(self) -> Tuple[str, ...]:
        return self._all_languages(self._compilers)

    def multi_file_languages(self) -> Tuple[str, ...]:
        return tuple(language for language in MULTI_FILE_LANGUAGES if language in self._compilers)

    def availability(self) -> Tuple[bool, str]:
        if not self._base:
            return False, "Chưa cấu hình địa chỉ Wandbox (RUN_WANDBOX_URL)"
        return True, ""

    # ------------------------------------------------------------- the call
    def _timeout_for(self, request: ExecutionRequest) -> float:
        """Wandbox ignores the per-request limits and builds slowly: wait at least `MIN_HTTP_TIMEOUT_S`."""
        return max(self._timeout_ceiling, MIN_HTTP_TIMEOUT_S)

    def _payload(self, request: ExecutionRequest, contents: Optional[List[str]] = None) -> Dict[str, Any]:
        main, *others = request.files
        main_code = contents[0] if contents else main.content
        other_code = contents[1:] if contents else [file.content for file in others]
        raw_compile: List[str] = list(request.compile_args)
        if request.language in ("c", "cpp"):
            # Only the main file is compiled unless the others are named.
            extra = set(source_files(request.language, [file.path for file in others]))
            raw_compile += [file.path for file in others if file.path in extra]
        payload: Dict[str, Any] = {
            "compiler": self._compilers[request.language],
            "code": main_code,
            "stdin": request.stdin,
            "save": False,
        }
        if others:
            payload["codes"] = [{"file": file.path, "code": code} for file, code in zip(others, other_code)]
        if raw_compile:
            payload["compiler-option-raw"] = "\n".join(raw_compile)
        if request.args:
            payload["runtime-option-raw"] = "\n".join(request.args)
        return payload

    async def execute(self, request: ExecutionRequest) -> RunResult:
        if any("\n" in arg or "\r" in arg for arg in request.args):
            # One option per line is the only way to pass arguments here.
            raise BadRequestError(
                "Wandbox không nhận tham số chương trình có xuống dòng",
                payload={"code": "run_bad_arg"},
            )
        contents: Optional[List[str]] = None
        warnings: List[str] = []
        if request.language == "java":
            contents, warnings = java_for_wandbox(request.files)
        started = time.perf_counter()
        response = await self._send("POST", "/compile.json", request, json_body=self._payload(request, contents))
        result = self.read_result(self._json(response), request, self._timed(started))
        if warnings:
            result.warnings = list(result.warnings or []) + warnings
        return result

    # ---------------------------------------------------------- the answer
    def read_result(self, data: Dict[str, Any], request: ExecutionRequest, elapsed_ms: int) -> RunResult:
        status = to_int(data.get("status"), default=None)
        if status is None and "status" not in data:
            raise RunProviderUnavailable(self.id, "Nhà cung cấp trả về dữ liệu không đúng định dạng.")
        status = status if status is not None else 0
        signal = data.get("signal") or None

        compile_out, cut_a = clip_text(data.get("compiler_output"))
        compile_err, cut_b = clip_text(data.get("compiler_error"))
        compiled = LANGUAGES[request.language].compiled
        program_ran = any(key in data for key in ("program_output", "program_error", "program_message"))

        compile_stage: Optional[StageResult] = None
        if not program_ran and status != 0:
            compile_stage = StageResult(ran=True, ok=False, stdout=compile_out, stderr=compile_err,
                                        code=status, truncated=cut_a or cut_b)
            return finish(provider=self.id, language=request.language, version=self._compilers[request.language],
                          compile=compile_stage, run=not_run())
        if compiled:
            compile_stage = StageResult(ran=True, ok=True, stdout=compile_out, stderr=compile_err, code=0,
                                        truncated=cut_a or cut_b)

        stdout, cut_out = clip_text(data.get("program_output"))
        stderr, cut_err = clip_text(data.get("program_error"))
        killed = signal in _KILLED
        run_stage = StageResult(
            ran=True,
            ok=status == 0 and signal is None,
            stdout=stdout,
            stderr=stderr,
            code=status,
            signal=str(signal) if signal else None,
            ms=elapsed_ms,
            # Wandbox does not say "timeout"; a kill after nearly the whole
            # allowance (here: any kill of a slow call) is what one looks like.
            timedOut=killed and elapsed_ms >= 0.9 * request.run_timeout_ms,
            truncated=cut_out or cut_err,
        )
        return finish(provider=self.id, language=request.language, version=self._compilers[request.language],
                      compile=compile_stage, run=run_stage)
