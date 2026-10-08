from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.output.gemini.service.gemini_ai_model import GeminiAiModel
from src.adapter.output.mysql.db.base import get_async_session_dependency
from src.adapter.factory.course_factory import get_course_usecase
from src.adapter.factory.mongo_admin_factory import get_mongo_admin_input_port
from src.adapter.factory.sql_admin_factory import get_sql_admin_input_port
from src.adapter.output.mysql.repositories.ai_repository import AiRepository
from src.adapter.output.web.safe_web_fetcher import SafeWebFetcher
from src.application.ports.input.mongo_admin_input_port import MongoAdminInputPort
from src.application.ports.input.sql_admin_input_port import SqlAdminInputPort
from src.application.usecases.ai_chat_usecase import AiChatUseCase
from src.application.usecases.ai_course_usecase import AiCourseUseCase
from src.application.usecases.ai_draft_usecase import AiDraftUseCase
from src.application.usecases.ai_http_usecase import AiHttpUseCase
from src.application.usecases.ai_query_usecase import AiQueryUseCase
from src.application.usecases.ai_speaking_usecase import AiSpeakingUseCase
from src.application.usecases.ai_spending_usecase import AiSpendingUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.application.usecases.course_usecase import CourseUseCase


def get_ai_usecase(db: AsyncSession = Depends(get_async_session_dependency)) -> AiUseCase:
    """One use case per request, bound to that request's session."""
    return AiUseCase(AiRepository(db), GeminiAiModel())


def get_ai_course_usecase(ai: AiUseCase = Depends(get_ai_usecase),
                          courses: CourseUseCase = Depends(get_course_usecase)) -> AiCourseUseCase:
    """Both share the request's session (FastAPI resolves the dependency once)."""
    return AiCourseUseCase(ai, courses)


def get_ai_draft_usecase(ai: AiUseCase = Depends(get_ai_usecase)) -> AiDraftUseCase:
    return AiDraftUseCase(ai, SafeWebFetcher())


def get_ai_speaking_usecase(ai: AiUseCase = Depends(get_ai_usecase)) -> AiSpeakingUseCase:
    return AiSpeakingUseCase(ai)


def get_ai_query_usecase(ai: AiUseCase = Depends(get_ai_usecase),
                         sql: SqlAdminInputPort = Depends(get_sql_admin_input_port),
                         mongo: MongoAdminInputPort = Depends(get_mongo_admin_input_port)) -> AiQueryUseCase:
    """The administrator apps' own process-wide sessions, so their tokens work here."""
    return AiQueryUseCase(ai, sql, mongo)


def get_ai_http_usecase(ai: AiUseCase = Depends(get_ai_usecase)) -> AiHttpUseCase:
    return AiHttpUseCase(ai)


def get_ai_chat_usecase(ai: AiUseCase = Depends(get_ai_usecase)) -> AiChatUseCase:
    return AiChatUseCase(ai)


def get_ai_spending_usecase(ai: AiUseCase = Depends(get_ai_usecase)) -> AiSpendingUseCase:
    return AiSpendingUseCase(ai)
