

from typing import Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.application.ports.input.health_input_port import HealthInputPort
from src.application.usecases.health_usecase import HealthUsecase
from src.adapter.output.mysql.db.base import get_async_session_dependency
from src.adapter.output.mysql.repositories.conversation_repository import ConversationRepository
from src.adapter.output.mysql.repositories.message_repository import MessageRepository
from src.application.ports.input.conversation_input_port import ConversationInputPort
from src.application.ports.output.conversation_output_port import ConversationOutputPort
from src.application.ports.output.message_output_port import MessageOutputPort
from src.application.usecases.conversation_usecase import ConversationUseCase
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.adapter.output.gemini.helper.gemini_client import GeminiClient
from src.adapter.output.gemini.service.gemini_service import GeminiService
from src.application.usecases.gemini_usecase import GeminiUseCase


def _make_repos_and_ports(db: AsyncSession) -> tuple[ConversationOutputPort, MessageOutputPort, ConversationInputPort, HealthInputPort]:
    """Create DB-backed repositories and usecases using provided session."""
    conv_repo: ConversationOutputPort = ConversationRepository(db)
    msg_repo: MessageOutputPort = MessageRepository(db)
    conv_input: ConversationInputPort = ConversationUseCase(conv_repo, msg_repo)
    health_input: HealthInputPort = HealthUsecase([conv_repo, msg_repo])
    return conv_repo, msg_repo, conv_input, health_input


def _make_gemini_input_port(msg_repo: MessageOutputPort, conv_repo: ConversationOutputPort) -> GeminiInputPort:
    """Create Gemini input port with provided repositories."""
    client = GeminiClient()
    svc = GeminiService(client)
    return GeminiUseCase(svc, msg_repo, conv_repo)

class ServiceFactory:
    """Factory for creating services with proper dependency injection."""
    
    @staticmethod
    def get_conversation_input_port(
        db: AsyncSession = Depends(get_async_session_dependency)
    ) -> ConversationInputPort:
        _, _, conv_input, _ = _make_repos_and_ports(db)
        return conv_input
    
    @staticmethod
    def get_conversation_output_port(
        db: AsyncSession = Depends(get_async_session_dependency)
    ) -> ConversationOutputPort:
        conv_repo, _, _, _ = _make_repos_and_ports(db)
        return conv_repo

    @staticmethod
    def get_message_output_port(
        db: AsyncSession = Depends(get_async_session_dependency)
    ) -> MessageOutputPort:
        _, msg_repo, _, _ = _make_repos_and_ports(db)
        return msg_repo

    @staticmethod
    def get_health_input_port(
        db: AsyncSession = Depends(get_async_session_dependency)
    ) -> HealthInputPort:
        _, _, _, health_input = _make_repos_and_ports(db)
        return health_input

    @staticmethod
    def get_gemini_input_port(
        db: AsyncSession = Depends(get_async_session_dependency)
    ) -> GeminiInputPort:
        conv_repo, msg_repo, _, _ = _make_repos_and_ports(db)
        return _make_gemini_input_port(msg_repo, conv_repo)