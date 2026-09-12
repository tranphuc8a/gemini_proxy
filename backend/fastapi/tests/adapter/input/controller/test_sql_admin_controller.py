"""Router tests: routing, token plumbing and the response envelope.

The use case is replaced through dependency_overrides so no database is needed.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory.sql_admin_factory import get_sql_admin_input_port
from src.application.exceptions.exceptions import BadRequestError, UnauthorizedError
from src.application.config.config import settings
from src.domain.vo.sqladmin_vo import (
    BrowsePage,
    ColumnInfo,
    DatabaseInfo,
    MutationResult,
    QueryResult,
    SessionInfo,
    TableInfo,
    TableStructure,
)
from src.main import app

BASE = f"{settings.API_PREFIX}/sqladmin"


class FakeService:
    def __init__(self):
        self.calls = []

    def _record(self, name, **kwargs):
        self.calls.append((name, kwargs))

    async def connect(self, request):
        self._record("connect", request=request)
        return SessionInfo(
            token="tok-123",
            host=request.host,
            port=request.port,
            username=request.username,
            database=request.database,
            label="label",
            server_version="8.0.36",
            connected_at="2026-09-12T00:00:00+00:00",
            last_used_at="2026-09-12T00:00:00+00:00",
        )

    async def current_session(self, token):
        self._record("current_session", token=token)
        if token != "tok-123":
            raise UnauthorizedError("Session expired or not found; please connect again")
        return SessionInfo(
            token=token, host="localhost", port=3306, username="root",
            connected_at="2026-09-12T00:00:00+00:00", last_used_at="2026-09-12T00:00:00+00:00",
        )

    async def disconnect(self, token):
        self._record("disconnect", token=token)
        return token == "tok-123"

    async def list_databases(self, token):
        self._record("list_databases", token=token)
        return [DatabaseInfo(name="shop", charset="utf8mb4")]

    async def create_database(self, token, request):
        self._record("create_database", token=token, request=request)
        return MutationResult(affected_rows=1, statement="CREATE DATABASE `shop`")

    async def drop_database(self, token, database):
        self._record("drop_database", token=token, database=database)
        return MutationResult(affected_rows=0)

    async def list_tables(self, token, database):
        self._record("list_tables", token=token, database=database)
        return [TableInfo(name="users", engine="InnoDB")]

    async def table_structure(self, token, database, table):
        self._record("table_structure", token=token, database=database, table=table)
        return TableStructure(
            database=database,
            table=table,
            columns=[ColumnInfo(name="id", data_type="int", column_type="int(11)", nullable=False, key="PRI")],
            primary_key=["id"],
        )

    async def drop_table(self, token, database, table):
        self._record("drop_table", token=token, database=database, table=table)
        return MutationResult()

    async def truncate_table(self, token, database, table):
        self._record("truncate_table", token=token, database=database, table=table)
        return MutationResult()

    async def browse_table(self, token, database, table, limit=50, offset=0, order_by=None, direction=None, search=None):
        self._record(
            "browse_table", token=token, database=database, table=table,
            limit=limit, offset=offset, order_by=order_by, direction=direction, search=search,
        )
        return BrowsePage(database=database, table=table, rows=[{"id": 1}], total=1, limit=limit, offset=offset)

    async def insert_row(self, token, database, table, payload):
        self._record("insert_row", token=token, payload=payload)
        return MutationResult(affected_rows=1, last_insert_id=9)

    async def update_row(self, token, database, table, payload):
        self._record("update_row", token=token, payload=payload)
        return MutationResult(affected_rows=1)

    async def delete_rows(self, token, database, table, payload):
        self._record("delete_rows", token=token, payload=payload)
        return MutationResult(affected_rows=len(payload.keys))

    async def run_sql(self, token, request):
        self._record("run_sql", token=token, request=request)
        if "BOOM" in request.sql:
            raise BadRequestError("You have an error in your SQL syntax")
        return [QueryResult(statement=request.sql, kind="read", columns=["n"], rows=[[1]], row_count=1)]

    async def server_overview(self, token):
        self._record("server_overview", token=token)
        from src.domain.vo.sqladmin_vo import ServerOverview

        return ServerOverview(version="8.0.36", status={"Uptime": "10"})

    async def process_list(self, token):
        self._record("process_list", token=token)
        from src.domain.vo.sqladmin_vo import ProcessInfo

        return [ProcessInfo(id=1, user="root")]

    async def export_table(self, token, database, table, fmt, limit):
        self._record("export_table", token=token, fmt=fmt, limit=limit)
        return {
            "filename": f"{database}.{table}.{fmt}",
            "media_type": "text/csv",
            "content": "id\n1\n",
            "row_count": 1,
        }


@pytest.fixture
def service():
    fake = FakeService()
    app.dependency_overrides[get_sql_admin_input_port] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_sql_admin_input_port, None)


@pytest.fixture
def client(service):
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


AUTH = {"X-Session-Token": "tok-123"}


class TestSessions:
    def test_connect_returns_201_with_a_token(self, client, service):
        response = client.post(f"{BASE}/sessions", json={"host": "db", "port": 3307, "username": "root", "password": "pw"})
        assert response.status_code == 201
        body = response.json()
        assert body["data"]["token"] == "tok-123"
        assert body["status_code"] == 201 and body["message"] == "Connected"
        assert service.calls[0][1]["request"].host == "db"

    def test_connect_validates_the_port(self, client):
        response = client.post(f"{BASE}/sessions", json={"username": "root", "port": 99999})
        assert response.status_code == 422

    def test_connect_requires_a_username(self, client):
        assert client.post(f"{BASE}/sessions", json={"host": "db"}).status_code == 422

    def test_current_session_reads_the_token_header(self, client, service):
        response = client.get(f"{BASE}/sessions/current", headers=AUTH)
        assert response.status_code == 200
        assert service.calls[-1][1]["token"] == "tok-123"

    def test_bearer_header_is_accepted(self, client, service):
        response = client.get(f"{BASE}/sessions/current", headers={"Authorization": "Bearer tok-123"})
        assert response.status_code == 200
        assert service.calls[-1][1]["token"] == "tok-123"

    def test_missing_token_yields_401_envelope(self, client):
        response = client.get(f"{BASE}/sessions/current")
        assert response.status_code == 401
        assert response.json()["status_code"] == 401

    def test_disconnect(self, client):
        response = client.delete(f"{BASE}/sessions/current", headers=AUTH)
        assert response.status_code == 200 and response.json()["data"]["disconnected"] is True


class TestSchemaRoutes:
    def test_list_databases(self, client):
        response = client.get(f"{BASE}/databases", headers=AUTH)
        assert response.status_code == 200
        assert response.json()["data"][0]["name"] == "shop"

    def test_create_database(self, client, service):
        response = client.post(f"{BASE}/databases", json={"name": "shop"}, headers=AUTH)
        assert response.status_code == 201
        assert service.calls[-1][1]["request"].charset == "utf8mb4"

    def test_drop_database(self, client, service):
        assert client.delete(f"{BASE}/databases/shop", headers=AUTH).status_code == 200
        assert service.calls[-1][1]["database"] == "shop"

    def test_list_tables(self, client):
        response = client.get(f"{BASE}/databases/shop/tables", headers=AUTH)
        assert response.json()["data"][0]["engine"] == "InnoDB"

    def test_table_structure(self, client):
        response = client.get(f"{BASE}/databases/shop/tables/users/structure", headers=AUTH)
        assert response.json()["data"]["primary_key"] == ["id"]

    def test_truncate_and_drop_table(self, client, service):
        assert client.post(f"{BASE}/databases/shop/tables/users/truncate", headers=AUTH).status_code == 200
        assert client.delete(f"{BASE}/databases/shop/tables/users", headers=AUTH).status_code == 200
        assert [c[0] for c in service.calls[-2:]] == ["truncate_table", "drop_table"]

    def test_encoded_names_survive_routing(self, client, service):
        client.get(f"{BASE}/databases/my%20db/tables/odd%20table/structure", headers=AUTH)
        assert service.calls[-1][1]["database"] == "my db"
        assert service.calls[-1][1]["table"] == "odd table"


class TestRowRoutes:
    def test_browse_forwards_query_parameters(self, client, service):
        response = client.get(
            f"{BASE}/databases/shop/tables/users/rows",
            params={"limit": 10, "offset": 20, "order_by": "id", "direction": "desc", "search": "an"},
            headers=AUTH,
        )
        assert response.status_code == 200
        kwargs = service.calls[-1][1]
        assert (kwargs["limit"], kwargs["offset"], kwargs["order_by"]) == (10, 20, "id")
        assert kwargs["direction"] == "desc" and kwargs["search"] == "an"

    def test_browse_rejects_an_out_of_range_limit(self, client):
        response = client.get(f"{BASE}/databases/shop/tables/users/rows", params={"limit": 5000}, headers=AUTH)
        assert response.status_code == 422

    def test_insert_returns_201(self, client, service):
        response = client.post(
            f"{BASE}/databases/shop/tables/users/rows", json={"values": {"name": "ann"}}, headers=AUTH
        )
        assert response.status_code == 201
        assert response.json()["data"]["last_insert_id"] == 9
        assert service.calls[-1][1]["payload"].values == {"name": "ann"}

    def test_update_sends_the_key(self, client, service):
        response = client.patch(
            f"{BASE}/databases/shop/tables/users/rows",
            json={"values": {"name": "bo"}, "key": {"id": 1}},
            headers=AUTH,
        )
        assert response.status_code == 200
        assert service.calls[-1][1]["payload"].key == {"id": 1}

    def test_delete_requires_at_least_one_key(self, client):
        response = client.post(f"{BASE}/databases/shop/tables/users/rows/delete", json={"keys": []}, headers=AUTH)
        assert response.status_code == 422

    def test_delete_reports_affected_rows(self, client):
        response = client.post(
            f"{BASE}/databases/shop/tables/users/rows/delete",
            json={"keys": [{"id": 1}, {"id": 2}]},
            headers=AUTH,
        )
        assert response.json()["data"]["affected_rows"] == 2


class TestConsoleAndServer:
    def test_run_sql(self, client):
        response = client.post(f"{BASE}/query", json={"sql": "SELECT 1"}, headers=AUTH)
        assert response.status_code == 200
        assert response.json()["data"][0]["rows"] == [[1]]

    def test_sql_error_becomes_a_400_envelope(self, client):
        response = client.post(f"{BASE}/query", json={"sql": "BOOM"}, headers=AUTH)
        assert response.status_code == 400
        assert "SQL syntax" in response.json()["message"]

    def test_empty_sql_is_rejected_by_validation(self, client):
        assert client.post(f"{BASE}/query", json={"sql": ""}, headers=AUTH).status_code == 422

    def test_server_overview_and_processes(self, client):
        assert client.get(f"{BASE}/server/overview", headers=AUTH).json()["data"]["version"] == "8.0.36"
        assert client.get(f"{BASE}/server/processes", headers=AUTH).json()["data"][0]["id"] == 1

    def test_export_is_returned_as_an_attachment(self, client, service):
        response = client.get(
            f"{BASE}/databases/shop/tables/users/export", params={"format": "csv", "limit": 10}, headers=AUTH
        )
        assert response.status_code == 200
        assert response.headers["content-disposition"] == 'attachment; filename="shop.users.csv"'
        assert response.text == "id\n1\n"
        assert service.calls[-1][1]["fmt"] == "csv"
