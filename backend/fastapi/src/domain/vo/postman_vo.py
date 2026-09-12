"""Value objects for the postman-lite-pro workspace store.

The browser owns the shape of a collection, a request and an environment; the
server only needs to keep those documents, version them and hand them back. So
the payloads stay opaque (`list[dict]`) and the typed part is the envelope
around them: identity, revision and access.

Revisions are what make two browsers editing one workspace safe: a save states
the revision it was based on, and the server refuses the write if someone else
has saved since.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Guard rails so one runaway client cannot fill the disk. Generous enough for a
# real collection: Postman's own export of ~200 requests lands near 1 MB.
MAX_ITEMS_PER_STORE = 5000
MAX_DOCUMENT_BYTES = 8 * 1024 * 1024


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(default="My Workspace", min_length=1, max_length=120)


class WorkspaceCreated(BaseModel):
    """Returned once, at creation. The access key is never shown again."""

    id: str
    name: str
    access_key: str
    revision: int
    created_at: str


class WorkspaceSaveRequest(BaseModel):
    # The revision the client started editing from. A mismatch means somebody
    # else saved in the meantime and this write would silently drop their work.
    revision: int = Field(ge=0)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    collections: List[Dict[str, Any]] = Field(default_factory=list)
    requests: List[Dict[str, Any]] = Field(default_factory=list)
    environments: List[Dict[str, Any]] = Field(default_factory=list)


class WorkspaceView(BaseModel):
    id: str
    name: str
    revision: int
    created_at: str
    updated_at: str
    collections: List[Dict[str, Any]] = Field(default_factory=list)
    requests: List[Dict[str, Any]] = Field(default_factory=list)
    environments: List[Dict[str, Any]] = Field(default_factory=list)
    share_token: Optional[str] = None


class SharedWorkspaceView(BaseModel):
    """What a share link exposes: the collections, never the environments.

    Environments are where tokens and passwords live, so they are deliberately
    left out of anything reachable without the access key.
    """

    id: str
    name: str
    revision: int
    updated_at: str
    collections: List[Dict[str, Any]] = Field(default_factory=list)
    requests: List[Dict[str, Any]] = Field(default_factory=list)


class ShareResult(BaseModel):
    share_token: Optional[str] = None
    enabled: bool


class HistoryEntry(BaseModel):
    id: Optional[str] = None
    timestamp: Optional[str] = None
    method: str = "GET"
    url: str = ""
    status: Optional[int] = None
    duration_ms: Optional[int] = None
    size_bytes: Optional[int] = None
    via: Optional[str] = None
    success: bool = True
    # The request spec, so a history row can be reopened in the editor.
    spec: Dict[str, Any] = Field(default_factory=dict)


class HistoryPage(BaseModel):
    items: List[HistoryEntry] = Field(default_factory=list)
    total: int = 0


class WorkspaceRecord(BaseModel):
    """The stored document, including the secret. Never leaves the usecase."""

    id: str
    name: str
    key_hash: str
    revision: int
    created_at: str
    updated_at: str
    collections: List[Dict[str, Any]] = Field(default_factory=list)
    requests: List[Dict[str, Any]] = Field(default_factory=list)
    environments: List[Dict[str, Any]] = Field(default_factory=list)
    share_token: Optional[str] = None

    def to_view(self) -> WorkspaceView:
        return WorkspaceView(
            id=self.id,
            name=self.name,
            revision=self.revision,
            created_at=self.created_at,
            updated_at=self.updated_at,
            collections=self.collections,
            requests=self.requests,
            environments=self.environments,
            share_token=self.share_token,
        )

    def to_shared_view(self) -> SharedWorkspaceView:
        return SharedWorkspaceView(
            id=self.id,
            name=self.name,
            revision=self.revision,
            updated_at=self.updated_at,
            collections=self.collections,
            requests=self.requests,
        )
