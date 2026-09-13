"""Process-wide wiring for the MongoDB administrator feature.

The gateway holds one driver client per session and the session store holds the
logins, so both are singletons for the life of the process rather than
per-request objects.
"""

from __future__ import annotations

from src.adapter.output.mongogateway.mongo_gateway import MongoGateway
from src.adapter.output.mongogateway.session_store import FileMongoSessionStore
from src.application.config.config import settings
from src.application.ports.input.mongo_admin_input_port import MongoAdminInputPort
from src.application.usecases.mongo_admin_usecase import MongoAdminUseCase

_gateway: MongoGateway | None = None
_sessions: FileMongoSessionStore | None = None
_usecase: MongoAdminUseCase | None = None


def get_gateway() -> MongoGateway:
    global _gateway
    if _gateway is None:
        _gateway = MongoGateway(
            connect_timeout=getattr(settings, "MONGOADMIN_CONNECT_TIMEOUT", 10),
            operation_timeout=getattr(settings, "MONGOADMIN_OPERATION_TIMEOUT", 60),
            pool_max_size=getattr(settings, "MONGOADMIN_POOL_SIZE", 10),
        )
    return _gateway


def get_session_store() -> FileMongoSessionStore:
    global _sessions
    if _sessions is None:
        _sessions = FileMongoSessionStore(
            file_path=getattr(settings, "MONGOADMIN_SESSION_FILE", "data/mongoadmin-sessions.json"),
            secret=getattr(settings, "MONGOADMIN_SECRET_KEY", "") or "",
            persist=bool(getattr(settings, "MONGOADMIN_PERSIST_SESSIONS", True)),
        )
    return _sessions


def get_mongo_admin_usecase() -> MongoAdminUseCase:
    global _usecase
    if _usecase is None:
        _usecase = MongoAdminUseCase(
            gateway=get_gateway(),
            sessions=get_session_store(),
            max_documents_hard_limit=getattr(settings, "MONGOADMIN_MAX_DOCUMENTS", 1000),
        )
    return _usecase


def get_mongo_admin_input_port() -> MongoAdminInputPort:
    """FastAPI dependency."""
    return get_mongo_admin_usecase()


async def shutdown_mongo_admin() -> None:
    if _gateway is not None:
        await _gateway.release_all()


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    global _gateway, _sessions, _usecase
    _gateway = None
    _sessions = None
    _usecase = None
