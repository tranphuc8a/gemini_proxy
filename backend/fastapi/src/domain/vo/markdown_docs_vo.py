"""Value objects of the markdown delta sync (md-sync B2, ke-hoach M4a).

The store keeps ONE record per node of the editor's tree (a file or a folder), stamped
with a revision the server bumps on every change; a push carries only the nodes that
changed, and a file's new text travels either whole or as a line patch against the text
the client last synced (`application/utils/line_patch`). Field names are camelCase: they
are the API's, the JSON file's and the browser's `DocRecord`, so no layer translates them.

The limits here are the defaults of the `MARKDOWN_*` size budget in `config.py` (the
real values are read from settings by the factory; the `Field` ceilings below only keep
an absurd body from being parsed at all).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.types import StrictInt

from src.domain.vo.markdown_ids import DOC_ID_PATTERN

# --- size budget (UTF-8 bytes). One request body may not exceed 4.5 MB on Vercel and
# JSON escaping makes a body bigger than its text, hence 3.5 MB per document, 4 MB per push.
MAX_OPS_PER_PUSH = 200
MAX_PUSH_BYTES = 4_000_000
MAX_DOC_BYTES = 3_500_000
MAX_DOCS = 20_000
PAGE_ITEMS = 200
PAGE_BYTES = 3_000_000
MAX_CLOCK_AHEAD_MS = 24 * 3600 * 1000
#: The pull cursor trails the clock by this much: a write that began before a poll but
#: committed after it must still be newer than the cursor (same rule as `/wiki`).
SYNC_LAG_MS = 2000
MAX_NAME_CHARS = 255
#: Pydantic's ceiling on one text (characters >= bytes/4): the byte limit is the use case's.
MAX_CONTENT_CHARS = 4_000_000

HASH_PATTERN = r"^[0-9a-f]{64}$"
DEVICE_PATTERN = r"^[A-Za-z0-9_.:-]{1,64}$"
#: The `device` of the records and history rows the lazy migration makes from the old store: a name no client may use
#: (its own writes would come back to it without text, and its history would be mistaken for the migration's).
LEGACY_DEVICE = "legacy"
#: One store per `?backend=`; the column exists so several spaces never need an ALTER. Not in the API.
DEFAULT_SPACE = "default"

DocKind = Literal["file", "folder"]
RevisionEncoding = Literal["full", "delta", "none"]
RevisionOrigin = Literal["edit", "merge", "restore", "import", "migrate", "delete"]

#: Codes of a per-op `rejected` result (the other ops of the push still apply).
REJECT_CODES = (
    "md_patch_mismatch", "md_hash_mismatch", "md_doc_too_large", "md_kind_changed", "md_bad_name",
    "md_bad_parent", "md_space_full", "md_bad_clock", "md_bad_content", "md_content_required",
)


class PatchIn(BaseModel):
    """`{"v": 1, "h": [[offset, removed, [lines...]], ...]}` - see `line_patch`."""

    v: Literal[1]
    h: List[tuple[StrictInt, StrictInt, List[str]]]


class MetaIn(BaseModel):
    """The node fields a push may change. `parentId: null` moves a node to the top; not sending
    it leaves the parent alone - `model_fields_set` tells the two apart."""

    name: Optional[str] = Field(default=None, max_length=1000)
    parentId: Optional[str] = Field(default=None, pattern=DOC_ID_PATTERN)


class PushOp(BaseModel):
    """One node's change. Exactly one of `content` / `patch` carries new text; `hash` (SHA-256 of
    the RESULTING text) is mandatory with either, `baseHash` (of the text the patch applies to)
    with a patch."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., pattern=DOC_ID_PATTERN)
    kind: DocKind
    baseRev: int = Field(..., ge=0)
    meta: Optional[MetaIn] = Field(default=None, alias="set")
    content: Optional[str] = Field(default=None, max_length=MAX_CONTENT_CHARS)
    patch: Optional[PatchIn] = None
    baseHash: Optional[str] = Field(default=None, pattern=HASH_PATTERN)
    hash: Optional[str] = Field(default=None, pattern=HASH_PATTERN)
    deleted: Optional[bool] = None
    updatedAt: int = Field(..., ge=0)

    @model_validator(mode="after")
    def _coherent(self) -> "PushOp":
        if self.content is not None and self.patch is not None:
            raise ValueError("an op carries content or patch, not both")
        if self.patch is not None and not self.baseHash:
            raise ValueError("a patch needs baseHash")
        if (self.content is not None or self.patch is not None) and not self.hash:
            raise ValueError("content or patch needs hash")
        if self.kind == "folder" and (self.content is not None or self.patch is not None):
            raise ValueError("a folder has no content")
        return self


class PushRequest(BaseModel):
    device: str = Field(..., pattern=DEVICE_PATTERN)
    ops: List[PushOp] = Field(..., min_length=1, max_length=MAX_OPS_PER_PUSH)

    @field_validator("device")
    @classmethod
    def _not_the_migration(cls, value: str) -> str:
        if value == LEGACY_DEVICE:
            raise ValueError(f"the device name '{LEGACY_DEVICE}' is reserved")
        return value


class DocRecord(BaseModel):
    """The stored state of one node. A tombstone (`deleted`) has no `content` and an empty `hash`."""

    id: str
    kind: DocKind
    parentId: Optional[str] = None
    name: str = ""
    content: Optional[str] = None
    hash: str = ""
    size: int = 0
    rev: int = 1
    contentRev: int = 1
    metaRev: int = 1
    deleted: bool = False
    createdAt: int = 0
    updatedAt: int = 0
    serverUpdatedAt: int = 0
    device: str = ""

    def without_content(self) -> "DocRecord":
        return self.model_copy(update={"content": None})


class Revision(BaseModel):
    """One row of a document's history (written whenever the TEXT changes, on delete and on restore).

    `encoding`: `full` = `body` is the whole text (a keyframe); `delta` = `body` is the JSON of a
    patch against the keyframe `baseRev`; `none` = a deletion, no text. `compressed`: `body` is
    zlib + base64. Restoring any row therefore needs at most two reads.
    """

    docId: str
    rev: int
    kind: DocKind = "file"
    name: str = ""
    parentId: Optional[str] = None
    deleted: bool = False
    hash: str = ""
    size: int = 0
    encoding: RevisionEncoding = "full"
    compressed: bool = False
    baseRev: Optional[int] = None
    body: str = ""
    origin: RevisionOrigin = "edit"
    restoredFrom: Optional[int] = None
    label: Optional[str] = None
    device: str = ""
    savedAt: int = 0
    updatedAt: int = 0

    def meta(self) -> Dict[str, Any]:
        """The row without its body: what a listing shows."""
        data = self.model_dump(exclude={"body", "docId"})
        data.pop("compressed", None)
        return data

    def without_body(self) -> "Revision":
        return self.model_copy(update={"body": ""})
