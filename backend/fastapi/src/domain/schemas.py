"""Compatibility shims for earlier code that imported `src.domain.schemas`.

New location for request/response models is `src.domain.vo`. We provide aliases
here to maintain compatibility for older imports while encouraging migration to
the new package.
"""

from src.domain.vo.message_response import MessageResponse as MessageSchema
from src.domain.vo.conversation_response import ConversationResponse as ConversationSchema
from src.domain.vo.conversation_update_request import ConversationUpdateRequest as ConversationUpdatingRequest
from src.domain.vo.response_list import ResponseList

__all__ = [
    "MessageSchema",
    "ConversationSchema",
    "ConversationUpdatingRequest",
    "ResponseList",
]
