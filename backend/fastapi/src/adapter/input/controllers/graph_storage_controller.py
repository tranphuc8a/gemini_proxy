"""Server-side store for graphuc documents.

graphuc draws its graphs in the browser and keeps them in localStorage, which is
all a single person on a single machine needs. This router is the other half:
saving a graph so it survives a cleared cache and can be opened somewhere else.

The document itself stays opaque. The browser owns what a node and an edge look
like, and the shape of that will keep changing as the editor grows; pinning it
into a schema here would mean a backend change for every editor feature. What
the server does own is the envelope -- id, title, timestamps, revision -- and
that is what the endpoints are built around.

Three interchangeable backends, chosen per request with `?backend=`, exactly as
`markdown_storage_controller` does:

* ``json``  - one file, no database. The default, and on a serverless platform
  an ephemeral one (see `application/utils/data_paths`).
* ``mysql`` - one row per graph, document in a LONGTEXT column.
* ``mongo`` - one document per graph.

Writing needs the admin key, or a session token issued in exchange for it.
Reading does not: a graph is a diagram, and the point of saving one is usually
to show it to somebody.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from src.adapter.output.mongostore import client as mongo_store
from src.adapter.output.mysql.db.base import get_async_session
from src.application.config.config import settings
from src.application.utils import admin_session
from src.application.utils.data_paths import seeded_data_path

router = APIRouter(prefix="/graphs", tags=["graphuc"])

SESSION_SALT = "graphuc"
MONGO_COLLECTION = "graphuc_graphs"
SUPPORTED_BACKENDS = ("json", "mysql", "mongo")

#: A drawing that has grown past this is almost certainly a runaway client.
MAX_DOCUMENT_BYTES = 4 * 1024 * 1024


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------- models

class GraphSummary(BaseModel):
    id: str
    title: str
    kind: str = "graph"
    nodes: int = 0
    edges: int = 0
    revision: int = 1
    created_at: str
    updated_at: str


class GraphDocument(GraphSummary):
    #: The editor's own document. Opaque here on purpose -- see the module note.
    document: dict[str, Any] = Field(default_factory=dict)


class GraphSaveRequest(BaseModel):
    title: str = Field(default="Đồ thị chưa đặt tên", min_length=1, max_length=200)
    kind: str = Field(default="graph", max_length=40)
    document: dict[str, Any] = Field(default_factory=dict)


class AdminSessionResponse(BaseModel):
    ok: bool = True
    session: str
    expiresAt: int


class BackendInfo(BaseModel):
    id: str
    available: bool
    reason: str | None = None


# -------------------------------------------------------------------- auth

def _admin_key() -> str:
    return os.getenv("GRAPHUC_ADMIN_KEY", getattr(settings, "GRAPHUC_ADMIN_KEY", "graphuc-admin-2024"))


def _check_admin(admin_key: str | None, session_token: str | None = None) -> None:
    expected = _admin_key()
    if admin_key and admin_key == expected:
        return
    if session_token:
        try:
            admin_session.verify(session_token, expected, salt=SESSION_SALT)
            return
        except admin_session.SessionError as cause:
            raise HTTPException(status_code=403, detail=str(cause)) from cause
    raise HTTPException(status_code=403, detail="Admin key required")


def _issue_session() -> AdminSessionResponse:
    issued = admin_session.issue(
        _admin_key(),
        salt=SESSION_SALT,
        ttl_seconds=int(getattr(settings, "GRAPHUC_SESSION_HOURS", 12)) * 3600,
    )
    return AdminSessionResponse(session=issued.token, expiresAt=issued.expires_at)


# ----------------------------------------------------------------- backends

def _storage_backend(requested: str | None = None) -> str:
    backend = requested or os.getenv("GRAPHUC_STORAGE_BACKEND", getattr(settings, "GRAPHUC_STORAGE_BACKEND", "json"))
    if backend not in SUPPORTED_BACKENDS:
        raise HTTPException(status_code=400, detail=f"Storage backend must be one of {', '.join(SUPPORTED_BACKENDS)}")
    if backend == "mongo" and not mongo_store.is_configured():
        raise HTTPException(status_code=503, detail="The mongo backend needs MONGO_URI to be configured")
    return backend


def _json_path() -> Path:
    configured = os.getenv("GRAPHUC_JSON_FILE", getattr(settings, "GRAPHUC_JSON_FILE", "data/graphuc-graphs.json"))
    return seeded_data_path(configured)


def _read_json_store() -> dict[str, dict[str, Any]]:
    path = _json_path()
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # A corrupt store must not take the router down; the bad file is left in
        # place so it can be inspected rather than silently overwritten.
        return {}
    graphs = raw.get("graphs")
    return graphs if isinstance(graphs, dict) else {}


def _write_json_store(graphs: dict[str, dict[str, Any]]) -> None:
    path = _json_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"version": 1, "graphs": graphs}, ensure_ascii=False, indent=2)
    # Write then move: a crash halfway through leaves the previous good file
    # rather than a truncated one.
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(payload, encoding="utf-8")
    os.replace(temp, path)


_CREATE_TABLE = """
    CREATE TABLE IF NOT EXISTS graphuc_graphs (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        kind VARCHAR(40) NOT NULL,
        node_count INTEGER NOT NULL DEFAULT 0,
        edge_count INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        document LONGTEXT NOT NULL
    )
"""


async def _mysql_session():
    session = get_async_session()
    await session.execute(text(_CREATE_TABLE))
    await session.commit()
    return session


def _row_to_document(row: Any) -> GraphDocument:
    mapping = row._mapping if hasattr(row, "_mapping") else row
    try:
        document = json.loads(mapping["document"] or "{}")
    except (TypeError, ValueError):
        document = {}
    return GraphDocument(
        id=mapping["id"],
        title=mapping["title"],
        kind=mapping["kind"],
        nodes=int(mapping["node_count"]),
        edges=int(mapping["edge_count"]),
        revision=int(mapping["revision"]),
        created_at=mapping["created_at"],
        updated_at=mapping["updated_at"],
        document=document,
    )


def _record_to_document(record: dict[str, Any]) -> GraphDocument:
    return GraphDocument(
        id=record["id"],
        title=record.get("title", "Đồ thị"),
        kind=record.get("kind", "graph"),
        nodes=int(record.get("nodes", 0)),
        edges=int(record.get("edges", 0)),
        revision=int(record.get("revision", 1)),
        created_at=record.get("created_at", _now()),
        updated_at=record.get("updated_at", _now()),
        document=record.get("document") or {},
    )


def _counts(document: dict[str, Any]) -> tuple[int, int]:
    nodes = document.get("nodes")
    edges = document.get("edges")
    return (len(nodes) if isinstance(nodes, list) else 0, len(edges) if isinstance(edges, list) else 0)


def _guard_size(document: dict[str, Any]) -> None:
    size = len(json.dumps(document, ensure_ascii=False).encode("utf-8"))
    if size > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Đồ thị {size // 1024} KB, vượt giới hạn {MAX_DOCUMENT_BYTES // 1024} KB",
        )


# ------------------------------------------------------------------ routes

@router.get("/_backends", response_model=list[BackendInfo])
async def list_backends():
    """Which storage backends this deployment can serve.

    Prefixed with an underscore so it can never collide with a graph id.
    """
    from src.adapter.input.controllers.storage_controller import list_backends as probe

    # Connects rather than reads configuration -- see storage_controller.
    return [
        BackendInfo(id=status.id, available=status.available, reason=status.detail)
        for status in await probe()
    ]


@router.post("/_admin/verify", response_model=AdminSessionResponse)
async def verify_admin_key(x_admin_key: str | None = Header(default=None)):
    """Exchange the admin key for a session token the browser can keep."""
    _check_admin(x_admin_key)
    return _issue_session()


@router.post("/_admin/session", response_model=AdminSessionResponse)
async def refresh_admin_session(x_admin_session: str | None = Header(default=None)):
    """Check a stored token on page load and hand back a fresh one."""
    _check_admin(None, x_admin_session)
    return _issue_session()


@router.get("", response_model=list[GraphSummary])
async def list_graphs(backend: str | None = Query(default=None)):
    """Every saved graph, newest first, without the drawings themselves."""
    chosen = _storage_backend(backend)

    if chosen == "json":
        records = list(_read_json_store().values())
    elif chosen == "mysql":
        session = await _mysql_session()
        try:
            result = await session.execute(text(
                "SELECT id, title, kind, node_count, edge_count, revision, created_at, updated_at, '{}' AS document "
                "FROM graphuc_graphs"
            ))
            return sorted(
                (GraphSummary(**_row_to_document(row).model_dump(exclude={"document"})) for row in result),
                key=lambda item: item.updated_at,
                reverse=True,
            )
        finally:
            await session.close()
    else:
        collection = mongo_store.get_collection(MONGO_COLLECTION)
        records = []
        async for doc in collection.find({}):
            records.append({**doc, "id": doc.get("_id")})

    summaries = [GraphSummary(**_record_to_document(record).model_dump(exclude={"document"})) for record in records]
    return sorted(summaries, key=lambda item: item.updated_at, reverse=True)


@router.get("/{graph_id}", response_model=GraphDocument)
async def get_graph(graph_id: str, backend: str | None = Query(default=None)):
    chosen = _storage_backend(backend)

    if chosen == "json":
        record = _read_json_store().get(graph_id)
        if not record:
            raise HTTPException(status_code=404, detail="Không tìm thấy đồ thị")
        return _record_to_document(record)

    if chosen == "mysql":
        session = await _mysql_session()
        try:
            result = await session.execute(
                text("SELECT * FROM graphuc_graphs WHERE id = :id"), {"id": graph_id}
            )
            row = result.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Không tìm thấy đồ thị")
            return _row_to_document(row)
        finally:
            await session.close()

    doc = await mongo_store.get_collection(MONGO_COLLECTION).find_one({"_id": graph_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy đồ thị")
    return _record_to_document({**doc, "id": doc["_id"]})


@router.put("/{graph_id}", response_model=GraphDocument)
async def save_graph(
    graph_id: str,
    request: GraphSaveRequest,
    backend: str | None = Query(default=None),
    x_admin_key: str | None = Header(default=None),
    x_admin_session: str | None = Header(default=None),
):
    """Create or overwrite a graph.

    An upsert rather than separate create/update routes: the client mints the id
    when the drawing is first made (so it can save offline and sync later), and
    a save must work whether or not the server has seen that id before.
    """
    _check_admin(x_admin_key, x_admin_session)
    chosen = _storage_backend(backend)
    _guard_size(request.document)

    if not graph_id or len(graph_id) > 64 or not graph_id.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Mã đồ thị không hợp lệ")

    nodes, edges = _counts(request.document)
    now = _now()

    if chosen == "json":
        graphs = _read_json_store()
        existing = graphs.get(graph_id)
        record = {
            "id": graph_id,
            "title": request.title,
            "kind": request.kind,
            "nodes": nodes,
            "edges": edges,
            "revision": int(existing["revision"]) + 1 if existing else 1,
            "created_at": existing["created_at"] if existing else now,
            "updated_at": now,
            "document": request.document,
        }
        graphs[graph_id] = record
        _write_json_store(graphs)
        return _record_to_document(record)

    if chosen == "mysql":
        session = await _mysql_session()
        try:
            found = await session.execute(
                text("SELECT revision, created_at FROM graphuc_graphs WHERE id = :id"), {"id": graph_id}
            )
            row = found.fetchone()
            revision = int(row[0]) + 1 if row else 1
            created_at = row[1] if row else now
            params = {
                "id": graph_id, "title": request.title, "kind": request.kind,
                "node_count": nodes, "edge_count": edges, "revision": revision,
                "created_at": created_at, "updated_at": now,
                "document": json.dumps(request.document, ensure_ascii=False),
            }
            if row:
                await session.execute(text(
                    "UPDATE graphuc_graphs SET title = :title, kind = :kind, node_count = :node_count, "
                    "edge_count = :edge_count, revision = :revision, updated_at = :updated_at, document = :document "
                    "WHERE id = :id"
                ), params)
            else:
                await session.execute(text(
                    "INSERT INTO graphuc_graphs "
                    "(id, title, kind, node_count, edge_count, revision, created_at, updated_at, document) VALUES "
                    "(:id, :title, :kind, :node_count, :edge_count, :revision, :created_at, :updated_at, :document)"
                ), params)
            await session.commit()
            return _record_to_document({**params, "nodes": nodes, "edges": edges, "document": request.document})
        finally:
            await session.close()

    collection = mongo_store.get_collection(MONGO_COLLECTION)
    existing = await collection.find_one({"_id": graph_id})
    record = {
        "title": request.title,
        "kind": request.kind,
        "nodes": nodes,
        "edges": edges,
        "revision": int(existing.get("revision", 0)) + 1 if existing else 1,
        "created_at": existing.get("created_at", now) if existing else now,
        "updated_at": now,
        "document": request.document,
    }
    await collection.update_one({"_id": graph_id}, {"$set": record}, upsert=True)
    return _record_to_document({**record, "id": graph_id})


@router.delete("/{graph_id}")
async def delete_graph(
    graph_id: str,
    backend: str | None = Query(default=None),
    x_admin_key: str | None = Header(default=None),
    x_admin_session: str | None = Header(default=None),
):
    _check_admin(x_admin_key, x_admin_session)
    chosen = _storage_backend(backend)

    if chosen == "json":
        graphs = _read_json_store()
        removed = graphs.pop(graph_id, None) is not None
        if removed:
            _write_json_store(graphs)
        return {"deleted": removed}

    if chosen == "mysql":
        session = await _mysql_session()
        try:
            result = await session.execute(
                text("DELETE FROM graphuc_graphs WHERE id = :id"), {"id": graph_id}
            )
            await session.commit()
            return {"deleted": (result.rowcount or 0) > 0}
        finally:
            await session.close()

    result = await mongo_store.get_collection(MONGO_COLLECTION).delete_one({"_id": graph_id})
    return {"deleted": result.deleted_count > 0}
