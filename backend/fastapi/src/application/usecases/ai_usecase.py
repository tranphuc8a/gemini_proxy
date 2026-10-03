"""The one door to the model: who may ask, how often, how much per day, at what cost.

Every AI feature goes through `AiUseCase.ask`, and the chat (`/gemini/*`) goes
through `admit` + `account`, so the same rules hold everywhere:

* **Kill switch** — `AI_ENABLED=false` stops every Gemini call.
* **Access** (features only; the chat keeps its public access) — `AI_ACCESS`:
  "admin" (default) a course administrator; "code" anyone holding a token issued
  for `AI_ACCESS_CODE`; "public" anyone.
* **Per address** — `AI_RATE_PER_MINUTE` / `AI_RATE_PER_DAY`, in-process like
  the login limits (an administrator is exempt).
* **Per day, for the deployment** — `AI_DAILY_REQUESTS` / `AI_DAILY_TOKENS`,
  counted in the database (one conditional UPDATE, see `AiRepository.reserve`)
  so every serverless instance shares the budget.
* **Accounting** — requests and tokens per UTC day and feature, shown to the
  administrator (`GET /ai/usage`).
* **Cache** — answers that depend only on their inputs (a lesson's flashcards
  at a given revision) are stored, so the second learner costs nothing.

A database outage must not turn into an AI outage: the budget and the books are
then skipped with a logged warning, and the per-address limits still apply.
"""

from __future__ import annotations

import asyncio
import calendar
import hashlib
import hmac
import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, GatewayTimeoutError
from src.application.ports.output.ai_output_port import AiModelOutputPort, AiOutputPort
from src.application.utils import admin_session
from src.application.utils.rate_limit import FailureWindow
from src.domain.models.ai_domain import AiCaller, AiCompletion

logger = logging.getLogger(__name__)

ACCESS_MODES = ("admin", "code", "public")
#: Feature names end up as database keys and in the usage table.
_FEATURE_RE = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
#: Stored answers older than this are asked again.
CACHE_DAYS = 30
#: Namespaces the HMAC of AI tokens (signed with AI_ACCESS_CODE).
CODE_SALT = "ai-code"

_LIMITS: Dict[str, FailureWindow] = {}


def _windows() -> Dict[str, FailureWindow]:
    if not _LIMITS:
        _LIMITS["minute"] = FailureWindow(int(settings.AI_RATE_PER_MINUTE), 60)
        _LIMITS["day"] = FailureWindow(int(settings.AI_RATE_PER_DAY), 86400)
        # Wrong access codes, per address and in all — guessing one stays slow.
        _LIMITS["code"] = FailureWindow(5, 300)
        _LIMITS["code_all"] = FailureWindow(50, 300)
    return _LIMITS


def reset_limits() -> None:
    """Forget every count and re-read the limits from the settings (tests)."""
    _LIMITS.clear()


def access_mode() -> str:
    mode = str(getattr(settings, "AI_ACCESS", "admin") or "admin").strip().lower()
    return mode if mode in ACCESS_MODES else "admin"      # a typo must not open the door


def configured() -> bool:
    return bool(settings.GEMINI_URL) and bool(settings.GEMINI_API_KEY)


def today() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def _seconds_to_utc_midnight() -> int:
    now = time.gmtime()
    midnight = calendar.timegm((now.tm_year, now.tm_mon, now.tm_mday, 0, 0, 0)) + 86400
    return max(1, midnight - int(time.time()))


def cache_key(*parts: Any) -> str:
    """A stable key for an answer that depends only on `parts` (and the model)."""
    raw = json.dumps([settings.AI_MODEL, *parts], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _error(status: int, message: str, code: str, *, headers: Optional[Dict[str, str]] = None,
           **extra: Any) -> AppException:
    return AppException(message=message, status_code=status, code=code, payload={"code": code, **extra},
                        headers=headers)


def generation_config(*, schema: Optional[Dict[str, Any]] = None, temperature: float = 0.5,
                      max_tokens: int = 2048) -> Dict[str, Any]:
    """Gemini `generationConfig`: JSON output when a schema is given.

    Thinking is switched off on 2.5 Flash: these are short, well-specified tasks
    where it adds seconds and output tokens but little else. (Pro cannot turn it
    off, and older models do not know the field.)
    """
    config: Dict[str, Any] = {"temperature": temperature, "maxOutputTokens": max_tokens}
    if schema is not None:
        config["responseMimeType"] = "application/json"
        config["responseSchema"] = schema
    if "2.5-flash" in str(settings.AI_MODEL):
        config["thinkingConfig"] = {"thinkingBudget": 0}
    return config


def text_turn(text: str) -> Dict[str, Any]:
    return {"role": "user", "parts": [{"text": text}]}


# --------------------------------------------------------- AI access tokens

def code_session_valid(token: Optional[str]) -> bool:
    """A token issued for the CURRENT access code: changing the code revokes them all."""
    code = str(getattr(settings, "AI_ACCESS_CODE", "") or "").strip()
    if not token or not code:
        return False
    try:
        admin_session.verify(token, code, salt=CODE_SALT)
        return True
    except admin_session.SessionError:
        return False


def issue_code_session(code: Optional[str], ip: str) -> admin_session.AdminSession:
    """A token for whoever proves they know `AI_ACCESS_CODE` — counted like the admin login."""
    expected = str(getattr(settings, "AI_ACCESS_CODE", "") or "").strip()
    if access_mode() != "code" or not expected:
        raise _error(403, "Máy chủ không dùng mã truy cập AI", "ai_code_disabled")
    windows = _windows()
    wait = windows["code"].retry_after(ip) or windows["code_all"].retry_after("*")
    if wait:
        raise _error(429, f"Nhập sai mã quá nhiều lần — thử lại sau {wait} giây", "too_many_attempts",
                     headers={"Retry-After": str(wait)}, retryAfter=wait)
    provided = (code or "").strip()
    if not provided or not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        windows["code"].add(ip)
        windows["code_all"].add("*")
        raise _error(403, "Mã truy cập AI không đúng", "ai_code_invalid")
    windows["code"].reset(ip)
    return admin_session.issue(expected, salt=CODE_SALT, ttl_seconds=int(settings.AI_SESSION_DAYS) * 86400)


class AiUseCase:
    def __init__(self, store: AiOutputPort, model: AiModelOutputPort):
        self.store = store
        self.model = model

    # ------------------------------------------------------------ access

    @staticmethod
    def may_use(caller: AiCaller) -> bool:
        mode = access_mode()
        if caller.admin or mode == "public":
            return True
        return mode == "code" and caller.code

    @classmethod
    def status(cls, caller: AiCaller) -> Dict[str, Any]:
        """What a page needs to decide how to offer the AI features."""
        mode = access_mode()
        allowed = cls.may_use(caller)
        return {
            "enabled": bool(settings.AI_ENABLED) and configured(),
            "access": mode,
            "allowed": allowed,
            # What would let this caller in: the access code, or an admin login.
            "needs": None if allowed else ("code" if mode == "code" else "admin"),
            "admin": caller.admin,
            "model": settings.AI_MODEL,
            "limits": {"perMinute": int(settings.AI_RATE_PER_MINUTE), "perDay": int(settings.AI_RATE_PER_DAY)},
        }

    @classmethod
    def check_access(cls, caller: AiCaller) -> None:
        if cls.may_use(caller):
            return
        if access_mode() == "code":
            raise _error(403, "Cần mã truy cập AI — nhập mã để dùng tính năng này", "ai_code_required")
        raise _error(403, "Tính năng AI hiện chỉ dành cho quản trị viên", "ai_admin_only")

    # --------------------------------------------------------- admission

    async def admit(self, caller: AiCaller, feature: str) -> None:
        """Let one model call through, or raise: switched off, too fast, or over budget.

        Does NOT check access — the chat has none; `ask` checks it first.
        """
        if not _FEATURE_RE.match(feature or ""):
            raise ValueError(f"Bad AI feature name {feature!r}")
        if not settings.AI_ENABLED:
            raise _error(503, "Tính năng AI đang tắt trên máy chủ này", "ai_disabled")
        if not caller.admin:
            windows = _windows()
            wait = windows["minute"].retry_after(caller.ip) or windows["day"].retry_after(caller.ip)
            if wait:
                raise _error(429, f"Bạn hỏi AI nhanh quá — thử lại sau {wait} giây", "ai_rate_limited",
                             headers={"Retry-After": str(wait)}, retryAfter=wait)
            windows["minute"].add(caller.ip)
            windows["day"].add(caller.ip)
        try:
            admitted = await self.store.reserve(today(), int(settings.AI_DAILY_REQUESTS),
                                                int(settings.AI_DAILY_TOKENS))
        except Exception:                                   # the books are down, the feature is not
            logger.warning("AI budget check skipped: usage store unavailable", exc_info=True)
            return
        if not admitted:
            wait = _seconds_to_utc_midnight()
            raise _error(429, "Hạn mức AI của hôm nay đã dùng hết — quay lại sau 7 giờ sáng (0 giờ UTC)",
                         "ai_budget_exhausted", headers={"Retry-After": str(wait)}, retryAfter=wait)

    async def account(self, feature: str, completion: AiCompletion) -> None:
        if completion.cached:
            return
        try:
            await self.store.record(today(), feature, completion.prompt_tokens, completion.output_tokens)
        except Exception:
            logger.warning("AI usage not recorded: usage store unavailable", exc_info=True)

    # ----------------------------------------------------------- asking

    async def _cached(self, key: str) -> Optional[str]:
        try:
            return await self.store.cache_get(key, int(time.time()) - CACHE_DAYS * 86400)
        except Exception:
            logger.warning("AI cache unavailable", exc_info=True)
            return None

    async def _remember(self, key: str, feature: str, text: str) -> None:
        try:
            await self.store.cache_put(key, feature, text, int(time.time()) - CACHE_DAYS * 86400)
        except Exception:
            logger.warning("AI answer not cached", exc_info=True)

    async def ask(self, caller: AiCaller, feature: str, *, contents: List[Dict[str, Any]],
                  system: Optional[str] = None, config: Optional[Dict[str, Any]] = None,
                  cache: Optional[str] = None,
                  parse: Optional[Callable[[str], Any]] = None) -> Tuple[Any, AiCompletion]:
        """One model call behind every rule above.

        `parse` turns the answer text into the feature's result and raises
        ValueError when the model did not keep to the format; only a parsed
        answer is cached. Returns (result, completion).
        """
        self.check_access(caller)
        if not configured():
            raise _error(503, "Máy chủ chưa cấu hình Gemini (GEMINI_URL, GEMINI_API_KEY)", "ai_unconfigured")
        parse = parse or (lambda text: text)
        if cache:
            stored = await self._cached(cache)
            if stored is not None:
                try:
                    return parse(stored), AiCompletion(text=stored, cached=True)
                except ValueError:
                    logger.warning("Dropping an unreadable cached AI answer for %s", feature)
        await self.admit(caller, feature)
        try:
            completion = await asyncio.wait_for(
                self.model.complete(model=settings.AI_MODEL, contents=contents, system=system,
                                    generation_config=config),
                timeout=float(settings.AI_TIMEOUT_SECONDS))
        except asyncio.TimeoutError as exc:
            raise GatewayTimeoutError("AI trả lời quá lâu — thử lại sau ít phút") from exc
        await self.account(feature, completion)
        if completion.finish_reason == "MAX_TOKENS" and parse is not None and not completion.text.strip():
            raise BadGatewayError("AI trả lời quá dài và bị cắt — thử hỏi ngắn hơn")
        try:
            result = parse(completion.text)
        except ValueError as exc:
            logger.warning("AI answer for %s did not parse: %s", feature, exc)
            raise BadGatewayError("AI trả lời sai định dạng — thử lại") from exc
        if cache and completion.text:
            await self._remember(cache, feature, completion.text)
        return result, completion

    # ------------------------------------------------------------ books

    async def usage(self, days: int = 30) -> Dict[str, Any]:
        days = max(1, min(int(days), 90))
        since = time.strftime("%Y-%m-%d", time.gmtime(time.time() - (days - 1) * 86400))
        rows = await self.store.usage(since)
        total_today = next((r for r in rows if r.day == today() and r.feature == "*"), None)
        return {
            "since": since,
            "today": today(),
            "rows": [r.model_dump() for r in rows],
            "budget": {
                "requests": int(settings.AI_DAILY_REQUESTS),
                "tokens": int(settings.AI_DAILY_TOKENS),
                "requestsUsed": total_today.requests if total_today else 0,
                "tokensUsed": (total_today.prompt_tokens + total_today.output_tokens) if total_today else 0,
            },
            "config": {
                "enabled": bool(settings.AI_ENABLED),
                "configured": configured(),
                "access": access_mode(),
                "codeSet": bool(str(getattr(settings, "AI_ACCESS_CODE", "") or "").strip()),
                "model": settings.AI_MODEL,
                "perMinute": int(settings.AI_RATE_PER_MINUTE),
                "perDay": int(settings.AI_RATE_PER_DAY),
            },
        }


def parse_json(text: str) -> Any:
    """JSON mode answers are JSON; a stray code fence is tolerated."""
    body = (text or "").strip()
    if body.startswith("```"):
        body = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", body)
    try:
        return json.loads(body)
    except ValueError as exc:
        raise ValueError(f"not JSON: {exc}") from exc
