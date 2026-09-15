"""SQL administrator use cases: sessions, schema browsing, data editing, console."""

from __future__ import annotations

import csv
import io
import json
import re
import secrets
import time
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
from src.domain.utils.sql_ddl import (
    column_list,
    referential_action,
    render_column,
    routine_kind,
    validate_charset,
    validate_check_option,
    validate_engine,
)
from src.domain.utils.sql_dump import render_values, routine_name, split_dump, utc_now
from src.domain.utils.sql_script import jsonify, split_statements, statement_kind
from src.domain.vo.sqladmin_vo import (
    AddColumnRequest,
    BackupRequest,
    BackupResult,
    BrowsePage,
    CallRoutineRequest,
    ColumnInfo,
    ConnectRequest,
    CreateDatabaseRequest,
    CreateTableRequest,
    DatabaseInfo,
    DropColumnRequest,
    ForeignKeyInfo,
    ForeignKeyRequest,
    IndexInfo,
    IndexRequest,
    ModifyColumnRequest,
    MutationResult,
    PrimaryKeyRequest,
    ProcessInfo,
    QueryRequest,
    QueryResult,
    RenameTableRequest,
    RestoreRequest,
    RestoreResult,
    RoutineInfo,
    RoutineRequest,
    RowDeleteRequest,
    RowMutation,
    ServerOverview,
    SessionInfo,
    TableInfo,
    TableStructure,
    TriggerInfo,
    ViewInfo,
    ViewRequest,
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


    async def _mutate(self, session: StoredSession, statement: str) -> MutationResult:
        """Run a statement and report it the way every other mutation does."""
        result = await self._run(session, statement)
        return MutationResult(
            affected_rows=result.affected_rows, statement=statement, duration_ms=result.duration_ms
        )

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
            # From the index, not from column order: a composite key on
            # (tag, book_id) is a different key from (book_id, tag) -- the
            # leftmost-prefix rule makes the order part of what it does -- and
            # filtering the column list would always report the table's order.
            primary_key=[
                name
                for name in (indexes["PRIMARY"].columns if "PRIMARY" in indexes else [])
            ] or [c.name for c in columns if c.key == "PRI"],
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
            # Column order is fine here: this list is used to identify a row
            # for editing, where the *set* of key columns is what matters. The
            # ordered version lives in `table_structure`, which describes the
            # key itself.
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

    # ------------------------------------------------------------------
    # schema editing
    #
    # Every statement below is assembled from validated parts, never from a
    # caller's string. The one endpoint that does take raw SQL is `/query`,
    # where that is the whole point; a form that builds DDL must not become a
    # second one by accident.
    # ------------------------------------------------------------------
    async def create_table(self, token: str, database: str, request: CreateTableRequest) -> MutationResult:
        session = await self._require_session(token)
        clauses = [render_column(column) for column in request.columns]
        if request.primary_key:
            clauses.append(f"PRIMARY KEY ({column_list(request.primary_key)})")

        options = []
        engine = validate_engine(request.engine)
        if engine:
            options.append(f"ENGINE={engine}")
        charset = validate_charset(request.charset)
        if charset:
            options.append(f"DEFAULT CHARSET={charset}")
        if request.comment:
            options.append(f"COMMENT={quote_string_literal(request.comment)}")

        statement = (
            f"CREATE TABLE {qualified_name(database, request.name)} "
            f"({', '.join(clauses)})" + (" " + " ".join(options) if options else "")
        )
        return await self._mutate(session, statement)

    async def add_column(self, token: str, database: str, table: str, request: AddColumnRequest) -> MutationResult:
        session = await self._require_session(token)
        statement = (
            f"ALTER TABLE {qualified_name(database, table)} "
            f"ADD COLUMN {render_column(request.column, with_position=True)}"
        )
        return await self._mutate(session, statement)

    async def modify_column(self, token: str, database: str, table: str, request: ModifyColumnRequest) -> MutationResult:
        session = await self._require_session(token)
        # CHANGE rather than MODIFY: it is the only form that can rename, so one
        # verb covers both editing a column and renaming it.
        statement = (
            f"ALTER TABLE {qualified_name(database, table)} CHANGE COLUMN "
            f"{quote_identifier(request.name, 'column')} {render_column(request.column, with_position=True)}"
        )
        return await self._mutate(session, statement)

    async def drop_column(self, token: str, database: str, table: str, request: DropColumnRequest) -> MutationResult:
        session = await self._require_session(token)
        statement = (
            f"ALTER TABLE {qualified_name(database, table)} "
            f"DROP COLUMN {quote_identifier(request.name, 'column')}"
        )
        return await self._mutate(session, statement)

    async def rename_table(self, token: str, database: str, table: str, request: RenameTableRequest) -> MutationResult:
        session = await self._require_session(token)
        statement = (
            f"RENAME TABLE {qualified_name(database, table)} TO {qualified_name(database, request.new_name)}"
        )
        return await self._mutate(session, statement)

    # ----------------------------------------------------------- keys/indexes
    async def set_primary_key(self, token: str, database: str, table: str, request: PrimaryKeyRequest) -> MutationResult:
        """Replace (or drop) the primary key in a single ALTER.

        Drop-then-add in two statements is the obvious implementation and it
        fails on any server running with `sql_require_primary_key=ON` -- managed
        MySQL commonly does, Aiven included. The drop is refused, the add then
        reports "Multiple primary key defined", and the user is told something
        that has nothing to do with what went wrong. One statement never leaves
        the table without a key, so the policy is satisfied and the change is
        atomic into the bargain.
        """
        session = await self._require_session(token)
        target = qualified_name(database, table)

        existing = await self._run(
            session,
            "SELECT COUNT(*) FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND INDEX_NAME = 'PRIMARY'",
            [validate_identifier(database, "database"), validate_identifier(table, "table")],
        )
        has_primary_key = bool(existing.rows and existing.rows[0][0])

        if not request.columns:
            if not has_primary_key:
                raise BadRequestError(f"Bảng '{table}' vốn không có khoá chính")
            return await self._mutate(session, f"ALTER TABLE {target} DROP PRIMARY KEY")

        clause = f"ADD PRIMARY KEY ({column_list(request.columns)})"
        if has_primary_key:
            clause = f"DROP PRIMARY KEY, {clause}"
        return await self._mutate(session, f"ALTER TABLE {target} {clause}")

    async def create_index(self, token: str, database: str, table: str, request: IndexRequest) -> MutationResult:
        session = await self._require_session(token)
        unique = "UNIQUE " if request.unique else ""
        statement = (
            f"CREATE {unique}INDEX {quote_identifier(request.name, 'index')} "
            f"ON {qualified_name(database, table)} ({column_list(request.columns)})"
        )
        return await self._mutate(session, statement)

    async def drop_index(self, token: str, database: str, table: str, name: str) -> MutationResult:
        session = await self._require_session(token)
        statement = f"DROP INDEX {quote_identifier(name, 'index')} ON {qualified_name(database, table)}"
        return await self._mutate(session, statement)

    async def create_foreign_key(self, token: str, database: str, table: str, request: ForeignKeyRequest) -> MutationResult:
        session = await self._require_session(token)
        if len(request.columns) != len(request.referenced_columns):
            raise BadRequestError("So cot nguon va cot tham chieu phai bang nhau")

        target_schema = request.referenced_schema or database
        statement = (
            f"ALTER TABLE {qualified_name(database, table)} "
            f"ADD CONSTRAINT {quote_identifier(request.name, 'constraint')} "
            f"FOREIGN KEY ({column_list(request.columns)}) "
            f"REFERENCES {qualified_name(target_schema, request.referenced_table)} "
            f"({column_list(request.referenced_columns)})"
        )
        on_delete = referential_action(request.on_delete)
        if on_delete:
            statement += f" ON DELETE {on_delete}"
        on_update = referential_action(request.on_update)
        if on_update:
            statement += f" ON UPDATE {on_update}"
        return await self._mutate(session, statement)

    async def drop_foreign_key(self, token: str, database: str, table: str, name: str) -> MutationResult:
        session = await self._require_session(token)
        statement = (
            f"ALTER TABLE {qualified_name(database, table)} "
            f"DROP FOREIGN KEY {quote_identifier(name, 'constraint')}"
        )
        return await self._mutate(session, statement)

    # ------------------------------------------------------------------ views
    async def list_views(self, token: str, database: str) -> list[ViewInfo]:
        session = await self._require_session(token)
        result = await self._run(
            session,
            "SELECT TABLE_NAME, IS_UPDATABLE, DEFINER, SECURITY_TYPE, VIEW_DEFINITION "
            "FROM information_schema.VIEWS WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME",
            [validate_identifier(database, "database")],
        )
        return [
            ViewInfo(
                name=row[0],
                updatable=str(row[1]).upper() == "YES",
                definer=row[2],
                security=row[3],
                definition=row[4],
            )
            for row in result.rows
        ]

    async def get_view(self, token: str, database: str, view: str) -> ViewInfo:
        views = [item for item in await self.list_views(token, database) if item.name == view]
        if not views:
            raise NotFoundError(f"View '{view}' khong ton tai trong '{database}'")

        found = views[0]
        if not found.definition:
            # information_schema blanks VIEW_DEFINITION for a user without SHOW
            # VIEW on the object; SHOW CREATE VIEW still answers.
            session = await self._require_session(token)
            result = await self._run(session, f"SHOW CREATE VIEW {qualified_name(database, view)}")
            if result.rows and len(result.rows[0]) > 1:
                found.definition = result.rows[0][1]
        return found

    async def save_view(self, token: str, database: str, request: ViewRequest) -> MutationResult:
        session = await self._require_session(token)
        select = (request.select or "").strip().rstrip(";")
        if not select:
            raise BadRequestError("View can mot cau SELECT")
        # One statement, and a reading one. A view body carrying a second
        # statement would turn "save this view" into arbitrary execution.
        if len(split_statements(select)) > 1:
            raise BadRequestError("Dinh nghia view chi duoc la mot cau lenh")
        if statement_kind(select) != "read":
            raise BadRequestError("Dinh nghia view phai la mot cau SELECT")

        verb = "CREATE OR REPLACE VIEW" if request.replace else "CREATE VIEW"
        statement = f"{verb} {qualified_name(database, request.name)} AS {select}"
        check = validate_check_option(request.check_option)
        if check:
            statement += f" WITH {check} CHECK OPTION"
        return await self._mutate(session, statement)

    async def drop_view(self, token: str, database: str, view: str) -> MutationResult:
        session = await self._require_session(token)
        return await self._mutate(session, f"DROP VIEW {qualified_name(database, view)}")

    # --------------------------------------------------------------- routines
    async def list_routines(self, token: str, database: str) -> list[RoutineInfo]:
        session = await self._require_session(token)
        schema = validate_identifier(database, "database")
        result = await self._run(
            session,
            "SELECT ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER, EXTERNAL_LANGUAGE, IS_DETERMINISTIC, "
            "SECURITY_TYPE, ROUTINE_COMMENT, CREATED, LAST_ALTERED "
            "FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = %s "
            "ORDER BY ROUTINE_TYPE, ROUTINE_NAME",
            [schema],
        )
        routines = [
            RoutineInfo(
                name=row[0],
                kind="FUNCTION" if str(row[1]).upper() == "FUNCTION" else "PROCEDURE",
                returns=row[2],
                language=row[3],
                deterministic=str(row[4]).upper() == "YES",
                security=row[5],
                comment=row[6],
                created=str(row[7]) if row[7] else None,
                modified=str(row[8]) if row[8] else None,
            )
            for row in result.rows
        ]

        # Parameters live in another table. One query for all of them rather than
        # one per routine: a schema with thirty routines would be thirty trips.
        params = await self._run(
            session,
            "SELECT SPECIFIC_NAME, PARAMETER_MODE, PARAMETER_NAME, DTD_IDENTIFIER "
            "FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA = %s AND ORDINAL_POSITION > 0 "
            "ORDER BY SPECIFIC_NAME, ORDINAL_POSITION",
            [schema],
        )
        signatures: dict[str, list[str]] = {}
        for row in params.rows:
            signatures.setdefault(row[0], []).append(
                " ".join(str(part) for part in [row[1], row[2], row[3]] if part)
            )
        for routine in routines:
            routine.parameters = ", ".join(signatures.get(routine.name, []))
        return routines

    async def get_routine(self, token: str, database: str, name: str, kind: str) -> RoutineInfo:
        session = await self._require_session(token)
        wanted = "FUNCTION" if str(kind).upper() == "FUNCTION" else "PROCEDURE"
        matches = [
            item for item in await self.list_routines(token, database)
            if item.name == name and item.kind == wanted
        ]
        if not matches:
            raise NotFoundError(f"{wanted} '{name}' khong ton tai trong '{database}'")

        found = matches[0]
        result = await self._run(session, f"SHOW CREATE {wanted} {qualified_name(database, name)}")
        if result.rows:
            row = result.rows[0]
            # The body is the third column for both FUNCTION and PROCEDURE.
            found.definition = row[2] if len(row) > 2 else None
        return found

    async def save_routine(self, token: str, database: str, request: RoutineRequest) -> MutationResult:
        session = await self._require_session(token)
        statement = (request.statement or "").strip().rstrip(";")
        # Checked, not trusted. A routine body is one statement that happens to
        # contain semicolons, so it cannot go through the script splitter; what
        # can be checked is that it really is a CREATE FUNCTION/PROCEDURE.
        kind = routine_kind(statement)

        if request.replace:
            name = routine_name(statement)
            if name:
                try:
                    await self._run(session, f"DROP {kind} IF EXISTS {qualified_name(database, name)}")
                except Exception:  # noqa: BLE001 - nothing to drop is fine
                    pass

        # USE picks the schema: a routine body cannot reliably be qualified, so
        # the current database is what decides where it lands.
        await self._run(session, f"USE {quote_identifier(database, 'database')}")
        return await self._mutate(session, statement)

    async def drop_routine(self, token: str, database: str, name: str, kind: str) -> MutationResult:
        session = await self._require_session(token)
        wanted = "FUNCTION" if str(kind).upper() == "FUNCTION" else "PROCEDURE"
        return await self._mutate(session, f"DROP {wanted} {qualified_name(database, name)}")

    async def call_routine(self, token: str, database: str, request: CallRoutineRequest) -> QueryResult:
        session = await self._require_session(token)
        placeholders = ", ".join(["%s"] * len(request.arguments))
        statement = f"CALL {qualified_name(database, request.name)}({placeholders})"
        started = time.perf_counter()
        result = await self._run(session, statement, list(request.arguments))
        return QueryResult(
            statement=statement,
            kind="read" if result.columns else "write",
            columns=list(result.columns),
            rows=[[jsonify(value) for value in row] for row in result.rows],
            row_count=len(result.rows),
            affected_rows=result.affected_rows,
            duration_ms=(time.perf_counter() - started) * 1000,
        )

    async def list_triggers(self, token: str, database: str) -> list[TriggerInfo]:
        session = await self._require_session(token)
        result = await self._run(
            session,
            "SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION, ACTION_STATEMENT "
            "FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = %s "
            "ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME",
            [validate_identifier(database, "database")],
        )
        return [
            TriggerInfo(name=row[0], table=row[1], timing=row[2], event=row[3], statement=row[4])
            for row in result.rows
        ]

    # ------------------------------------------------------------------
    # backup & restore
    # ------------------------------------------------------------------
    async def backup_database(self, token: str, database: str, request: BackupRequest) -> BackupResult:
        """Produce a .sql dump this tool can read back.

        Written by hand rather than by shelling out to `mysqldump`, because the
        deployment this runs in has no mysql client binary and, on a serverless
        platform, no way to install one. The trade is that the dump is only as
        complete as what `information_schema` exposes -- which covers tables,
        views and routines, and does not cover users or grants.
        """
        session = await self._require_session(token)
        schema = validate_identifier(database, "database")
        generated_at = utc_now()

        # The DDL below comes from SHOW CREATE TABLE, which quotes identifiers
        # according to the *server's* sql_mode. A server running ANSI_QUOTES --
        # managed MySQL often does, Aiven included -- emits "name" rather than
        # `name`, and a dump that then reset SQL_MODE to something without
        # ANSI_QUOTES could not be read back: every CREATE TABLE failed as a
        # syntax error. So the mode travels with the dump, as mysqldump does.
        mode_result = await self._run(session, "SELECT @@SESSION.sql_mode")
        server_mode = (mode_result.rows[0][0] if mode_result.rows else "") or ""
        modes = [part for part in str(server_mode).split(",") if part]
        if "NO_AUTO_VALUE_ON_ZERO" not in modes:
            modes.append("NO_AUTO_VALUE_ON_ZERO")

        header = [
            f"-- gemini-proxy sql-administrator dump of `{schema}`",
            f"-- generated at {generated_at}",
            f"-- schema: {request.include_schema}, data: {request.include_data}, "
            f"routines: {request.include_routines}, views: {request.include_views}",
            "",
            "SET FOREIGN_KEY_CHECKS = 0;",
            f"SET SQL_MODE = {quote_string_literal(','.join(modes))};",
            "",
        ]
        body: list[str] = []

        listing = await self._run(
            session,
            "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME",
            [schema],
        )
        wanted = set(request.tables or [])
        base_tables = [row[0] for row in listing.rows if str(row[1]).upper() == "BASE TABLE"]
        view_names = [row[0] for row in listing.rows if str(row[1]).upper() == "VIEW"]
        if wanted:
            base_tables = [name for name in base_tables if name in wanted]
            view_names = [name for name in view_names if name in wanted]

        total_rows = 0
        truncated: list[str] = []

        for table in base_tables:
            # Unqualified on purpose. SHOW CREATE TABLE emits an unqualified
            # CREATE, so the restore's `USE` is what decides where a table
            # lands; qualifying only the INSERTs would send the rows to the
            # schema the dump came from and leave the restored tables empty.
            # Unqualified throughout is also what makes a dump portable between
            # schemas, which is most of the point of having one.
            target = quote_identifier(table, "table")
            source = qualified_name(schema, table)
            body.append(f"-- ---------- table `{table}`")
            if request.drop_if_exists and request.include_schema:
                body.append(f"DROP TABLE IF EXISTS {target};")
            if request.include_schema:
                ddl = await self._run(session, f"SHOW CREATE TABLE {source}")
                if ddl.rows and len(ddl.rows[0]) > 1:
                    body.append(f"{ddl.rows[0][1]};")
            body.append("")

            if not request.include_data:
                continue

            # One row over the cap is asked for on purpose: it is how the dump
            # can say "this table was truncated" instead of silently losing rows.
            probe = min(request.max_rows_per_table + 1, self._max_rows_hard_limit)
            rows_result = await self._run(
                session, f"SELECT * FROM {source} LIMIT %s", [probe], max_rows=probe
            )
            rows = rows_result.rows
            if len(rows) > request.max_rows_per_table:
                rows = rows[: request.max_rows_per_table]
                truncated.append(table)

            if rows:
                columns_sql = ", ".join(quote_identifier(name, "column") for name in rows_result.columns)
                for row in rows:
                    body.append(
                        f"INSERT INTO {target} ({columns_sql}) VALUES ({render_values(row)});"
                    )
                total_rows += len(rows)
                body.append("")

        view_count = 0
        if request.include_views:
            for view in view_names:
                definition = await self._run(session, f"SHOW CREATE VIEW {qualified_name(schema, view)}")
                if definition.rows and len(definition.rows[0]) > 1:
                    body.append(f"-- ---------- view `{view}`")
                    if request.drop_if_exists:
                        # Unqualified, like the table DROPs above. Naming the
                        # source schema here meant a restore into *another*
                        # database dropped the original's view -- a restore that
                        # damages the schema it was taken from.
                        body.append(f"DROP VIEW IF EXISTS {quote_identifier(view, 'view')};")
                    body.append(f"{definition.rows[0][1]};")
                    body.append("")
                    view_count += 1

        routine_count = 0
        if request.include_routines:
            for routine in await self.list_routines(token, database):
                full = await self._run(
                    session, f"SHOW CREATE {routine.kind} {qualified_name(schema, routine.name)}"
                )
                if not full.rows or len(full.rows[0]) < 3 or not full.rows[0][2]:
                    continue
                body.append(f"-- ---------- {routine.kind.lower()} `{routine.name}`")
                if request.drop_if_exists:
                    body.append(
                        f"DROP {routine.kind} IF EXISTS {quote_identifier(routine.name, 'routine')};"
                    )
                # DELIMITER is a client instruction, not SQL. The restore path
                # here understands it; so does the mysql CLI, which is what makes
                # this dump usable outside this tool.
                body.append("DELIMITER $$")
                body.append(f"{full.rows[0][2]}$$")
                body.append("DELIMITER ;")
                body.append("")
                routine_count += 1

        body.append("SET FOREIGN_KEY_CHECKS = 1;")
        content = "\n".join(header + body)

        return BackupResult(
            database=schema,
            filename=f"{schema}-{generated_at[:10]}.sql",
            content=content,
            tables=len(base_tables),
            rows=total_rows,
            routines=routine_count,
            views=view_count,
            bytes=len(content.encode("utf-8")),
            generated_at=generated_at,
            truncated_tables=truncated,
        )

    async def restore_database(self, token: str, database: str, request: RestoreRequest) -> RestoreResult:
        """Replay a dump into `database`.

        Destructive by nature -- a dump made with `drop_if_exists` starts by
        dropping every table it is about to recreate -- so the caller must name
        the target database in `confirm_database`. Getting that wrong is the
        difference between restoring a backup and destroying a live schema, and
        it is not a mistake a confirmation dialog alone should be trusted with.
        """
        session = await self._require_session(token)
        schema = validate_identifier(database, "database")

        if request.confirm_database is not None and request.confirm_database != schema:
            raise BadRequestError(
                f"Xac nhan khong khop: ban go '{request.confirm_database}' nhung dang phuc hoi vao '{schema}'"
            )

        statements = split_dump(request.content)
        if not statements:
            raise BadRequestError("Khong tim thay cau lenh nao trong noi dung backup")

        started = time.perf_counter()
        await self._run(session, f"USE {quote_identifier(schema, 'database')}")

        executed = 0
        failed = 0
        affected = 0
        errors: list[str] = []
        for statement in statements:
            try:
                result = await self._run(session, statement)
                affected += result.affected_rows or 0
                executed += 1
            except Exception as cause:  # noqa: BLE001 - reported, not raised
                failed += 1
                # The statement is truncated in the message: a failing INSERT can
                # be tens of kilobytes, and the first line is what identifies it.
                errors.append(f"{statement.splitlines()[0][:160]} -> {str(cause)[:200]}")
                if request.stop_on_error:
                    break

        return RestoreResult(
            database=schema,
            statements=len(statements),
            executed=executed,
            failed=failed,
            affected_rows=affected,
            duration_ms=(time.perf_counter() - started) * 1000,
            errors=errors[:50],
        )
