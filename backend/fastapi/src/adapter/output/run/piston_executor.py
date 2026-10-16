"""Piston: `POST {RUN_PISTON_URL}/execute`.

Piston (github.com/engineer-man/piston) runs a request in a sandbox it manages
itself. Facts this adapter relies on, from its v2 API:

* `files[]` carries every file and **the first one is the entry point** - the use
  case already put the main file first;
* `compile_timeout` / `run_timeout` (wall time) and `compile_cpu_time` /
  `run_cpu_time` are in milliseconds; a server refuses a value above its own
  configured maximum with HTTP 400, which surfaces here as `run_provider_rejected`
  carrying the server's sentence;
* the reply has a `compile` object for compiled languages only and a `run`
  object; each has `stdout`, `stderr`, `code`, `signal`, and on current servers
  `status` (`TO` timeout, `OL`/`EL` output limit, `RE`, `SG`, `XX`) and
  `wall_time` in ms;
* there is **no way to pass compiler flags**, so `compileArgs` are ignored (and
  the result says so in `warnings`).
* **several files work only for interpreted languages** (checked against a real
  Piston 3 server: python 3.12, node 20): its `gcc` and `java` packages compile
  just the entry file - renamed `main.cpp.cpp` / `Main.java.java` - and keep no
  sub-directories, so `#include "include/calc.h"` or a second class is "not
  found". Those projects are refused up front (`run_multifile_unsupported`)
  instead of failing with a confusing compiler message.

The public instance (emkc.org) restricts access; set `RUN_PISTON_KEY` (sent as
the `Authorization` header) or point `RUN_PISTON_URL` at a server of your own.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

from src.adapter.output.run.common import HttpExecutor, clip_text, to_int
from src.application.exceptions.run_exceptions import RunProviderUnavailable
from src.domain.vo.run_vo import ExecutionRequest, RunResult, StageResult, finish, not_run

#: Canonical language -> the name Piston knows it by (an alias works too).
LANGUAGE_MAP: Dict[str, str] = {
    "c": "c",
    "cpp": "c++",
    "java": "java",
    "python": "python",
    "javascript": "javascript",
    "typescript": "typescript",
    "go": "go",
    "rust": "rust",
    "csharp": "csharp",
    "kotlin": "kotlin",
    "php": "php",
    "ruby": "ruby",
    "bash": "bash",
}


#: Languages whose multi-file projects were verified on a real Piston server (see the module docstring).
MULTI_FILE_LANGUAGES: Tuple[str, ...] = ("python", "javascript")


class PistonExecutor(HttpExecutor):
    id = "piston"
    label = "Piston"

    def languages(self) -> Tuple[str, ...]:
        return self._all_languages(LANGUAGE_MAP)

    def multi_file_languages(self) -> Tuple[str, ...]:
        return tuple(language for language in MULTI_FILE_LANGUAGES if language in self.languages())

    def availability(self) -> Tuple[bool, str]:
        if not self._base:
            return False, "Chưa cấu hình địa chỉ Piston (RUN_PISTON_URL)"
        return True, ""

    # ------------------------------------------------------------- the call
    def _payload(self, request: ExecutionRequest) -> Dict[str, Any]:
        return {
            "language": LANGUAGE_MAP[request.language],
            "version": "*",
            "files": [{"name": file.path, "content": file.content} for file in request.files],
            "stdin": request.stdin,
            "args": list(request.args),
            "compile_timeout": request.compile_timeout_ms,
            "run_timeout": request.run_timeout_ms,
            # Wall time is not the only limit: Piston also caps CPU time.
            "compile_cpu_time": request.compile_timeout_ms,
            "run_cpu_time": request.run_timeout_ms,
        }

    async def execute(self, request: ExecutionRequest) -> RunResult:
        started = time.perf_counter()
        headers = {"Authorization": self._key} if self._key else {}
        response = await self._send("POST", "/execute", request, json_body=self._payload(request), headers=headers)
        elapsed = self._timed(started)
        return self.read_result(self._json(response), request, elapsed)

    # ---------------------------------------------------------- the answer
    def read_result(self, data: Dict[str, Any], request: ExecutionRequest, elapsed_ms: int) -> RunResult:
        raw_compile = data.get("compile")
        raw_run = data.get("run")
        if not isinstance(raw_run, dict) and not isinstance(raw_compile, dict):
            raise RunProviderUnavailable(self.id, "Nhà cung cấp trả về dữ liệu không đúng định dạng.")

        compile_stage: Optional[StageResult] = None
        if isinstance(raw_compile, dict):
            compile_stage = self._stage(raw_compile, elapsed_ms, request.compile_timeout_ms, fallback_ms=0)
        if compile_stage is not None and not compile_stage.ok:
            run_stage = not_run()
        elif isinstance(raw_run, dict):
            run_stage = self._stage(raw_run, elapsed_ms, request.run_timeout_ms, fallback_ms=elapsed_ms)
        else:
            raise RunProviderUnavailable(self.id, "Nhà cung cấp không trả kết quả chạy.")

        warnings = []
        if request.compile_args:
            warnings.append("Piston không nhận cờ biên dịch (compileArgs) nên chúng đã bị bỏ qua.")
        version = data.get("version")
        return finish(
            provider=self.id,
            language=request.language,
            version=version if isinstance(version, str) else "",
            compile=compile_stage,
            run=run_stage,
            warnings=warnings,
        )

    @staticmethod
    def _stage(raw: Dict[str, Any], elapsed_ms: int, timeout_ms: int, *, fallback_ms: int) -> StageResult:
        stdout, cut_out = clip_text(raw.get("stdout"))
        stderr, cut_err = clip_text(raw.get("stderr"))
        status = raw.get("status") or None
        signal = raw.get("signal") or None
        code = to_int(raw.get("code"))
        # Older servers send no `status`: a SIGKILL after (nearly) the whole
        # allowance is what a timeout looks like there.
        timed_out = status == "TO" or (
            status is None and signal == "SIGKILL" and elapsed_ms >= 0.95 * timeout_ms
        )
        wall = raw.get("wall_time")
        ms = int(wall) if isinstance(wall, (int, float)) and not isinstance(wall, bool) else fallback_ms
        return StageResult(
            ran=True,
            ok=code == 0 and signal is None and status is None,
            stdout=stdout,
            stderr=stderr,
            code=code,
            signal=str(signal) if signal else None,
            ms=max(0, ms),
            timedOut=timed_out,
            truncated=cut_out or cut_err or status in ("OL", "EL"),
        )
