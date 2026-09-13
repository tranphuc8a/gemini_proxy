"""Use-case tests driven by a fake gateway, so the calls it makes are the assertion."""

import asyncio
import json

import pytest

from src.application.exceptions.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.output.mongo_gateway_output_port import (
    MongoConnectionProfile,
    MongoGatewayOutputPort,
    QueryOutcome,
    WriteOutcome,
)
from src.application.ports.output.mongo_session_output_port import (
    MongoSessionOutputPort,
    StoredMongoSession,
)
from src.application.usecases.mongo_admin_usecase import MongoAdminUseCase
from src.domain.utils.mongo_json import bson_available
from src.domain.vo.mongoadmin_vo import (
    AggregateRequest,
    CommandRequest,
    ConnectRequest,
    CountRequest,
    CreateCollectionRequest,
    CreateDatabaseRequest,
    CreateIndexRequest,
    DeleteRequest,
    FindRequest,
    InsertRequest,
    RenameCollectionRequest,
    UpdateRequest,
)

needs_bson = pytest.mark.skipif(not bson_available(), reason="pymongo/bson is not installed")


def run(coro):
    return asyncio.run(coro)


class FakeGateway(MongoGatewayOutputPort):
    """Records every call and replays scripted answers."""

    def __init__(self, commands=None, documents=None, probe_result=None, indexes=None, collections=None):
        self.calls: list[tuple[str, dict]] = []
        self.released: list[str] = []
        self.commands = dict(commands or {})
        self.documents = list(documents or [])
        self.indexes = list(indexes or [])
        self.collections = list(collections or [])
        self.databases = [
            {"name": "shop", "sizeOnDisk": 4096, "empty": False},
            {"name": "admin", "sizeOnDisk": 8192, "empty": False},
        ]
        self.probe_result = probe_result or {
            "server_version": "8.0.4",
            "server_flavor": "MongoDB",
            "topology": "standalone",
            "host": "db.local:27017",
            "current_user": "root@admin",
        }
        self.count_value = 7
        self.write_outcome = WriteOutcome(inserted=1, matched=1, modified=1, deleted=1)

    def _record(self, _call, **kwargs):
        self.calls.append((_call, kwargs))

    def called(self, call):
        return [kwargs for name, kwargs in self.calls if name == call]

    async def probe(self, profile):
        self._record("probe", profile=profile)
        if isinstance(self.probe_result, Exception):
            raise self.probe_result
        return self.probe_result

    async def run_command(self, session_id, profile, database, command):
        self._record("run_command", database=database, command=command)
        key = next(iter(command))
        scripted = self.commands.get(key)
        if isinstance(scripted, Exception):
            raise scripted
        return dict(scripted) if scripted is not None else {"ok": 1}

    async def list_databases(self, session_id, profile):
        self._record("list_databases")
        return list(self.databases)

    async def list_collections(self, session_id, profile, database):
        self._record("list_collections", database=database)
        return list(self.collections)

    async def find(self, session_id, profile, database, collection, filter, projection=None, sort=None, skip=0, limit=50):
        self._record(
            "find",
            database=database, collection=collection, filter=filter,
            projection=projection, sort=sort, skip=skip, limit=limit,
        )
        return QueryOutcome(documents=list(self.documents), duration_ms=1.5)

    async def count(self, session_id, profile, database, collection, filter):
        self._record("count", database=database, collection=collection, filter=filter)
        return self.count_value

    async def insert(self, session_id, profile, database, collection, documents):
        self._record("insert", database=database, collection=collection, documents=documents)
        return WriteOutcome(inserted=len(documents), inserted_ids=[f"id-{i}" for i in range(len(documents))])

    async def update(self, session_id, profile, database, collection, filter, update, many=False, upsert=False, replace=False):
        self._record(
            "update",
            database=database, collection=collection, filter=filter,
            update=update, many=many, upsert=upsert, replace=replace,
        )
        return self.write_outcome

    async def delete(self, session_id, profile, database, collection, filter, many=False):
        self._record("delete", database=database, collection=collection, filter=filter, many=many)
        return self.write_outcome

    async def aggregate(self, session_id, profile, database, collection, pipeline, max_rows=200):
        self._record("aggregate", database=database, collection=collection, pipeline=pipeline, max_rows=max_rows)
        return QueryOutcome(documents=list(self.documents), duration_ms=2.0)

    async def list_indexes(self, session_id, profile, database, collection):
        self._record("list_indexes", database=database, collection=collection)
        return list(self.indexes)

    async def create_index(self, session_id, profile, database, collection, keys, options):
        self._record("create_index", database=database, collection=collection, keys=keys, options=options)
        return options.get("name") or "_".join(f"{f}_{d}" for f, d in keys)

    async def drop_index(self, session_id, profile, database, collection, name):
        self._record("drop_index", database=database, collection=collection, name=name)

    async def release(self, session_id):
        self.released.append(session_id)

    async def release_all(self):
        self.released.append("*")


class MemorySessions(MongoSessionOutputPort):
    def __init__(self):
        self.items: dict[str, StoredMongoSession] = {}

    async def create(self, session):
        session.connected_at = session.connected_at or "2026-09-13T00:00:00+00:00"
        session.last_used_at = "2026-09-13T00:00:00+00:00"
        self.items[session.token] = session
        return session

    async def get(self, token):
        return self.items.get(token)

    async def touch(self, token):
        return self.items.get(token)

    async def update(self, session):
        self.items[session.token] = session
        return session

    async def delete(self, token):
        return self.items.pop(token, None) is not None


def build(gateway=None, sessions=None, **kwargs):
    return MongoAdminUseCase(
        gateway=gateway or FakeGateway(),
        sessions=sessions or MemorySessions(),
        **kwargs,
    )


def connected(gateway=None, **connect_kwargs):
    """Return (usecase, gateway, token) with one live session."""
    gateway = gateway or FakeGateway()
    usecase = build(gateway)
    payload = {"host": "db.local", "port": 27017, "username": "root", "password": "s3cr3t"}
    payload.update(connect_kwargs)
    info = run(usecase.connect(ConnectRequest(**payload)))
    gateway.calls.clear()
    return usecase, gateway, info.token


# ---------------------------------------------------------------------------
# session
# ---------------------------------------------------------------------------
class TestSession:
    def test_connect_builds_a_uri_from_the_form_fields(self):
        gateway = FakeGateway()
        usecase = build(gateway)
        info = run(usecase.connect(ConnectRequest(host="db.local", port=27018, username="root", password="p@ss")))

        profile = gateway.called("probe")[0]["profile"]
        assert profile.uri.startswith("mongodb://root:p%40ss@db.local:27018/")
        assert info.host == "db.local" and info.port == 27018
        assert info.server_version == "8.0.4"
        assert info.label == "root@db.local:27018"
        assert info.token

    def test_connect_accepts_a_pasted_uri(self):
        gateway = FakeGateway()
        usecase = build(gateway)
        info = run(usecase.connect(ConnectRequest(uri="mongodb+srv://u:p@cluster.example.net/shop")))

        assert info.srv is True and info.tls is True
        assert info.host == "cluster.example.net" and info.database == "shop"

    def test_a_pasted_uri_wins_over_the_fields(self):
        gateway = FakeGateway()
        run(build(gateway).connect(ConnectRequest(uri="mongodb://other:27017/", host="ignored", port=1)))
        assert "other:27017" in gateway.called("probe")[0]["profile"].uri

    def test_a_malformed_uri_is_a_400(self):
        with pytest.raises(BadRequestError):
            run(build().connect(ConnectRequest(uri="http://localhost")))

    def test_an_invalid_database_name_is_a_400(self):
        with pytest.raises(BadRequestError):
            run(build().connect(ConnectRequest(host="h", database="bad name")))

    def test_a_failing_probe_is_propagated(self):
        gateway = FakeGateway(probe_result=UnauthorizedError("Authentication failed"))
        with pytest.raises(UnauthorizedError):
            run(build(gateway).connect(ConnectRequest(host="h", username="u", password="bad")))

    def test_the_session_survives_until_it_is_deleted(self):
        usecase, _, token = connected()
        assert run(usecase.current_session(token)).token == token

    def test_an_unknown_token_is_rejected(self):
        usecase, _, _ = connected()
        with pytest.raises(UnauthorizedError):
            run(usecase.current_session("nope"))

    def test_an_empty_token_is_rejected(self):
        with pytest.raises(UnauthorizedError):
            run(build().current_session(""))

    def test_disconnect_releases_the_client(self):
        usecase, gateway, token = connected()
        assert run(usecase.disconnect(token)) is True
        assert gateway.released == [token]
        with pytest.raises(UnauthorizedError):
            run(usecase.current_session(token))

    def test_disconnecting_twice_is_not_an_error(self):
        usecase, _, token = connected()
        run(usecase.disconnect(token))
        assert run(usecase.disconnect(token)) is False


# ---------------------------------------------------------------------------
# databases and collections
# ---------------------------------------------------------------------------
class TestDatabases:
    def test_databases_come_back_sorted(self):
        usecase, _, token = connected()
        names = [db.name for db in run(usecase.list_databases(token))]
        assert names == ["admin", "shop"]

    def test_create_database_creates_its_first_collection(self):
        usecase, gateway, token = connected()
        run(usecase.create_database(token, CreateDatabaseRequest(name="analytics", collection="events")))
        assert gateway.called("run_command")[0] == {"database": "analytics", "command": {"create": "events"}}

    def test_creating_an_existing_database_is_a_conflict(self):
        usecase, _, token = connected()
        with pytest.raises(ConflictError):
            run(usecase.create_database(token, CreateDatabaseRequest(name="shop")))

    def test_drop_database_issues_the_command(self):
        usecase, gateway, token = connected()
        run(usecase.drop_database(token, "shop"))
        assert gateway.called("run_command")[0] == {"database": "shop", "command": {"dropDatabase": 1}}

    @pytest.mark.parametrize("name", ["admin", "local", "config"])
    def test_system_databases_are_protected(self, name):
        usecase, gateway, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.drop_database(token, name))
        assert gateway.called("run_command") == []

    def test_the_protection_can_be_lifted(self):
        gateway = FakeGateway()
        usecase = MongoAdminUseCase(gateway, MemorySessions(), allow_reserved_database_drop=True)
        token = run(usecase.connect(ConnectRequest(host="h"))).token
        run(usecase.drop_database(token, "config"))
        assert {"dropDatabase": 1} in [call["command"] for call in gateway.called("run_command")]

    def test_db_stats_drop_the_command_envelope(self):
        gateway = FakeGateway(commands={"dbStats": {"db": "shop", "collections": 3, "ok": 1, "operationTime": 1}})
        usecase = build(gateway)
        token = run(usecase.connect(ConnectRequest(host="h"))).token
        stats = run(usecase.database_stats(token, "shop"))
        assert stats.stats == {"db": "shop", "collections": 3}


class TestCollections:
    def test_collections_are_listed_and_sorted(self):
        gateway = FakeGateway(
            collections=[
                {"name": "orders", "type": "collection", "options": {}},
                {"name": "Customers", "type": "collection", "options": {"capped": True}},
                {"name": "recent", "type": "view", "options": {"viewOn": "orders"}},
            ]
        )
        usecase, gateway, token = connected(gateway)
        result = run(usecase.list_collections(token, "shop"))
        assert [c.name for c in result] == ["Customers", "orders", "recent"]
        assert result[0].capped is True
        assert result[2].type == "view" and result[2].view_on == "orders"

    def test_stats_are_only_fetched_on_request(self):
        gateway = FakeGateway(
            collections=[{"name": "orders", "type": "collection", "options": {}}],
            commands={"collStats": {"count": 12, "size": 900, "storageSize": 4096, "nindexes": 2, "ok": 1}},
        )
        usecase, gateway, token = connected(gateway)

        plain = run(usecase.list_collections(token, "shop"))
        assert plain[0].count is None
        assert gateway.called("run_command") == []

        enriched = run(usecase.list_collections(token, "shop", with_stats=True))
        assert enriched[0].count == 12 and enriched[0].index_count == 2

    def test_create_collection_can_be_capped(self):
        usecase, gateway, token = connected()
        run(usecase.create_collection(token, "shop", CreateCollectionRequest(name="logs", capped=True, size=4096, max_documents=100)))
        assert gateway.called("run_command")[0]["command"] == {
            "create": "logs", "capped": True, "size": 4096, "max": 100,
        }

    def test_a_capped_collection_needs_a_size(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.create_collection(token, "shop", CreateCollectionRequest(name="logs", capped=True)))

    def test_rename_uses_fully_qualified_names_on_admin(self):
        usecase, gateway, token = connected()
        run(usecase.rename_collection(token, "shop", "orders", RenameCollectionRequest(name="orders_v2")))
        call = gateway.called("run_command")[0]
        assert call["database"] == "admin"
        assert call["command"] == {
            "renameCollection": "shop.orders", "to": "shop.orders_v2", "dropTarget": False,
        }

    def test_renaming_to_the_same_name_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.rename_collection(token, "shop", "orders", RenameCollectionRequest(name="orders")))

    def test_truncate_deletes_every_document(self):
        usecase, gateway, token = connected()
        result = run(usecase.truncate_collection(token, "shop", "orders"))
        assert gateway.called("delete")[0] == {
            "database": "shop", "collection": "orders", "filter": {}, "many": True,
        }
        assert result.deleted == 1

    def test_coll_stats_fall_back_to_the_aggregation_stage(self):
        gateway = FakeGateway(commands={"collStats": RuntimeError("no such command")})
        gateway.documents = [{"ns": "shop.orders", "storageStats": {"count": 3, "size": 120}}]
        usecase, gateway, token = connected(gateway)
        stats = run(usecase.collection_stats(token, "shop", "orders"))
        assert stats.stats["count"] == 3 and stats.stats["size"] == 120
        assert gateway.called("aggregate")[0]["pipeline"] == [{"$collStats": {"storageStats": {}, "count": {}}}]

    def test_missing_stats_are_a_404(self):
        gateway = FakeGateway(commands={"collStats": RuntimeError("nope")})
        gateway.documents = []
        usecase, _, token = connected(gateway)
        with pytest.raises(NotFoundError):
            run(usecase.collection_stats(token, "shop", "orders"))

    def test_a_bad_collection_name_never_reaches_the_gateway(self):
        usecase, gateway, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.drop_collection(token, "shop", "bad$name"))
        assert gateway.calls == []


# ---------------------------------------------------------------------------
# documents
# ---------------------------------------------------------------------------
class TestDocuments:
    def test_find_decodes_the_filter_and_encodes_the_results(self):
        gateway = FakeGateway(documents=[{"_id": 1, "name": "a"}, {"_id": 2, "qty": 3}])
        usecase, gateway, token = connected(gateway)
        page = run(usecase.find_documents(
            token, "shop", "orders",
            FindRequest(filter={"qty": {"$gt": 1}}, sort={"qty": -1}, skip=10, limit=25),
        ))

        call = gateway.called("find")[0]
        assert call["filter"] == {"qty": {"$gt": 1}}
        assert call["sort"] == [("qty", -1)]
        assert call["skip"] == 10 and call["limit"] == 25
        assert page.fields == ["_id", "name", "qty"]
        assert page.total == 7 and page.duration_ms == 1.5

    def test_the_count_can_be_skipped(self):
        usecase, gateway, token = connected()
        page = run(usecase.find_documents(token, "shop", "orders", FindRequest(with_count=False)))
        assert page.total == 0 and gateway.called("count") == []

    def test_the_limit_is_capped_by_configuration(self):
        gateway = FakeGateway()
        usecase = MongoAdminUseCase(gateway, MemorySessions(), max_documents_hard_limit=20)
        token = run(usecase.connect(ConnectRequest(host="h"))).token
        page = run(usecase.find_documents(token, "shop", "orders", FindRequest(limit=500)))
        assert page.limit == 20
        assert gateway.called("find")[0]["limit"] == 20

    def test_a_projection_is_forwarded_only_when_given(self):
        usecase, gateway, token = connected()
        run(usecase.find_documents(token, "shop", "orders", FindRequest(projection={"name": 1})))
        assert gateway.called("find")[0]["projection"] == {"name": 1}

        gateway.calls.clear()
        run(usecase.find_documents(token, "shop", "orders", FindRequest()))
        assert gateway.called("find")[0]["projection"] is None

    def test_a_malformed_sort_is_a_400(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.find_documents(token, "shop", "orders", FindRequest(sort={"name": 5})))

    def test_count_uses_the_given_filter(self):
        usecase, gateway, token = connected()
        assert run(usecase.count_documents(token, "shop", "orders", CountRequest(filter={"a": 1}))) == 7
        assert gateway.called("count")[0]["filter"] == {"a": 1}

    def test_insert_accepts_one_document(self):
        usecase, gateway, token = connected()
        result = run(usecase.insert_documents(token, "shop", "orders", InsertRequest(documents={"name": "x"})))
        assert gateway.called("insert")[0]["documents"] == [{"name": "x"}]
        assert result.inserted == 1 and result.inserted_ids == ["id-0"]

    def test_insert_accepts_many_documents(self):
        usecase, gateway, token = connected()
        result = run(usecase.insert_documents(token, "shop", "orders", InsertRequest(documents=[{"a": 1}, {"b": 2}])))
        assert len(gateway.called("insert")[0]["documents"]) == 2 and result.inserted == 2

    def test_insert_rejects_a_non_document(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.insert_documents(token, "shop", "orders", InsertRequest(documents="nope")))

    def test_an_operator_update_is_not_a_replacement(self):
        usecase, gateway, token = connected()
        run(usecase.update_documents(
            token, "shop", "orders",
            UpdateRequest(filter={"_id": 1}, update={"$set": {"qty": 4}}),
        ))
        call = gateway.called("update")[0]
        assert call["replace"] is False and call["update"] == {"$set": {"qty": 4}}

    def test_a_plain_document_becomes_a_replacement(self):
        usecase, gateway, token = connected()
        run(usecase.update_documents(token, "shop", "orders", UpdateRequest(filter={"_id": 1}, update={"qty": 4})))
        assert gateway.called("update")[0]["replace"] is True

    def test_a_replacement_cannot_target_many_documents(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.update_documents(token, "shop", "orders", UpdateRequest(filter={"a": 1}, update={"b": 2}, many=True)))

    def test_updating_one_document_needs_a_filter(self):
        usecase, gateway, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.update_documents(token, "shop", "orders", UpdateRequest(update={"$set": {"a": 1}})))
        assert gateway.called("update") == []

    def test_an_empty_update_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.update_documents(token, "shop", "orders", UpdateRequest(filter={"_id": 1}, update={})))

    def test_mixing_operators_and_fields_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.update_documents(
                token, "shop", "orders",
                UpdateRequest(filter={"_id": 1}, update={"$set": {"a": 1}, "b": 2}),
            ))

    def test_delete_needs_a_filter(self):
        usecase, gateway, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.delete_documents(token, "shop", "orders", DeleteRequest()))
        assert gateway.called("delete") == []

    def test_deleting_everything_is_pushed_to_the_truncate_action(self):
        usecase, gateway, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.delete_documents(token, "shop", "orders", DeleteRequest(many=True)))
        assert gateway.called("delete") == []

    def test_delete_many_with_a_filter_is_allowed(self):
        usecase, gateway, token = connected()
        result = run(usecase.delete_documents(token, "shop", "orders", DeleteRequest(filter={"qty": 0}, many=True)))
        assert gateway.called("delete")[0]["many"] is True and result.deleted == 1

    @needs_bson
    def test_an_object_id_filter_round_trips(self):
        from bson import ObjectId

        gateway = FakeGateway(documents=[{"_id": ObjectId("507f1f77bcf86cd799439011"), "n": 1}])
        usecase, gateway, token = connected(gateway)
        page = run(usecase.find_documents(
            token, "shop", "orders",
            FindRequest(filter={"_id": {"$oid": "507f1f77bcf86cd799439011"}}),
        ))
        assert gateway.called("find")[0]["filter"] == {"_id": ObjectId("507f1f77bcf86cd799439011")}
        assert page.documents[0]["_id"] == {"$oid": "507f1f77bcf86cd799439011"}


class TestExport:
    def test_json_export(self):
        gateway = FakeGateway(documents=[{"_id": 1, "name": "a"}])
        usecase, _, token = connected(gateway)
        payload = run(usecase.export_collection(token, "shop", "orders", "json", 100))
        assert payload["filename"] == "shop.orders.json"
        assert payload["media_type"] == "application/json"
        assert json.loads(payload["content"]) == [{"_id": 1, "name": "a"}]

    def test_jsonl_export_puts_one_document_per_line(self):
        gateway = FakeGateway(documents=[{"a": 1}, {"a": 2}])
        usecase, _, token = connected(gateway)
        payload = run(usecase.export_collection(token, "shop", "orders", "jsonl", 100))
        assert payload["content"].splitlines() == ['{"a": 1}', '{"a": 2}']

    def test_csv_export_unions_the_columns(self):
        gateway = FakeGateway(documents=[{"_id": 1, "name": "a"}, {"_id": 2, "qty": 3}])
        usecase, _, token = connected(gateway)
        payload = run(usecase.export_collection(token, "shop", "orders", "csv", 100))
        assert payload["content"].splitlines()[0] == "_id,name,qty"
        assert payload["content"].splitlines()[2] == "2,,3"

    def test_an_unknown_format_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.export_collection(token, "shop", "orders", "xlsx", 100))

    def test_a_malformed_filter_is_reported(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.export_collection(token, "shop", "orders", "json", 100, "{not json"))

    def test_the_filter_is_applied(self):
        usecase, gateway, token = connected()
        run(usecase.export_collection(token, "shop", "orders", "json", 100, '{"qty": 1}'))
        assert gateway.called("find")[0]["filter"] == {"qty": 1}


# ---------------------------------------------------------------------------
# indexes
# ---------------------------------------------------------------------------
class TestIndexes:
    def test_indexes_are_flattened_for_the_ui(self):
        gateway = FakeGateway(indexes=[
            {"name": "_id_", "key": {"_id": 1}},
            {"name": "email_1", "key": {"email": 1}, "unique": True, "expireAfterSeconds": 60},
        ])
        usecase, _, token = connected(gateway)
        indexes = run(usecase.list_indexes(token, "shop", "users"))
        assert indexes[0].keys == [["_id", 1]]
        assert indexes[1].unique is True and indexes[1].ttl_seconds == 60

    def test_create_index_maps_every_option(self):
        usecase, gateway, token = connected()
        run(usecase.create_index(token, "shop", "users", CreateIndexRequest(
            keys={"email": 1}, name="email_unique", unique=True, sparse=True,
            ttl_seconds=3600, partial_filter={"active": True},
        )))
        call = gateway.called("create_index")[0]
        assert call["keys"] == [("email", 1)]
        assert call["options"] == {
            "name": "email_unique", "unique": True, "sparse": True,
            "expireAfterSeconds": 3600, "partialFilterExpression": {"active": True},
        }

    def test_special_index_types_are_allowed(self):
        usecase, gateway, token = connected()
        run(usecase.create_index(token, "shop", "places", CreateIndexRequest(keys={"loc": "2dsphere"})))
        assert gateway.called("create_index")[0]["keys"] == [("loc", "2dsphere")]

    @pytest.mark.parametrize("keys", [{}, {"a": 2}, {"a": "nonsense"}, "a", [["a", 1, 2]]])
    def test_invalid_index_keys_are_rejected(self, keys):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.create_index(token, "shop", "users", CreateIndexRequest(keys=keys)))

    def test_the_id_index_cannot_be_dropped(self):
        usecase, gateway, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.drop_index(token, "shop", "users", "_id_"))
        assert gateway.called("drop_index") == []

    def test_drop_index_passes_the_name_through(self):
        usecase, gateway, token = connected()
        run(usecase.drop_index(token, "shop", "users", "email_1"))
        assert gateway.called("drop_index")[0]["name"] == "email_1"


# ---------------------------------------------------------------------------
# console and server
# ---------------------------------------------------------------------------
class TestConsole:
    def test_aggregate_forwards_the_pipeline(self):
        gateway = FakeGateway(documents=[{"_id": "a", "n": 2}])
        usecase, gateway, token = connected(gateway)
        result = run(usecase.aggregate(token, "shop", "orders", AggregateRequest(
            pipeline=[{"$group": {"_id": "$status", "n": {"$sum": 1}}}], max_rows=50,
        )))
        assert gateway.called("aggregate")[0]["max_rows"] == 50
        assert result.kind == "aggregate" and result.row_count == 1

    def test_an_empty_pipeline_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.aggregate(token, "shop", "orders", AggregateRequest(pipeline=[])))

    def test_a_non_list_pipeline_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.aggregate(token, "shop", "orders", AggregateRequest(pipeline={"$match": {}})))

    def test_a_command_defaults_to_admin(self):
        usecase, gateway, token = connected()
        run(usecase.run_command(token, CommandRequest(command={"ping": 1})))
        assert gateway.called("run_command")[0]["database"] == "admin"

    def test_a_command_can_name_its_database(self):
        usecase, gateway, token = connected()
        run(usecase.run_command(token, CommandRequest(command={"ping": 1}, database="shop")))
        assert gateway.called("run_command")[0]["database"] == "shop"

    def test_a_cursor_result_is_surfaced_as_documents(self):
        gateway = FakeGateway(commands={"listCollections": {
            "cursor": {"firstBatch": [{"name": "orders"}, {"name": "users"}]}, "ok": 1,
        }})
        usecase, _, token = connected(gateway)
        result = run(usecase.run_command(token, CommandRequest(command={"listCollections": 1})))
        assert result.row_count == 2 and result.documents[0] == {"name": "orders"}

    def test_an_empty_command_is_rejected(self):
        usecase, _, token = connected()
        with pytest.raises(BadRequestError):
            run(usecase.run_command(token, CommandRequest(command={})))

    def test_server_overview_pulls_the_interesting_counters(self):
        gateway = FakeGateway(commands={
            "serverStatus": {
                "version": "8.0.4", "host": "db.local:27017", "uptime": 1234,
                "connections": {"current": 3}, "opcounters": {"query": 9},
                "mem": {"resident": 120}, "storageEngine": {"name": "wiredTiger"}, "ok": 1,
            },
            "buildInfo": {"version": "8.0.4", "gitVersion": "abc", "bits": 64, "ok": 1},
        })
        usecase, _, token = connected(gateway)
        overview = run(usecase.server_overview(token))
        assert overview.version == "8.0.4"
        assert overview.uptime_seconds == 1234
        assert overview.storage_engine == "wiredTiger"
        assert overview.connections == {"current": 3}
        assert overview.build == {"version": "8.0.4", "gitVersion": "abc", "bits": 64}
        assert overview.current_user == "root@admin"

    def test_current_operations_read_the_inprog_list(self):
        gateway = FakeGateway(commands={"currentOp": {
            "inprog": [{"opid": 12, "op": "query", "ns": "shop.orders", "secs_running": 2, "active": True}],
            "ok": 1,
        }})
        usecase, _, token = connected(gateway)
        operations = run(usecase.current_operations(token))
        assert operations[0].opid == 12 and operations[0].ns == "shop.orders"

    def test_current_operations_fall_back_to_the_aggregation_stage(self):
        gateway = FakeGateway(commands={
            "currentOp": RuntimeError("no such command"),
            "aggregate": {"cursor": {"firstBatch": [{"opid": 5, "op": "getmore"}]}, "ok": 1},
        })
        usecase, gateway, token = connected(gateway)
        operations = run(usecase.current_operations(token))
        assert operations[0].opid == 5
        assert gateway.called("run_command")[1]["command"]["pipeline"] == [{"$currentOp": {}}]


# ---------------------------------------------------------------------------
# every operation is behind the session check
# ---------------------------------------------------------------------------
class TestAuthorisation:
    @pytest.mark.parametrize("call", [
        lambda uc, t: uc.list_databases(t),
        lambda uc, t: uc.drop_database(t, "shop"),
        lambda uc, t: uc.database_stats(t, "shop"),
        lambda uc, t: uc.list_collections(t, "shop"),
        lambda uc, t: uc.drop_collection(t, "shop", "orders"),
        lambda uc, t: uc.truncate_collection(t, "shop", "orders"),
        lambda uc, t: uc.collection_stats(t, "shop", "orders"),
        lambda uc, t: uc.find_documents(t, "shop", "orders", FindRequest()),
        lambda uc, t: uc.count_documents(t, "shop", "orders", CountRequest()),
        lambda uc, t: uc.insert_documents(t, "shop", "orders", InsertRequest(documents={"a": 1})),
        lambda uc, t: uc.list_indexes(t, "shop", "orders"),
        lambda uc, t: uc.aggregate(t, "shop", "orders", AggregateRequest(pipeline=[{"$match": {}}])),
        lambda uc, t: uc.run_command(t, CommandRequest(command={"ping": 1})),
        lambda uc, t: uc.server_overview(t),
        lambda uc, t: uc.current_operations(t),
    ])
    def test_an_invalid_token_is_rejected_everywhere(self, call):
        usecase = build()
        with pytest.raises(UnauthorizedError):
            run(call(usecase, "not-a-token"))
