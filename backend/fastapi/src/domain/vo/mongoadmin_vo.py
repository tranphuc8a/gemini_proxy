"""Request/response value objects for the MongoDB administrator feature.

Documents, filters and pipelines are typed as `Any`/`dict` on purpose: they are
Extended JSON and are validated by `src.domain.utils.mongo_json`, not by
pydantic, which has no vocabulary for `{"$oid": ...}`.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ConnectRequest(BaseModel):
    """Either paste a `uri`, or fill in the individual fields."""

    uri: str | None = Field(default=None, max_length=2048)
    host: str = Field(default="localhost", max_length=255)
    port: int = Field(default=27017, ge=1, le=65535)
    username: str | None = Field(default=None, max_length=255)
    password: str = Field(default="")
    database: str | None = Field(default=None, max_length=63)
    auth_source: str | None = Field(default=None, max_length=63)
    auth_mechanism: str | None = Field(default=None, max_length=64)
    replica_set: str | None = Field(default=None, max_length=128)
    tls: bool = False
    srv: bool = False
    direct_connection: bool = False
    label: str | None = Field(default=None, max_length=120)


class SessionInfo(BaseModel):
    token: str
    host: str
    port: int | None = None
    username: str | None = None
    database: str | None = None
    auth_source: str | None = None
    tls: bool = False
    srv: bool = False
    label: str | None = None
    server_version: str | None = None
    server_flavor: str | None = None
    topology: str | None = None
    connected_at: str
    last_used_at: str


class DatabaseInfo(BaseModel):
    name: str
    size_on_disk: int | None = None
    empty: bool = False
    collections: int | None = None


class CollectionInfo(BaseModel):
    name: str
    type: str = "collection"
    count: int | None = None
    size: int | None = None
    storage_size: int | None = None
    avg_obj_size: int | None = None
    index_count: int | None = None
    capped: bool = False
    view_on: str | None = None


class IndexInfo(BaseModel):
    name: str
    keys: list[list[Any]] = Field(default_factory=list)
    unique: bool = False
    sparse: bool = False
    ttl_seconds: int | None = None
    partial_filter: dict[str, Any] | None = None
    size: int | None = None


class DocumentPage(BaseModel):
    database: str
    collection: str
    documents: list[Any] = Field(default_factory=list)
    fields: list[str] = Field(default_factory=list)
    total: int = 0
    skip: int = 0
    limit: int = 50
    duration_ms: float = 0.0
    truncated: bool = False


class FindRequest(BaseModel):
    filter: Any = Field(default_factory=dict)
    projection: Any = None
    sort: Any = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=1000)
    # Counting an unfiltered huge collection is the slowest part of a page load,
    # so the UI can ask for the page only.
    with_count: bool = True


class CountRequest(BaseModel):
    filter: Any = Field(default_factory=dict)


class InsertRequest(BaseModel):
    documents: Any


class UpdateRequest(BaseModel):
    filter: Any = Field(default_factory=dict)
    update: Any
    many: bool = False
    upsert: bool = False


class DeleteRequest(BaseModel):
    filter: Any = Field(default_factory=dict)
    many: bool = False


class AggregateRequest(BaseModel):
    pipeline: Any = Field(default_factory=list)
    max_rows: int = Field(default=200, ge=1, le=5000)


class CommandRequest(BaseModel):
    command: Any
    database: str | None = Field(default=None, max_length=63)


class CreateDatabaseRequest(BaseModel):
    name: str = Field(min_length=1, max_length=63)
    # MongoDB creates a database lazily, so a first collection is required for
    # the new database to exist at all.
    collection: str = Field(default="documents", min_length=1, max_length=235)


class CreateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=235)
    capped: bool = False
    size: int | None = Field(default=None, ge=1)
    max_documents: int | None = Field(default=None, ge=1)


class RenameCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=235)
    drop_target: bool = False


class CreateIndexRequest(BaseModel):
    keys: Any
    name: str | None = Field(default=None, max_length=127)
    unique: bool = False
    sparse: bool = False
    ttl_seconds: int | None = Field(default=None, ge=0)
    partial_filter: Any = None


class MutationResult(BaseModel):
    acknowledged: bool = True
    matched: int = 0
    modified: int = 0
    inserted: int = 0
    deleted: int = 0
    upserted_id: Any = None
    inserted_ids: list[Any] = Field(default_factory=list)
    duration_ms: float = 0.0
    detail: str | None = None


class CommandResult(BaseModel):
    kind: Literal["command", "aggregate"] = "command"
    database: str | None = None
    result: Any = None
    documents: list[Any] = Field(default_factory=list)
    row_count: int = 0
    duration_ms: float = 0.0
    truncated: bool = False


class StatsResult(BaseModel):
    database: str
    collection: str | None = None
    stats: dict[str, Any] = Field(default_factory=dict)


class ServerOverview(BaseModel):
    version: str | None = None
    flavor: str | None = None
    topology: str | None = None
    host: str | None = None
    uptime_seconds: int | None = None
    current_user: str | None = None
    connections: dict[str, Any] = Field(default_factory=dict)
    opcounters: dict[str, Any] = Field(default_factory=dict)
    memory: dict[str, Any] = Field(default_factory=dict)
    storage_engine: str | None = None
    build: dict[str, Any] = Field(default_factory=dict)


class OperationInfo(BaseModel):
    opid: Any = None
    op: str | None = None
    ns: str | None = None
    secs_running: int | None = None
    client: str | None = None
    description: str | None = None
    active: bool = False
    command: Any = None


# ---------------------------------------------------------- backup & restore

class MongoBackupRequest(BaseModel):
    """What to include in a dump of a MongoDB database.

    Indexes are separable from documents because they are the expensive half to
    rebuild and the cheap half to carry: a dump taken for "keep a copy of the
    data" wants both, one taken to seed a test database often wants neither.
    """

    collections: list[str] = Field(default_factory=list)
    include_documents: bool = True
    include_indexes: bool = True
    #: Cap per collection, so one huge collection cannot exhaust memory.
    max_documents_per_collection: int = Field(default=10_000, ge=1, le=200_000)


class MongoBackupResult(BaseModel):
    """A dump as Extended JSON.

    Extended JSON rather than BSON: it survives a copy-paste, a text editor and
    a git diff, and `mongo_json` already round-trips ObjectId, dates and binary
    through it. The cost is size, which matters less than being able to read
    what you backed up.
    """

    database: str
    filename: str
    media_type: str = "application/json"
    content: str
    collections: int = 0
    documents: int = 0
    indexes: int = 0
    bytes: int = 0
    generated_at: str = ""
    truncated_collections: list[str] = Field(default_factory=list)


class MongoRestoreRequest(BaseModel):
    content: str = Field(min_length=1)
    #: Empty the collection before inserting. Off by default: a restore that
    #: silently discarded existing documents would be a data-loss trap.
    drop_existing: bool = False
    stop_on_error: bool = True
    confirm_database: str | None = None


class MongoRestoreResult(BaseModel):
    database: str
    collections: int = 0
    documents: int = 0
    indexes: int = 0
    failed: int = 0
    duration_ms: float = 0.0
    errors: list[str] = Field(default_factory=list)
