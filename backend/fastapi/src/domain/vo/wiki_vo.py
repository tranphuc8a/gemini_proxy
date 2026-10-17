"""Value objects of `/wiki`: the notes and flash cards of the Personal Wiki, synced between devices.

A workspace is a bag of records. The client owns their content and their clock:
every record carries `updatedAt` (milliseconds, set by the device that edited it)
and the server merges by it, last writer wins. A deletion is a record too
(`deleted: true`, a tombstone) - without it a device that was offline would bring a
deleted note back.

`data` is OPAQUE to the server: the browser puts the whole note (or card) there and
the server never looks inside, it only checks that it is a JSON object of a bounded
size (the use case does that) and drops it from a tombstone.

`serverUpdatedAt` is the server's own clock at the moment it stored the record. It
is what `GET ...?since=` filters on: a device's `updatedAt` says when the text was
edited, which may be long before the server first saw it, so polling by it would
miss records another device pushed late.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- size limits
MAX_ITEMS_PER_PUT = 200
#: One record's `data`, serialised. A note may hold 500,000 characters of up to 3 bytes each in UTF-8.
MAX_ITEM_BYTES = 1_600_000
MAX_PUT_BYTES = 4_000_000
#: A client clock further ahead than this would win every later merge.
MAX_CLOCK_AHEAD_MS = 24 * 3600 * 1000
#: Year 2100 in ms: a sanity ceiling for the schema, not the clock check above.
MAX_TIMESTAMP_MS = 4_102_444_800_000

RecordKind = Literal["note", "card"]


class RecordIn(BaseModel):
    """One record as a client sends it."""

    id: str = Field(..., pattern=r"^[A-Za-z0-9_.:-]{1,80}$")
    kind: RecordKind
    updatedAt: int = Field(..., ge=0, le=MAX_TIMESTAMP_MS)
    deleted: bool = False
    #: Opaque to the server; its size is checked by the use case.
    data: Dict[str, Any] = Field(default_factory=dict)


class Record(RecordIn):
    """A record as the server holds it."""

    serverUpdatedAt: int = 0


class PutItemsRequest(BaseModel):
    items: List[RecordIn] = Field(default_factory=list, max_length=MAX_ITEMS_PER_PUT)


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
