"""Errors of the `/run` providers: the PROVIDER is broken, not the user's code.

A program that fails to compile or exits non-zero is an ordinary `ok: false`
answer. These three are for the cases where no answer about the program could be
obtained, and each carries a `data.code` the page reacts to:

* `run_provider_unavailable` (502) - unreachable, 5xx, or an unusable reply;
* `run_provider_timeout` (504) - did not answer in time;
* `run_provider_rejected` (502) - answered, but refused the request (a bad key,
  a rate limit, an unknown runtime).

Messages are for people and in Vietnamese. They never contain the provider's URL
or key: `payload["detail"]` holds the provider's own words only after those were
scrubbed out (see `adapter/output/run/common.py`).
"""

from __future__ import annotations

from typing import Optional

from src.application.exceptions.exceptions import AppException


def _payload(code: str, provider: str, detail: str = "", retry_after: Optional[int] = None) -> dict:
    payload: dict = {"code": code, "provider": provider}
    if detail:
        payload["detail"] = detail
    if retry_after:
        payload["retryAfter"] = retry_after
    return payload


class RunProviderUnavailable(AppException):
    def __init__(self, provider: str, message: str = "", detail: str = ""):
        super().__init__(
            message=message or f"Nhà cung cấp '{provider}' hiện không phản hồi — hãy thử nhà cung cấp khác.",
            status_code=502,
            code="run_provider_unavailable",
            payload=_payload("run_provider_unavailable", provider, detail),
        )


class RunProviderTimeout(AppException):
    def __init__(self, provider: str, message: str = ""):
        super().__init__(
            message=message or f"Nhà cung cấp '{provider}' trả lời quá chậm — hãy thử lại hoặc chọn nhà cung cấp khác.",
            status_code=504,
            code="run_provider_timeout",
            payload=_payload("run_provider_timeout", provider),
        )


class RunProviderRejected(AppException):
    def __init__(self, provider: str, message: str = "", detail: str = "", retry_after: Optional[int] = None):
        super().__init__(
            message=message or f"Nhà cung cấp '{provider}' từ chối yêu cầu.",
            status_code=502,
            code="run_provider_rejected",
            payload=_payload("run_provider_rejected", provider, detail, retry_after),
        )
