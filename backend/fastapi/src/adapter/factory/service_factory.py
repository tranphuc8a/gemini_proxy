

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.application.ports.input.health_input_port import HealthInputPort
from src.application.usecases.health_usecase import HealthUsecase
from src.adapter.output.mysql.db.base import get_async_session
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


db: AsyncSession = get_async_session()
default_conversation_output_port: ConversationOutputPort = ConversationRepository(db)
default_message_output_port: MessageOutputPort = MessageRepository(db)
default_conversation_input_port: ConversationInputPort = ConversationUseCase(default_conversation_output_port, default_message_output_port)
# default_message_input_port: MessageInputPort = MessageUsecase(default_conversation_output_port)
default_health_input_port: HealthInputPort = HealthUsecase([default_conversation_output_port, default_message_output_port])

# Gemini wiring (client -> output port/service -> input usecase)
_default_gemini_client = GeminiClient()
_default_gemini_output_port = GeminiService(_default_gemini_client)
default_gemini_input_port: GeminiInputPort = GeminiUseCase(_default_gemini_output_port, default_message_output_port, default_conversation_output_port)

class ServiceFactory:
    
    @staticmethod
    def get_conversation_input_port() -> ConversationInputPort:
        return default_conversation_input_port
    
    @staticmethod
    def get_conversation_output_port() -> ConversationOutputPort:
        return default_conversation_output_port

    @staticmethod
    def get_health_input_port() -> HealthInputPort:
        return default_health_input_port

    @staticmethod
    def get_gemini_input_port() -> GeminiInputPort:
        return default_gemini_input_port