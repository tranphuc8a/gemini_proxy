"""Use-case tests driven by a fake gateway, so the generated SQL is the assertion."""

import asyncio

import pytest

from src.application.exceptions.exceptions import BadRequestError, NotFoundError, UnauthorizedError
from src.application.ports.output.sql_gateway_output_port import (
    ConnectionProfile,
    RawResult,
    SqlGatewayOutputPort,
)
from src.application.ports.output.sql_session_output_port import SqlSessionOutputPort, StoredSession
from src.application.usecases.sql_admin_usecase import SqlAdminUseCase
from src.domain.vo.sqladmin_vo import (
    ConnectRequest,
    CreateDatabaseRequest,
    QueryRequest,
    RowDeleteRequest,
    RowMutation,
)


def run(coro):
    return asyncio.run(coro)


def result(columns=None, rows=None, affected=0, last_id=None):
    return RawResult(
        columns=list(columns or []),
        column_types=["VAR_STRING"] * len(columns or []),
        rows=[list(r) for r in (rows or [])],
        affected_rows=affected,
        last_insert_id=last_id,
        duration_ms=1.0,
    )


COLUMN_ROWS = [
    ["id", "int", "int(11)", "NO", "PRI", None, "auto_increment", "", 1],
    ["name", "varchar", "varchar(50)", "YES", "", None, "", "", 2],
]


class FakeGateway(SqlGatewayOutputPort):
    """Returns a scripted result for the first matching substring rule."""

    def __init__(self, rules=None, probe_result=None, fail_with=None):
        self.calls = []
        self.released = []
        self.rules = list(rules or [])
        self.probe_result = probe_result or {
            "server_version": "8.0.36",
            "server_flavor": "MySQL",
            "current_user": "root@localhost",
            "charset": "utf8mb4",
        }
        self.fail_with = fail_with
        self.probe_calls = []

    async def probe(self, profile):
        self.probe_calls.append(profile)
        if isinstance(self.probe_result, Exception):
            raise self.probe_result
        return self.probe_result

    async def execute(self, session_id, profile, statement, params=None, database=None, max_rows=None):
        self.calls.append(
            {"statement": statement, "params": list(params or []), "database": database, "max_rows": max_rows}
        )
        if self.fail_with is not None:
            raise self.fail_with
        for needle, scripted in self.rules:
            if needle in statement:
                if isinstance(scripted, Exception):
                    raise scripted
                return scripted
        if "information_schema.COLUMNS" in statement:
            return result(["a", "b", "c", "d", "e", "f", "g", "h", "i"], COLUMN_ROWS)
        return result()

    async def release(self, session_id):
        self.released.append(session_id)

    async def release_all(self):
        self.released.append("*")

    def statements(self):
        return [c["statement"] for c in self.calls]

    def find(self, needle):
        for call in self.calls:
            if needle in call["statement"]:
                return call
        raise AssertionError(f"No statement containing {needle!r}. Got: {self.statements()}")


class MemorySessionStore(SqlSessionOutputPort):
    def __init__(self):
        self.data = {}

    async def create(self, session):
        session.connected_at = session.connected_at or "2026-09-12T00:00:00+00:00"
        session.last_used_at = "2026-09-12T00:00:00+00:00"
        self.data[session.token] = session
        return session

    async def get(self, token):
        return self.data.get(token)

    async def touch(self, token):
        return self.data.get(token)

    async def update(self, session):
        self.data[session.token] = session
        return session

    async def delete(self, token):
        return self.data.pop(token, None) is not None


def build(gateway=None, token="tok"):
    gateway = gateway or FakeGateway()
    store = MemorySessionStore()
    store.data[token] = StoredSession(
        token=token,
        profile=ConnectionProfile("localhost", 3306, "root", "pw", "shop"),
        label="root@localhost",
        server_version="8.0.36",
        server_flavor="MySQL",
        connected_at="2026-09-12T00:00:00+00:00",
        last_used_at="2026-09-12T00:00:00+00:00",
        metadata={"current_user": "root@localhost", "charset": "utf8mb4"},
    )
    return SqlAdminUseCase(gateway, store), gateway, store


class TestConnect:
    def test_connect_probes_and_issues_a_token(self):
        usecase, gateway, store = build()
        info = run(usecase.connect(ConnectRequest(host="db", port=3307, username="app", password="pw")))
        assert info.token and info.token in store.data
        assert info.server_version == "8.0.36" and info.server_flavor == "MySQL"
        assert gateway.probe_calls[0].host == "db" and gateway.probe_calls[0].port == 3307

    def test_tokens_are_unique_per_connect(self):
        usecase, _, _ = build()
        first = run(usecase.connect(ConnectRequest(username="a")))
        second = run(usecase.connect(ConnectRequest(username="a")))
        assert first.token != second.token

    def test_default_label_identifies_the_target(self):
        usecase, _, _ = build()
        info = run(usecase.connect(ConnectRequest(host="db", port=3306, username="app")))
        assert info.label == "app@db:3306"

    def test_username_is_required(self):
        usecase, _, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.connect(ConnectRequest(username="")))

    def test_probe_failure_propagates(self):
        gateway = FakeGateway(probe_result=UnauthorizedError("Access denied"))
        usecase, _, _ = build(gateway)
        with pytest.raises(UnauthorizedError):
            run(usecase.connect(ConnectRequest(username="root", password="bad")))

    def test_password_is_never_returned(self):
        usecase, _, _ = build()
        info = run(usecase.connect(ConnectRequest(username="app", password="s3cret")))
        assert "s3cret" not in info.model_dump_json()


class TestSessionGuard:
    def test_missing_token_is_unauthorized(self):
        usecase, _, _ = build()
        with pytest.raises(UnauthorizedError):
            run(usecase.list_databases(""))

    def test_unknown_token_is_unauthorized(self):
        usecase, _, _ = build()
        with pytest.raises(UnauthorizedError):
            run(usecase.list_databases("ghost"))

    def test_disconnect_releases_pool_and_session(self):
        usecase, gateway, store = build()
        assert run(usecase.disconnect("tok")) is True
        assert gateway.released == ["tok"]
        assert "tok" not in store.data

    def test_disconnect_unknown_token_is_a_noop(self):
        usecase, gateway, _ = build()
        assert run(usecase.disconnect("ghost")) is False
        assert gateway.released == []

    def test_current_session_reports_the_target(self):
        usecase, _, _ = build()
        info = run(usecase.current_session("tok"))
        assert info.host == "localhost" and info.database == "shop"


class TestDatabases:
    def test_list_databases(self):
        gateway = FakeGateway([("information_schema.SCHEMATA", result(["a", "b", "c"], [["shop", "utf8mb4", "utf8mb4_general_ci"]]))])
        usecase, _, _ = build(gateway)
        databases = run(usecase.list_databases("tok"))
        assert [d.name for d in databases] == ["shop"]
        assert databases[0].charset == "utf8mb4"

    def test_create_database_quotes_the_name(self):
        usecase, gateway, _ = build()
        run(usecase.create_database("tok", CreateDatabaseRequest(name="new db", charset="utf8mb4")))
        assert gateway.find("CREATE DATABASE")["statement"] == "CREATE DATABASE `new db` CHARACTER SET utf8mb4"

    def test_create_database_with_collation(self):
        usecase, gateway, _ = build()
        run(usecase.create_database("tok", CreateDatabaseRequest(name="d", charset="utf8mb4", collation="utf8mb4_bin")))
        assert gateway.find("CREATE DATABASE")["statement"].endswith("COLLATE utf8mb4_bin")

    def test_create_database_rejects_injected_charset(self):
        usecase, _, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.create_database("tok", CreateDatabaseRequest(name="d", charset="utf8; DROP DATABASE x")))

    def test_drop_database_quotes_the_name(self):
        usecase, gateway, _ = build()
        run(usecase.drop_database("tok", "shop"))
        assert gateway.find("DROP DATABASE")["statement"] == "DROP DATABASE `shop`"

    @pytest.mark.parametrize("name", ["mysql", "information_schema", "performance_schema", "SYS"])
    def test_refuses_to_drop_system_databases(self, name):
        usecase, gateway, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.drop_database("tok", name))
        assert gateway.calls == []


class TestTables:
    def test_list_tables_binds_the_schema(self):
        gateway = FakeGateway([
            ("information_schema.TABLES", result(
                ["a", "b", "c", "d", "e", "f", "g"],
                [["users", "BASE TABLE", "InnoDB", 12, 16384, "utf8mb4_general_ci", ""]],
            ))
        ])
        usecase, _, _ = build(gateway)
        tables = run(usecase.list_tables("tok", "shop"))
        assert tables[0].name == "users" and tables[0].rows == 12
        assert gateway.find("information_schema.TABLES")["params"] == ["shop"]

    def test_structure_collects_columns_indexes_and_keys(self):
        gateway = FakeGateway([
            ("information_schema.STATISTICS", result(["a", "b", "c", "d"], [
                ["PRIMARY", 0, "id", "BTREE"],
                ["idx_name", 1, "name", "BTREE"],
            ])),
            ("KEY_COLUMN_USAGE", result(["a", "b", "c", "d", "e"], [
                ["fk_owner", "owner_id", "shop", "owners", "id"],
            ])),
            ("SHOW CREATE TABLE", result(["Table", "Create Table"], [["users", "CREATE TABLE `users` (...)"]])),
        ])
        usecase, _, _ = build(gateway)
        structure = run(usecase.table_structure("tok", "shop", "users"))
        assert [c.name for c in structure.columns] == ["id", "name"]
        assert structure.primary_key == ["id"]
        assert {i.name: i.unique for i in structure.indexes} == {"PRIMARY": True, "idx_name": False}
        assert structure.foreign_keys[0].referenced_table == "owners"
        assert structure.ddl.startswith("CREATE TABLE")

    def test_structure_survives_a_refused_show_create(self):
        gateway = FakeGateway([("SHOW CREATE TABLE", BadRequestError("denied"))])
        usecase, _, _ = build(gateway)
        assert run(usecase.table_structure("tok", "shop", "users")).ddl is None

    def test_unknown_table_is_not_found(self):
        gateway = FakeGateway([("information_schema.COLUMNS", result(["a"], []))])
        usecase, _, _ = build(gateway)
        with pytest.raises(NotFoundError):
            run(usecase.table_structure("tok", "shop", "ghost"))

    def test_drop_and_truncate_are_qualified(self):
        usecase, gateway, _ = build()
        run(usecase.drop_table("tok", "shop", "users"))
        run(usecase.truncate_table("tok", "shop", "users"))
        assert gateway.find("DROP TABLE")["statement"] == "DROP TABLE `shop`.`users`"
        assert gateway.find("TRUNCATE TABLE")["statement"] == "TRUNCATE TABLE `shop`.`users`"


class TestBrowse:
    def _gateway(self, rows=None):
        return FakeGateway([
            ("COUNT(*)", result(["c"], [[2]])),
            ("SELECT * FROM", result(["id", "name"], rows if rows is not None else [[1, "ann"], [2, "bo"]])),
        ])

    def test_returns_rows_as_objects_with_total(self):
        usecase, gateway, _ = build(self._gateway())
        page = run(usecase.browse_table("tok", "shop", "users"))
        assert page.rows == [{"id": 1, "name": "ann"}, {"id": 2, "name": "bo"}]
        assert page.total == 2 and page.primary_key == ["id"]

    def test_pagination_is_bound_not_interpolated(self):
        usecase, gateway, _ = build(self._gateway())
        run(usecase.browse_table("tok", "shop", "users", limit=10, offset=20))
        call = gateway.find("SELECT * FROM")
        assert call["statement"].endswith("LIMIT %s OFFSET %s")
        assert call["params"] == [10, 20]

    def test_sorting_uses_a_validated_column(self):
        usecase, gateway, _ = build(self._gateway())
        run(usecase.browse_table("tok", "shop", "users", order_by="name", direction="desc"))
        assert "ORDER BY `name` DESC" in gateway.find("SELECT * FROM")["statement"]

    def test_unknown_sort_column_is_rejected(self):
        usecase, _, _ = build(self._gateway())
        with pytest.raises(BadRequestError):
            run(usecase.browse_table("tok", "shop", "users", order_by="1; DROP TABLE users"))

    def test_search_binds_the_term_and_filters_the_count_too(self):
        usecase, gateway, _ = build(self._gateway())
        run(usecase.browse_table("tok", "shop", "users", search="an"))
        data_call = gateway.find("SELECT * FROM")
        count_call = gateway.find("COUNT(*)")
        assert "CONCAT_WS(0x1f, `id`, `name`) LIKE %s" in data_call["statement"]
        assert data_call["params"][0] == "%an%"
        assert count_call["params"] == ["%an%"]

    def test_limit_is_capped_by_the_hard_limit(self):
        gateway = self._gateway()
        store = MemorySessionStore()
        run(store.create(StoredSession(token="tok", profile=ConnectionProfile("h", 3306, "u", "p"))))
        usecase = SqlAdminUseCase(gateway, store, max_rows_hard_limit=100)
        page = run(usecase.browse_table("tok", "shop", "users", limit=99999))
        assert page.limit == 100

    def test_negative_offset_is_clamped(self):
        usecase, gateway, _ = build(self._gateway())
        page = run(usecase.browse_table("tok", "shop", "users", offset=-5))
        assert page.offset == 0


class TestRowMutations:
    def test_insert_binds_values(self):
        usecase, gateway, _ = build()
        run(usecase.insert_row("tok", "shop", "users", RowMutation(values={"id": 1, "name": "ann"})))
        call = gateway.find("INSERT INTO")
        assert call["statement"] == "INSERT INTO `shop`.`users` (`id`, `name`) VALUES (%s, %s)"
        assert call["params"] == [1, "ann"]

    def test_insert_ignores_unknown_columns(self):
        usecase, gateway, _ = build()
        run(usecase.insert_row("tok", "shop", "users", RowMutation(values={"name": "ann", "bogus": 1})))
        assert gateway.find("INSERT INTO")["params"] == ["ann"]

    def test_insert_without_known_columns_is_rejected(self):
        usecase, _, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.insert_row("tok", "shop", "users", RowMutation(values={"bogus": 1})))

    def test_update_uses_the_key_in_the_where_clause(self):
        usecase, gateway, _ = build()
        run(usecase.update_row("tok", "shop", "users", RowMutation(values={"name": "bo"}, key={"id": 7})))
        call = gateway.find("UPDATE")
        assert call["statement"] == "UPDATE `shop`.`users` SET `name` = %s WHERE `id` = %s LIMIT 1"
        assert call["params"] == ["bo", 7]

    def test_update_without_a_key_is_rejected(self):
        usecase, gateway, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.update_row("tok", "shop", "users", RowMutation(values={"name": "bo"})))
        assert not any("UPDATE" in s for s in gateway.statements())

    def test_update_rejects_an_unknown_key_column(self):
        usecase, _, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.update_row("tok", "shop", "users", RowMutation(values={"name": "b"}, key={"nope": 1})))

    def test_null_key_becomes_is_null(self):
        usecase, gateway, _ = build()
        run(usecase.update_row("tok", "shop", "users", RowMutation(values={"name": "b"}, key={"name": None})))
        call = gateway.find("UPDATE")
        assert "WHERE `name` IS NULL" in call["statement"]
        assert call["params"] == ["b"]

    def test_delete_runs_one_statement_per_key(self):
        gateway = FakeGateway([("DELETE FROM", result(affected=1))])
        usecase, _, _ = build(gateway)
        outcome = run(usecase.delete_rows("tok", "shop", "users", RowDeleteRequest(keys=[{"id": 1}, {"id": 2}])))
        deletes = [s for s in gateway.statements() if s.startswith("DELETE")]
        assert len(deletes) == 2 and outcome.affected_rows == 2
        assert deletes[0] == "DELETE FROM `shop`.`users` WHERE `id` = %s LIMIT 1"


class TestRunSql:
    def test_runs_each_statement_and_reports_rows(self):
        gateway = FakeGateway([("SELECT", result(["n"], [[1]]))])
        usecase, _, _ = build(gateway)
        results = run(usecase.run_sql("tok", QueryRequest(sql="SELECT 1; SELECT 1")))
        assert len(results) == 2
        assert results[0].kind == "read" and results[0].rows == [[1]] and results[0].row_count == 1

    def test_write_statement_reports_affected_rows(self):
        gateway = FakeGateway([("UPDATE", result(affected=3))])
        usecase, _, _ = build(gateway)
        results = run(usecase.run_sql("tok", QueryRequest(sql="UPDATE t SET a=1")))
        assert results[0].kind == "write" and results[0].affected_rows == 3

    def test_stops_at_the_first_error_and_reports_it(self):
        gateway = FakeGateway([("BOOM", BadRequestError("syntax error"))])
        usecase, _, _ = build(gateway)
        results = run(usecase.run_sql("tok", QueryRequest(sql="SELECT 1; BOOM; SELECT 2")))
        assert len(results) == 2
        assert results[1].error and "syntax" in results[1].error

    def test_marks_a_truncated_result(self):
        gateway = FakeGateway([("SELECT", result(["n"], [[1], [2], [3]]))])
        usecase, _, _ = build(gateway)
        results = run(usecase.run_sql("tok", QueryRequest(sql="SELECT 1", max_rows=2)))
        assert results[0].truncated is True and results[0].row_count == 2

    def test_fetches_one_extra_row_to_detect_truncation(self):
        gateway = FakeGateway([("SELECT", result(["n"], [[1]]))])
        usecase, _, _ = build(gateway)
        run(usecase.run_sql("tok", QueryRequest(sql="SELECT 1", max_rows=50)))
        assert gateway.calls[0]["max_rows"] == 51

    def test_passes_the_target_database_through(self):
        usecase, gateway, _ = build()
        run(usecase.run_sql("tok", QueryRequest(sql="SELECT 1", database="shop")))
        assert gateway.calls[0]["database"] == "shop"

    def test_empty_script_is_rejected(self):
        usecase, _, _ = build()
        with pytest.raises(BadRequestError):
            run(usecase.run_sql("tok", QueryRequest(sql="-- just a comment")))


class TestServerAndExport:
    def test_overview_filters_to_the_interesting_keys(self):
        gateway = FakeGateway([
            ("SHOW GLOBAL STATUS", result(["a", "b"], [["Uptime", "120"], ["Noise_metric", "1"]])),
            ("SHOW GLOBAL VARIABLES", result(["a", "b"], [["version", "8.0.36"], ["other", "x"]])),
        ])
        usecase, _, _ = build(gateway)
        overview = run(usecase.server_overview("tok"))
        assert overview.uptime_seconds == 120
        assert "Noise_metric" not in overview.status and overview.variables == {"version": "8.0.36"}

    def test_process_list_maps_columns_by_name(self):
        gateway = FakeGateway([
            ("PROCESSLIST", result(
                ["Id", "User", "Host", "db", "Command", "Time", "State", "Info"],
                [[7, "root", "localhost:1", "shop", "Query", "3", "init", "SHOW PROCESSLIST"]],
            ))
        ])
        usecase, _, _ = build(gateway)
        processes = run(usecase.process_list("tok"))
        assert processes[0].id == 7 and processes[0].db == "shop" and processes[0].time == 3

    def _export_gateway(self):
        return FakeGateway([("SELECT * FROM", result(["id", "name"], [[1, "a,b"], [2, None]]))])

    def test_csv_export_quotes_embedded_commas(self):
        usecase, _, _ = build(self._export_gateway())
        payload = run(usecase.export_table("tok", "shop", "users", "csv", 100))
        assert payload["media_type"] == "text/csv"
        assert payload["content"].splitlines()[0] == "id,name"
        assert '"a,b"' in payload["content"]

    def test_json_export_is_a_list_of_objects(self):
        usecase, _, _ = build(self._export_gateway())
        payload = run(usecase.export_table("tok", "shop", "users", "json", 100))
        import json as _json

        assert _json.loads(payload["content"])[0] == {"id": 1, "name": "a,b"}

    def test_sql_export_emits_inserts_with_escaped_literals(self):
        gateway = FakeGateway([
            ("SELECT * FROM", result(["id", "name"], [[1, "O'Reilly"]])),
            ("SHOW CREATE TABLE", result(["Table", "Create Table"], [["users", "CREATE TABLE `users` (...)"]])),
        ])
        usecase, _, _ = build(gateway)
        content = run(usecase.export_table("tok", "shop", "users", "sql", 100))["content"]
        assert "CREATE TABLE `users` (...);" in content
        assert "INSERT INTO `shop`.`users` (`id`, `name`) VALUES (1, 'O\\'Reilly');" in content

    def test_sql_export_writes_null_for_missing_values(self):
        usecase, _, _ = build(self._export_gateway())
        content = run(usecase.export_table("tok", "shop", "users", "sql", 100))["content"]
        assert "VALUES (2, NULL);" in content

    def test_unknown_format_is_rejected(self):
        usecase, _, _ = build(self._export_gateway())
        with pytest.raises(BadRequestError):
            run(usecase.export_table("tok", "shop", "users", "xlsx", 100))

    def test_export_limit_is_bound(self):
        usecase, gateway, _ = build(self._export_gateway())
        run(usecase.export_table("tok", "shop", "users", "csv", 25))
        assert gateway.find("SELECT * FROM")["params"] == [25]
