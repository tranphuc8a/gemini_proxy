"""Value objects of the markdown editor's read-only share links (/markdown/shares).

A link is a FROZEN copy (snapshot) of one document, sent by an administrator from the
editor. One link per document (`doc_id` is unique per store); sharing again refreshes
the snapshot and keeps the token. `mode` has room for "live" (postponed, md-share V17b),
so a MySQL table never needs an `ALTER`.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from src.domain.vo.markdown_ids import DOC_ID_PATTERN

#: Pydantic's hard ceiling on `content` (characters). The real limit is in BYTES and
#: configurable (`MARKDOWN_SHARE_MAX_BYTES`), checked by the use case; this one only keeps
#: an absurd body from being parsed at all (Vercel stops at 4.5 MB anyway).
MAX_SHARE_CHARS = 4_000_000
MAX_TITLE_CHARS = 200

ShareMode = Literal["snapshot"]


class MarkdownShareIn(BaseModel):
    """Body of `POST /markdown/shares`."""

    docId: str = Field(..., min_length=1, max_length=80, pattern=DOC_ID_PATTERN)
    title: str = Field(..., min_length=1, max_length=MAX_TITLE_CHARS)
    content: str = Field(default="", max_length=MAX_SHARE_CHARS)
    expiresInDays: Optional[Literal[1, 7, 30]] = None
    mode: ShareMode = "snapshot"


class MarkdownShareSummary(BaseModel):
    """A link without its snapshot: what listing needs, and what saving returns."""

    token: str
    doc_id: str
    title: str
    mode: str = "snapshot"
    shared_at: int
    updated_at: int
    expires_at: Optional[int] = None
    bytes: int = 0
    content_hash: str = ""


class MarkdownShareRecord(MarkdownShareSummary):
    #: None only for a future "live" link, which reads the stored document instead.
    content: Optional[str] = None

    def summary(self) -> MarkdownShareSummary:
        return MarkdownShareSummary(**self.model_dump(exclude={"content"}))
