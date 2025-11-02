

from typing import AsyncIterator, List, Optional

from src.adapter.output.gemini.helper.gemini_client import GeminiClient, GeminiClientError
from src.application.ports.output.gemini_output_port import GeminiOutputPort
from adapter.output.gemini.dto.response.response import GeminiResponse
from domain.models.message_domain import MessageDomain


class GeminiService(GeminiOutputPort):
    def __init__(self, gemini_client: GeminiClient):
        self.gemini_client = gemini_client

    async def generate(self, model: str, message: MessageDomain, history: List[MessageDomain]) -> str:
        """Call the Gemini client and return the assistant text as a single string."""
        # Prepare prompt: convert history + message into contents list expected by the client
        contents = []
        for m in history:
            contents.append({"role": m.role, "parts": [{"text": m.content}]})
        contents.append({"role": message.role, "parts": [{"text": message.content}]})

        try:
            raw = await self.gemini_client.generate(contents, model=model)
        except GeminiClientError as exc:
            raise

        # Parse known response shapes
        try:
            resp = GeminiResponse.parse_obj(raw)
            parts = []
            if resp.candidates:
                for cand in resp.candidates:
                    if cand.content and cand.content.parts:
                        for p in cand.content.parts:
                            parts.append(p.text)
            return "".join(parts)
        except Exception:
            # Fallback: try to extract text heuristically
            if isinstance(raw, dict):
                candidates = raw.get("candidates", [])
                texts = []
                for cand in candidates:
                    content = cand.get("content", {})
                    for part in content.get("parts", []):
                        texts.append(part.get("text") or "")
                return "".join(texts)
            return str(raw)

    async def stream_generate(self, model: str, message: MessageDomain, history: List[MessageDomain]) -> AsyncIterator[str]:
        contents = []
        for m in history:
            contents.append({"role": m.role, "parts": [{"text": m.content}]})
        contents.append({"role": message.role, "parts": [{"text": message.content}]})

        async for part in self.gemini_client.stream_generate(contents, model=model):
            yield part

    async def stop(self) -> None:
        await self.gemini_client.stop()

    async def health_check(self) -> bool:
        return await self.gemini_client.health_check()
    