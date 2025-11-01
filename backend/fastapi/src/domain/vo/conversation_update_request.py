from pydantic import BaseModel


class ConversationUpdateRequest(BaseModel):
    conversation_id: str
    name: str
