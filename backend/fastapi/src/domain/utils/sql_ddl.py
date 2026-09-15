"""Rendering DDL fragments from validated parts.

Values can be bound as parameters; the pieces of a `CREATE TABLE` cannot — a
column name, a type, a referential action and a storage engine are all syntax,
not data. So each one is checked against what MySQL will accept *before* it is
put into a statement, and anything that does not fit is refused rather than
escaped and hoped for.

Identifiers go through `sql_identifier.quote_identifier`. The two things that
cannot be handled that way are types (`VARCHAR(20)`, `ENUM('a','b')`,
`DECIMAL(10,2) UNSIGNED`) and defaults, and they get the two validators below.
"""

from __future__ import annotations

import re

from src.domain.utils.sql_identifier import (
    InvalidIdentifierError,
    quote_identifier,
    quote_string_literal,
)

#: A column type: a word, optionally a parenthesised argument list, optionally
#: trailing attribute words. The argument list deliberately allows quoted
#: strings so `ENUM`/`SET` work, but not a semicolon, backtick or comment
#: opener -- the three ways a type could otherwise become a second statement.
_TYPE_PATTERN = re.compile(
    r"^[A-Za-z][A-Za-z0-9_]{0,30}"           # VARCHAR, INT, DECIMAL …
    r"(\s*\(\s*[^();`\\]{0,400}\s*\))?"      # (20)  (10,2)  ('a','b')
    r"(\s+(UNSIGNED|ZEROFILL|BINARY|CHARACTER\s+SET\s+[A-Za-z0-9_]{1,64}"
    r"|COLLATE\s+[A-Za-z0-9_]{1,64}))*\s*$",
    re.IGNORECASE,
)

#: Attributes allowed after the type in a column clause.
_EXTRA_PATTERN = re.compile(
    r"^(AUTO_INCREMENT|ON\s+UPDATE\s+CURRENT_TIMESTAMP(\(\d?\))?|UNSIGNED|ZEROFILL"
    r"|CHARACTER\s+SET\s+[A-Za-z0-9_]{1,64}|COLLATE\s+[A-Za-z0-9_]{1,64}|\s)+$",
    re.IGNORECASE,
)

#: Defaults that are keywords rather than literals, so must not be quoted.
_BARE_DEFAULTS = {
    "NULL", "CURRENT_TIMESTAMP", "CURRENT_TIMESTAMP()", "CURRENT_TIMESTAMP(3)",
    "CURRENT_TIMESTAMP(6)", "NOW()", "CURRENT_DATE", "CURRENT_TIME", "UUID()",
    "TRUE", "FALSE",
}

_REFERENTIAL_ACTIONS = {"CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"}

_ENGINES = {"INNODB", "MYISAM", "MEMORY", "CSV", "ARCHIVE", "BLACKHOLE", "NDB"}

_CHECK_OPTIONS = {"CASCADED", "LOCAL"}


def validate_column_type(raw: str) -> str:
    value = (raw or "").strip()
    if not _TYPE_PATTERN.match(value):
        raise InvalidIdentifierError(
            f"Kiểu cột không hợp lệ: {raw!r}. Ví dụ hợp lệ: INT, VARCHAR(255), "
            "DECIMAL(10,2) UNSIGNED, ENUM('a','b')"
        )
    return value


def render_default(raw: str | None) -> str | None:
    """`None` means "no DEFAULT clause"; the string "NULL" means DEFAULT NULL."""
    if raw is None:
        return None
    value = str(raw).strip()
    if value == "":
        return None
    if value.upper() in _BARE_DEFAULTS:
        return value.upper()
    # A number stays a number: quoting it would change the column's behaviour
    # for numeric types under a strict sql_mode.
    try:
        float(value)
        return value
    except ValueError:
        return quote_string_literal(value)


def validate_extra(raw: str | None) -> str:
    if not raw:
        return ""
    value = str(raw).strip()
    if not _EXTRA_PATTERN.match(value):
        raise InvalidIdentifierError(f"Thuộc tính cột không hợp lệ: {raw!r}")
    return value


def render_column(column, *, with_position: bool = False) -> str:
    """One column clause, as it appears in CREATE TABLE and ALTER TABLE."""
    parts = [quote_identifier(column.name, "column"), validate_column_type(column.data_type)]
    parts.append("NULL" if column.nullable else "NOT NULL")

    default = render_default(column.default)
    if default is not None:
        parts.append(f"DEFAULT {default}")

    extra = validate_extra(column.extra)
    if extra:
        parts.append(extra)

    if column.comment:
        parts.append(f"COMMENT {quote_string_literal(column.comment)}")

    if with_position and column.after is not None:
        # "" is a deliberate signal for FIRST -- there is no column to be after.
        parts.append("FIRST" if column.after == "" else f"AFTER {quote_identifier(column.after, 'column')}")

    return " ".join(parts)


def referential_action(raw: str | None) -> str | None:
    if not raw:
        return None
    value = " ".join(str(raw).upper().split())
    if value not in _REFERENTIAL_ACTIONS:
        raise InvalidIdentifierError(
            f"Hành động khoá ngoại không hợp lệ: {raw!r}. Chọn một trong: {', '.join(sorted(_REFERENTIAL_ACTIONS))}"
        )
    return value


def validate_engine(raw: str | None) -> str | None:
    if not raw:
        return None
    value = str(raw).strip()
    if value.upper() not in _ENGINES:
        raise InvalidIdentifierError(f"Storage engine không hợp lệ: {raw!r}")
    return value.upper()


def validate_charset(raw: str | None) -> str | None:
    if not raw:
        return None
    value = str(raw).strip()
    if not re.fullmatch(r"[A-Za-z0-9_]{1,64}", value):
        raise InvalidIdentifierError(f"Charset không hợp lệ: {raw!r}")
    return value


def validate_check_option(raw: str | None) -> str | None:
    if not raw:
        return None
    value = str(raw).strip().upper()
    if value not in _CHECK_OPTIONS:
        raise InvalidIdentifierError("CHECK OPTION phải là CASCADED hoặc LOCAL")
    return value


def column_list(names, kind: str = "column") -> str:
    if not names:
        raise InvalidIdentifierError(f"Cần ít nhất một {kind}")
    return ", ".join(quote_identifier(name, kind) for name in names)


#: A routine body is one statement that happens to contain semicolons, so the
#: script splitter must not be used on it. What *can* be checked is that it is
#: the kind of statement it claims to be.
_ROUTINE_PATTERN = re.compile(
    r"^\s*CREATE\s+(DEFINER\s*=\s*\S+\s+)?(FUNCTION|PROCEDURE)\s+", re.IGNORECASE
)


def routine_kind(statement: str) -> str:
    """FUNCTION or PROCEDURE, or a refusal.

    Checked rather than trusted because the endpoint that takes this is the one
    place a caller hands over raw SQL to be run as DDL, and "create a routine"
    should not be a way to run `DROP DATABASE`.
    """
    match = _ROUTINE_PATTERN.match(statement or "")
    if not match:
        raise InvalidIdentifierError(
            "Câu lệnh phải bắt đầu bằng CREATE FUNCTION hoặc CREATE PROCEDURE"
        )
    return match.group(2).upper()
