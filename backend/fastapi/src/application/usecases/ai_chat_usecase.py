"""One stateless answer from a chosen model — the chat's "compare two models".

The page sends the same prompt to two models as two requests, side by side;
nothing is stored and no conversation is read. The chat itself (`/gemini/*`)
is public, but this goes through `AiUseCase.ask` like every AI feature, so
`AI_ACCESS`, the per-address limits and the daily budget count each answer.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from src.application.exceptions.exceptions import BadGatewayError, BadRequestError
from src.application.usecases.ai_usecase import AiUseCase, generation_config, text_turn
from src.domain.enums.enums import EModel
from src.domain.models.ai_domain import AiCaller

MODELS = tuple(m.value for m in EModel)
PROMPT_CHARS = 8000
#: Generous: on 2.5 Pro the thinking tokens count against it.
MAX_TOKENS = 8192


class AiChatUseCase:
    def __init__(self, ai: AiUseCase):
        self.ai = ai

    async def compare(self, caller: AiCaller, *, prompt: str, model: str) -> Dict[str, Any]:
        prompt = (prompt or "").strip()[:PROMPT_CHARS]
        if not prompt:
            raise BadRequestError("Hãy nhập câu hỏi")
        if model not in MODELS:
            raise BadRequestError(f"Không có model {model!r} — chọn một trong: {', '.join(MODELS)}")
        started = time.monotonic()
        text, completion = await self.ai.ask(
            caller, "compare", contents=[text_turn(prompt)],
            config=generation_config(temperature=0.7, max_tokens=MAX_TOKENS, model=model), model=model)
        if not str(text).strip():
            raise BadGatewayError(f"{model} không trả lời (bị chặn hoặc rỗng: {completion.finish_reason or '?'})")
        return {"model": model, "text": text, "ms": round((time.monotonic() - started) * 1000),
                "promptTokens": completion.prompt_tokens, "outputTokens": completion.output_tokens,
                "finishReason": completion.finish_reason}
