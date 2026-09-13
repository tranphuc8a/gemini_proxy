"""Router tests: routing, token plumbing and the response envelope.

The use case is replaced through dependency_overrides so no MongoDB is needed.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory.mongo_admin_factory import get_mongo_admin_input_port
from src.application.config.config import settings
from src.application.exceptions.exceptions import BadRequestError, NotFoundError, UnauthorizedError
from src.domain.vo.mongoadmin_vo import (
    CollectionInfo,
    CommandResult,
    DatabaseInfo,
    DocumentPage,
    IndexInfo,
    MutationResult,
    OperationInfo,
    ServerOverview,
    SessionInfo,
    StatsResult,
)
from src.main import app

BASE = f"{settings.API_PREFIX}/mongoadmin"
TOKEN = "tok-123"
AUTH = {"X-Session-Token": TOKEN}


class FakeService:
    """Records what the router passed in and answers with fixed VOs."""

    def __init__(self):
        self.calls = []

    def _record(self, _call, **kwargs):
        self.calls.append((_call, kwargs))

    def called(self, call):
        return [kwargs for name, kwargs in self.calls if name == call]

    def _check(self, token):
        if token != TOKEN:
            raise UnauthorizedError("Session expired or not found; please connect again")

    # --- session ---
    async def connect(self, request):
        self._record("connect", request=request)
        return SessionInfo(
            token=TOKEN,
            host=request.host,
            port=request.port,
            username=request.username,
            database=request.database,
            label="root@db.local:27017",
            server_version="8.0.4",
            server_flavor="MongoDB",
            topology="standalone",
            connected_at="2026-09-13T00:00:00+00:00",
            last_used_at="2026-09-13T00:00:00+00:00",
        )

    async def current_session(self, token):
        self._record("current_session", token=token)
        self._check(token)
        return SessionInfo(
            token=token, host="db.local", port=27017, username="root",
            connected_at="2026-09-13T00:00:00+00:00", last_used_at="2026-09-13T00:00:00+00:00",
        )

    async def disconnect(self, token):
        self._record("disconnect", token=token)
        return token == TOKEN

    # --- databases ---
    async def list_databases(self, token):
        self._record("list_databases", token=token)
        self._check(token)
        return [DatabaseInfo(name="shop", size_on_disk=4096)]

    async def create_database(self, token, request):
        self._record("create_database", token=token, request=request)
        return MutationResult(detail=f"Created database {request.name!r}")

    async def drop_database(self, token, database):
        self._record("drop_database", token=token, database=database)
        return MutationResult(detail=f"Dropped {database}")

    async def database_stats(self, token, database):
        self._record("database_stats", token=token, database=database)
        return StatsResult(database=database, stats={"collections": 3})

    # --- collections ---
    async def list_collections(self, token, database, with_stats=False):
        self._record("list_collections", token=token, database=database, with_stats=with_stats)
        self._check(token)
        return [CollectionInfo(name="orders", count=12 if with_stats else None)]

    async def create_collection(self, token, database, request):
        self._record("create_collection", token=token, database=database, request=request)
        return MutationResult(detail="Created")

    async def drop_collection(self, token, database, collection):
        self._record("drop_collection", token=token, database=database, collection=collection)
        return MutationResult(detail="Dropped")

    async def rename_collection(self, token, database, collection, request):
        self._record("rename_collection", token=token, database=database, collection=collection, request=request)
        return MutationResult(detail="Renamed")

    async def truncate_collection(self, token, database, collection):
        self._record("truncate_collection", token=token, database=database, collection=collection)
        return MutationResult(deleted=4)

    async def collection_stats(self, token, database, collection):
        self._record("collection_stats", token=token, database=database, collection=collection)
        return StatsResult(database=database, collection=collection, stats={"count": 12})

    # --- documents ---
    async def find_documents(self, token, database, collection, request):
        self._record("find_documents", token=token, database=database, collection=collection, request=request)
        self._check(token)
        return DocumentPage(
            database=database, collection=collection,
            documents=[{"_id": {"$oid": "507f1f77bcf86cd799439011"}, "n": 1}],
            fields=["_id", "n"], total=1, limit=request.limit, skip=request.skip,
        )

    async def count_documents(self, token, database, collection, request):
        self._record("count_documents", token=token, database=database, collection=collection, request=request)
        return 42

    async def insert_documents(self, token, database, collection, request):
        self._record("insert_documents", token=token, database=database, collection=collection, request=request)
        return MutationResult(inserted=1, inserted_ids=[{"$oid": "507f1f77bcf86cd799439011"}])

    async def update_documents(self, token, database, collection, request):
        self._record("update_documents", token=token, database=database, collection=collection, request=request)
        return MutationResult(matched=1, modified=1)

    async def delete_documents(self, token, database, collection, request):
        self._record("delete_documents", token=token, database=database, collection=collection, request=request)
        return MutationResult(deleted=1)

    async def export_collection(self, token, database, collection, fmt, limit, filter_text=None):
        self._record(
            "export_collection",
            token=token, database=database, collection=collection, fmt=fmt, limit=limit, filter_text=filter_text,
        )
        if fmt not in {"json", "jsonl", "csv"}:
            raise BadRequestError("format must be one of json, jsonl or csv")
        return {"content": '[{"a": 1}]', "media_type": "application/json", "filename": f"{database}.{collection}.json"}

    # --- indexes ---
    async def list_indexes(self, token, database, collection):
        self._record("list_indexes", token=token, database=database, collection=collection)
        return [IndexInfo(name="_id_", keys=[["_id", 1]])]

    async def create_index(self, token, database, collection, request):
        self._record("create_index", token=token, database=database, collection=collection, request=request)
        return MutationResult(detail="Created index")

    async def drop_index(self, token, database, collection, name):
        self._record("drop_index", token=token, database=database, collection=collection, name=name)
        if name == "_id_":
            raise BadRequestError("The _id index is required by MongoDB and cannot be dropped")
        return MutationResult(detail=f"Dropped index {name!r}")

    # --- console ---
    async def aggregate(self, token, database, collection, request):
        self._record("aggregate", token=token, database=database, collection=collection, request=request)
        return CommandResult(kind="aggregate", database=database, documents=[{"n": 1}], row_count=1)

    async def run_command(self, token, request):
        self._record("run_command", token=token, request=request)
        return CommandResult(kind="command", database=request.database or "admin", result={"ok": 1})

    async def server_overview(self, token):
        self._record("server_overview", token=token)
        return ServerOverview(version="8.0.4", topology="standalone")

    async def current_operations(self, token):
        self._record("current_operations", token=token)
        return [OperationInfo(opid=12, op="query", ns="shop.orders")]


@pytest.fixture()
def service():
    fake = FakeService()
    app.dependency_overrides[get_mongo_admin_input_port] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture()
def client(service):
    with TestClient(app) as test_client:
        yield test_client


def envelope(response):
    body = response.json()
    assert set(body) == {"status_code", "message", "data"}
    assert body["status_code"] == response.status_code
    return body


# ---------------------------------------------------------------------------
# session
# ---------------------------------------------------------------------------
class TestSessionRoutes:
    def test_connect_returns_201_and_the_token(self, client, service):
        response = client.post(f"{BASE}/sessions", json={
            "host": "db.local", "port": 27017, "username": "root", "password": "s3cr3t",
        })
        assert response.status_code == 201
        assert envelope(response)["data"]["token"] == TOKEN
        assert service.called("connect")[0]["request"].username == "root"

    def test_connect_accepts_a_uri(self, client, service):
        client.post(f"{BASE}/sessions", json={"uri": "mongodb://localhost:27017/"})
        assert service.called("connect")[0]["request"].uri == "mongodb://localhost:27017/"

    def test_connect_rejects_an_out_of_range_port(self, client):
        response = client.post(f"{BASE}/sessions", json={"host": "h", "port": 99999})
        assert response.status_code == 422

    def test_the_token_header_reaches_the_service(self, client, service):
        client.get(f"{BASE}/sessions/current", headers=AUTH)
        assert service.called("current_session")[0]["token"] == TOKEN

    def test_a_bearer_header_works_too(self, client, service):
        response = client.get(f"{BASE}/sessions/current", headers={"Authorization": f"Bearer {TOKEN}"})
        assert response.status_code == 200
        assert service.called("current_session")[0]["token"] == TOKEN

    def test_a_missing_token_is_a_401(self, client):
        response = client.get(f"{BASE}/sessions/current")
        assert response.status_code == 401
        assert "connect again" in envelope(response)["message"]

    def test_logout_reports_what_it_removed(self, client):
        response = client.delete(f"{BASE}/sessions/current", headers=AUTH)
        assert envelope(response)["data"] == {"disconnected": True}


# ---------------------------------------------------------------------------
# databases and collections
# ---------------------------------------------------------------------------
class TestDatabaseRoutes:
    def test_list_databases(self, client):
        response = client.get(f"{BASE}/databases", headers=AUTH)
        assert envelope(response)["data"][0]["name"] == "shop"

    def test_list_databases_without_a_token_is_a_401(self, client):
        assert client.get(f"{BASE}/databases").status_code == 401

    def test_create_database_returns_201(self, client, service):
        response = client.post(f"{BASE}/databases", json={"name": "analytics"}, headers=AUTH)
        assert response.status_code == 201
        assert service.called("create_database")[0]["request"].collection == "documents"

    def test_drop_database_passes_the_name(self, client, service):
        client.delete(f"{BASE}/databases/shop", headers=AUTH)
        assert service.called("drop_database")[0]["database"] == "shop"

    def test_a_url_encoded_database_name_is_decoded(self, client, service):
        client.delete(f"{BASE}/databases/my%20db", headers=AUTH)
        assert service.called("drop_database")[0]["database"] == "my db"

    def test_database_stats(self, client):
        response = client.get(f"{BASE}/databases/shop/stats", headers=AUTH)
        assert envelope(response)["data"]["stats"] == {"collections": 3}


class TestCollectionRoutes:
    def test_list_collections_defaults_to_no_stats(self, client, service):
        response = client.get(f"{BASE}/databases/shop/collections", headers=AUTH)
        assert service.called("list_collections")[0]["with_stats"] is False
        assert envelope(response)["data"][0]["count"] is None

    def test_stats_can_be_requested(self, client, service):
        response = client.get(f"{BASE}/databases/shop/collections?with_stats=true", headers=AUTH)
        assert service.called("list_collections")[0]["with_stats"] is True
        assert envelope(response)["data"][0]["count"] == 12

    def test_create_collection_returns_201(self, client, service):
        response = client.post(
            f"{BASE}/databases/shop/collections",
            json={"name": "logs", "capped": True, "size": 4096},
            headers=AUTH,
        )
        assert response.status_code == 201
        assert service.called("create_collection")[0]["request"].size == 4096

    def test_drop_collection(self, client, service):
        client.delete(f"{BASE}/databases/shop/collections/orders", headers=AUTH)
        assert service.called("drop_collection")[0]["collection"] == "orders"

    def test_rename_collection(self, client, service):
        client.post(
            f"{BASE}/databases/shop/collections/orders/rename",
            json={"name": "orders_v2", "drop_target": True},
            headers=AUTH,
        )
        request = service.called("rename_collection")[0]["request"]
        assert request.name == "orders_v2" and request.drop_target is True

    def test_truncate_collection(self, client):
        response = client.post(f"{BASE}/databases/shop/collections/orders/truncate", headers=AUTH)
        assert envelope(response)["data"]["deleted"] == 4

    def test_a_dotted_collection_name_survives_the_path(self, client, service):
        client.delete(f"{BASE}/databases/shop/collections/orders.2026", headers=AUTH)
        assert service.called("drop_collection")[0]["collection"] == "orders.2026"


# ---------------------------------------------------------------------------
# documents
# ---------------------------------------------------------------------------
DOCS = f"{BASE}/databases/shop/collections/orders/documents"


class TestDocumentRoutes:
    def test_find_forwards_the_whole_request(self, client, service):
        response = client.post(DOCS + "/find", headers=AUTH, json={
            "filter": {"qty": {"$gt": 1}}, "sort": {"qty": -1}, "skip": 20, "limit": 10,
        })
        request = service.called("find_documents")[0]["request"]
        assert request.filter == {"qty": {"$gt": 1}}
        assert request.sort == {"qty": -1}
        assert request.skip == 20 and request.limit == 10
        assert envelope(response)["data"]["fields"] == ["_id", "n"]

    def test_extended_json_survives_the_round_trip(self, client):
        response = client.post(DOCS + "/find", headers=AUTH, json={"filter": {}})
        document = envelope(response)["data"]["documents"][0]
        assert document["_id"] == {"$oid": "507f1f77bcf86cd799439011"}

    def test_find_defaults(self, client, service):
        client.post(DOCS + "/find", headers=AUTH, json={})
        request = service.called("find_documents")[0]["request"]
        assert request.filter == {} and request.limit == 50 and request.with_count is True

    def test_an_over_large_limit_is_rejected(self, client):
        response = client.post(DOCS + "/find", headers=AUTH, json={"limit": 5000})
        assert response.status_code == 422

    def test_a_negative_skip_is_rejected(self, client):
        assert client.post(DOCS + "/find", headers=AUTH, json={"skip": -1}).status_code == 422

    def test_count(self, client):
        response = client.post(DOCS + "/count", headers=AUTH, json={"filter": {"a": 1}})
        assert envelope(response)["data"] == {"count": 42}

    def test_insert_returns_201(self, client, service):
        response = client.post(DOCS, headers=AUTH, json={"documents": {"name": "x"}})
        assert response.status_code == 201
        assert service.called("insert_documents")[0]["request"].documents == {"name": "x"}

    def test_update_uses_patch(self, client, service):
        response = client.patch(DOCS, headers=AUTH, json={"filter": {"_id": 1}, "update": {"$set": {"a": 2}}})
        assert response.status_code == 200
        assert envelope(response)["data"]["modified"] == 1
        assert service.called("update_documents")[0]["request"].update == {"$set": {"a": 2}}

    def test_update_requires_an_update_document(self, client):
        assert client.patch(DOCS, headers=AUTH, json={"filter": {}}).status_code == 422

    def test_delete_posts_a_filter(self, client, service):
        response = client.post(DOCS + "/delete", headers=AUTH, json={"filter": {"qty": 0}, "many": True})
        assert envelope(response)["data"]["deleted"] == 1
        assert service.called("delete_documents")[0]["request"].many is True


class TestExportRoute:
    def test_export_streams_a_file(self, client, service):
        response = client.get(
            f"{BASE}/databases/shop/collections/orders/export?format=json&limit=10",
            headers=AUTH,
        )
        assert response.status_code == 200
        assert response.headers["content-disposition"] == 'attachment; filename="shop.orders.json"'
        assert response.text == '[{"a": 1}]'
        call = service.called("export_collection")[0]
        assert call["fmt"] == "json" and call["limit"] == 10

    def test_a_filter_can_be_passed(self, client, service):
        client.get(
            f"{BASE}/databases/shop/collections/orders/export",
            params={"filter": '{"qty": 1}'},
            headers=AUTH,
        )
        assert service.called("export_collection")[0]["filter_text"] == '{"qty": 1}'

    def test_an_unknown_format_is_a_400(self, client):
        response = client.get(
            f"{BASE}/databases/shop/collections/orders/export?format=xlsx", headers=AUTH
        )
        assert response.status_code == 400
        assert "json, jsonl or csv" in envelope(response)["message"]


# ---------------------------------------------------------------------------
# indexes, console and server
# ---------------------------------------------------------------------------
class TestIndexRoutes:
    def test_list_indexes(self, client):
        response = client.get(f"{BASE}/databases/shop/collections/orders/indexes", headers=AUTH)
        assert envelope(response)["data"][0]["keys"] == [["_id", 1]]

    def test_create_index_returns_201(self, client, service):
        response = client.post(
            f"{BASE}/databases/shop/collections/orders/indexes",
            json={"keys": {"email": 1}, "unique": True},
            headers=AUTH,
        )
        assert response.status_code == 201
        assert service.called("create_index")[0]["request"].unique is True

    def test_drop_index(self, client, service):
        client.delete(f"{BASE}/databases/shop/collections/orders/indexes/email_1", headers=AUTH)
        assert service.called("drop_index")[0]["name"] == "email_1"

    def test_dropping_the_id_index_is_a_400(self, client):
        response = client.delete(f"{BASE}/databases/shop/collections/orders/indexes/_id_", headers=AUTH)
        assert response.status_code == 400


class TestConsoleRoutes:
    def test_aggregate(self, client, service):
        response = client.post(
            f"{BASE}/databases/shop/collections/orders/aggregate",
            json={"pipeline": [{"$match": {"qty": 1}}], "max_rows": 20},
            headers=AUTH,
        )
        assert envelope(response)["data"]["kind"] == "aggregate"
        assert service.called("aggregate")[0]["request"].max_rows == 20

    def test_run_command(self, client, service):
        response = client.post(f"{BASE}/command", json={"command": {"ping": 1}, "database": "shop"}, headers=AUTH)
        assert envelope(response)["data"]["database"] == "shop"
        assert service.called("run_command")[0]["request"].command == {"ping": 1}

    def test_server_overview(self, client):
        response = client.get(f"{BASE}/server/overview", headers=AUTH)
        assert envelope(response)["data"]["version"] == "8.0.4"

    def test_current_operations(self, client):
        response = client.get(f"{BASE}/server/operations", headers=AUTH)
        assert envelope(response)["data"][0]["ns"] == "shop.orders"


# ---------------------------------------------------------------------------
# error envelope
# ---------------------------------------------------------------------------
class TestErrorEnvelope:
    def test_application_errors_keep_the_envelope(self, client, service):
        async def boom(token, database):
            raise NotFoundError("No statistics available for shop.orders")

        service.database_stats = boom
        response = client.get(f"{BASE}/databases/shop/stats", headers=AUTH)
        assert response.status_code == 404
        assert envelope(response)["message"] == "No statistics available for shop.orders"

    def test_unknown_routes_are_404(self, client):
        assert client.get(f"{BASE}/nope", headers=AUTH).status_code == 404
