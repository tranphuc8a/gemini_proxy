"""Fakes for the two AI ports: the usage/cache store and the model.

Shared by the tests of `AiUseCase` and of the features built on it, so a
feature test exercises the real gateway (access, limits, budget, cache) and
only the model's words and the database are pretended.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from src.application.ports.output.ai_output_port import AiModelOutputPort, AiOutputPort
from src.application.usecases import ai_usecase
from src.domain.models.ai_domain import AiCompletion, AiUsageRow


class FakeStore(AiOutputPort):
    def __init__(self, max_requests: int = 1000):
        self.reserved = 0
        self.max_requests = max_requests
        self.records: List[tuple] = []
        self.cache: Dict[str, str] = {}
        self.broken = False

    async def reserve(self, day, max_requests, max_tokens):
        if self.broken:
            raise RuntimeError("database down")
        if self.reserved >= min(max_requests, self.max_requests):
            return False
        self.reserved += 1
        return True

    async def record(self, day, feature, prompt_tokens, output_tokens):
        if self.broken:
            raise RuntimeError("database down")
        self.records.append((feature, prompt_tokens, output_tokens))

    async def usage(self, since_day):
        return [AiUsageRow(day=ai_usecase.today(), feature="*", requests=self.reserved, prompt_tokens=7,
                           output_tokens=3)]

    async def cache_get(self, key, min_created_at):
        if self.broken:
            raise RuntimeError("database down")
        return self.cache.get(key)

    async def cache_put(self, key, feature, payload, prune_before):
        if self.broken:
            raise RuntimeError("database down")
        self.cache[key] = payload


class FakeModel(AiModelOutputPort):
    def __init__(self, answers: Optional[List[str]] = None, delay: float = 0.0):
        self.answers = list(answers or ["một câu trả lời"])
        self.calls: List[Dict[str, Any]] = []
        self.delay = delay

    async def complete(self, *, model, contents, system=None, generation_config=None):
        self.calls.append({"model": model, "contents": contents, "system": system, "config": generation_config})
        if self.delay:
            await asyncio.sleep(self.delay)
        text = self.answers[min(len(self.calls) - 1, len(self.answers) - 1)]
        return AiCompletion(text=text, prompt_tokens=11, output_tokens=5, finish_reason="STOP")
