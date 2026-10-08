from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.domain.models.ai_domain import AiCompletion, AiUsageRow


class AiModelOutputPort(ABC):
    """A language model that answers one request (no conversation state).

    `contents` are Gemini-shaped turns: ``[{"role": "user", "parts": [{"text": …}
    | {"inlineData": {"mimeType": …, "data": <base64>}}]}]``.
    """

    @abstractmethod
    async def complete(self, *, model: str, contents: List[Dict[str, Any]], system: Optional[str] = None,
                       generation_config: Optional[Dict[str, Any]] = None) -> AiCompletion:
        """The answer; raises on an upstream failure or a refused prompt."""

    async def list_models(self) -> List[Dict[str, Any]]:
        """The provider's models: ``[{"id": "gemini-3.5-flash", "label": "Gemini 3.5 Flash"}]``,
        only those that answer `generateContent`. [] when the provider cannot list them."""
        return []


class AiOutputPort(ABC):
    """Where AI spending is counted and reusable answers are kept."""

    @abstractmethod
    async def reserve(self, day: str, max_requests: int, max_tokens: int) -> bool:
        """Count one request against the day's budget — atomically, across
        instances. False when the day's requests or tokens are already spent."""

    @abstractmethod
    async def record(self, day: str, feature: str, prompt_tokens: int, output_tokens: int) -> None:
        """Book one finished request of `feature` and its tokens."""

    @abstractmethod
    async def usage(self, since_day: str) -> List[AiUsageRow]:
        """Every row from `since_day` (inclusive), oldest first."""

    @abstractmethod
    async def cache_get(self, key: str, min_created_at: int) -> Optional[str]:
        """A stored answer no older than `min_created_at`, else None."""

    @abstractmethod
    async def cache_put(self, key: str, feature: str, payload: str, prune_before: int) -> None:
        """Store (or replace) an answer; drop entries older than `prune_before`."""
