"""SQL administrator use cases: sessions, schema browsing, data editing, console."""

from __future__ import annotations

import csv
import io
import json
import re
import secrets
from typing import Any

from src.application.exceptions.exceptions import BadRequestError, NotFoundError, UnauthorizedError
from src.application.ports.input.sql_admin_input_port import SqlAdminInputPort
from src.application.ports.output.sql_gateway_output_port import ConnectionProfile, SqlGatewayOutputPort
from src.application.ports.output.sql_session_output_port import SqlSessionOutputPort, StoredSession
from src.domain.utils.sql_identifier import (
    InvalidIdentifierError,
    qualified_name,
    quote_identifier,
    quote_string_literal,
    sort_direction,
    validate_identifier,
)
from src.domain.utils.sql_script import jsonify, split_statements, statement_kind
from src.domain.vo.sqladmin_vo import (
    BrowsePage,
    ColumnInfo,
    ConnectRequest,
    CreateDatabaseRequest,
    DatabaseInfo,
    ForeignKeyInfo,
    IndexInfo,
    MutationResult,
    ProcessInfo,
    QueryRequest,
    QueryResult,
    RowDeleteRequest,
    RowMutation,
    ServerOverview,
    SessionInfo,
    TableInfo,
    TableStructure,
)

# Charsets/collations are identifiers in CREATE DATABASE and cannot be bound.
_CHARSET_PATTERN = re.compile(r"^[A-Za-z0-9_]{1,64}$")

# Server metrics surfaced on the dashboard; the full SHOW STATUS output is noise.
_STATUS_KEYS = (
    "Uptime", "Threads_connected", "Threads_running", "Queries", "Slow_queries",
    "Connections", "Aborted_connects", "Bytes_received", "Bytes_sent", "Open_tables",
)
_VARIABLE_KEYS = (
    "version", "version_comment", "character_set_server", "collation_server", "max_connections",
    "max_allowed_packet", "sql_mode", "time_zone", "datadir", "innodb_version", "wait_timeout",
)

_SYSTEM_DATABASES = {"information_schema", "performance_schema", "mysql", "sys"}


def _validate_charset(value: str, kind: str) -> str:
    if not _CHARSET_PATTERN.match(value or ""):
        raise BadRequestError(f"Invalid {kind} name")
    return value


class SqlAdminUseCase(SqlAdminInputPort):
    def __init__(
        self,
        gateway: SqlGatewayOutputPort,
        sessions: SqlSessionOutputPort,
        max_rows_hard_limit: int = 10000,
        allow_system_database_drop: bool = False,
    ):
        self._gateway = gateway
        self._sessions = sessions
        self._max_rows_hard_limit = max_rows_hard_limit
        self._allow_system_database_drop = allow_system_database_drop

    # ------------------------------------------------------------------
    # session
    # ------------------------------------------------------------------
    async def connect(self, request: ConnectRequest) -> SessionInfo:
        if not request.username:
            raise BadRequestError("Username is required")
        if request.database:
            validate_identifier(request.database, "database")

        profile = ConnectionProfile(
            host=request.host.strip() or "localhost",
            port=request.port,
            username=request.username,
            password=request.password or "",
            database=request.database or None,
        )
        facts = await self._gateway.probe(profile)

        session = StoredSession(
            token=secrets.token_urlsafe(32),
            profile=profile,
            label=request.label or f"{request.username}@{profile.host}:{profile.port}",
            server_version=facts.get("server_version"),
            server_flavor=facts.get("server_flavor"),
            metadata={"current_user": facts.get("current_user"), "charset": facts.get("charset")},
        )
        stored = await self._sessions.create(session)
        return self._to_session_info(stored)

    async def current_session(self, token: str) -> SessionInfo:
        return self._to_session_info(await self._require_session(token))

    async def disconnect(self, token: str) -> bool:
        session = await self._sessions.get(token)
        if session is None:
            return False
        await self._gateway.release(token)
        return await self._sessions.delete(token)

    @staticmethod
    def _to_session_info(session: StoredSession) -> SessionInfo:
        return SessionInfo(
            token=session.token,
            host=session.profile.host,
            port=session.profile.port,
            username=session.profile.username,
            database=session.profile.database,
            label=session.label,
            server_version=session.server_version,
            server_flavor=session.server_flavor,
            connected_at=session.connected_at,
            last_used_at=session.last_used_at,
        )

    async def _require_session(self, token: str) -> StoredSession:
        if not token:
            raise UnauthorizedError("A session token is required")
        session = await self._sessions.touch(token)
        if session is None:
            raise UnauthorizedError("Session expired or not found; please connect again")
        return session

    async def _run(
        self,
        session: StoredSession,
        statement: str,
        params: list[Any] | None = None,
        database: str | None = None,
        max_rows: int | None = None,
    ):
        try:
            return await self._gateway.execute(
                session_id=session.token,
                profile=session.profile,
                statement=statement,
                params=params,
                database=database,
                max_rows=max_rows,
            )
        except InvalidIdentifierError as exc:
            raise BadRequestError(str(exc)) from exc

    # ------------------------------------------------------------------
    # databases
    # ------------------------------------------------------------------
    async def list_databases(self, token: str) -> list[DatabaseInfo]:
        session = await self._require_session(token)
        result = await self._run(
            session,
            "SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME "
            "FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME",
        )
        return [DatabaseInfo(name=row[0], charset=row[1], collation=row[2]) for row in result.rows]

    async def create_database(self, token: str, request: CreateDatabaseRequest) -> MutationResult:
        session = await self._require_session(token)
        name = quote_identifier(request.name, "database")
        charset = _validate_charset(request.charset, "charset")
        statement = f"CREATE DATABASE {name} CHARACTER SET {charset}"
        if request.collation:
            statement += f" COLLATE {_validate_charset(request.collation, 'collation')}"
        result = await self._run(session, statement)
        return MutationResult(affected_rows=result.affected_rows, statement=statement, duration_ms=result.duration_ms)

    async def drop_database(self, token: str, database: str) -> MutationResult:
        session = await self._require_session(token)
        if database.lower() in _SYSTEM_DATABASES and not self._allow_system_database_drop:
            raise BadRequestError(f"Refusing to drop the system database '{database}'")
        statement = f"DROP DATABASE {quote_identifier(database, 'database')}"
        result = await self._run(session, statement)
        return MutationResult(affected_rows=result.affected_rows, statement=statement, duration_ms=result.duration_ms)

    # ------------------------------------------------------------------
    # tables
    # ------------------------------------------------------------------
    async def list_tables(self, token: str, database: str) -> list[TableInfo]:
        session = await self._require_session(token)
        validate_identifier(database, "database")
        result = await self._run(
            session,
            "SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, DATA_LENGTH, TABLE_COLLATION, TABLE_COMMENT "
            "FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME",
            [database],
        )
        return [
            TableInfo(
                name=row[0],
                type=row[1] or "BASE TABLE",
                engine=row[2],
                rows=int(row[3]) if row[3] is not None else None,
                data_length=int(row[4]) if row[4] is not None else None,
                collation=row[5],
                comment=row[6],
            )
            for row in result.rows
        ]

    async def _columns(self, session: StoredSession, database: str, table: str) -> list[ColumnInfo]:
        validate_identifier(database, "database")
        validate_identifier(table, "table")
        result = await self._run(
            session,
            "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, "
            "EXTRA, COLUMN_COMMENT, ORDINAL_POSITION FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION",
            [database, table],
        )
        if not result.rows:
            raise NotFoundError(f"Table '{database}.{table}' was not found")
        return [
            ColumnInfo(
                name=row[0],
                data_type=row[1],
                column_type=row[2],
                nullable=str(row[3]).upper() == "YES",
                key=row[4] or None,
                default=row[5],
                extra=row[6] or None,
                comment=row[7] or None,
                position=int(row[8] or 0),
            )
            for row in result.rows
        ]

    async def table_structure(self, token: str, database: str, table: str) -> TableStructure:
        session = await self._require_session(token)
        columns = await self._columns(session, database, table)

        index_rows = await self._run(
            session,
            "SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, INDEX_TYPE FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY INDEX_NAME, SEQ_IN_INDEX",
            [database, table],
        )
        indexes: dict[str, IndexInfo] = {}
        for name, non_unique, column, index_type in index_rows.rows:
            entry = indexes.setdefault(
                name, IndexInfo(name=name, unique=not int(non_unique or 0), index_type=index_type)
            )
            entry.columns.append(column)

        fk_rows = await self._run(
            session,
            "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, "
            "REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND REFERENCED_TABLE_NAME IS NOT NULL",
            [database, table],
        )
        foreign_keys = [
            ForeignKeyInfo(
                name=row[0],
                column=row[1],
                referenced_schema=row[2],
                referenced_table=row[3],
                referenced_column=row[4],
            )
            for row in fk_rows.rows
        ]

        ddl = None
        try:
            ddl_result = await self._run(session, f"SHOW CREATE TABLE {qualified_name(database, table)}")
            if ddl_result.rows and len(ddl_result.rows[0]) > 1:
                ddl = ddl_result.rows[0][1]
        except Exception:
            # Views and restricted grants can refuse SHOW CREATE; structure still renders.
            ddl = None

        return TableStructure(
            database=database,
            table=table,
            columns=columns,
            indexes=list(indexes.values()),
            foreign_keys=foreign_keys,
            primary_key=[c.name for c in columns if c.key == "PRI"],
            ddl=ddl,
        )

    async def drop_table(self, token: str, database: str, table: str) -> MutationResult:
        session = await self._require_session(token)
        statement = f"DROP TABLE {qualified_name(database, table)}"
        result = await self._run(session, statement)
        return MutationResult(affected_rows=result.affected_rows, statement=statement, duration_ms=result.duration_ms)

    async def truncate_table(self, token: str, database: str, table: str) -> MutationResult:
        session = await self._require_session(token)
        statement = f"TRUNCATE TABLE {qualified_name(database, table)}"
        result = await self._run(session, statement)
        return MutationResult(affected_rows=result.affected_rows, statement=statement, duration_ms=result.duration_ms)

    # ------------------------------------------------------------------
    # rows
    # ------------------------------------------------------------------
    async def browse_table(
        self,
        token: str,
        database: str,
        table: str,
        limit: int = 50,
        offset: int = 0,
        order_by: str | None = None,
        direction: str | None = None,
        search: str | None = None,
    ) -> BrowsePage:
        session = await self._require_session(token)
        columns = await self._columns(session, database, table)
        column_names = [c.name for c in columns]
        limit = max(1, min(int(limit), self._max_rows_hard_limit))
        offset = max(0, int(offset))

        where_sql = ""
        params: list[Any] = []
        if search:
            # CONCAT_WS skips NULLs, so one bound parameter covers every column.
            haystack = ", ".join(quote_identifier(name, "column") for name in column_names)
            where_sql = f" WHERE CONCAT_WS(0x1f, {haystack}) LIKE %s"
            params.append(f"%{search}%")

        order_sql = ""
        if order_by:
            if order_by not in column_names:
                raise BadRequestError(f"Unknown sort column '{order_by}'")
            order_sql = f" ORDER BY {quote_identifier(order_by, 'column')} {sort_direction(direction)}"

        target = qualified_name(database, table)
        count_result = await self._run(session, f"SELECT COUNT(*) FROM {target}{where_sql}", list(params))
        total = int(count_result.rows[0][0]) if count_result.rows else 0

        data_result = await self._run(
            session,
            f"SELECT * FROM {target}{where_sql}{order_sql} LIMIT %s OFFSET %s",
            [*params, limit, offset],
            max_rows=limit,
        )
        rows = [dict(zip(data_result.columns, record)) for record in data_result.rows]

        return BrowsePage(
            database=database,
            table=table,
            columns=columns,
            primary_key=[c.name for c in columns if c.key == "PRI"],
            rows=rows,
            total=total,
            limit=limit,
            offset=offset,
            duration_ms=round(count_result.duration_ms + data_result.duration_ms, 3),
        )

    def _where_from_key(self, key: dict[str, Any], column_names: list[str]) -> tuple[str, list[Any]]:
        if not key:
            raise BadRequestError("A row key is required; this table has no primary key selection")
        clauses: list[str] = []
        params: list[Any] = []
        for name, value in key.items():
            if name not in column_names:
                raise BadRequestError(f"Unknown key column '{name}'")
            quoted = quote_identifier(name, "column")
            if value is None:
                clauses.append(f"{quoted} IS NULL")
            else:
                clauses.append(f"{quoted} = %s")
                params.append(value)
        return " AND ".join(clauses), params

    async def insert_row(self, token: str, database: str, table: str, payload: RowMutation) -> MutationResult:
        session = await self._require_session(token)
        columns = await self._columns(session, database, table)
        column_names = [c.name for c in columns]
        values = {k: v for k, v in (payload.values or {}).items() if k in column_names}
        if not values:
            raise BadRequestError("No recognisable column values were supplied")

        cols_sql = ", ".join(quote_identifier(name, "column") for name in values)
        placeholders = ", ".join(["%s"] * len(values))
        statement = f"INSERT INTO {qualified_name(database, table)} ({cols_sql}) VALUES ({placeholders})"
        result = await self._run(session, statement, list(values.values()))
        return MutationResult(
            affected_rows=result.affected_rows,
            last_insert_id=result.last_insert_id,
            statement=statement,
            duration_ms=result.duration_ms,
        )

    async def update_row(self, token: str, database: str, table: str, payload: RowMutation) -> MutationResult:
        session = await self._require_session(token)
        columns = await self._columns(session, database, table)
        column_names = [c.name for c in columns]
        values = {k: v for k, v in (payload.values or {}).items() if k in column_names}
        if not values:
            raise BadRequestError("No recognisable column values were supplied")

        where_sql, where_params = self._where_from_key(payload.key or {}, column_names)
        set_sql = ", ".join(f"{quote_identifier(name, 'column')} = %s" for name in values)
        statement = f"UPDATE {qualified_name(database, table)} SET {set_sql} WHERE {where_sql} LIMIT 1"
        result = await self._run(session, statement, [*values.values(), *where_params])
        return MutationResult(affected_rows=result.affected_rows, statement=statement, duration_ms=result.duration_ms)

    async def delete_rows(self, token: str, database: str, table: str, payload: RowDeleteRequest) -> MutationResult:
        session = await self._require_session(token)
        columns = await self._columns(session, database, table)
        column_names = [c.name for c in columns]

        affected = 0
        duration = 0.0
        last_statement = None
        for key in payload.keys:
            where_sql, params = self._where_from_key(key, column_names)
            statement = f"DELETE FROM {qualified_name(database, table)} WHERE {where_sql} LIMIT 1"
            result = await self._run(session, statement, params)
            affected += result.affected_rows
            duration += result.duration_ms
            last_statement = statement
        return MutationResult(affected_rows=affected, statement=last_statement, duration_ms=round(duration, 3))

    # ------------------------------------------------------------------
    # console
    # ------------------------------------------------------------------
    async def run_sql(self, token: str, request: QueryRequest) -> list[QueryResult]:
        session = await self._require_session(token)
        statements = split_statements(request.sql)
        if not statements:
            raise BadRequestError("No executable statement was found")
        if request.database:
            validate_identifier(request.database, "database")

        max_rows = min(int(request.max_rows), self._max_rows_hard_limit)
        results: list[QueryResult] = []
        for statement in statements:
            kind = statement_kind(statement)
            try:
                raw = await self._run(
                    session,
                    statement,
                    database=request.database,
                    max_rows=max_rows + 1 if kind == "read" else None,
                )
            except Exception as exc:
                # Report the failure in-band and stop: later statements may
                # depend on this one having succeeded.
                results.append(QueryResult(statement=statement, kind=kind, error=str(exc)))
                break

            truncated = kind == "read" and len(raw.rows) > max_rows
            rows = raw.rows[:max_rows] if truncated else raw.rows
            results.append(
                QueryResult(
                    statement=statement,
                    kind=kind,
                    columns=raw.columns,
                    column_types=raw.column_types,
                    rows=rows,
                    row_count=len(rows),
                    affected_rows=raw.affected_rows,
                    last_insert_id=raw.last_insert_id,
                    duration_ms=raw.duration_ms,
                    truncated=truncated,
                )
            )
        return results

    # ------------------------------------------------------------------
    # server
    # ------------------------------------------------------------------
    async def server_overview(self, token: str) -> ServerOverview:
        session = await self._require_session(token)
        status_result = await self._run(session, "SHOW GLOBAL STATUS")
        variables_result = await self._run(session, "SHOW GLOBAL VARIABLES")
        status = {row[0]: jsonify(row[1]) for row in status_result.rows if row[0] in _STATUS_KEYS}
        variables = {row[0]: jsonify(row[1]) for row in variables_result.rows if row[0] in _VARIABLE_KEYS}
        uptime = status.get("Uptime")
        return ServerOverview(
            version=session.server_version,
            flavor=session.server_flavor,
            uptime_seconds=int(uptime) if str(uptime or "").isdigit() else None,
            current_user=session.metadata.get("current_user"),
            charset=session.metadata.get("charset"),
            status=status,
            variables=variables,
        )

    async def process_list(self, token: str) -> list[ProcessInfo]:
        session = await self._require_session(token)
        result = await self._run(session, "SHOW FULL PROCESSLIST")
        index = {name.lower(): position for position, name in enumerate(result.columns)}

        def field(row: list[Any], name: str) -> Any:
            position = index.get(name)
            return row[position] if position is not None and position < len(row) else None

        processes: list[ProcessInfo] = []
        for row in result.rows:
            raw_time = field(row, "time")
            processes.append(
                ProcessInfo(
                    id=int(field(row, "id") or 0),
                    user=field(row, "user"),
                    host=field(row, "host"),
                    db=field(row, "db"),
                    command=field(row, "command"),
                    time=int(raw_time) if str(raw_time or "").lstrip("-").isdigit() else None,
                    state=field(row, "state"),
                    info=field(row, "info"),
                )
            )
        return processes

    # ------------------------------------------------------------------
    # export
    # ------------------------------------------------------------------
    async def export_table(self, token: str, database: str, table: str, fmt: str, limit: int) -> dict[str, Any]:
        session = await self._require_session(token)
        fmt = (fmt or "csv").lower()
        if fmt not in {"csv", "json", "sql"}:
            raise BadRequestError("Export format must be one of: csv, json, sql")

        limit = max(1, min(int(limit), self._max_rows_hard_limit))
        result = await self._run(
            session, f"SELECT * FROM {qualified_name(database, table)} LIMIT %s", [limit], max_rows=limit
        )
        columns = result.columns
        rows = result.rows

        if fmt == "csv":
            buffer = io.StringIO()
            writer = csv.writer(buffer, lineterminator="\n")
            writer.writerow(columns)
            for row in rows:
                writer.writerow(["" if value is None else value for value in row])
            content, media_type = buffer.getvalue(), "text/csv"
        elif fmt == "json":
            content = json.dumps([dict(zip(columns, row)) for row in rows], indent=2, ensure_ascii=False)
            media_type = "application/json"
        else:
            lines = [f"-- Export of {database}.{table} ({len(rows)} rows)"]
            try:
                ddl_result = await self._run(session, f"SHOW CREATE TABLE {qualified_name(database, table)}")
                if ddl_result.rows and len(ddl_result.rows[0]) > 1:
                    lines.append(f"{ddl_result.rows[0][1]};")
            except Exception:
                pass
            cols_sql = ", ".join(quote_identifier(name, "column") for name in columns)
            target = qualified_name(database, table)
            for row in rows:
                rendered = ", ".join(
                    "NULL"
                    if value is None
                    else (str(value) if isinstance(value, (int, float)) else quote_string_literal(value))
                    for value in row
                )
                lines.append(f"INSERT INTO {target} ({cols_sql}) VALUES ({rendered});")
            content, media_type = "\n".join(lines), "application/sql"

        return {
            "filename": f"{database}.{table}.{fmt}",
            "media_type": media_type,
            "content": content,
            "row_count": len(rows),
        }
