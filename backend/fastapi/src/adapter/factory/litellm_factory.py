from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.input.controllers.admin_auth import client_address
from src.adapter.output.litellm.litellm_adapter import LiteLLMClient, LiteLLMAiModel
from src.adapter.output.mysql.db.base import get_async_session_dependency
from src.adapter.output.mysql.repositories.ai_repository import AiRepository
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller


def _bearer_key(authorization: str | None) -> str:
    scheme, separator, token = (authorization or "").partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise AppException(message="Cần LiteLLM virtual key trong Authorization: Bearer", status_code=401,
                           code="litellm_key_required", payload={"code": "litellm_key_required"})
    return token.strip()


def get_litellm_user_ai(
    authorization: str | None = Header(default=None, max_length=2048),
    db: AsyncSession = Depends(get_async_session_dependency),
) -> AiUseCase:
    if not settings.LITELLM_API_BASE:
        raise AppException(message="LiteLLM chưa được cấu hình", status_code=503,
                           code="ai_unconfigured", payload={"code": "ai_unconfigured"})
    api_key = _bearer_key(authorization)
    model = LiteLLMAiModel(api_key=api_key)
    return AiUseCase(AiRepository(db), model)


def get_litellm_user_caller(request: Request) -> AiCaller:
    return AiCaller(ip=client_address(request))


def get_litellm_admin_client() -> LiteLLMClient:
    if not settings.LITELLM_API_BASE or not settings.LITELLM_MASTER_KEY:
        raise AppException(message="LiteLLM chưa được cấu hình đầy đủ", status_code=503,
                           code="ai_unconfigured", payload={"code": "ai_unconfigured"})
    return LiteLLMClient(timeout=float(settings.AI_TIMEOUT_SECONDS))
