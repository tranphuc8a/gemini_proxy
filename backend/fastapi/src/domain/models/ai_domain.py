"""The AI features: who asks, what a model answered, what it cost.

Every AI feature — the tutor beside a lesson, flashcards, course drafting, OPIc
speaking feedback, natural-language SQL — and the chat spend one Gemini quota.
These types are what the guard in front of that quota reasons about.
"""

from __future__ import annotations

from pydantic import BaseModel


class AiCaller(BaseModel):
    """Who is asking, as the controller established it."""

    #: Client address — the per-caller rate limits are keyed on it.
    ip: str = "?"
    #: A course administrator (COURSE_ADMIN_KEY or its session token).
    admin: bool = False
    #: Holds a valid token issued for AI_ACCESS_CODE.
    code: bool = False


class AiCompletion(BaseModel):
    """One model answer and what it cost."""

    text: str = ""
    prompt_tokens: int = 0
    output_tokens: int = 0
    finish_reason: str = ""
    #: Served from the answer cache: no model call, nothing spent.
    cached: bool = False


class AiUsageRow(BaseModel):
    """Spending of one feature on one UTC day ("*" is the day's total)."""

    day: str
    feature: str
    requests: int = 0
    prompt_tokens: int = 0
    output_tokens: int = 0
