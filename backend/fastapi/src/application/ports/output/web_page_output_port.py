from abc import ABC, abstractmethod
from typing import Optional

from pydantic import BaseModel


class WebPage(BaseModel):
    """A fetched public page: its text (HTML reduced to text), or a PDF's bytes."""

    url: str
    title: str = ""
    text: str = ""
    pdf: Optional[bytes] = None


class WebPageOutputPort(ABC):
    @abstractmethod
    async def fetch(self, url: str) -> WebPage:
        """The page at `url`, or a 400 (BadRequestError) saying why it cannot be read."""
