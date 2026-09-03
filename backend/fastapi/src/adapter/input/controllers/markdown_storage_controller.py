import os
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from src.adapter.output.mysql.db.base import get_async_session
from src.application.config.config import settings

router = APIRouter(prefix="/markdown", tags=["markdown-storage"])


class MarkdownFile(BaseModel):
    id: str
    name: str
    type: Literal["file", "folder"]
    content: str | None = None
    children: list["MarkdownFile"] | None = None
    parentId: str | None = None


class MarkdownDocument(BaseModel):
    files: list[MarkdownFile] = Field(default_factory=list)


def _storage_backend(requested: str | None = None) -> str:
    backend = requested or os.getenv("MARKDOWN_STORAGE_BACKEND", getattr(settings, "MARKDOWN_STORAGE_BACKEND", "json"))
    if backend not in {"json", "mysql"}:
        raise HTTPException(status_code=500, detail="MARKDOWN_STORAGE_BACKEND must be json or mysql")
    return backend


def _check_admin(admin_key: str | None) -> None:
    expected = os.getenv("MARKDOWN_ADMIN_KEY", getattr(settings, "MARKDOWN_ADMIN_KEY", "markdown-editor-admin-2024"))
    if not admin_key or admin_key != expected:
        raise HTTPException(status_code=403, detail="Admin key required")


def _json_path() -> Path:
    configured = os.getenv("MARKDOWN_JSON_FILE", getattr(settings, "MARKDOWN_JSON_FILE", "data/markdown-files.json"))
    path = Path(configured)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path


async def _read_mysql() -> list[dict[str, Any]]:
    session = get_async_session()
    try:
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS markdown_files (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                node_type VARCHAR(20) NOT NULL,
                content LONGTEXT NULL,
                parent_id VARCHAR(255) NULL
            )
        """))
        result = await session.execute(text("SELECT id, name, node_type, content, parent_id FROM markdown_files"))
        return [dict(row._mapping) for row in result]
    finally:
        await session.close()


def _rows_to_tree(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    nodes: dict[str, dict[str, Any]] = {}
    for row in rows:
        nodes[row["id"]] = {
            "id": row["id"], "name": row["name"], "type": row["node_type"],
            "content": row["content"], "parentId": row["parent_id"], "children": []
        }
    roots: list[dict[str, Any]] = []
    for node in nodes.values():
        parent = nodes.get(node["parentId"])
        if parent:
            parent["children"].append(node)
        else:
            roots.append(node)
    return roots


@router.get("/files", response_model=MarkdownDocument)
async def get_markdown_files(backend: str | None = Query(default=None)):
    if _storage_backend(backend) == "json":
        path = _json_path()
        if not path.exists():
            return MarkdownDocument()
        return MarkdownDocument.model_validate_json(path.read_text(encoding="utf-8"))
    return MarkdownDocument(files=_rows_to_tree(await _read_mysql()))


@router.put("/files", response_model=MarkdownDocument)
async def save_markdown_files(document: MarkdownDocument, backend: str | None = Query(default=None), x_admin_key: str | None = Header(default=None)):
    _check_admin(x_admin_key)
    backend = _storage_backend(backend)
    if backend == "json":
        path = _json_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(document.model_dump_json(indent=2), encoding="utf-8")
        return document

    session = get_async_session()
    try:
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS markdown_files (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                node_type VARCHAR(20) NOT NULL,
                content LONGTEXT NULL,
                parent_id VARCHAR(255) NULL
            )
        """))
        await session.execute(text("DELETE FROM markdown_files"))

        def flatten(nodes: list[MarkdownFile], parent_id: str | None = None):
            for node in nodes:
                yield node, parent_id
                if node.children:
                    yield from flatten(node.children, node.id)

        for node, parent_id in flatten(document.files):
            await session.execute(text("""
                INSERT INTO markdown_files (id, name, node_type, content, parent_id)
                VALUES (:id, :name, :node_type, :content, :parent_id)
            """), {"id": node.id, "name": node.name, "node_type": node.type,
                  "content": node.content, "parent_id": parent_id})
        await session.commit()
        return document
    finally:
        await session.close()
