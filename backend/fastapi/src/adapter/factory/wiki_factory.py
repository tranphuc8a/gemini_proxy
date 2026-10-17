"""Process-wide wiring for the Personal Wiki store.

One use case per backend, cached: the JSON repository keeps the whole store in
memory (a second instance would see another store), and the rate-limit counters
must outlive a request. The counters are shared by the backends, so a client
cannot create ten workspaces in each. Where they count (memory, the SQL database,
MongoDB) is `RATE_LIMIT_BACKEND`, see `rate_limit_factory`.

Backends are separate stores, not views of one: a workspace created in `json` does
not exist in `mysql`. `WIKI_STORAGE_BACKEND` names the default and `?backend=`
overrides it per request.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Query
from sqlalchemy import text

from src.adapter.factory.rate_limit_factory import build_rate_limiter
from src.adapter.output.mongostore import client as mongo_store
from src.adapter.output.mysql.db.base import get_async_session
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadRequestError
from src.application.ports.input.wiki_input_port import WikiInputPort
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.ports.output.wiki_repository_port import WikiRepositoryPort
from src.application.usecases.wiki_usecase import WikiUseCase
from src.application.utils.data_paths import data_root

SUPPORTED_BACKENDS = ("json", "mysql", "mongo")
LABELS = {"json": "Tệp JSON trên máy chủ", "mysql": "MySQL", "mongo": "MongoDB"}

_repositories: Dict[str, WikiRepositoryPort] = {}
_usecases: Dict[str, WikiUseCase] = {}
_limiters: Dict[str, RateLimiterPort] = {}


def default_backend() -> str:
    return (getattr(settings, "WIKI_STORAGE_BACKEND", "json") or "json").lower()


def resolve_backend(requested: Optional[str] = None) -> str:
    backend = (requested or default_backend()).strip().lower()
    if backend not in SUPPORTED_BACKENDS:
        raise BadRequestError(
            f"Kho lưu trữ phải là một trong: {', '.join(SUPPORTED_BACKENDS)}",
            payload={"code": "wiki_bad_backend"},
        )
    if backend == "mongo" and not mongo_store.is_configured():
        raise AppException(
            "Kho MongoDB chưa được cấu hình trên máy chủ này", status_code=503,
            code="wiki_backend_unavailable", payload={"code": "wiki_backend_unavailable"},
        )
    return backend


def _build_repository(backend: str) -> WikiRepositoryPort:
    if backend == "mysql":
        from src.adapter.output.wiki.mysql_repository import MySqlWikiRepository

        return MySqlWikiRepository()
    if backend == "mongo":
        from src.adapter.output.wiki.mongo_repository import MongoWikiRepository

        return MongoWikiRepository()
    from src.adapter.output.wiki.json_repository import JsonWikiRepository

    return JsonWikiRepository(file_path=getattr(settings, "WIKI_JSON_FILE", "data/wiki.json"))


def _limiter(name: str) -> RateLimiterPort:
    """One counter per purpose, shared by every backend's use case. All are per client address."""
    if name not in _limiters:
        if name == "workspaces":
            _limiters[name] = build_rate_limiter(
                "wiki_workspaces", max(1, int(getattr(settings, "WIKI_WORKSPACES_PER_HOUR", 10))), 3600
            )
        else:
            # Wrong keys per client address: 20 in ten minutes.
            _limiters[name] = build_rate_limiter("wiki_failures", 20, 600)
    return _limiters[name]


def get_wiki_repository(backend: Optional[str] = None) -> WikiRepositoryPort:
    chosen = resolve_backend(backend)
    if chosen not in _repositories:
        _repositories[chosen] = _build_repository(chosen)
    return _repositories[chosen]


def get_wiki_usecase(backend: Optional[str] = None) -> WikiUseCase:
    chosen = resolve_backend(backend)
    if chosen not in _usecases:
        _usecases[chosen] = WikiUseCase(
            repository=get_wiki_repository(chosen),
            max_items=int(getattr(settings, "WIKI_MAX_ITEMS", 300_000)),
            tombstone_ttl_days=int(getattr(settings, "WIKI_TOMBSTONE_DAYS", 90)),
            workspace_limiter=_limiter("workspaces"),
            failure_limiter=_limiter("failures"),
        )
    return _usecases[chosen]


def get_wiki_input_port(
    backend: Optional[str] = Query(
        default=None, max_length=16,
        description="Storage backend for this request: json, mysql or mongo. Defaults to WIKI_STORAGE_BACKEND.",
    ),
) -> WikiInputPort:
    """FastAPI dependency."""
    return get_wiki_usecase(backend)


# ------------------------------------------------------------------ backends
def _json_status() -> Dict[str, Any]:
    try:
        root = data_root().resolve()
    except Exception:  # noqa: BLE001
        return {"available": False, "persistent": False, "reason": "Máy chủ không ghi được thư mục dữ liệu"}
    temporary = Path(tempfile.gettempdir()).resolve()
    persistent = temporary != root and temporary not in root.parents
    return {
        "available": True,
        "persistent": persistent,
        "reason": "" if persistent else "Thư mục tạm: dữ liệu mất khi máy chủ khởi động lại — nên dùng MySQL hoặc MongoDB",
    }


async def _mysql_status() -> Dict[str, Any]:
    session = None
    try:
        session = get_async_session()          # may itself fail: no driver installed
        await session.execute(text("SELECT 1"))
        return {"available": True, "persistent": True, "reason": ""}
    except Exception:  # noqa: BLE001 - the driver's message could name the host
        return {"available": False, "persistent": True, "reason": "Không kết nối được MySQL"}
    finally:
        if session is not None:
            await session.close()


async def _mongo_status() -> Dict[str, Any]:
    if not mongo_store.is_configured():
        return {"available": False, "persistent": True, "reason": "Máy chủ chưa cấu hình MongoDB"}
    try:
        await mongo_store.ping()
        return {"available": True, "persistent": True, "reason": ""}
    except Exception:  # noqa: BLE001
        return {"available": False, "persistent": True, "reason": "Không kết nối được MongoDB"}


async def available_backends() -> List[Dict[str, Any]]:
    """What this deployment can serve, for a client that offers the choice.

    It connects rather than reads configuration (a URI can be present and wrong),
    and says nothing about HOW it is configured: no host, database or driver
    message, which `/storage/backends` would reveal.
    """
    statuses = {"json": _json_status(), "mysql": await _mysql_status(), "mongo": await _mongo_status()}
    return [{"id": name, "label": LABELS[name], **statuses[name]} for name in SUPPORTED_BACKENDS]


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    _repositories.clear()
    _usecases.clear()
    _limiters.clear()
