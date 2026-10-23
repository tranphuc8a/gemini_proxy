"""Read-only access to the OLD markdown store (the whole-tree `PUT /markdown/files` one).

The first call of the new client to `/markdown/sync/*` copies this store into the delta store
(`MarkdownDocsUseCase.ensure_migrated`). Nothing here ever writes: the old data stays exactly
as it is, so the migration can be abandoned and the old app keeps working.

The three backends hold the same tree in three shapes (`markdown_storage_controller`):
one nested JSON file, rows of `markdown_files`, and documents of the `markdown_files`
collection. They are flattened to rows `{id, name, kind, content, parent_id}`. The names
(file, table, collection) are the controller's; they are repeated, not imported, because an
output adapter must not depend on an input controller.

MySQL: the legacy table is created if absent (`CREATE TABLE IF NOT EXISTS`, the same statement
the controller runs on every read) rather than "SELECT and swallow the error": a failing read
must stop the migration, not look like an empty store that gets flagged as migrated.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from sqlalchemy import text

from src.adapter.output.mongostore import client as mongo_store
from src.adapter.output.mysql.db.base import get_async_session
from src.application.config.config import settings
from src.application.ports.output.markdown_docs_repository_port import LegacyMarkdownReaderPort
from src.application.utils.data_paths import seeded_data_path

LEGACY_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS markdown_files (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        node_type VARCHAR(20) NOT NULL,
        content LONGTEXT NULL,
        parent_id VARCHAR(255) NULL,
        sort_order INT NOT NULL DEFAULT 0
    )
"""
LEGACY_COLLECTION = "markdown_files"


def _kind(value: Any) -> str:
    return "folder" if value == "folder" else "file"


def _flatten(nodes: List[Dict[str, Any]], parent_id: Any, out: List[Dict[str, Any]], depth: int = 0) -> None:
    if depth > 200:                      # a hand-edited file with a runaway nest must not hang the migration
        return
    for node in nodes or []:
        if not isinstance(node, dict) or node.get("id") is None:
            continue
        out.append({
            "id": str(node["id"]), "name": str(node.get("name") or ""), "kind": _kind(node.get("type")),
            "content": node.get("content"), "parent_id": parent_id,
        })
        children = node.get("children")
        if children:
            _flatten(children, str(node["id"]), out, depth + 1)


class LegacyMarkdownReader(LegacyMarkdownReaderPort):
    async def read_tree(self, backend: str) -> List[Dict[str, Any]]:
        if backend == "mysql":
            return await self._read_mysql()
        if backend == "mongo":
            return await self._read_mongo()
        return self._read_json()

    @staticmethod
    def _read_json() -> List[Dict[str, Any]]:
        configured = os.getenv("MARKDOWN_JSON_FILE", getattr(settings, "MARKDOWN_JSON_FILE", "data/markdown-files.json"))
        path = seeded_data_path(configured)
        if not path.exists():
            return []
        document = json.loads(path.read_text(encoding="utf-8"))      # a corrupt file raises: not "empty"
        rows: List[Dict[str, Any]] = []
        _flatten(document.get("files") or [], None, rows)
        return rows

    @staticmethod
    async def _read_mysql() -> List[Dict[str, Any]]:
        session = get_async_session()
        try:
            await session.execute(text(LEGACY_TABLE_SQL))
            await session.commit()
            result = await session.execute(text("SELECT id, name, node_type, content, parent_id FROM markdown_files"))
            return [
                {"id": row.id, "name": row.name or "", "kind": _kind(row.node_type), "content": row.content,
                 "parent_id": row.parent_id}
                for row in result
            ]
        finally:
            await session.close()

    @staticmethod
    async def _read_mongo() -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        async for doc in mongo_store.get_collection(LEGACY_COLLECTION).find({}):
            rows.append({
                "id": str(doc.get("_id")), "name": doc.get("name") or "", "kind": _kind(doc.get("node_type")),
                "content": doc.get("content"), "parent_id": doc.get("parent_id"),
            })
        return rows
