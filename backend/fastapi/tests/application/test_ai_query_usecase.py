"""A question → SQL / Mongo: what the model reads, and what is checked before the page sees it."""

from __future__ import annotations

import asyncio
import json

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, BadRequestError
from src.application.usecases import ai_query_usecase
from src.application.usecases.ai_query_usecase import AiQueryUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from src.domain.vo.mongoadmin_vo import DocumentPage
from src.domain.vo.sqladmin_vo import (ColumnInfo, DatabaseSchema, ForeignKeyInfo, QueryResult, SchemaTable,
                                       SessionInfo)
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN = AiCaller(ip="1.2.3.4", admin=True)
GUEST = AiCaller(ip="5.6.7.8")


def _col(name, ctype="int", key=None, nullable=True, comment=None, extra=None):
    return ColumnInfo(name=name, data_type=ctype.split("(")[0], column_type=ctype, nullable=nullable, key=key,
                      comment=comment, extra=extra)


SCHEMA = DatabaseSchema(database="shop", tables=[
    SchemaTable(name="customers", comment="khách hàng", columns=[
        _col("id", key="PRI", nullable=False, extra="auto_increment"), _col("email", "varchar(120)", key="UNI")]),
    SchemaTable(name="orders", columns=[
        _col("id", key="PRI", nullable=False), _col("customer_id", key="MUL"),
        _col("status", "enum('new','paid')", nullable=False, comment="trạng thái")],
        foreign_keys=[ForeignKeyInfo(name="fk", column="customer_id", referenced_table="customers",
                                     referenced_column="id", referenced_schema="shop")]),
])


class FakeSql:
    """The SQL administrator as the helper uses it: session, schema, EXPLAIN."""

    def __init__(self, errors=None):
        self.errors = dict(errors or {})            # substring of the EXPLAINed statement → MySQL error
        self.explained = []

    async def current_session(self, token):
        assert token == "tok"
        return SessionInfo(token=token, host="db", port=3306, username="u", server_version="8.0.36",
                           server_flavor="MySQL", connected_at="t", last_used_at="t")

    async def database_schema(self, token, database):
        return SCHEMA

    async def run_sql(self, token, request):
        assert request.sql.startswith("EXPLAIN ") and request.database == "shop"
        self.explained.append(request.sql[8:])
        error = next((e for needle, e in self.errors.items() if needle in request.sql), None)
        return [QueryResult(statement=request.sql, error=error)]


DOCS = [
    {"_id": {"$oid": "65a000000000000000000001"}, "email": "a@x.vn", "status": "active", "age": 30,
     "createdAt": {"$date": "2024-01-02T00:00:00Z"}, "address": {"city": "Hà Nội"},
     "tags": ["vip", "new"], "orders": [{"total": 12.5}]},
    {"_id": {"$oid": "65a000000000000000000002"}, "email": "b@x.vn", "status": "banned", "age": 41},
    {"_id": {"$oid": "65a000000000000000000003"}, "email": "c@x.vn", "status": "active", "age": None},
]


class FakeMongo:
    def __init__(self, docs=DOCS):
        self.docs = docs
        self.requests = []

    async def find_documents(self, token, database, collection, request):
        self.requests.append((token, database, collection, request))
        return DocumentPage(database=database, collection=collection, documents=self.docs)


@pytest.fixture
def ai(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")

    def make(*answers, errors=None, store=None, docs=DOCS):
        model = FakeModel([a if isinstance(a, str) else json.dumps(a) for a in answers])
        sql, mongo = FakeSql(errors), FakeMongo(docs)
        return AiQueryUseCase(AiUseCase(store or FakeStore(), model), sql, mongo), model, sql, mongo
    return make


def _sql(uc, caller=ADMIN, **kw):
    return asyncio.run(uc.sql(caller, **{"token": "tok", "database": "shop", "question": "đơn đã trả tiền", **kw}))


def _mongo(uc, caller=ADMIN, **kw):
    args = {"token": "tok", "database": "shop", "collection": "users", "question": "người bị khoá", **kw}
    return asyncio.run(uc.mongo(caller, **args))


# ------------------------------------------------------------------- SQL

def test_the_model_reads_the_schema_and_the_answer_is_explained_before_it_is_shown(ai):
    uc, model, sql, _ = ai({"sql": "```sql\nSELECT * FROM `orders` WHERE `status` = 'paid' LIMIT 100;\n```",
                            "explanation": "Lấy đơn đã trả."})
    out = _sql(uc)
    prompt = model.calls[0]["contents"][0]["parts"][0]["text"]
    assert "`orders`: `id` int PK, `customer_id` int → `customers`.`id`" in prompt
    assert "`status` enum('new','paid') NOT NULL /* trạng thái */" in prompt
    assert "`customers` /* khách hàng */" in prompt and "auto_increment" in prompt and "UNIQUE" in prompt
    assert "MySQL 8.0.36" in model.calls[0]["system"]
    assert model.calls[0]["config"]["responseSchema"] == ai_query_usecase.SQL_SCHEMA
    assert out["sql"] == "SELECT * FROM `orders` WHERE `status` = 'paid' LIMIT 100;"       # fences gone
    assert out["statements"] == [{"sql": "SELECT * FROM `orders` WHERE `status` = 'paid' LIMIT 100",
                                  "readOnly": True, "checked": True, "error": None}]
    assert out["readOnly"] is True and out["repaired"] is False and out["tables"] == 2 and out["cached"] is False
    assert sql.explained == ["SELECT * FROM `orders` WHERE `status` = 'paid' LIMIT 100"]


def test_the_same_question_again_is_cached_but_explained_again(ai):
    uc, model, sql, _ = ai({"sql": "SELECT 1 FROM `orders`", "explanation": ""})
    _sql(uc)
    out = _sql(uc)
    assert out["cached"] is True and len(model.calls) == 1 and len(sql.explained) == 2


def test_a_statement_mysql_rejects_goes_back_to_the_model_once(ai):
    bad = {"sql": "SELECT `total` FROM `orders`", "explanation": "sai cột"}
    good = {"sql": "SELECT `id` FROM `orders`", "explanation": "đúng"}
    uc, model, sql, _ = ai(bad, good, errors={"`total`": "Unknown column 'total' in 'field list'"})
    out = _sql(uc)
    fix = model.calls[1]["contents"][0]["parts"][0]["text"]
    assert "Unknown column 'total'" in fix and "SELECT `total` FROM `orders`" in fix
    assert out["sql"] == "SELECT `id` FROM `orders`" and out["repaired"] is True
    assert out["statements"][0]["checked"] is True and len(model.calls) == 2


def test_when_the_repair_is_over_a_limit_the_first_try_is_shown_with_its_error(ai):
    bad = {"sql": "SELECT `total` FROM `orders`", "explanation": "sai cột"}
    uc, model, _, _ = ai(bad, errors={"`total`": "Unknown column"}, store=FakeStore(max_requests=1))
    out = _sql(uc)
    assert out["repaired"] is False and out["statements"][0] == {
        "sql": "SELECT `total` FROM `orders`", "readOnly": True, "checked": False, "error": "Unknown column"}
    assert len(model.calls) == 1


def test_writes_are_marked_and_checking_stops_at_ddl(ai):
    uc, _, sql, _ = ai({"sql": "UPDATE `orders` SET `status`='paid' WHERE `id`=1; CREATE TABLE `t` (`a` int); "
                               "INSERT INTO `t` VALUES (1); SELECT * FROM `t`", "explanation": ""})
    out = _sql(uc, question="đánh dấu đơn 1 đã trả rồi tạo bảng t")
    assert [(s["readOnly"], s["checked"]) for s in out["statements"]] == [
        (False, True), (False, None), (False, None), (True, None)]
    assert out["readOnly"] is False and sql.explained == ["UPDATE `orders` SET `status`='paid' WHERE `id`=1"]


def test_a_refused_caller_costs_no_database_query(ai):
    uc, model, sql, _ = ai({"sql": "SELECT 1", "explanation": ""})
    with pytest.raises(AppException) as exc:
        _sql(uc, caller=GUEST)
    assert exc.value.status_code == 403 and model.calls == [] and sql.explained == []


def test_a_question_is_required_and_an_answer_without_sql_is_refused(ai):
    uc, _, _, _ = ai({"explanation": "không có sql"})
    with pytest.raises(BadRequestError):
        _sql(uc, question="   ")
    with pytest.raises(BadGatewayError):
        _sql(uc)


def test_the_editor_query_is_sent_for_a_revision(ai):
    uc, model, _, _ = ai({"sql": "SELECT 1", "explanation": ""})
    _sql(uc, question="chỉ lấy 10 dòng", current="SELECT * FROM `orders`")
    assert "SELECT * FROM `orders`" in model.calls[0]["contents"][0]["parts"][0]["text"]


# ----------------------------------------------------------------- Mongo

def test_the_model_reads_field_types_and_categories_never_unique_values(ai):
    uc, model, _, mongo = ai({"mode": "find", "filter": '{"status": "banned"}', "projection": "",
                              "sort": '{"createdAt": -1}', "limit": 20, "explanation": "Người bị khoá."})
    out = _mongo(uc)
    prompt = model.calls[0]["contents"][0]["parts"][0]["text"]
    assert "_id: objectId" in prompt and "createdAt: date" in prompt and "age: int | null" in prompt
    assert "address.city: string" in prompt and "tags: array" in prompt and "tags[]: string" in prompt
    assert "orders[].total: double" in prompt
    assert 'status: string — giá trị gặp: "active", "banned"' in prompt
    assert "a@x.vn" not in prompt                                     # every e-mail is different: not a category
    assert mongo.requests[0][3].limit == ai_query_usecase.SAMPLE and mongo.requests[0][3].with_count is False
    assert out["mode"] == "find" and out["filter"] == {"status": "banned"} and out["sort"] == {"createdAt": -1}
    assert out["projection"] is None and out["limit"] == 20 and out["writes"] is False and out["risky"] == []
    assert out["sampled"] == 3 and out["cached"] is False


def test_a_pipeline_that_writes_or_runs_javascript_is_flagged(ai):
    pipeline = [{"$match": {"$where": "this.age > 30"}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}},
                {"$out": "status_counts"}]
    uc, _, _, _ = ai({"mode": "aggregate", "pipeline": json.dumps(pipeline), "explanation": "Đếm theo trạng thái."})
    out = _mongo(uc, question="đếm theo trạng thái rồi lưu lại")
    assert out["pipeline"] == pipeline and out["writes"] is True and out["risky"] == ["$where"]


@pytest.mark.parametrize("answer", [
    {"mode": "find", "filter": "{status: banned}", "explanation": ""},                 # not JSON
    {"mode": "find", "filter": "[1, 2]", "explanation": ""},                           # not an object
    {"mode": "aggregate", "pipeline": '[{"$match": {}, "$limit": 5}]', "explanation": ""},  # two operators in a stage
    {"mode": "aggregate", "pipeline": "[]", "explanation": ""},
    {"mode": "find", "filter": "{}", "sort": '{"a": 2}', "explanation": ""},           # sort is 1 or -1
    {"mode": "delete", "explanation": ""},
])
def test_an_answer_that_does_not_decode_is_refused(ai, answer):
    uc, _, _, _ = ai(answer)
    with pytest.raises(BadGatewayError):
        _mongo(uc)


def test_an_empty_collection_still_gets_an_answer(ai):
    uc, model, _, _ = ai({"mode": "find", "filter": "", "explanation": "Tất cả."}, docs=[])
    out = _mongo(uc)
    assert "collection rỗng" in model.calls[0]["contents"][0]["parts"][0]["text"]
    assert out["filter"] == {} and out["fields"] == 0
