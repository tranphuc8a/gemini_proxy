"""Process-wide wiring for the postman-lite-pro workspace store.

The JSON repository keeps the whole document set in memory, so it must be a
singleton or two requests would see two different stores.
"""

from __future__ import annotations

from src.application.config.config import settings
from src.application.ports.input.postman_input_port import PostmanInputPort
from src.application.ports.output.postman_repository_port import PostmanRepositoryPort
from src.application.usecases.postman_usecase import PostmanUseCase

_repository: PostmanRepositoryPort | None = None
_usecase: PostmanUseCase | None = None


def get_postman_repository() -> PostmanRepositoryPort:
    global _repository
    if _repository is None:
        backend = (getattr(settings, "POSTMAN_STORAGE_BACKEND", "json") or "json").lower()
        if backend == "mysql":
            from src.adapter.output.postman.mysql_repository import MySqlPostmanRepository

            _repository = MySqlPostmanRepository()
        else:
            from src.adapter.output.postman.json_repository import JsonPostmanRepository

            _repository = JsonPostmanRepository(
                file_path=getattr(settings, "POSTMAN_JSON_FILE", "data/postman-workspaces.json")
            )
    return _repository


def get_postman_usecase() -> PostmanUseCase:
    global _usecase
    if _usecase is None:
        _usecase = PostmanUseCase(
            repository=get_postman_repository(),
            max_history=int(getattr(settings, "POSTMAN_MAX_HISTORY", 500)),
        )
    return _usecase


def get_postman_input_port() -> PostmanInputPort:
    """FastAPI dependency."""
    return get_postman_usecase()


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    global _repository, _usecase
    _repository = None
    _usecase = None
