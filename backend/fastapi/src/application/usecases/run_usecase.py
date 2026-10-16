"""`/run`: validate a request, pick the provider the user chose, run it there.

The rules that live here and nowhere else:

1. **The client names a provider by id, never by URL.** The providers are built
   from the server's configuration; a request that could carry an address would
   make the backend a way to reach arbitrary hosts (SSRF).
2. **Nothing reaches a provider unchecked.** File names are normalised (no `..`,
   no absolute path, a safe alphabet), sizes are counted in bytes, and compiler
   flags must match an allow-list (`application/utils/compile_flags`).
3. **Executing code on the server's own machine needs an administrator.** A
   provider with `needs_session` is refused to anyone else.
4. **One address, a limited number of runs per minute** (administrators exempt,
   as with the AI features). Counted by a `RateLimiterPort`: shared between
   instances when the deployment configured a persistent counter, else in the
   instance's memory (slows abuse rather than ending it).
5. **The user's code failing is an answer, not an error.** Providers return
   `ok: false` results; only a broken provider raises.
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional

from src.application.exceptions.exceptions import AppException, BadRequestError
from src.application.ports.input.run_input_port import RunInputPort
from src.application.ports.output.code_executor_port import CodeExecutorPort
from src.application.utils.compile_flags import BadFlag, check_compile_args
from src.application.utils.rate_limiter import LimiterLike, MemoryRateLimiter, as_rate_limiter
from src.application.utils.safe_paths import find_path_conflict, normalize_run_path
from src.domain.utils.run_languages import LANGUAGES, canonical_language, pick_main_file, source_files
from src.domain.vo.run_vo import (
    DEFAULT_COMPILE_TIMEOUT_MS,
    DEFAULT_RUN_TIMEOUT_MS,
    MAX_COMPILE_TIMEOUT_MS,
    MAX_FILE_BYTES,
    MAX_RUN_TIMEOUT_MS,
    MAX_STDIN_BYTES,
    MAX_TOTAL_BYTES,
    MIN_TIMEOUT_MS,
    ExecutionRequest,
    RunCaller,
    RunRequestIn,
    RunResult,
    SourceFile,
)

DISABLED_REASON = "Tính năng chạy mã đang tắt trên máy chủ này (RUN_ENABLED=false)"


def _bad(message: str, code: str, **extra: Any) -> BadRequestError:
    return BadRequestError(message, payload={"code": code, **extra})


def _clamp(value: Optional[int], default: int, ceiling: int) -> int:
    if value is None:
        return default
    return max(MIN_TIMEOUT_MS, min(int(value), ceiling))


class RunUseCase(RunInputPort):
    def __init__(
        self,
        executors: Mapping[str, CodeExecutorPort],
        *,
        enabled: bool = True,
        default_provider: str = "piston",
        rate_per_minute: int = 20,
        limiter: Optional[LimiterLike] = None,
    ):
        self._executors: Dict[str, CodeExecutorPort] = dict(executors)
        self._enabled = enabled
        self._default = (default_provider or "").strip().lower()
        self._limiter = as_rate_limiter(limiter) or MemoryRateLimiter(max(1, int(rate_per_minute)), 60)

    # ------------------------------------------------------------ providers
    def _status(self, executor: CodeExecutorPort) -> tuple[bool, str]:
        if not self._enabled:
            return False, DISABLED_REASON
        return executor.availability()

    def _default_id(self) -> str:
        """The configured default when it works, else the first one that does."""
        configured = self._executors.get(self._default)
        if configured is not None and self._status(configured)[0]:
            return configured.id
        for executor in self._executors.values():
            if self._status(executor)[0]:
                return executor.id
        return self._default or next(iter(self._executors), "")

    def providers(self) -> Dict[str, Any]:
        rows: List[Dict[str, Any]] = []
        for executor in self._executors.values():
            available, reason = self._status(executor)
            supported = set(executor.languages())
            multi = set(executor.multi_file_languages())
            rows.append({
                "id": executor.id,
                "label": executor.label,
                "kind": executor.kind,
                "available": available,
                "reason": "" if available else reason,
                "languages": [language for language in LANGUAGES if language in supported],
                "multiFile": bool(multi),
                "multiFileLanguages": [language for language in LANGUAGES if language in multi],
                "needsSession": bool(executor.needs_session),
            })
        return {"providers": rows, "default": self._default_id()}

    # ------------------------------------------------------------------ run
    async def _admit(self, caller: RunCaller) -> None:
        if caller.admin:
            return
        wait = await self._limiter.retry_after(caller.ip)
        if wait:
            raise AppException(
                message=f"Bạn chạy mã nhanh quá — thử lại sau {wait} giây",
                status_code=429,
                code="run_rate_limited",
                payload={"code": "run_rate_limited", "retryAfter": wait},
                headers={"Retry-After": str(wait)},
            )
        await self._limiter.add(caller.ip)

    def _prepare(self, body: RunRequestIn, executor: CodeExecutorPort, language: str) -> ExecutionRequest:
        # --- files
        names: List[str] = []
        for file in body.files:
            try:
                names.append(normalize_run_path(file.name))
            except ValueError as cause:
                raise _bad(str(cause), "run_bad_file") from cause
        conflict = find_path_conflict(names)
        if conflict:
            raise _bad(conflict, "run_bad_file")

        total = 0
        for name, file in zip(names, body.files):
            size = len(file.content.encode("utf-8"))
            if size > MAX_FILE_BYTES:
                raise _bad(f"Tệp {name!r} quá lớn ({size} byte, tối đa {MAX_FILE_BYTES})", "run_too_large")
            total += size
        if total > MAX_TOTAL_BYTES:
            raise _bad(f"Tổng dung lượng mã quá lớn ({total} byte, tối đa {MAX_TOTAL_BYTES})", "run_too_large")
        if len(body.stdin.encode("utf-8")) > MAX_STDIN_BYTES:
            raise _bad(f"Dữ liệu stdin quá lớn (tối đa {MAX_STDIN_BYTES} byte)", "run_too_large")

        # --- arguments
        for arg in body.args:
            if "\x00" in arg:
                raise _bad("Tham số chương trình không được chứa ký tự NUL", "run_bad_arg")
        try:
            compile_args = check_compile_args(body.compileArgs)
        except BadFlag as cause:
            flag = cause.args[0]
            raise _bad(
                f"Cờ biên dịch không được phép: {flag!r}. Chỉ nhận -std=…, -O0..-O3, -Wall, -Wextra, "
                "-D<TÊN>[=giá trị], -I<thư mục tương đối>…",
                "run_bad_flag",
                flag=flag,
            ) from cause

        # --- entry point
        requested: Optional[str] = None
        if body.mainFile:
            try:
                requested = normalize_run_path(body.mainFile)
            except ValueError as cause:
                raise _bad(str(cause), "run_bad_file") from cause
        if LANGUAGES[language].compiled and not source_files(language, names):
            extensions = "/".join(LANGUAGES[language].extensions)
            raise _bad(f"Không có tệp mã nguồn {extensions} nào để biên dịch", "run_no_source")
        try:
            main = pick_main_file(language, names, requested)
        except ValueError as cause:
            raise _bad(str(cause), "run_bad_file") from cause

        if len(names) > 1 and language not in executor.multi_file_languages():
            raise _bad(
                f"Nhà cung cấp '{executor.id}' chưa hỗ trợ nhiều tệp cho {LANGUAGES[language].label}",
                "run_multifile_unsupported",
            )

        contents = dict(zip(names, (file.content for file in body.files)))
        ordered = [main] + [name for name in names if name != main]
        return ExecutionRequest(
            language=language,
            files=tuple(SourceFile(path=name, content=contents[name]) for name in ordered),
            main_file=main,
            stdin=body.stdin,
            args=tuple(body.args),
            compile_args=tuple(compile_args),
            run_timeout_ms=_clamp(body.runTimeoutMs, DEFAULT_RUN_TIMEOUT_MS, MAX_RUN_TIMEOUT_MS),
            compile_timeout_ms=_clamp(body.compileTimeoutMs, DEFAULT_COMPILE_TIMEOUT_MS, MAX_COMPILE_TIMEOUT_MS),
        )

    async def run(self, body: RunRequestIn, caller: RunCaller) -> RunResult:
        if not self._enabled:
            raise AppException(DISABLED_REASON, status_code=503, code="run_disabled",
                               payload={"code": "run_disabled"})
        await self._admit(caller)

        executor = self._executors.get(body.provider.strip().lower())
        if executor is None:
            raise _bad(f"Không có nhà cung cấp chạy mã '{body.provider}'", "run_unknown_provider")
        available, reason = executor.availability()
        if not available:
            raise AppException(reason or f"Nhà cung cấp '{executor.id}' chưa sẵn sàng", status_code=503,
                               code="run_provider_disabled",
                               payload={"code": "run_provider_disabled", "provider": executor.id})
        if executor.needs_session and not caller.admin:
            raise AppException(
                "Chạy mã bằng chương trình cài trên máy chủ cần phiên quản trị — hãy đăng nhập quản trị rồi thử lại",
                status_code=403, code="admin_required",
                payload={"code": "admin_required", "provider": executor.id},
            )

        language = canonical_language(body.language)
        if language is None:
            raise _bad(f"Ngôn ngữ '{body.language}' chưa được hỗ trợ", "run_language_unsupported")
        if language not in executor.languages():
            raise _bad(
                f"Nhà cung cấp '{executor.id}' không chạy được {LANGUAGES[language].label}",
                "run_language_unsupported",
                language=language,
            )

        request = self._prepare(body, executor, language)
        return await executor.execute(request)
