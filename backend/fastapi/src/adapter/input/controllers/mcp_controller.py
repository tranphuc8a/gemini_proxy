"""Authenticated MCP Streamable HTTP endpoint exposing LiteLLM models as tools."""

from __future__ import annotations

import json
from typing import Any, Dict
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response

from src.adapter.factory.litellm_factory import get_litellm_user_ai, get_litellm_user_caller
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller

router = APIRouter(tags=["mcp"])
MCP_VERSION = "2025-06-18"
MAX_BODY_BYTES = 128_000
_TOOLS = [
    {
        "name": "list_models",
        "description": "List the models allowed for this LiteLLM virtual key.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "chat",
        "description": "Send a prompt to an allowed LiteLLM model.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "model": {"type": "string", "description": "An allowed LiteLLM model alias."},
                "prompt": {"type": "string", "description": "The user prompt; maximum 12,000 characters."},
            },
            "required": ["model", "prompt"],
            "additionalProperties": False,
        },
    },
]


def _origin_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return True
    parsed = urlsplit(origin)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    configured = str(settings.FRONTEND_ALLOWED_ORIGINS or "*").strip()
    allowed = {item.strip().rstrip("/") for item in configured.split(",") if item.strip() and item.strip() != "*"}
    if configured != "*" and origin.rstrip("/") in allowed:
        return True
    expected_origin = f"{request.url.scheme}://{request.headers.get('host', '').lower()}"
    return origin.rstrip("/").lower() == expected_origin.lower()


def _rpc_error(request_id: Any, code: int, message: str) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


@router.get("/mcp", summary="MCP Streamable HTTP endpoint (server-initiated SSE is not enabled)")
async def mcp_get(request: Request):
    if not _origin_allowed(request):
        return Response(status_code=403, headers={"Cache-Control": "no-store"})
    return Response(status_code=405, headers={"Allow": "POST", "Cache-Control": "no-store"})


@router.post("/mcp", summary="MCP Streamable HTTP: list_models and chat tools")
async def mcp_post(request: Request, uc: AiUseCase = Depends(get_litellm_user_ai),
                   caller: AiCaller = Depends(get_litellm_user_caller)):
    if not _origin_allowed(request):
        return Response(status_code=403, headers={"Cache-Control": "no-store"})
    accept = request.headers.get("accept", "")
    if "application/json" not in accept or "text/event-stream" not in accept:
        return Response(status_code=406, headers={"Cache-Control": "no-store"})
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdecimal() and int(content_length) > MAX_BODY_BYTES:
        return Response(status_code=413, headers={"Cache-Control": "no-store"})
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > MAX_BODY_BYTES:
            return Response(status_code=413, headers={"Cache-Control": "no-store"})
        raw.extend(chunk)
    try:
        message = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JSONResponse(_rpc_error(None, -32700, "Parse error"), status_code=400,
                            headers={"Cache-Control": "no-store"})
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        return JSONResponse(_rpc_error(message.get("id") if isinstance(message, dict) else None,
                                       -32600, "Invalid Request"), status_code=400,
                            headers={"Cache-Control": "no-store"})
    request_id = message.get("id")
    if request_id is None:
        return Response(status_code=202, headers={"Cache-Control": "no-store"})

    method = message["method"]
    params = message.get("params") if isinstance(message.get("params"), dict) else {}
    try:
        if method == "initialize":
            result = {
                "protocolVersion": MCP_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "gemini-proxy-litellm", "version": "1.0.0"},
            }
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": _TOOLS}
        elif method == "tools/call":
            result = await _call_tool(params, uc, caller)
        else:
            return JSONResponse(_rpc_error(request_id, -32601, "Method not found"),
                                headers={"Cache-Control": "no-store"})
        response = {"jsonrpc": "2.0", "id": request_id, "result": result}
    except AppException as exc:
        response = _rpc_error(request_id, -32000, exc.message)
    except (TypeError, ValueError) as exc:
        response = _rpc_error(request_id, -32602, str(exc))
    return JSONResponse(response, headers={"Cache-Control": "no-store"})


async def _call_tool(params: Dict[str, Any], uc: AiUseCase, caller: AiCaller) -> Dict[str, Any]:
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        raise ValueError("Tool arguments must be an object")
    if name == "list_models":
        models = await uc.model.list_models()
        text = json.dumps(models, ensure_ascii=False)
        return {"content": [{"type": "text", "text": text}], "structuredContent": {"models": models}}
    if name != "chat":
        raise ValueError(f"Unknown tool: {name}")
    model = arguments.get("model")
    prompt = arguments.get("prompt")
    if not isinstance(model, str) or not model.strip() or len(model) > 128 or not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("chat requires a model and a non-empty prompt")
    if len(prompt) > 12_000:
        raise ValueError("prompt exceeds 12,000 characters")
    if not settings.AI_ENABLED:
        raise AppException(message="Tính năng AI đang tắt trên máy chủ này", status_code=503,
                           code="ai_disabled", payload={"code": "ai_disabled"})
    answer, completion = await uc.ask(caller, "mcp", contents=[{"role": "user", "parts": [{"text": prompt}]}],
                                      model=model, provider_authenticated=True)
    return {
        "content": [{"type": "text", "text": str(answer)}],
        "structuredContent": {"text": answer, "model": model,
                              "usage": {"promptTokens": completion.prompt_tokens,
                                        "completionTokens": completion.output_tokens}},
    }
