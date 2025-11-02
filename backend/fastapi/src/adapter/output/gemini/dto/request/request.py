from typing import List, Optional
from pydantic import BaseModel


class Part(BaseModel):
    text: str


class ContentBlock(BaseModel):
    role: str
    parts: List[Part]


class GeminiRequest(BaseModel):
    contents: List[ContentBlock]
    model: Optional[str] = None
    # any additional fields may be present
