"""Value objects of the `/run` feature: run source code through a chosen provider.

Three shapes live here:

* `RunRequestIn` - the HTTP body, with a hard length on every string so a huge
  body is refused before any code looks at it.
* `ExecutionRequest` - what the use case hands to a provider after validation:
  names normalised, the main file chosen and put first, flags vetted.
* `RunResult` / `StageResult` - the answer. A failure of the USER's code
  (compile error, non-zero exit, timeout) is an ordinary `ok: false` result, not
  an HTTP error; only a broken provider is an error.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, List, Optional, Tuple

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- size limits
MAX_FILES = 64
MAX_FILE_BYTES = 128 * 1024
MAX_TOTAL_BYTES = 256 * 1024
MAX_STDIN_BYTES = 64 * 1024
MAX_ARGS = 16
MAX_ARG_CHARS = 200
#: One captured stream (stdout or stderr) is cut here and flagged `truncated`.
MAX_OUTPUT_BYTES = 1024 * 1024

DEFAULT_RUN_TIMEOUT_MS = 5000
MAX_RUN_TIMEOUT_MS = 15000
MIN_TIMEOUT_MS = 100
DEFAULT_COMPILE_TIMEOUT_MS = 15000
MAX_COMPILE_TIMEOUT_MS = 30000

Argument = Annotated[str, Field(max_length=MAX_ARG_CHARS)]


class RunFileIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    # Characters here; the byte limits (a character can be four bytes) are
    # checked by the use case.
    content: str = Field(default="", max_length=MAX_FILE_BYTES)


class RunRequestIn(BaseModel):
    provider: str = Field(..., min_length=1, max_length=32)
    language: str = Field(..., min_length=1, max_length=32)
    files: List[RunFileIn] = Field(..., min_length=1, max_length=MAX_FILES)
    mainFile: Optional[str] = Field(default=None, max_length=200)
    stdin: str = Field(default="", max_length=MAX_STDIN_BYTES)
    args: List[Argument] = Field(default_factory=list, max_length=MAX_ARGS)
    compileArgs: List[Argument] = Field(default_factory=list, max_length=MAX_ARGS)
    # Above the ceiling is clamped, not refused: the page may remember a value
    # chosen against another provider.
    runTimeoutMs: Optional[int] = Field(default=None, ge=1)
    compileTimeoutMs: Optional[int] = Field(default=None, ge=1)


@dataclass(frozen=True)
class SourceFile:
    path: str
    content: str


@dataclass(frozen=True)
class ExecutionRequest:
    """A validated request. `files[0]` is the main file."""

    language: str
    files: Tuple[SourceFile, ...]
    main_file: str
    stdin: str = ""
    args: Tuple[str, ...] = ()
    compile_args: Tuple[str, ...] = ()
    run_timeout_ms: int = DEFAULT_RUN_TIMEOUT_MS
    compile_timeout_ms: int = DEFAULT_COMPILE_TIMEOUT_MS


@dataclass(frozen=True)
class RunCaller:
    ip: str
    admin: bool = False


class StageResult(BaseModel):
    """One stage (compile or run). `ran=False` means it was never started."""

    ran: bool = False
    ok: bool = False
    stdout: str = ""
    stderr: str = ""
    code: Optional[int] = None
    signal: Optional[str] = None
    ms: int = 0
    timedOut: bool = False
    truncated: bool = False


class RunErrorInfo(BaseModel):
    code: str
    message: str


class RunResult(BaseModel):
    ok: bool
    provider: str
    language: str
    version: str = ""
    # null for an interpreted language.
    compile: Optional[StageResult] = None
    run: StageResult
    # null when `ok`; otherwise why: compile_error, compile_timeout,
    # run_timeout or runtime_error. Provider trouble is an HTTP error instead.
    error: Optional[RunErrorInfo] = None
    # Things the provider could not honour (e.g. compileArgs), in Vietnamese.
    warnings: List[str] = Field(default_factory=list)


def not_run() -> StageResult:
    """The run stage of a request whose compilation failed."""
    return StageResult(ran=False, ok=False)


def finish(
    *,
    provider: str,
    language: str,
    version: str,
    compile: Optional[StageResult],
    run: StageResult,
    warnings: Optional[List[str]] = None,
) -> RunResult:
    """Assemble a result and derive `ok` / `error` from the two stages.

    Every adapter ends here, so "what counts as success" is decided once.
    """
    error: Optional[RunErrorInfo] = None
    if compile is not None and compile.ran and not compile.ok:
        if compile.timedOut:
            error = RunErrorInfo(code="compile_timeout", message="Biên dịch quá thời gian cho phép")
        else:
            error = RunErrorInfo(code="compile_error", message="Biên dịch thất bại")
    elif run.ran and not run.ok:
        if run.timedOut:
            error = RunErrorInfo(code="run_timeout", message="Chương trình chạy quá thời gian cho phép")
        else:
            error = RunErrorInfo(code="runtime_error", message="Chương trình kết thúc với lỗi")
    ok = error is None and run.ran
    if not ok and error is None:
        error = RunErrorInfo(code="runtime_error", message="Chương trình không chạy được")
    return RunResult(
        ok=ok,
        provider=provider,
        language=language,
        version=version,
        compile=compile,
        run=run,
        error=error,
        warnings=list(warnings or []),
    )
