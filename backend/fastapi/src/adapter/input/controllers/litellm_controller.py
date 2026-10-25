"""LiteLLM user-key endpoints and administrator virtual-key issuing."""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.adapter.factory.litellm_factory import get_litellm_admin_client, get_litellm_user_ai
from src.adapter.input.controllers.admin_auth import require_admin
from src.adapter.output.litellm.litellm_adapter import LiteLLMClient, LiteLLMClientError
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadRequestError, BadGatewayError
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from src.adapter.factory.litellm_factory import get_litellm_user_caller

router = APIRouter(prefix="/litellm", tags=["litellm"])
NO_STORE = {"Cache-Control": "no-store"}


def _raise_client_error(exc: LiteLLMClientError) -> None:
    if exc.status_code in (401, 403):
        raise AppException(message="LiteLLM virtual key không hợp lệ hoặc không được phép",
                           status_code=exc.status_code, code="litellm_key_rejected",
                           payload={"code": "litellm_key_rejected"}) from exc
    raise BadGatewayError(f"LiteLLM proxy error: {exc}") from exc


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=12_000)


class ChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=128)
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def validate_total_text(self):
        if not any(message.role in ("user", "assistant") for message in self.messages):
            raise ValueError("messages must include a user or assistant turn")
        if sum(len(message.content) for message in self.messages) > 60_000:
            raise ValueError("Tin nhắn vượt quá 60.000 ký tự")
        return self


class CreateVirtualKey(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    alias: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9 _.-]*$")
    models: List[Annotated[str, Field(min_length=1, max_length=128)]] = Field(min_length=1, max_length=30)
    duration: Literal["1d", "7d", "30d", "90d"] = "30d"
    max_budget: Optional[float] = Field(default=None, alias="maxBudget", gt=0, le=100_000)

    @model_validator(mode="after")
    def validate_models(self):
        if len(set(self.models)) != len(self.models):
            raise ValueError("Không chọn trùng model")
        return self


@router.get("/models", summary="Models allowed for the caller's LiteLLM virtual key")
async def user_models(uc: AiUseCase = Depends(get_litellm_user_ai)):
    return JSONResponse({"models": await uc.model.list_models()}, headers=NO_STORE)


@router.post("/chat", summary="Chat through LiteLLM using the caller's own virtual key")
async def user_chat(body: ChatRequest,
                    uc: AiUseCase = Depends(get_litellm_user_ai),
                    caller: AiCaller = Depends(get_litellm_user_caller)):
    if not settings.AI_ENABLED:
        raise AppException(message="Tính năng AI đang tắt trên máy chủ này", status_code=503,
                           code="ai_disabled", payload={"code": "ai_disabled"})
    system = "\n\n".join(message.content for message in body.messages if message.role == "system") or None
    contents = [
        {"role": "model" if message.role == "assistant" else "user", "parts": [{"text": message.content}]}
        for message in body.messages if message.role != "system"
    ]
    result, completion = await uc.ask(caller, "litellm_chat", contents=contents, system=system,
                                      model=body.model, provider_authenticated=True)
    return JSONResponse({"text": result, "usage": {
        "promptTokens": completion.prompt_tokens, "completionTokens": completion.output_tokens,
    }}, headers=NO_STORE)


@router.get("/admin/models", dependencies=[Depends(require_admin)],
            summary="List proxy models for issuing scoped virtual keys")
async def admin_models(client: LiteLLMClient = Depends(get_litellm_admin_client)):
    try:
        return JSONResponse({"models": await client.list_models()}, headers=NO_STORE)
    except LiteLLMClientError as exc:
        _raise_client_error(exc)


@router.post("/admin/keys", dependencies=[Depends(require_admin)],
             summary="Issue a LiteLLM virtual key restricted to selected models")
async def create_virtual_key(body: CreateVirtualKey,
                             client: LiteLLMClient = Depends(get_litellm_admin_client)):
    try:
        available = {str(item.get("id") or "") for item in await client.list_models()}
        if any(model not in available for model in body.models):
            raise BadRequestError("Chỉ chọn model đang được cấu hình trên LiteLLM",
                                  payload={"code": "litellm_model_invalid"})
        payload = {
            "key_alias": body.alias,
            "models": body.models,
            "duration": body.duration,
        }
        if body.max_budget is not None:
            payload["max_budget"] = body.max_budget
        created = await client.management_request("key/generate", payload)
    except LiteLLMClientError as exc:
        _raise_client_error(exc)

    key = created.get("key")
    if not isinstance(key, str) or not key:
        raise BadGatewayError("LiteLLM did not return the newly created key")
    return JSONResponse({
        "key": key,
        "alias": body.alias,
        "models": body.models,
        "duration": body.duration,
        "maxBudget": body.max_budget,
        "warning": "Khóa chỉ được hiển thị một lần. Hãy sao chép và gửi an toàn cho người dùng.",
    }, status_code=201, headers=NO_STORE)
