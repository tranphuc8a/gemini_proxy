"""Backup and restore for both administrators.

The gateways are replaced with recorders, so what is under test is the thing
worth testing without a server: *what SQL and which driver calls get produced*.
Three of these assertions exist because the live run against MySQL 8 found the
real bug first:

* a dump must carry the server's `sql_mode`, or a server running `ANSI_QUOTES`
  produces DDL its own restore cannot parse;
* a dump must name tables unqualified, or restoring into another schema inserts
  the rows back into the one it came from;
* the `DROP` statements must be unqualified too, or a restore *deletes objects
  in the database the backup was taken from*.
"""

import os

os.environ.setdefault("TESTING", "1")

import json
from types import SimpleNamespace

import pytest

from src.application.usecases.mongo_admin_usecase import MongoAdminUseCase
from src.application.usecases.sql_admin_usecase import SqlAdminUseCase
from src.domain.vo.mongoadmin_vo import MongoBackupRequest, MongoRestoreRequest
from src.domain.vo.sqladmin_vo import BackupRequest, RestoreRequest
from tests.conftest import arun


# =========================================================== SQL administrator

class FakeSqlGateway:
    """Answers the handful of queries a backup makes, and records everything."""

    def __init__(self, *, sql_mode="ONLY_FULL_GROUP_BY", rows=None):
        self.statements: list[str] = []
        self.sql_mode = sql_mode
        self.rows = rows if rows is not None else [(1, "Knuth"), (2, "Dijkstra")]

    async def execute(self, *, session_id, profile, statement, params=None, database=None, max_rows=None):
        self.statements.append(statement)
        upper = statement.upper()

        def result(columns, rows):
            return SimpleNamespace(columns=columns, rows=rows, affected_rows=len(rows), duration_ms=1.0)

        if "@@SESSION.SQL_MODE" in upper:
            return result(["sql_mode"], [(self.sql_mode,)])
        if "INFORMATION_SCHEMA.TABLES" in upper:
            return result(["TABLE_NAME", "TABLE_TYPE"], [("authors", "BASE TABLE"), ("v_a", "VIEW")])
        if upper.startswith("SHOW CREATE TABLE"):
            quoted = '"authors"' if "ANSI_QUOTES" in self.sql_mode else "`authors`"
            return result(["Table", "Create Table"], [("authors", f"CREATE TABLE {quoted} (id int)")])
        if upper.startswith("SHOW CREATE VIEW"):
            return result(["View", "Create View"], [("v_a", "CREATE VIEW v_a AS SELECT 1")])
        if upper.startswith("SHOW CREATE FUNCTION") or upper.startswith("SHOW CREATE PROCEDURE"):
            return result(["Name", "sql_mode", "Create"], [("fn", "", "CREATE FUNCTION fn() RETURNS INT RETURN 1")])
        if "INFORMATION_SCHEMA.ROUTINES" in upper:
            return result(
                ["ROUTINE_NAME", "ROUTINE_TYPE", "DTD_IDENTIFIER", "EXTERNAL_LANGUAGE",
                 "IS_DETERMINISTIC", "SECURITY_TYPE", "ROUTINE_COMMENT", "CREATED", "LAST_ALTERED"],
                [("fn", "FUNCTION", "int", "SQL", "YES", "DEFINER", "", None, None)],
            )
        if "INFORMATION_SCHEMA.PARAMETERS" in upper:
            return result(["SPECIFIC_NAME", "PARAMETER_MODE", "PARAMETER_NAME", "DTD_IDENTIFIER"], [])
        if upper.startswith("SELECT * FROM"):
            return result(["id", "name"], list(self.rows))
        return result([], [])

    async def release(self, session_id):
        return None


class FakeSqlSessions:
    def __init__(self):
        self.session = SimpleNamespace(
            token="tok", profile=SimpleNamespace(database=None), label="x",
            server_version="8.4", server_flavor="MySQL", connected_at="", last_used_at="", metadata={},
        )

    async def touch(self, token):
        return self.session if token else None


def sql_service(**gateway_kwargs):
    gateway = FakeSqlGateway(**gateway_kwargs)
    service = SqlAdminUseCase(gateway=gateway, sessions=FakeSqlSessions())
    return service, gateway


def test_the_dump_carries_the_servers_sql_mode():
    """A server running ANSI_QUOTES emits `"name"` from SHOW CREATE TABLE. A
    dump that reset SQL_MODE to something without it produced DDL that its own
    restore rejected as a syntax error."""
    service, _ = sql_service(sql_mode="ANSI_QUOTES,STRICT_ALL_TABLES")
    result = arun(service.backup_database("tok", "shop", BackupRequest()))
    assert "ANSI_QUOTES" in result.content
    assert "SET SQL_MODE = 'ANSI_QUOTES,STRICT_ALL_TABLES,NO_AUTO_VALUE_ON_ZERO'" in result.content


def test_inserts_are_not_qualified_with_the_source_schema():
    """SHOW CREATE TABLE emits an unqualified CREATE, so the restore's `USE`
    decides where a table lands. Qualified INSERTs would send the rows to the
    schema the dump came from and leave the restored tables empty."""
    service, _ = sql_service()
    content = arun(service.backup_database("tok", "shop", BackupRequest())).content
    assert "INSERT INTO `authors`" in content
    assert "INSERT INTO `shop`.`authors`" not in content


def test_drop_statements_are_not_qualified_either():
    """The dangerous half: a qualified DROP means restoring into database B
    deletes the view and routine in database A."""
    service, _ = sql_service()
    content = arun(service.backup_database("tok", "shop", BackupRequest())).content
    assert "`shop`." not in content.replace("dump of `shop`", "")


def test_routines_are_wrapped_in_delimiter():
    """A routine body is one statement full of semicolons; without DELIMITER a
    restore would tear it into fragments."""
    content = arun(sql_service()[0].backup_database("tok", "shop", BackupRequest())).content
    assert "DELIMITER $$" in content and "DELIMITER ;" in content


def test_schema_only_and_data_only_dumps():
    service, _ = sql_service()
    schema_only = arun(service.backup_database("tok", "shop", BackupRequest(include_data=False)))
    assert "INSERT INTO" not in schema_only.content
    assert "CREATE TABLE" in schema_only.content

    data_only = arun(service.backup_database("tok", "shop", BackupRequest(include_schema=False)))
    assert "CREATE TABLE" not in data_only.content
    assert "INSERT INTO" in data_only.content


def test_a_capped_dump_says_which_tables_it_cut():
    service, _ = sql_service(rows=[(n, f"row{n}") for n in range(10)])
    result = arun(service.backup_database("tok", "shop", BackupRequest(max_rows_per_table=3)))
    assert result.truncated_tables == ["authors"]
    assert result.rows == 3


def test_restore_refuses_a_mismatched_confirmation():
    """Getting this wrong is the difference between restoring a backup and
    destroying a live schema."""
    service, _ = sql_service()
    with pytest.raises(Exception) as raised:
        arun(service.restore_database("tok", "shop", RestoreRequest(
            content="SELECT 1;", confirm_database="production"
        )))
    assert "production" in str(raised.value)


def test_restore_selects_the_target_database_first():
    service, gateway = sql_service()
    arun(service.restore_database("tok", "shop", RestoreRequest(content="SELECT 1;")))
    assert gateway.statements[0] == "USE `shop`"


def test_restore_keeps_going_when_asked_to():
    service, gateway = sql_service()

    async def failing(*, session_id, profile, statement, params=None, database=None, max_rows=None):
        gateway.statements.append(statement)
        if "BOOM" in statement:
            raise RuntimeError("no such table")
        return SimpleNamespace(columns=[], rows=[], affected_rows=1, duration_ms=1.0)

    gateway.execute = failing
    result = arun(service.restore_database("tok", "shop", RestoreRequest(
        content="SELECT 1;\nBOOM;\nSELECT 2;", stop_on_error=False
    )))
    assert result.statements == 3
    assert result.executed == 2 and result.failed == 1
    assert "no such table" in result.errors[0]


def test_restore_stops_on_the_first_error_by_default():
    service, gateway = sql_service()

    async def failing(*, session_id, profile, statement, params=None, database=None, max_rows=None):
        if "BOOM" in statement:
            raise RuntimeError("bad")
        return SimpleNamespace(columns=[], rows=[], affected_rows=0, duration_ms=1.0)

    gateway.execute = failing
    result = arun(service.restore_database("tok", "shop", RestoreRequest(content="BOOM;\nSELECT 2;")))
    assert result.failed == 1 and result.executed == 0


def test_an_empty_dump_is_refused():
    service, _ = sql_service()
    with pytest.raises(Exception):
        arun(service.restore_database("tok", "shop", RestoreRequest(content="-- nothing here\n")))


# ========================================================= Mongo administrator

class FakeMongoGateway:
    def __init__(self, documents=None):
        self.commands: list[dict] = []
        self.inserted: list[list[dict]] = []
        self.indexes_created: list[tuple] = []
        self.documents = documents if documents is not None else [{"_id": 1, "name": "a"}, {"_id": 2, "name": "b"}]

    async def list_collections(self, token, profile, database):
        return [{"name": "people"}]

    async def list_indexes(self, token, profile, database, collection):
        return [
            {"name": "_id_", "key": {"_id": 1}},
            {"name": "ix_name", "key": {"name": 1}, "unique": True},
        ]

    async def find(self, token, profile, database, collection, query, projection, sort, skip, limit):
        return SimpleNamespace(documents=self.documents[:limit], duration_ms=1.0, truncated=False)

    async def insert(self, token, profile, database, collection, documents):
        self.inserted.append(list(documents))
        return SimpleNamespace(inserted=len(documents), matched=0, modified=0, deleted=0, upserted_id=None)

    async def create_index(self, token, profile, database, collection, keys, options):
        self.indexes_created.append((collection, keys, options))
        return "ix"

    async def run_command(self, token, profile, database, command):
        self.commands.append(command)
        return {"ok": 1}


class FakeMongoSessions:
    def __init__(self):
        self.session = SimpleNamespace(token="tok", profile=SimpleNamespace(uri="mongodb://x"))

    async def touch(self, token):
        return self.session if token else None


def mongo_service(**kwargs):
    gateway = FakeMongoGateway(**kwargs)
    return MongoAdminUseCase(gateway=gateway, sessions=FakeMongoSessions()), gateway


def test_mongo_backup_is_readable_extended_json():
    service, _ = mongo_service()
    result = arun(service.backup_database("tok", "shop", MongoBackupRequest()))
    payload = json.loads(result.content)
    assert payload["database"] == "shop"
    assert payload["collections"][0]["name"] == "people"
    assert len(payload["collections"][0]["documents"]) == 2
    assert result.documents == 2


def test_the_automatic_id_index_is_not_dumped():
    """`_id_` is created by the server; restoring it would fail, and counting it
    would overstate what the dump carries."""
    service, _ = mongo_service()
    result = arun(service.backup_database("tok", "shop", MongoBackupRequest()))
    names = [index["name"] for index in json.loads(result.content)["collections"][0]["indexes"]]
    assert names == ["ix_name"]
    assert result.indexes == 1


def test_a_capped_mongo_dump_says_which_collections_it_cut():
    service, _ = mongo_service(documents=[{"_id": n} for n in range(20)])
    result = arun(service.backup_database("tok", "shop", MongoBackupRequest(max_documents_per_collection=5)))
    assert result.truncated_collections == ["people"]
    assert result.documents == 5


def test_mongo_restore_round_trips_a_dump():
    service, gateway = mongo_service()
    dump = arun(service.backup_database("tok", "shop", MongoBackupRequest())).content

    result = arun(service.restore_database("tok", "shop2", MongoRestoreRequest(content=dump)))
    assert result.collections == 1
    assert result.documents == 2
    assert result.indexes == 1
    assert gateway.inserted[0][0]["_id"] == 1
    assert gateway.indexes_created[0][0] == "people"


def test_restore_only_drops_when_asked():
    service, gateway = mongo_service()
    dump = arun(service.backup_database("tok", "shop", MongoBackupRequest())).content

    arun(service.restore_database("tok", "shop", MongoRestoreRequest(content=dump)))
    assert not any("drop" in command for command in gateway.commands)

    arun(service.restore_database("tok", "shop", MongoRestoreRequest(content=dump, drop_existing=True)))
    assert {"drop": "people"} in gateway.commands


def test_mongo_restore_refuses_a_mismatched_confirmation():
    service, _ = mongo_service()
    with pytest.raises(Exception) as raised:
        arun(service.restore_database("tok", "shop", MongoRestoreRequest(
            content='{"collections": []}', confirm_database="production"
        )))
    assert "production" in str(raised.value)


def test_mongo_restore_rejects_rubbish():
    service, _ = mongo_service()
    with pytest.raises(Exception):
        arun(service.restore_database("tok", "shop", MongoRestoreRequest(content="{not json")))
    with pytest.raises(Exception):
        arun(service.restore_database("tok", "shop", MongoRestoreRequest(content='{"hello": 1}')))


def test_large_restores_are_batched():
    """One insert_many of a hundred thousand documents can exceed MongoDB's 48MB
    command limit, and a failure there loses the whole collection.

    The dump itself is capped by MONGOADMIN_MAX_DOCUMENTS, so the assertion is
    about the *shape* of the batching rather than an exact count.
    """
    service, gateway = mongo_service(documents=[{"_id": n} for n in range(1200)])
    dump = arun(service.backup_database("tok", "shop", MongoBackupRequest())).content
    arun(service.restore_database("tok", "shop", MongoRestoreRequest(content=dump)))

    assert len(gateway.inserted) > 1, "everything arrived in a single insert"
    assert all(len(batch) <= 500 for batch in gateway.inserted)
    assert sum(len(batch) for batch in gateway.inserted) == len(json.loads(dump)["collections"][0]["documents"])
