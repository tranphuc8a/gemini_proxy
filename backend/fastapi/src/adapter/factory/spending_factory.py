"""Process-wide wiring for the personal-spending workspace store.

One usecase per backend, cached. The JSON repository keeps the whole document
set in memory, so it must be a singleton or two requests would see two different
stores; the database repositories are cached for the same reason their MySQL
table is only created once.

Backends are separate stores, not views of one. A workspace created against
`json` does not exist in `mysql`: the id and its access key were minted in one
place. `SPENDING_STORAGE_BACKEND` names the default, and `?backend=` lets a
client work against another one -- which is how the web app offers the choice.
"""

from __future__ import annotations

from fastapi import HTTPException, Query

from src.adapter.output.mongostore import client as mongo_store
from src.application.config.config import settings
from src.application.ports.input.spending_input_port import SpendingInputPort
from src.application.ports.output.spending_repository_port import SpendingRepositoryPort
from src.application.usecases.spending_usecase import SpendingUseCase

SUPPORTED_BACKENDS = ("json", "mysql", "mongo")

_repositories: dict[str, SpendingRepositoryPort] = {}
_usecases: dict[str, SpendingUseCase] = {}


def default_backend() -> str:
    return (getattr(settings, "SPENDING_STORAGE_BACKEND", "json") or "json").lower()


def resolve_backend(requested: str | None = None) -> str:
    backend = (requested or default_backend()).lower()
    if backend not in SUPPORTED_BACKENDS:
        raise HTTPException(status_code=400, detail=f"Storage backend must be one of {', '.join(SUPPORTED_BACKENDS)}")
    if backend == "mongo" and not mongo_store.is_configured():
        raise HTTPException(status_code=503, detail="The mongo backend needs MONGO_URI to be configured")
    return backend


def _build_repository(backend: str) -> SpendingRepositoryPort:
    if backend == "mysql":
        from src.adapter.output.spending.mysql_repository import MySqlSpendingRepository

        return MySqlSpendingRepository()
    if backend == "mongo":
        from src.adapter.output.spending.mongo_repository import MongoSpendingRepository

        return MongoSpendingRepository()
    from src.adapter.output.spending.json_repository import JsonSpendingRepository

    return JsonSpendingRepository(file_path=getattr(settings, "SPENDING_JSON_FILE", "data/spending-workspaces.json"))


def get_spending_repository(backend: str | None = None) -> SpendingRepositoryPort:
    chosen = resolve_backend(backend)
    if chosen not in _repositories:
        _repositories[chosen] = _build_repository(chosen)
    return _repositories[chosen]


def get_spending_usecase(backend: str | None = None) -> SpendingUseCase:
    chosen = resolve_backend(backend)
    if chosen not in _usecases:
        _usecases[chosen] = SpendingUseCase(
            repository=get_spending_repository(chosen),
            max_bytes=int(getattr(settings, "SPENDING_MAX_BYTES", 4_000_000)),
        )
    return _usecases[chosen]


def get_spending_input_port(
    backend: str | None = Query(
        default=None,
        description="Storage backend for this request: json, mysql or mongo. Defaults to SPENDING_STORAGE_BACKEND.",
    ),
) -> SpendingInputPort:
    """FastAPI dependency."""
    return get_spending_usecase(backend)


async def available_backends() -> list[dict[str, object]]:
    """What this deployment can serve, for a client that offers the choice.

    Connects rather than reads configuration: a URI can be present and wrong,
    and the picker used to offer such a backend until the first save failed.
    """
    from src.adapter.input.controllers.storage_controller import list_backends as probe

    return [
        {"id": status.id, "available": status.available, "reason": status.detail}
        for status in await probe()
    ]


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    _repositories.clear()
    _usecases.clear()
