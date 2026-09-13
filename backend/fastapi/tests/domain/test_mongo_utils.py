"""Extended JSON round trips, namespace rules and connection-string handling."""

import datetime as dt
import math

import pytest

from src.domain.utils.mongo_json import (
    ExtendedJsonError,
    InvalidNamespaceError,
    bson_available,
    coerce_document,
    coerce_documents,
    coerce_pipeline,
    collect_field_names,
    flatten_for_csv,
    from_extended_json,
    is_reserved_database,
    is_update_operator_document,
    namespace,
    normalise_sort,
    to_extended_json,
    validate_collection_name,
    validate_database_name,
)
from src.domain.utils.mongo_uri import (
    InvalidConnectionStringError,
    build_uri,
    describe,
    parse_uri,
    redact_uri,
)

needs_bson = pytest.mark.skipif(not bson_available(), reason="pymongo/bson is not installed")


# ---------------------------------------------------------------------------
# namespaces
# ---------------------------------------------------------------------------
class TestNamespaces:
    def test_database_name_is_trimmed(self):
        assert validate_database_name("  shop  ") == "shop"

    @pytest.mark.parametrize("name", ["", "   ", "with space", "a/b", "a.b", "a$b", "a|b", "a?b", 'a"b'])
    def test_database_name_rejects_forbidden_characters(self, name):
        with pytest.raises(InvalidNamespaceError):
            validate_database_name(name)

    def test_database_name_rejects_over_long_names(self):
        with pytest.raises(InvalidNamespaceError):
            validate_database_name("d" * 64)

    def test_database_name_counts_bytes_not_characters(self):
        # 32 two-byte characters fit; 32 four-byte emoji do not.
        validate_database_name("é" * 31)
        with pytest.raises(InvalidNamespaceError):
            validate_database_name("😀" * 16)

    def test_collection_name_allows_dots(self):
        assert validate_collection_name("orders.2026") == "orders.2026"

    @pytest.mark.parametrize("name", ["", "a$b", ".hidden"])
    def test_collection_name_rejects_invalid(self, name):
        with pytest.raises(InvalidNamespaceError):
            validate_collection_name(name)

    def test_system_collections_need_an_opt_in(self):
        with pytest.raises(InvalidNamespaceError):
            validate_collection_name("system.views")
        assert validate_collection_name("system.views", allow_system=True) == "system.views"

    def test_namespace_joins_both_halves(self):
        assert namespace("shop", "orders") == "shop.orders"

    @pytest.mark.parametrize("name,expected", [("admin", True), ("Local", True), ("config", True), ("shop", False)])
    def test_reserved_databases(self, name, expected):
        assert is_reserved_database(name) is expected


# ---------------------------------------------------------------------------
# Extended JSON encoding
# ---------------------------------------------------------------------------
class TestEncoding:
    def test_plain_values_pass_through(self):
        assert to_extended_json({"a": 1, "b": "x", "c": True, "d": None}) == {
            "a": 1, "b": "x", "c": True, "d": None,
        }

    def test_datetime_becomes_a_date_wrapper(self):
        moment = dt.datetime(2026, 9, 13, 10, 30, tzinfo=dt.timezone.utc)
        assert to_extended_json(moment) == {"$date": "2026-09-13T10:30:00Z"}

    def test_naive_datetime_is_treated_as_utc(self):
        assert to_extended_json(dt.datetime(2026, 1, 1)) == {"$date": "2026-01-01T00:00:00Z"}

    def test_nan_and_infinity_are_spelled_out(self):
        assert to_extended_json(float("nan")) == {"$numberDouble": "NaN"}
        assert to_extended_json(float("inf")) == {"$numberDouble": "Infinity"}
        assert to_extended_json(float("-inf")) == {"$numberDouble": "-Infinity"}

    def test_bytes_become_base64(self):
        assert to_extended_json(b"hi") == {"$binary": {"base64": "aGk=", "subType": "00"}}

    def test_nested_structures_are_walked(self):
        moment = dt.datetime(2026, 9, 13, tzinfo=dt.timezone.utc)
        assert to_extended_json({"items": [{"at": moment}]}) == {
            "items": [{"at": {"$date": "2026-09-13T00:00:00Z"}}]
        }

    @needs_bson
    def test_object_id_becomes_an_oid_wrapper(self):
        from bson import ObjectId

        oid = ObjectId("507f1f77bcf86cd799439011")
        assert to_extended_json(oid) == {"$oid": "507f1f77bcf86cd799439011"}

    @needs_bson
    def test_int64_is_distinguished_from_int(self):
        from bson import Int64

        assert to_extended_json(Int64(5)) == {"$numberLong": "5"}
        assert to_extended_json(5) == 5

    @needs_bson
    def test_decimal128_and_extreme_keys(self):
        from bson import Decimal128, MaxKey, MinKey

        assert to_extended_json(Decimal128("1.50")) == {"$numberDecimal": "1.50"}
        assert to_extended_json(MinKey()) == {"$minKey": 1}
        assert to_extended_json(MaxKey()) == {"$maxKey": 1}


# ---------------------------------------------------------------------------
# Extended JSON decoding
# ---------------------------------------------------------------------------
class TestDecoding:
    def test_plain_values_pass_through(self):
        assert from_extended_json({"a": [1, "x", None]}) == {"a": [1, "x", None]}

    def test_date_wrapper_becomes_a_datetime(self):
        decoded = from_extended_json({"$date": "2026-09-13T10:30:00Z"})
        assert decoded == dt.datetime(2026, 9, 13, 10, 30, tzinfo=dt.timezone.utc)

    def test_date_accepts_epoch_milliseconds(self):
        assert from_extended_json({"$date": 0}) == dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)

    def test_invalid_date_is_reported(self):
        with pytest.raises(ExtendedJsonError):
            from_extended_json({"$date": "not-a-date"})

    def test_number_wrappers(self):
        assert from_extended_json({"$numberInt": "7"}) == 7
        assert from_extended_json({"$numberDouble": "1.5"}) == 1.5
        assert math.isnan(from_extended_json({"$numberDouble": "NaN"}))

    def test_operator_documents_are_not_mistaken_for_wrappers(self):
        # `$gt` is a query operator, not an Extended JSON type.
        assert from_extended_json({"age": {"$gt": 18}}) == {"age": {"$gt": 18}}

    def test_wrappers_nested_inside_operators_are_decoded(self):
        decoded = from_extended_json({"created": {"$gte": {"$date": "2026-01-01T00:00:00Z"}}})
        assert decoded["created"]["$gte"] == dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)

    @needs_bson
    def test_oid_round_trip(self):
        from bson import ObjectId

        decoded = from_extended_json({"_id": {"$oid": "507f1f77bcf86cd799439011"}})
        assert decoded["_id"] == ObjectId("507f1f77bcf86cd799439011")
        assert to_extended_json(decoded) == {"_id": {"$oid": "507f1f77bcf86cd799439011"}}

    @needs_bson
    def test_malformed_oid_is_reported(self):
        with pytest.raises(ExtendedJsonError):
            from_extended_json({"$oid": "nope"})

    def test_coerce_document_rejects_non_objects(self):
        with pytest.raises(ExtendedJsonError):
            coerce_document([1, 2], "filter")

    def test_coerce_document_defaults_to_empty(self):
        assert coerce_document(None) == {}

    def test_coerce_documents_accepts_one_or_many(self):
        assert coerce_documents({"a": 1}) == [{"a": 1}]
        assert coerce_documents([{"a": 1}, {"b": 2}]) == [{"a": 1}, {"b": 2}]

    @pytest.mark.parametrize("value", [[], "x", [{"a": 1}, 3]])
    def test_coerce_documents_rejects_the_rest(self, value):
        with pytest.raises(ExtendedJsonError):
            coerce_documents(value)

    def test_coerce_pipeline_requires_stage_objects(self):
        assert coerce_pipeline([{"$match": {}}]) == [{"$match": {}}]
        with pytest.raises(ExtendedJsonError):
            coerce_pipeline([{"$match": {}}, "oops"])


# ---------------------------------------------------------------------------
# sorts, updates and export helpers
# ---------------------------------------------------------------------------
class TestSortsAndUpdates:
    def test_sort_from_object(self):
        assert normalise_sort({"name": 1, "age": -1}) == [("name", 1), ("age", -1)]

    def test_sort_from_pairs(self):
        assert normalise_sort([["name", "1"]]) == [("name", 1)]

    def test_empty_sorts_are_dropped(self):
        assert normalise_sort(None) == []
        assert normalise_sort({}) == []

    @pytest.mark.parametrize("value", [{"name": 2}, {"": 1}, "name", [["a", 1, 2]]])
    def test_invalid_sorts_are_rejected(self, value):
        with pytest.raises(ExtendedJsonError):
            normalise_sort(value)

    def test_operator_update_is_detected(self):
        assert is_update_operator_document({"$set": {"a": 1}}) is True
        assert is_update_operator_document({"a": 1}) is False
        assert is_update_operator_document({}) is False

    def test_mixing_operators_and_fields_is_rejected(self):
        with pytest.raises(ExtendedJsonError):
            is_update_operator_document({"$set": {"a": 1}, "b": 2})


class TestExportHelpers:
    def test_id_leads_the_field_list(self):
        fields = collect_field_names([{"name": "a", "_id": 1}, {"age": 2}])
        assert fields == ["_id", "name", "age"]

    def test_csv_cells_unwrap_scalars(self):
        assert flatten_for_csv({"$oid": "abc"}) == "abc"
        assert flatten_for_csv({"$date": "2026-01-01T00:00:00Z"}) == "2026-01-01T00:00:00Z"
        assert flatten_for_csv({"$numberLong": "9"}) == "9"
        assert flatten_for_csv(None) == ""
        assert flatten_for_csv(True) == "true"

    def test_csv_cells_serialise_anything_else(self):
        assert flatten_for_csv({"a": [1, 2]}) == '{"a":[1,2]}'


# ---------------------------------------------------------------------------
# connection strings
# ---------------------------------------------------------------------------
class TestConnectionStrings:
    def test_build_the_simplest_uri(self):
        assert build_uri("localhost", 27017) == "mongodb://localhost:27017/"

    def test_credentials_are_percent_encoded(self):
        uri = build_uri("db.local", 27017, username="ad min", password="p@ss:word/!")
        assert "ad%20min:p%40ss%3Aword%2F%21@db.local:27017" in uri

    def test_auth_source_defaults_to_admin_when_a_user_is_given(self):
        assert "authSource=admin" in build_uri("h", 27017, username="root", password="x")

    def test_auth_source_defaults_to_the_chosen_database(self):
        uri = build_uri("h", 27017, username="root", password="x", database="shop")
        assert "authSource=shop" in uri

    def test_no_auth_source_without_a_user(self):
        assert "authSource" not in build_uri("h", 27017)

    def test_srv_uris_carry_no_port(self):
        uri = build_uri("cluster.example.net", 27017, username="u", password="p", srv=True)
        assert uri.startswith("mongodb+srv://u:p@cluster.example.net/")
        assert ":27017" not in uri

    def test_tls_and_replica_set_become_options(self):
        uri = build_uri("h", 27017, tls=True, replica_set="rs0", direct_connection=True)
        assert "tls=true" in uri and "replicaSet=rs0" in uri and "directConnection=true" in uri

    def test_a_seed_list_keeps_its_own_ports(self):
        assert build_uri("a:27017,b:27018", None).startswith("mongodb://a:27017,b:27018/")

    def test_a_full_uri_is_not_a_hostname(self):
        with pytest.raises(InvalidConnectionStringError):
            build_uri("mongodb://localhost:27017")

    def test_out_of_range_ports_are_rejected(self):
        with pytest.raises(InvalidConnectionStringError):
            build_uri("h", 70000)

    def test_parse_splits_every_part(self):
        parts = parse_uri("mongodb://root:secret@db.local:27018/shop?authSource=admin&tls=true")
        assert parts["host"] == "db.local"
        assert parts["port"] == 27018
        assert parts["username"] == "root"
        assert parts["password"] == "secret"
        assert parts["database"] == "shop"
        assert parts["auth_source"] == "admin"
        assert parts["tls"] is True
        assert parts["srv"] is False

    def test_parse_decodes_percent_escapes(self):
        parts = parse_uri("mongodb://ad%20min:p%40ss@h:27017/")
        assert parts["username"] == "ad min"
        assert parts["password"] == "p@ss"

    def test_a_password_may_contain_an_at_sign_once_encoded(self):
        # rpartition on '@' is what makes this work; a naive split would not.
        parts = parse_uri("mongodb://u:a%40b@h:27017/")
        assert parts["host"] == "h"
        assert parts["password"] == "a@b"

    def test_srv_implies_tls(self):
        parts = parse_uri("mongodb+srv://u:p@cluster.example.net/shop")
        assert parts["srv"] is True and parts["tls"] is True and parts["port"] is None

    def test_srv_with_a_port_is_rejected(self):
        with pytest.raises(InvalidConnectionStringError):
            parse_uri("mongodb+srv://cluster.example.net:27017/")

    def test_a_seed_list_is_parsed(self):
        parts = parse_uri("mongodb://a:27017,b:27018/?replicaSet=rs0")
        assert parts["hosts"] == [("a", 27017), ("b", 27018)]
        assert parts["replica_set"] == "rs0"

    def test_ipv6_literals_survive(self):
        parts = parse_uri("mongodb://[::1]:27017/")
        assert parts["host"] == "[::1]" and parts["port"] == 27017

    @pytest.mark.parametrize("uri", ["", "http://localhost", "mongodb://", "mongodb://h:abc/"])
    def test_unusable_strings_are_rejected(self, uri):
        with pytest.raises(InvalidConnectionStringError):
            parse_uri(uri)

    def test_round_trip_through_build_and_parse(self):
        uri = build_uri("h", 27017, username="root", password="p@ss", database="shop", tls=True)
        parts = parse_uri(uri)
        assert (parts["username"], parts["password"], parts["database"]) == ("root", "p@ss", "shop")

    def test_redaction_hides_the_password(self):
        assert redact_uri("mongodb://root:secret@h:27017/") == "mongodb://root:***@h:27017/"

    def test_redaction_leaves_anonymous_uris_alone(self):
        assert redact_uri("mongodb://h:27017/") == "mongodb://h:27017/"

    def test_describe_builds_a_short_label(self):
        assert describe("mongodb://root:secret@h:27017/") == "root@h:27017"
        assert describe("mongodb://h:27017/") == "h:27017"
