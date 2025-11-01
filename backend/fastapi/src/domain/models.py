"""Legacy compatibility module.

Domain classes were moved to the package `src.domain.models` where they are named
with the suffix `Domain` (e.g. `ConversationDomain`, `MessageDomain`).

This module re-exports those classes and provides short aliases for backward
compatibility with older imports that use `from src.domain import models`.
"""

from .models import ConversationDomain, MessageDomain

# Backwards-compatible aliases (avoid using these in new code; prefer Domain suffix)
Conversation = ConversationDomain
Message = MessageDomain

__all__ = ["ConversationDomain", "MessageDomain", "Conversation", "Message"]
