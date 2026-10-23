"""Process-wide wiring of the markdown editor's read-only share links.

One use case per backend, cached: the JSON repository keeps every link in memory (a
second instance would see another store) and the rate-limit counters must outlive a
request. The two counters (public reads, wrong tokens) are shared by the backends and
keyed by client address; where they count is `RATE_LIMIT_BACKEND` (`rate_limit_factory`).

The backend is the one the editor's document tree uses (`MARKDOWN_STORAGE_BACKEND`,
overridden per request with `?backend=`); each is a separate store of links.
"""

from __future__ import annotations

import os
from typing import Dict, Optional

from fastapi import Query

from src.adapter.factory.rate_limit_factory import build_rate_limiter
from src.adapter.output.mongostore import client as mongo_store
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadRequestError
from src.application.ports.input.markdown_share_input_port import MarkdownShareInputPort
from src.application.ports.output.markdown_share_repository_port import MarkdownShareRepositoryPort
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.usecases.markdown_share_usecase import MarkdownShareUseCase
from src.application.utils.data_paths import is_temporary_data_root

SUPPORTED_BACKENDS = ("json", "mysql", "mongo")

_repositories: Dict[str, MarkdownShareRepositoryPort] = {}
_usecases: Dict[str, MarkdownShareUseCase] = {}
_limiters: Dict[str, RateLimiterPort] = {}


def _setting(name: str, default):
    return getattr(settings, name, default)


def default_backend() -> str:
    return (os.getenv("MARKDOWN_STORAGE_BACKEND") or _setting("MARKDOWN_STORAGE_BACKEND", "json") or "json").lower()


def resolve_backend(requested: Optional[str] = None) -> str:
    backend = (requested or default_backend()).strip().lower()
    if backend not in SUPPORTED_BACKENDS:
        raise BadRequestError(
            f"Kho lưu trữ phải là một trong: {', '.join(SUPPORTED_BACKENDS)}",
            payload={"code": "markdown_bad_backend"},
        )
    if backend == "mongo" and not mongo_store.is_configured():
        raise AppException(
            "Kho MongoDB chưa được cấu hình trên máy chủ này", status_code=503,
            code="markdown_backend_unavailable", payload={"code": "markdown_backend_unavailable"},
        )
    return backend


def _build_repository(backend: str) -> MarkdownShareRepositoryPort:
    if backend == "mysql":
        from src.adapter.output.markdown_share.mysql_repository import MySqlMarkdownShareRepository

        return MySqlMarkdownShareRepository()
    if backend == "mongo":
        from src.adapter.output.markdown_share.mongo_repository import MongoMarkdownShareRepository

        return MongoMarkdownShareRepository()
    from src.adapter.output.markdown_share.json_repository import JsonMarkdownShareRepository

    return JsonMarkdownShareRepository(file_path=_setting("MARKDOWN_SHARES_JSON_FILE", "data/markdown-shares.json"))


def _limiter(name: str) -> RateLimiterPort:
    if name not in _limiters:
        if name == "reads":
            per_minute = max(1, int(_setting("MARKDOWN_SHARE_READS_PER_MIN", 120)))
            _limiters[name] = build_rate_limiter("markdown_share_reads", per_minute, 60)
        else:
            # Unknown tokens: 20 in ten minutes per address, apart from the reads.
            _limiters[name] = build_rate_limiter("markdown_share_misses", 20, 600)
    return _limiters[name]


def get_markdown_share_repository(backend: Optional[str] = None) -> MarkdownShareRepositoryPort:
    """The (cached) link store of a backend: the delta sync carries renamed document ids into it."""
    chosen = resolve_backend(backend)
    if chosen not in _repositories:
        _repositories[chosen] = _build_repository(chosen)
    return _repositories[chosen]


def get_markdown_share_usecase(backend: Optional[str] = None) -> MarkdownShareUseCase:
    chosen = resolve_backend(backend)
    if chosen not in _usecases:
        if chosen not in _repositories:
            _repositories[chosen] = _build_repository(chosen)
        _usecases[chosen] = MarkdownShareUseCase(
            repository=_repositories[chosen],
            max_shares=int(_setting("MARKDOWN_MAX_SHARES", 50)),
            max_bytes=int(_setting("MARKDOWN_SHARE_MAX_BYTES", 2_000_000)),
            read_limiter=_limiter("reads"),
            miss_limiter=_limiter("misses"),
            persistent=chosen != "json" or not is_temporary_data_root(),
        )
    return _usecases[chosen]


def get_markdown_share_input_port(
    backend: Optional[str] = Query(
        default=None, max_length=16,
        description="Storage backend: json, mysql or mongo. Defaults to MARKDOWN_STORAGE_BACKEND.",
    ),
) -> MarkdownShareInputPort:
    """FastAPI dependency."""
    return get_markdown_share_usecase(backend)


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    _repositories.clear()
    _usecases.clear()
    _limiters.clear()
