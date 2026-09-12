"""aiomysql-backed gateway to arbitrary MySQL/MariaDB servers.

This is deliberately separate from `adapter/output/mysql`, which owns the
application's *own* database through SQLAlchemy. Here the target server is
chosen by the end user at login time, so connections are pooled per session and
torn down on logout.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Sequence

from src.application.exceptions.exceptions import (
    BadGatewayError,
    BadRequestError,
    GatewayTimeoutError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.output.sql_gateway_output_port import (
    ConnectionProfile,
    RawResult,
    SqlGatewayOutputPort,
)
from src.domain.utils.sql_identifier import quote_identifier
from src.domain.utils.sql_script import jsonify

logger = logging.getLogger(__name__)

# MySQL server error codes worth mapping onto specific HTTP statuses.
_ACCESS_DENIED = {1044, 1045, 1142, 1143, 1227, 1370}
_UNKNOWN_OBJECT = {1049, 1146, 1054, 1146}

_FIELD_TYPE_NAMES: dict[int, str] = {}


def _field_type_name(code: int) -> str:
    if not _FIELD_TYPE_NAMES:
        try:
            from pymysql.constants import FIELD_TYPE

            for name in dir(FIELD_TYPE):
                if name.isupper():
                    value = getattr(FIELD_TYPE, name)
                    if isinstance(value, int):
                        _FIELD_TYPE_NAMES.setdefault(value, name)
        except Exception:  # pragma: no cover - pymysql always ships with aiomysql
            pass
    return _FIELD_TYPE_NAMES.get(code, "UNKNOWN")


def _translate_error(exc: Exception) -> Exception:
    """Map driver errors onto the application's exception vocabulary."""
    code: int | None = None
    message = str(exc)
    args = getattr(exc, "args", ())
    if args and isinstance(args[0], int):
        code = args[0]
        if len(args) > 1 and isinstance(args[1], str):
            message = args[1]

    if isinstance(exc, asyncio.TimeoutError):
        return GatewayTimeoutError("The database server did not respond in time")
    if code in _ACCESS_DENIED:
        return UnauthorizedError(message)
    if code in _UNKNOWN_OBJECT:
        return NotFoundError(message)
    if code is not None and 1000 <= code < 2000:
        # Syntax errors, constraint violations, bad values: the client's fault.
        return BadRequestError(message, payload={"mysql_errno": code})
    return BadGatewayError(message or "Could not reach the database server")


class MySqlGateway(SqlGatewayOutputPort):
    def __init__(self, connect_timeout: int = 10, pool_max_size: int = 5, statement_timeout: int = 60):
        self._pools: dict[str, Any] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._connect_timeout = connect_timeout
        self._pool_max_size = pool_max_size
        self._statement_timeout = statement_timeout

    # --- connection management -------------------------------------------
    @staticmethod
    def _import_driver():
        try:
            import aiomysql
        except ModuleNotFoundError as exc:  # pragma: no cover - install-time problem
            raise BadGatewayError(
                "aiomysql is not installed; run 'pip install -r requirements.txt'"
            ) from exc
        return aiomysql

    async def probe(self, profile: ConnectionProfile) -> dict[str, Any]:
        aiomysql = self._import_driver()
        try:
            conn = await asyncio.wait_for(
                aiomysql.connect(
                    host=profile.host,
                    port=profile.port,
                    user=profile.username,
                    password=profile.password,
                    db=profile.database or None,
                    charset=profile.charset,
                    autocommit=True,
                    connect_timeout=self._connect_timeout,
                ),
                timeout=self._connect_timeout + 2,
            )
        except Exception as exc:
            raise _translate_error(exc) from exc

        try:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT VERSION(), CURRENT_USER(), @@character_set_server")
                row = await cursor.fetchone()
            version = str(row[0]) if row else None
            return {
                "server_version": version,
                "server_flavor": "MariaDB" if version and "mariadb" in version.lower() else "MySQL",
                "current_user": str(row[1]) if row else None,
                "charset": str(row[2]) if row else None,
            }
        except Exception as exc:
            raise _translate_error(exc) from exc
        finally:
            conn.close()

    async def _get_pool(self, session_id: str, profile: ConnectionProfile):
        pool = self._pools.get(session_id)
        if pool is not None and not pool._closed:  # noqa: SLF001 - aiomysql exposes no public flag
            return pool

        lock = self._locks.setdefault(session_id, asyncio.Lock())
        async with lock:
            pool = self._pools.get(session_id)
            if pool is not None and not pool._closed:  # noqa: SLF001
                return pool
            aiomysql = self._import_driver()
            try:
                pool = await asyncio.wait_for(
                    aiomysql.create_pool(
                        host=profile.host,
                        port=profile.port,
                        user=profile.username,
                        password=profile.password,
                        db=profile.database or None,
                        charset=profile.charset,
                        autocommit=True,
                        minsize=1,
                        maxsize=self._pool_max_size,
                        pool_recycle=300,
                        connect_timeout=self._connect_timeout,
                    ),
                    timeout=self._connect_timeout + 2,
                )
            except Exception as exc:
                raise _translate_error(exc) from exc
            self._pools[session_id] = pool
            return pool

    # --- execution --------------------------------------------------------
    async def execute(
        self,
        session_id: str,
        profile: ConnectionProfile,
        statement: str,
        params: Sequence[Any] | None = None,
        database: str | None = None,
        max_rows: int | None = None,
    ) -> RawResult:
        pool = await self._get_pool(session_id, profile)
        started = time.perf_counter()
        try:
            async with pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    if database:
                        # Set explicitly on every call: pooled connections are
                        # shared and may carry another statement's schema.
                        await cursor.execute(f"USE {quote_identifier(database, 'database')}")
                    await asyncio.wait_for(
                        cursor.execute(statement, tuple(params) if params else None),
                        timeout=self._statement_timeout,
                    )
                    columns: list[str] = []
                    column_types: list[str] = []
                    rows: list[list[Any]] = []
                    if cursor.description:
                        columns = [str(d[0]) for d in cursor.description]
                        column_types = [_field_type_name(int(d[1])) for d in cursor.description]
                        fetched = (
                            await cursor.fetchmany(max_rows)
                            if max_rows is not None
                            else await cursor.fetchall()
                        )
                        rows = [[jsonify(value) for value in record] for record in (fetched or [])]
                    return RawResult(
                        columns=columns,
                        column_types=column_types,
                        rows=rows,
                        affected_rows=int(cursor.rowcount or 0),
                        last_insert_id=int(cursor.lastrowid) if cursor.lastrowid else None,
                        duration_ms=round((time.perf_counter() - started) * 1000, 3),
                    )
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def release(self, session_id: str) -> None:
        pool = self._pools.pop(session_id, None)
        self._locks.pop(session_id, None)
        if pool is None:
            return
        try:
            pool.close()
            await pool.wait_closed()
        except Exception as exc:  # pragma: no cover - teardown is best effort
            logger.debug("Ignoring error while closing pool: %s", exc)

    async def release_all(self) -> None:
        for session_id in list(self._pools.keys()):
            await self.release(session_id)
