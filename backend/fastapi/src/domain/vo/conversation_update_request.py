from fastapi import Body
from pydantic import BaseModel


class ConversationUpdateRequest(BaseModel):
    id: str
    name: str
    
    @staticmethod
    def as_body(
        id: str = Body(..., min_length=1, description="Conversation ID (non-empty)"),
        name: str = Body(..., min_length=1, max_length=100, description="Updated conversation name (1-100 characters)"),
    ) -> "ConversationUpdateRequest":
        return ConversationUpdateRequest(
            id=id,
            name=name,
        )
