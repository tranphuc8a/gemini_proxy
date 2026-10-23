"""Process-wide wiring of the markdown delta sync (md-sync B11).

One use case per backend, cached: the JSON repository keeps the whole store in memory (a second
instance would see another store), and the use case remembers that the lazy migration is done.
The backend is the one the editor's document tree uses (`MARKDOWN_STORAGE_BACKEND`, overridden
per request with `?backend=`); each is a separate store with its own records and history.

The old whole-tree store is read by `LegacyMarkdownReader` (only to be copied once), and the
share links of the same backend follow renamed document ids (`share_repository`).
"""

from __future__ import annotations

import re
from typing import Dict, Optional

from fastapi import Query

from src.adapter.factory.markdown_share_factory import get_markdown_share_repository, resolve_backend
from src.application.config.config import settings
from src.application.ports.input.markdown_docs_input_port import MarkdownDocsInputPort
from src.application.ports.output.markdown_docs_repository_port import MarkdownDocsRepositoryPort
from src.application.usecases.markdown_docs_usecase import MarkdownDocsUseCase

_repositories: Dict[str, MarkdownDocsRepositoryPort] = {}
_usecases: Dict[str, MarkdownDocsUseCase] = {}


def _setting(name: str, default):
    return getattr(settings, name, default)


def tz_minutes(value: str) -> int:
    """`"+07:00"` / `"-0330"` as minutes east of UTC; anything unreadable is UTC."""
    match = re.fullmatch(r"([+-])(\d{1,2}):?(\d{2})?", str(value or "").strip())
    if not match:
        return 0
    minutes = int(match.group(2)) * 60 + int(match.group(3) or 0)
    return -minutes if match.group(1) == "-" else minutes


def _build_repository(backend: str) -> MarkdownDocsRepositoryPort:
    if backend == "mysql":
        from src.adapter.output.markdown_docs.mysql_repository import MySqlMarkdownDocsRepository

        return MySqlMarkdownDocsRepository()
    if backend == "mongo":
        from src.adapter.output.markdown_docs.mongo_repository import MongoMarkdownDocsRepository

        return MongoMarkdownDocsRepository()
    from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository

    return JsonMarkdownDocsRepository(file_path=_setting("MARKDOWN_DOCS_JSON_FILE", "data/markdown-docs.json"))


def get_markdown_docs_usecase(backend: Optional[str] = None) -> MarkdownDocsUseCase:
    chosen = resolve_backend(backend)
    if chosen not in _usecases:
        from src.adapter.output.markdown_docs.legacy_reader import LegacyMarkdownReader

        if chosen not in _repositories:
            _repositories[chosen] = _build_repository(chosen)
        _usecases[chosen] = MarkdownDocsUseCase(
            repository=_repositories[chosen],
            legacy_reader=LegacyMarkdownReader(),
            share_repository=get_markdown_share_repository(chosen),
            backend=chosen,
            max_doc_bytes=int(_setting("MARKDOWN_DOC_MAX_BYTES", 3_500_000)),
            max_push_bytes=int(_setting("MARKDOWN_PUSH_MAX_BYTES", 4_000_000)),
            max_docs=int(_setting("MARKDOWN_MAX_DOCS", 20_000)),
            keep_recent=int(_setting("MARKDOWN_HISTORY_KEEP_RECENT", 50)),
            daily_days=int(_setting("MARKDOWN_HISTORY_DAILY_DAYS", 90)),
            coalesce_ms=int(_setting("MARKDOWN_HISTORY_COALESCE_S", 600)) * 1000,
            history_tz_minutes=tz_minutes(_setting("MARKDOWN_HISTORY_TZ", "+07:00")),
            tombstone_days=int(_setting("MARKDOWN_TOMBSTONE_DAYS", 90)),
        )
    return _usecases[chosen]


def get_markdown_docs_input_port(
    backend: Optional[str] = Query(
        default=None, max_length=16,
        description="Storage backend: json, mysql or mongo. Defaults to MARKDOWN_STORAGE_BACKEND.",
    ),
) -> MarkdownDocsInputPort:
    """FastAPI dependency."""
    return get_markdown_docs_usecase(backend)


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    _repositories.clear()
    _usecases.clear()
