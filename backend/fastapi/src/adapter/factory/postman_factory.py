"""Process-wide wiring for the postman-lite-pro workspace store.

One usecase per backend, cached. The JSON repository keeps the whole document
set in memory, so it must be a singleton or two requests would see two different
stores; the database repositories are cached for the same reason their MySQL
tables and Mongo indexes are only created once.

Backends are separate stores, not views of one. A workspace created against
`json` does not exist in `mysql`: the id and its access key were minted in one
place. `POSTMAN_STORAGE_BACKEND` names the default, and `?backend=` lets a
client work against another one -- which is how the web app offers the choice.
"""

from __future__ import annotations

from fastapi import HTTPException, Query

from src.adapter.output.mongostore import client as mongo_store
from src.application.config.config import settings
from src.application.ports.input.postman_input_port import PostmanInputPort
from src.application.ports.output.postman_repository_port import PostmanRepositoryPort
from src.application.usecases.postman_usecase import PostmanUseCase

SUPPORTED_BACKENDS = ("json", "mysql", "mongo")

_repositories: dict[str, PostmanRepositoryPort] = {}
_usecases: dict[str, PostmanUseCase] = {}


def default_backend() -> str:
    return (getattr(settings, "POSTMAN_STORAGE_BACKEND", "json") or "json").lower()


def resolve_backend(requested: str | None = None) -> str:
    backend = (requested or default_backend()).lower()
    if backend not in SUPPORTED_BACKENDS:
        raise HTTPException(status_code=400, detail=f"Storage backend must be one of {', '.join(SUPPORTED_BACKENDS)}")
    if backend == "mongo" and not mongo_store.is_configured():
        raise HTTPException(status_code=503, detail="The mongo backend needs MONGO_URI to be configured")
    return backend


def _build_repository(backend: str) -> PostmanRepositoryPort:
    if backend == "mysql":
        from src.adapter.output.postman.mysql_repository import MySqlPostmanRepository

        return MySqlPostmanRepository()
    if backend == "mongo":
        from src.adapter.output.postman.mongo_repository import MongoPostmanRepository

        return MongoPostmanRepository()
    from src.adapter.output.postman.json_repository import JsonPostmanRepository

    return JsonPostmanRepository(file_path=getattr(settings, "POSTMAN_JSON_FILE", "data/postman-workspaces.json"))


def get_postman_repository(backend: str | None = None) -> PostmanRepositoryPort:
    chosen = resolve_backend(backend)
    if chosen not in _repositories:
        _repositories[chosen] = _build_repository(chosen)
    return _repositories[chosen]


def get_postman_usecase(backend: str | None = None) -> PostmanUseCase:
    chosen = resolve_backend(backend)
    if chosen not in _usecases:
        _usecases[chosen] = PostmanUseCase(
            repository=get_postman_repository(chosen),
            max_history=int(getattr(settings, "POSTMAN_MAX_HISTORY", 500)),
        )
    return _usecases[chosen]


def get_postman_input_port(
    backend: str | None = Query(
        default=None,
        description="Storage backend for this request: json, mysql or mongo. Defaults to POSTMAN_STORAGE_BACKEND.",
    ),
) -> PostmanInputPort:
    """FastAPI dependency."""
    return get_postman_usecase(backend)


def available_backends() -> list[dict[str, object]]:
    """What this deployment can serve, for a client that offers the choice."""
    return [
        {"id": "json", "available": True, "reason": None},
        {"id": "mysql", "available": True, "reason": None},
        {
            "id": "mongo",
            "available": mongo_store.is_configured(),
            "reason": None if mongo_store.is_configured() else "MONGO_URI is not configured on the server",
        },
    ]


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    _repositories.clear()
    _usecases.clear()
