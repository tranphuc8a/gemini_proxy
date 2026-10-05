"""Value objects for the personal-spending ("quan-ly-chi-tieu") document store.

The browser owns the shape of the ledger -- accounts, categories, transactions,
budgets -- and does every calculation. The server only keeps one JSON document
per workspace, versions it and hands it back, exactly like the postman store.
So `data` stays opaque (`Dict[str, Any]`) and the typed part is the envelope
around it: identity, revision and access.

A save states the revision it was based on; the server refuses it when someone
else has saved since, and sends the current document back so the client can
merge instead of overwriting.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

# Fallback for a use case built without an explicit limit. The deployment's real
# limit is `settings.SPENDING_MAX_BYTES`, injected by the factory.
DEFAULT_MAX_DATA_BYTES = 4_000_000

DEFAULT_NAME = "Sổ chi tiêu"


class SpendingCreateRequest(BaseModel):
    name: str = Field(default=DEFAULT_NAME, min_length=1, max_length=120)
    # Optional starting document ("push this device's data to the server"). It
    # is stored as revision 1; without it the workspace starts empty.
    data: Optional[Dict[str, Any]] = None


class SpendingCreated(BaseModel):
    """Returned once, at creation. The access key is never shown again."""

    id: str
    name: str
    access_key: str
    revision: int
    created_at: str


class SpendingSaveRequest(BaseModel):
    # The revision the client started editing from. A mismatch means another
    # device saved in the meantime and this write would drop its changes.
    revision: int = Field(ge=0)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    data: Dict[str, Any]


class SpendingView(BaseModel):
    id: str
    name: str
    revision: int
    created_at: str
    updated_at: str
    # None only on an "unchanged" answer, where the client already holds it.
    data: Optional[Dict[str, Any]] = None
    unchanged: bool = False


class SpendingRecord(BaseModel):
    """The stored document, including the secret. Never leaves the usecase."""

    id: str
    name: str
    key_hash: str
    revision: int
    created_at: str
    updated_at: str
    data: Dict[str, Any] = Field(default_factory=dict)

    def to_view(self) -> SpendingView:
        return SpendingView(
            id=self.id,
            name=self.name,
            revision=self.revision,
            created_at=self.created_at,
            updated_at=self.updated_at,
            data=self.data,
        )
