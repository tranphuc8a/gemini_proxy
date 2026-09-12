"""Process-wide wiring for the SQL administrator feature.

The gateway holds connection pools and the session store holds logins, so both
are singletons for the life of the process rather than per-request objects.
"""

from __future__ import annotations

from src.adapter.output.sqlgateway.mysql_gateway import MySqlGateway
from src.adapter.output.sqlgateway.session_store import FileSessionStore
from src.application.config.config import settings
from src.application.ports.input.sql_admin_input_port import SqlAdminInputPort
from src.application.usecases.sql_admin_usecase import SqlAdminUseCase

_gateway: MySqlGateway | None = None
_sessions: FileSessionStore | None = None
_usecase: SqlAdminUseCase | None = None


def get_gateway() -> MySqlGateway:
    global _gateway
    if _gateway is None:
        _gateway = MySqlGateway(
            connect_timeout=getattr(settings, "SQLADMIN_CONNECT_TIMEOUT", 10),
            pool_max_size=getattr(settings, "SQLADMIN_POOL_SIZE", 5),
            statement_timeout=getattr(settings, "SQLADMIN_STATEMENT_TIMEOUT", 60),
        )
    return _gateway


def get_session_store() -> FileSessionStore:
    global _sessions
    if _sessions is None:
        _sessions = FileSessionStore(
            file_path=getattr(settings, "SQLADMIN_SESSION_FILE", "data/sqladmin-sessions.json"),
            secret=getattr(settings, "SQLADMIN_SECRET_KEY", "") or "",
            persist=bool(getattr(settings, "SQLADMIN_PERSIST_SESSIONS", True)),
        )
    return _sessions


def get_sql_admin_usecase() -> SqlAdminUseCase:
    global _usecase
    if _usecase is None:
        _usecase = SqlAdminUseCase(
            gateway=get_gateway(),
            sessions=get_session_store(),
            max_rows_hard_limit=getattr(settings, "SQLADMIN_MAX_ROWS", 10000),
        )
    return _usecase


def get_sql_admin_input_port() -> SqlAdminInputPort:
    """FastAPI dependency."""
    return get_sql_admin_usecase()


async def shutdown_sql_admin() -> None:
    if _gateway is not None:
        await _gateway.release_all()


def reset_for_tests() -> None:
    """Drop the cached singletons so each test builds its own wiring."""
    global _gateway, _sessions, _usecase
    _gateway = None
    _sessions = None
    _usecase = None
