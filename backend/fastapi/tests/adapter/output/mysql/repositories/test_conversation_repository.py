from src.adapter.repositories.conversation_repository import ConversationRepository


def test_conversation_repo_has_methods():
    repo = ConversationRepository()
    assert hasattr(repo, "get_by_id")
    assert hasattr(repo, "get_all")
    assert hasattr(repo, "save")
    assert hasattr(repo, "delete")
