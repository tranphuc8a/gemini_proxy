from src.application.usecases.conversation_usecase import ConversationUseCase
from src.adapter.repositories.conversation_repository import ConversationRepository
from src.adapter.repositories.message_repository import MessageRepository


def test_usecase_constructs():
    conv_repo = ConversationRepository()
    msg_repo = MessageRepository()
    uc = ConversationUseCase(conv_repo, msg_repo)
    assert hasattr(uc, "create_conversation")
    assert hasattr(uc, "get_conversation_list")
