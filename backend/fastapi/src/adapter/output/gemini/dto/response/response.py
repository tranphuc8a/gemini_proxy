from typing import List, Optional, Any
from pydantic import BaseModel


class ResponsePart(BaseModel):
    text: str


class ResponseContent(BaseModel):
    parts: List[ResponsePart]
    role: Optional[str] = None


class Candidate(BaseModel):
    content: ResponseContent
    finishReason: Optional[str] = None
    index: Optional[int] = None


class UsageMetadata(BaseModel):
    promptTokenCount: Optional[int] = None
    candidatesTokenCount: Optional[int] = None
    totalTokenCount: Optional[int] = None
    promptTokensDetails: Optional[List[Any]] = None
    thoughtsTokenCount: Optional[int] = None


class GeminiResponse(BaseModel):
    candidates: Optional[List[Candidate]] = None
    usageMetadata: Optional[UsageMetadata] = None
    modelVersion: Optional[str] = None
    responseId: Optional[str] = None
