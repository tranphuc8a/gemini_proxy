"""Shared document store behind the markdown-editor web app.

Three interchangeable backends sit behind one pair of endpoints, chosen per
request with `?backend=`:

* ``json``  - one file, no database. The zero-setup default, and the only one
  that works on a laptop with nothing installed. On a serverless platform its
  file lives in an ephemeral directory (see `application/utils/data_paths`), so
  it is a scratchpad there, not storage.
* ``mysql`` - flat rows, one per node, rebuilt into a tree on read.
* ``mongo`` - the same flat shape in a collection, for deployments that have a
  MongoDB but no MySQL.

Both database backends keep an explicit ``sort_order``: a tree read back in
whatever order the storage engine felt like returning rows is not the tree the
user saved.
"""

import os
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from src.adapter.output.mongostore import client as mongo_store
from src.adapter.output.mysql.db.base import get_async_session
from src.application.config.config import settings
from src.application.utils import admin_session
from src.application.utils.data_paths import seeded_data_path

router = APIRouter(prefix="/markdown", tags=["markdown-storage"])

#: Namespaces the HMAC so a token minted here cannot be replayed against another
#: app that shares the same admin key.
SESSION_SALT = "markdown-editor"

MONGO_COLLECTION = "markdown_files"

SUPPORTED_BACKENDS = ("json", "mysql", "mongo")


class MarkdownFile(BaseModel):
    id: str
    name: str
    type: Literal["file", "folder"]
    content: str | None = None
    children: list["MarkdownFile"] | None = None
    parentId: str | None = None


class MarkdownDocument(BaseModel):
    files: list[MarkdownFile] = Field(default_factory=list)


class AdminSessionResponse(BaseModel):
    ok: bool = True
    session: str
    expiresAt: int


class BackendInfo(BaseModel):
    id: str
    available: bool
    reason: str | None = None


def _storage_backend(requested: str | None = None) -> str:
    backend = requested or os.getenv("MARKDOWN_STORAGE_BACKEND", getattr(settings, "MARKDOWN_STORAGE_BACKEND", "json"))
    if backend not in SUPPORTED_BACKENDS:
        raise HTTPException(status_code=400, detail=f"Storage backend must be one of {', '.join(SUPPORTED_BACKENDS)}")
    if backend == "mongo" and not mongo_store.is_configured():
        raise HTTPException(status_code=503, detail="The mongo backend needs MONGO_URI to be configured")
    return backend


def _admin_key() -> str:
    return os.getenv("MARKDOWN_ADMIN_KEY", getattr(settings, "MARKDOWN_ADMIN_KEY", "markdown-editor-admin-2024"))


def _check_admin(admin_key: str | None, session_token: str | None = None) -> None:
    """Accept either the key itself or a session token issued in exchange for it.

    The token exists so a reload does not sign the user out: the key stays in the
    user's head and the server's config, while the browser only ever stores a
    signed expiry.
    """
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


def _json_path() -> Path:
    configured = os.getenv("MARKDOWN_JSON_FILE", getattr(settings, "MARKDOWN_JSON_FILE", "data/markdown-files.json"))
    # Not `Path.cwd() / configured`: the deployment directory is read-only on a
    # serverless platform. See src/application/utils/data_paths.py.
    return seeded_data_path(configured)


# ------------------------------------------------------------------ tree shape

def _flatten(nodes: list[MarkdownFile], parent_id: str | None = None):
    """Depth-first walk yielding (node, parent_id, position among its siblings)."""
    for position, node in enumerate(nodes):
        yield node, parent_id, position
        if node.children:
            yield from _flatten(node.children, node.id)


def _rows_to_tree(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rebuild the tree, restoring sibling order from `sort_order`.

    A node whose parent is missing becomes a root rather than disappearing: a
    half-written save should cost the user a nesting level, not a file.
    """
    nodes: dict[str, dict[str, Any]] = {}
    order: dict[str, int] = {}
    for row in rows:
        nodes[row["id"]] = {
            "id": row["id"], "name": row["name"], "type": row["node_type"],
            "content": row["content"], "parentId": row["parent_id"], "children": []
        }
        order[row["id"]] = int(row.get("sort_order") or 0)

    roots: list[dict[str, Any]] = []
    for node in nodes.values():
        parent = nodes.get(node["parentId"])
        if parent:
            parent["children"].append(node)
        else:
            roots.append(node)

    def sort_level(level: list[dict[str, Any]]) -> None:
        level.sort(key=lambda item: order.get(item["id"], 0))
        for item in level:
            sort_level(item["children"])

    sort_level(roots)
    return roots


# ----------------------------------------------------------------- mysql rows

_CREATE_TABLE = """
    CREATE TABLE IF NOT EXISTS markdown_files (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        node_type VARCHAR(20) NOT NULL,
        content LONGTEXT NULL,
        parent_id VARCHAR(255) NULL,
        sort_order INT NOT NULL DEFAULT 0
    )
"""


async def _ensure_mysql_schema(session) -> None:
    await session.execute(text(_CREATE_TABLE))
    try:
        # Tables created before sort_order existed. MySQL has no portable
        # "ADD COLUMN IF NOT EXISTS", so the duplicate-column error is the check.
        await session.execute(text("ALTER TABLE markdown_files ADD COLUMN sort_order INT NOT NULL DEFAULT 0"))
        await session.commit()
    except Exception:
        await session.rollback()


async def _read_mysql() -> list[dict[str, Any]]:
    session = get_async_session()
    try:
        await _ensure_mysql_schema(session)
        result = await session.execute(
            text("SELECT id, name, node_type, content, parent_id, sort_order FROM markdown_files")
        )
        return [dict(row._mapping) for row in result]
    finally:
        await session.close()


async def _write_mysql(document: MarkdownDocument) -> None:
    session = get_async_session()
    try:
        await _ensure_mysql_schema(session)
        await session.execute(text("DELETE FROM markdown_files"))
        for node, parent_id, position in _flatten(document.files):
            await session.execute(text("""
                INSERT INTO markdown_files (id, name, node_type, content, parent_id, sort_order)
                VALUES (:id, :name, :node_type, :content, :parent_id, :sort_order)
            """), {"id": node.id, "name": node.name, "node_type": node.type,
                   "content": node.content, "parent_id": parent_id, "sort_order": position})
        await session.commit()
    finally:
        await session.close()


# ------------------------------------------------------------------ mongo docs

async def _read_mongo() -> list[dict[str, Any]]:
    collection = mongo_store.get_collection(MONGO_COLLECTION)
    rows: list[dict[str, Any]] = []
    async for doc in collection.find({}):
        rows.append({
            "id": doc.get("_id"),
            "name": doc.get("name"),
            "node_type": doc.get("node_type"),
            "content": doc.get("content"),
            "parent_id": doc.get("parent_id"),
            "sort_order": doc.get("sort_order", 0),
        })
    return rows


async def _write_mongo(document: MarkdownDocument) -> None:
    collection = mongo_store.get_collection(MONGO_COLLECTION)
    payload = [
        {
            "_id": node.id,
            "name": node.name,
            "node_type": node.type,
            "content": node.content,
            "parent_id": parent_id,
            "sort_order": position,
        }
        for node, parent_id, position in _flatten(document.files)
    ]
    # Delete-then-insert, matching the MySQL path: the client always sends the
    # whole tree, so a diff would only add a way for the two to drift apart.
    await collection.delete_many({})
    if payload:
        await collection.insert_many(payload)


# -------------------------------------------------------------------- endpoints

@router.get("/backends", response_model=list[BackendInfo])
async def list_backends():
    """Which storage backends this deployment can actually serve.

    The editor shows all three; without this it would offer `mongo` on a
    deployment that has no MongoDB and only find out on the first save.
    """
    return [
        BackendInfo(id="json", available=True),
        BackendInfo(id="mysql", available=True),
        BackendInfo(
            id="mongo",
            available=mongo_store.is_configured(),
            reason=None if mongo_store.is_configured() else "MONGO_URI is not configured on the server",
        ),
    ]


@router.post("/admin/verify", response_model=AdminSessionResponse)
async def verify_admin_key(x_admin_key: str | None = Header(default=None)):
    """Exchange the admin key for a session token.

    The key must not travel in the bundle: a VITE_* value is compiled into the
    JavaScript, so anyone opening DevTools could read it, and a client-side
    comparison proves nothing anyway. The key the user types is verified here and
    then exchanged for a token, so the browser has something it can keep across a
    reload without ever storing the key.
    """
    _check_admin(x_admin_key)
    issued = admin_session.issue(
        _admin_key(),
        salt=SESSION_SALT,
        ttl_seconds=int(getattr(settings, "MARKDOWN_SESSION_HOURS", 12)) * 3600,
    )
    return AdminSessionResponse(session=issued.token, expiresAt=issued.expires_at)


@router.post("/admin/session", response_model=AdminSessionResponse)
async def refresh_admin_session(x_admin_session: str | None = Header(default=None)):
    """Check a stored token on page load, and hand back a fresh one.

    Re-issuing keeps an active user signed in without ever extending the life of
    a token that has already expired.
    """
    _check_admin(None, x_admin_session)
    issued = admin_session.issue(
        _admin_key(),
        salt=SESSION_SALT,
        ttl_seconds=int(getattr(settings, "MARKDOWN_SESSION_HOURS", 12)) * 3600,
    )
    return AdminSessionResponse(session=issued.token, expiresAt=issued.expires_at)


@router.get("/files", response_model=MarkdownDocument)
async def get_markdown_files(backend: str | None = Query(default=None)):
    chosen = _storage_backend(backend)
    if chosen == "json":
        path = _json_path()
        if not path.exists():
            return MarkdownDocument()
        return MarkdownDocument.model_validate_json(path.read_text(encoding="utf-8"))
    rows = await (_read_mysql() if chosen == "mysql" else _read_mongo())
    return MarkdownDocument(files=_rows_to_tree(rows))


@router.put("/files", response_model=MarkdownDocument)
async def save_markdown_files(
    document: MarkdownDocument,
    backend: str | None = Query(default=None),
    x_admin_key: str | None = Header(default=None),
    x_admin_session: str | None = Header(default=None),
):
    _check_admin(x_admin_key, x_admin_session)
    chosen = _storage_backend(backend)

    if chosen == "json":
        path = _json_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(document.model_dump_json(indent=2), encoding="utf-8")
    elif chosen == "mysql":
        await _write_mysql(document)
    else:
        await _write_mongo(document)
    return document
