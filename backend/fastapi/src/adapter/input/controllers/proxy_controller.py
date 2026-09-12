"""HTTP forward proxy for the postman-lite web app.

See `http_proxy_usecase` for why a browser-based API client needs this at all.
"""

from __future__ import annotations

from fastapi import APIRouter

from src.adapter.input.controllers.response_utils import success_response
from src.application.config.config import settings
from src.application.usecases import http_proxy_usecase
from src.domain.vo.proxy_vo import ProxyRequest

router = APIRouter(prefix="/proxy", tags=["proxy"])


@router.get("/status", summary="Whether request forwarding is available")
async def proxy_status():
    """Let the client decide up front whether to offer the proxy send mode."""
    return success_response(
        data={
            "enabled": bool(getattr(settings, "PROXY_ENABLED", True)),
            "allowed_hosts": getattr(settings, "PROXY_ALLOWED_HOSTS", "*"),
            "max_bytes": int(getattr(settings, "PROXY_MAX_BYTES", 10 * 1024 * 1024)),
            "timeout_seconds": float(getattr(settings, "PROXY_TIMEOUT_SECONDS", 60)),
        },
        message="OK",
    )


@router.post("/request", summary="Forward one HTTP request and return the response")
async def forward_request(request: ProxyRequest):
    result = await http_proxy_usecase.forward(request)
    return success_response(data=result, message="OK")
