import datetime
import decimal

import pytest

from src.domain.utils.sql_identifier import (
    InvalidIdentifierError,
    qualified_name,
    quote_identifier,
    quote_string_literal,
    sort_direction,
    validate_identifier,
)
from src.domain.utils.sql_script import jsonify, split_statements, statement_kind


class TestQuoteIdentifier:
    def test_wraps_in_backticks(self):
        assert quote_identifier("users") == "`users`"

    def test_doubles_embedded_backtick(self):
        assert quote_identifier("we`ird") == "`we``ird`"

    def test_neutralises_injection_attempt(self):
        quoted = quote_identifier("a` ; DROP TABLE t; -- ")
        assert quoted.startswith("`") and quoted.endswith("`")
        assert quoted.count("`") % 2 == 0

    @pytest.mark.parametrize("bad", ["", "   ", "x" * 65, "a\x00b", None, 7])
    def test_rejects_invalid_names(self, bad):
        with pytest.raises(InvalidIdentifierError):
            validate_identifier(bad)

    def test_qualified_name(self):
        assert qualified_name("shop", "order") == "`shop`.`order`"


class TestStringLiteral:
    def test_escapes_quote_and_backslash(self):
        assert quote_string_literal("O'Reilly") == "'O\\'Reilly'"
        assert quote_string_literal("a\\b") == "'a\\\\b'"

    def test_escapes_control_characters(self):
        assert quote_string_literal("a\nb\rc") == "'a\\nb\\rc'"
        assert quote_string_literal("\x00") == "'\\0'"
        assert quote_string_literal("\x1a") == "'\\Z'"


class TestSortDirection:
    def test_defaults_to_ascending(self):
        assert sort_direction(None) == "ASC"

    def test_normalises_case(self):
        assert sort_direction("DeSc") == "DESC"

    def test_rejects_anything_else(self):
        with pytest.raises(InvalidIdentifierError):
            sort_direction("asc; DROP TABLE t")


class TestSplitStatements:
    def test_splits_on_semicolons(self):
        assert split_statements("SELECT 1; SELECT 2") == ["SELECT 1", "SELECT 2"]

    def test_ignores_trailing_semicolon_and_blanks(self):
        assert split_statements("SELECT 1;;  ;") == ["SELECT 1"]

    def test_keeps_semicolons_inside_string_literals(self):
        assert split_statements("SELECT 'a;b'") == ["SELECT 'a;b'"]

    def test_keeps_semicolons_inside_identifiers(self):
        assert split_statements("SELECT `we;ird`") == ["SELECT `we;ird`"]

    def test_handles_escaped_quote_in_literal(self):
        assert split_statements("SELECT 'it\\'s'; SELECT 2") == ["SELECT 'it\\'s'", "SELECT 2"]

    def test_handles_doubled_quote_in_literal(self):
        assert split_statements("SELECT 'it''s; ok'") == ["SELECT 'it''s; ok'"]

    def test_strips_line_comments(self):
        assert split_statements("SELECT 1 -- a;b\n; SELECT 2") == ["SELECT 1", "SELECT 2"]

    def test_strips_hash_comments(self):
        assert split_statements("SELECT 1 # note;\n; SELECT 2") == ["SELECT 1", "SELECT 2"]

    def test_strips_block_comments(self):
        assert split_statements("SELECT /* a;b */ 1; SELECT 2") == ["SELECT  1", "SELECT 2"]

    def test_empty_script(self):
        assert split_statements("") == []
        assert split_statements("   \n -- only a comment\n") == []


class TestStatementKind:
    @pytest.mark.parametrize("sql", ["SELECT 1", "  select 1", "SHOW TABLES", "EXPLAIN SELECT 1", "WITH x AS () SELECT"])
    def test_read_statements(self, sql):
        assert statement_kind(sql) == "read"

    @pytest.mark.parametrize("sql", ["INSERT INTO t VALUES (1)", "update t set a=1", "DROP TABLE t", "CREATE DATABASE d"])
    def test_write_statements(self, sql):
        assert statement_kind(sql) == "write"


class TestJsonify:
    def test_passes_through_primitives(self):
        assert jsonify(None) is None
        assert jsonify(5) == 5
        assert jsonify("x") == "x"
        assert jsonify(True) is True

    def test_decimal_becomes_string(self):
        assert jsonify(decimal.Decimal("10.50")) == "10.50"

    def test_datetime_is_iso(self):
        assert jsonify(datetime.datetime(2026, 9, 12, 8, 30)) == "2026-09-12 08:30:00"
        assert jsonify(datetime.date(2026, 9, 12)) == "2026-09-12"

    def test_utf8_bytes_decode(self):
        assert jsonify("chào".encode("utf-8")) == "chào"

    def test_binary_bytes_are_base64_wrapped(self):
        out = jsonify(b"\xff\xfe\x00")
        assert out["__binary__"] and out["size"] == 3

    def test_nested_containers(self):
        assert jsonify({"a": [decimal.Decimal("1")]}) == {"a": ["1"]}
