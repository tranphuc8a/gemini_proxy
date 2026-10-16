"""Value objects of `/codestore`: code snippets and projects synced between devices.

A workspace is a bag of records ("items"). The client owns their content and
their clock: every item carries `updatedAt` (milliseconds, set by the device that
edited it) and the server merges by it, last writer wins. A deletion is a record
too (`deleted: true`, a tombstone) - without it a device that was offline would
bring a deleted snippet back.

`serverUpdatedAt` is the server's own clock at the moment it stored the record. It
is what `GET ...?since=` filters on: a device's `updatedAt` says when the text was
edited, which may be long before the server first saw it, so polling by it would
miss records another device pushed late.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- size limits
MAX_ITEMS_PER_PUT = 100
MAX_ITEM_BYTES = 512 * 1024
MAX_PUT_BYTES = 2 * 1024 * 1024
MAX_META_BYTES = 32 * 1024
MAX_FILES_PER_ITEM = 200
MAX_NAME_CHARS = 200
#: A client clock further ahead than this would win every later merge.
MAX_CLOCK_AHEAD_MS = 24 * 3600 * 1000
#: Year 2100 in ms: a sanity ceiling for the schema, not the clock check above.
MAX_TIMESTAMP_MS = 4_102_444_800_000

#: What the owner's own editor keeps in `meta` (pinned in the list, open tabs, the
#: file being edited): about the owner's session, not about the code, so it is not
#: part of what a read-only link shows.
PRIVATE_META_KEYS = ("pinned", "openTabs", "activeFile")

ItemKind = Literal["snippet", "project"]


class CodeFile(BaseModel):
    path: str = Field(..., min_length=1, max_length=512)
    # Characters; the byte size of the whole item is checked by the use case.
    content: str = Field(default="", max_length=MAX_ITEM_BYTES)


class CodeItemIn(BaseModel):
    """One record as a client sends it."""

    id: str = Field(..., pattern=r"^[A-Za-z0-9_.:-]{1,80}$")
    kind: ItemKind
    name: str = Field(default="", max_length=MAX_NAME_CHARS)
    language: str = Field(default="", max_length=32, pattern=r"^[A-Za-z0-9_+#.-]*$")
    files: List[CodeFile] = Field(default_factory=list, max_length=MAX_FILES_PER_ITEM)
    meta: Dict[str, Any] = Field(default_factory=dict)
    updatedAt: int = Field(..., ge=0, le=MAX_TIMESTAMP_MS)
    deleted: bool = False


class CodeItem(CodeItemIn):
    """A record as the server holds it."""

    serverUpdatedAt: int = 0


class PutItemsRequest(BaseModel):
    items: List[CodeItemIn] = Field(default_factory=list, max_length=MAX_ITEMS_PER_PUT)


class ShareSummary(BaseModel):
    """A read-only link, without the snapshot it points at."""

    token: str
    workspace_id: str
    item_id: str
    name: str = ""
    #: Milliseconds: when the link was first made, and when its snapshot was last refreshed.
    shared_at: int
    updated_at: int


class ShareRecord(ShareSummary):
    """A read-only link and the frozen copy (snapshot) of the record it shows.

    The token IS the read key: whoever holds it can read the snapshot. It is
    stored as is (a digest would make the link unrecoverable for its owner, who
    lists it again later) and must never reach a log.
    """

    item: CodeItem


class WorkspaceRecord(BaseModel):
    """The stored workspace, including the key digest. Never leaves the use case."""

    id: str
    key_hash: str
    created_at: str


def wins(new_updated_at: int, new_deleted: bool, old_updated_at: int, old_deleted: bool) -> bool:
    """Does the incoming record replace the stored one?

    The later `updatedAt` wins. On a tie a deletion beats an edit (the user did
    say "delete it"); otherwise the record already stored stays, so pushing the
    same record twice changes nothing.
    """
    if new_updated_at != old_updated_at:
        return new_updated_at > old_updated_at
    return bool(new_deleted and not old_deleted)
