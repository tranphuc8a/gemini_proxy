"""The two places DDL is assembled from untrusted parts, and the dump splitter.

Identifiers are quoted by `sql_identifier`; what this file covers is everything
that *cannot* be quoted — a column type, a default, a referential action — plus
the dump reader, whose whole reason to exist is that a stored routine is one
statement full of semicolons.
"""

import datetime
import decimal

import pytest

from src.domain.utils.sql_ddl import (
    column_list,
    referential_action,
    render_column,
    render_default,
    routine_kind,
    validate_charset,
    validate_check_option,
    validate_column_type,
    validate_engine,
    validate_extra,
)
from src.domain.utils.sql_dump import render_values, routine_name, split_dump, strip_comments
from src.domain.utils.sql_identifier import InvalidIdentifierError
from src.domain.vo.sqladmin_vo import ColumnDefinition


# --------------------------------------------------------------- column types

@pytest.mark.parametrize(
    "value",
    [
        "INT",
        "BIGINT UNSIGNED",
        "VARCHAR(255)",
        "DECIMAL(10,2)",
        "DECIMAL(10, 2) UNSIGNED",
        "ENUM('a','b','c')",
        "SET('x','y')",
        "TIMESTAMP",
        "JSON",
        "VARCHAR(50) CHARACTER SET utf8mb4",
        "TEXT COLLATE utf8mb4_bin",
    ],
)
def test_real_types_are_accepted(value):
    assert validate_column_type(value) == value.strip()


@pytest.mark.parametrize(
    "value",
    [
        "INT; DROP TABLE users",
        "INT) , x INT, PRIMARY KEY (id",
        "VARCHAR(20) -- comment",
        "VARCHAR(20) /* comment */",
        "`INT`",
        "INT\\",
        "",
        "   ",
        "1NT",
    ],
)
def test_a_type_that_could_become_a_second_statement_is_refused(value):
    with pytest.raises(InvalidIdentifierError):
        validate_column_type(value)


# ------------------------------------------------------------------ defaults

def test_keyword_defaults_are_not_quoted():
    # Quoting CURRENT_TIMESTAMP would store the *text*, which is a different
    # column entirely.
    assert render_default("CURRENT_TIMESTAMP") == "CURRENT_TIMESTAMP"
    assert render_default("null") == "NULL"


def test_numeric_defaults_stay_numeric():
    assert render_default("0") == "0"
    assert render_default("-1.5") == "-1.5"


def test_text_defaults_are_quoted_and_escaped():
    assert render_default("hello") == "'hello'"
    assert render_default("it's") == "'it\\'s'"


def test_no_default_means_no_clause():
    assert render_default(None) is None
    assert render_default("") is None


# --------------------------------------------------------------------- extra

def test_known_attributes_pass():
    assert validate_extra("AUTO_INCREMENT") == "AUTO_INCREMENT"
    assert validate_extra("ON UPDATE CURRENT_TIMESTAMP") == "ON UPDATE CURRENT_TIMESTAMP"


def test_an_arbitrary_attribute_is_refused():
    with pytest.raises(InvalidIdentifierError):
        validate_extra("AUTO_INCREMENT, ADD COLUMN evil INT")


# ---------------------------------------------------------------- whole column

def test_a_column_renders_in_the_order_mysql_expects():
    column = ColumnDefinition(
        name="created_at", data_type="TIMESTAMP", nullable=False,
        default="CURRENT_TIMESTAMP", extra="ON UPDATE CURRENT_TIMESTAMP", comment="when",
    )
    assert render_column(column) == (
        "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP "
        "ON UPDATE CURRENT_TIMESTAMP COMMENT 'when'"
    )


def test_an_empty_after_means_first():
    """`after=""` is the only way to say FIRST: there is no column to be after."""
    column = ColumnDefinition(name="id", data_type="INT", after="")
    assert render_column(column, with_position=True).endswith(" FIRST")


def test_after_names_a_column():
    column = ColumnDefinition(name="b", data_type="INT", after="a")
    assert render_column(column, with_position=True).endswith("AFTER `a`")


def test_a_backtick_in_a_column_name_cannot_escape_the_quotes():
    column = ColumnDefinition(name="we`ird", data_type="INT")
    assert "`we``ird`" in render_column(column)


# ------------------------------------------------------------------- clauses

def test_referential_actions_are_an_allow_list():
    assert referential_action("cascade") == "CASCADE"
    assert referential_action("set null") == "SET NULL"
    assert referential_action(None) is None
    with pytest.raises(InvalidIdentifierError):
        referential_action("CASCADE; DROP TABLE t")


def test_engine_and_charset_are_allow_listed():
    assert validate_engine("innodb") == "INNODB"
    assert validate_charset("utf8mb4") == "utf8mb4"
    with pytest.raises(InvalidIdentifierError):
        validate_engine("InnoDB ROW_FORMAT=COMPRESSED")
    with pytest.raises(InvalidIdentifierError):
        validate_charset("utf8mb4' ")


def test_check_option_is_one_of_two_words():
    assert validate_check_option("local") == "LOCAL"
    with pytest.raises(InvalidIdentifierError):
        validate_check_option("ALWAYS")


def test_column_list_needs_at_least_one_column():
    assert column_list(["a", "b"]) == "`a`, `b`"
    with pytest.raises(InvalidIdentifierError):
        column_list([])


# ------------------------------------------------------------------ routines

def test_routine_kind_accepts_both_and_refuses_anything_else():
    assert routine_kind("CREATE PROCEDURE p() BEGIN END") == "PROCEDURE"
    assert routine_kind("CREATE FUNCTION f() RETURNS INT RETURN 1") == "FUNCTION"
    assert routine_kind("CREATE DEFINER=`root`@`%` FUNCTION f() RETURNS INT RETURN 1") == "FUNCTION"
    # This endpoint is the one that takes SQL verbatim; it must not become a
    # second console.
    with pytest.raises(InvalidIdentifierError):
        routine_kind("DROP DATABASE production")
    with pytest.raises(InvalidIdentifierError):
        routine_kind("SELECT 1")


def test_routine_name_is_found_in_every_spelling():
    assert routine_name("CREATE PROCEDURE do_it() BEGIN END") == "do_it"
    assert routine_name("CREATE PROCEDURE `do it`() BEGIN END") == "do it"
    assert routine_name("CREATE DEFINER=`root`@`%` FUNCTION `db`.`fn`() RETURNS INT RETURN 1") == "fn"
    assert routine_name("SELECT 1") is None


# --------------------------------------------------------------------- values

def test_values_render_by_type():
    row = [None, True, 7, decimal.Decimal("1.50"), "it's", b"\x00\xff"]
    assert render_values(row) == "NULL, 1, 7, 1.50, 'it\\'s', 0x00ff"


def test_dates_render_as_mysql_literals():
    row = [datetime.datetime(2026, 9, 15, 8, 30, 0), datetime.date(2026, 1, 2)]
    assert render_values(row) == "'2026-09-15 08:30:00', '2026-01-02'"


def test_a_time_column_comes_back_as_a_timedelta_and_still_renders():
    assert render_values([datetime.timedelta(hours=1, minutes=2)]) == "'1:02:00'"


# ----------------------------------------------------------------- splitting

def test_a_plain_dump_splits_on_semicolons():
    dump = "CREATE TABLE a (id INT);\nINSERT INTO a VALUES (1);\nINSERT INTO a VALUES (2);"
    assert len(split_dump(dump)) == 3


def test_comment_lines_are_dropped():
    dump = "-- a comment\nSELECT 1;\n-- another\n"
    assert split_dump(dump) == ["SELECT 1"]


def test_a_semicolon_inside_a_string_does_not_split():
    dump = "INSERT INTO a VALUES ('x; y');"
    assert split_dump(dump) == ["INSERT INTO a VALUES ('x; y')"]


def test_a_routine_body_survives_as_one_statement():
    """The whole reason DELIMITER exists: without honouring it, this procedure
    would be torn into four broken fragments."""
    dump = (
        "DROP PROCEDURE IF EXISTS p;\n"
        "DELIMITER $$\n"
        "CREATE PROCEDURE p()\n"
        "BEGIN\n"
        "  SELECT 1;\n"
        "  SELECT 2;\n"
        "END$$\n"
        "DELIMITER ;\n"
        "SELECT 3;"
    )
    statements = split_dump(dump)
    assert len(statements) == 3
    assert statements[0].startswith("DROP PROCEDURE")
    assert "SELECT 1;" in statements[1] and "SELECT 2;" in statements[1]
    assert statements[1].startswith("CREATE PROCEDURE")
    assert statements[2] == "SELECT 3"


def test_a_dump_with_no_trailing_semicolon_still_yields_its_last_statement():
    assert split_dump("SELECT 1;\nSELECT 2") == ["SELECT 1", "SELECT 2"]


def test_an_empty_dump_is_no_statements():
    assert split_dump("") == []
    assert split_dump("-- only comments\n") == []


def test_strip_comments_keeps_the_sql():
    assert strip_comments("-- note\nSELECT 1\n-- end") == "SELECT 1"
