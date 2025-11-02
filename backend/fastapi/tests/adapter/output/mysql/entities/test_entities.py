from src.adapter.output.mysql.entities import ConversationEntity, MessageEntity


def test_models_exist():
    assert ConversationEntity.__tablename__ == "conversations"
    assert MessageEntity.__tablename__ == "messages"
