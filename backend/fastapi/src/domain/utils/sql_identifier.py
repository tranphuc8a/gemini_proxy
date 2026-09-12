"""Helpers for safely embedding MySQL identifiers into generated SQL.

Values are always bound as parameters; identifiers (schema/table/column names)
cannot be bound, so they must be validated and quoted here instead.
"""

from __future__ import annotations

MAX_IDENTIFIER_LENGTH = 64

# Characters MySQL itself refuses inside a quoted identifier.
_FORBIDDEN = {"\x00"}


class InvalidIdentifierError(ValueError):
    """Raised when a caller supplies something that cannot be a MySQL identifier."""


def validate_identifier(name: str, kind: str = "identifier") -> str:
    if name is None or not isinstance(name, str):
        raise InvalidIdentifierError(f"{kind} must be a string")
    stripped = name.strip()
    if not stripped:
        raise InvalidIdentifierError(f"{kind} must not be empty")
    if len(stripped) > MAX_IDENTIFIER_LENGTH:
        raise InvalidIdentifierError(f"{kind} exceeds {MAX_IDENTIFIER_LENGTH} characters")
    if any(ch in stripped for ch in _FORBIDDEN):
        raise InvalidIdentifierError(f"{kind} contains forbidden characters")
    return stripped


def quote_identifier(name: str, kind: str = "identifier") -> str:
    """Return `name` as a backtick-quoted MySQL identifier."""
    validated = validate_identifier(name, kind)
    escaped = validated.replace("`", "``")
    return f"`{escaped}`"


def qualified_name(database: str, table: str) -> str:
    return f"{quote_identifier(database, 'database')}.{quote_identifier(table, 'table')}"


# Escapes MySQL recognises inside a single-quoted string literal.
_LITERAL_ESCAPES = {
    "\\": "\\\\",
    "'": "\\'",
    "\x00": "\\0",
    "\n": "\\n",
    "\r": "\\r",
    "\x1a": "\\Z",
}


def quote_string_literal(value: str) -> str:
    """Quote a string literal for SQL dumps (exports), where binding is impossible."""
    escaped = "".join(_LITERAL_ESCAPES.get(ch, ch) for ch in str(value))
    return f"'{escaped}'"


_SORT_DIRECTIONS = {"asc": "ASC", "desc": "DESC"}


def sort_direction(direction: str | None) -> str:
    if not direction:
        return "ASC"
    normalised = _SORT_DIRECTIONS.get(str(direction).strip().lower())
    if normalised is None:
        raise InvalidIdentifierError("sort direction must be 'asc' or 'desc'")
    return normalised
