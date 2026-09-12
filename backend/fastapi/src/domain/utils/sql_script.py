"""Split a multi-statement SQL script and normalise driver values for JSON.

aiomysql executes one statement per round trip, so the console endpoint splits
the script itself rather than enabling CLIENT.MULTI_STATEMENTS. Doing the split
here also lets us report per-statement timings back to the UI.
"""

from __future__ import annotations

import base64
import datetime as _dt
import decimal
from typing import Any, Iterator

_QUOTES = {"'", '"', "`"}


def split_statements(script: str) -> list[str]:
    """Split `script` on semicolons that sit outside strings, comments and identifiers."""
    if not script:
        return []

    statements: list[str] = []
    buffer: list[str] = []
    quote: str | None = None
    index = 0
    length = len(script)

    while index < length:
        char = script[index]
        nxt = script[index + 1] if index + 1 < length else ""

        if quote:
            buffer.append(char)
            if char == "\\" and quote in {"'", '"'}:
                # Backslash escapes the next character inside a MySQL string.
                if nxt:
                    buffer.append(nxt)
                    index += 2
                    continue
            elif char == quote:
                # A doubled quote is an escaped quote, not the end of the literal.
                if nxt == quote:
                    buffer.append(nxt)
                    index += 2
                    continue
                quote = None
            index += 1
            continue

        if char == "-" and nxt == "-" and (index + 2 >= length or script[index + 2] in " \t\r\n"):
            index = _skip_to_eol(script, index)
            continue
        if char == "#":
            index = _skip_to_eol(script, index)
            continue
        if char == "/" and nxt == "*":
            end = script.find("*/", index + 2)
            index = length if end == -1 else end + 2
            continue
        if char in _QUOTES:
            quote = char
            buffer.append(char)
            index += 1
            continue
        if char == ";":
            statements.append("".join(buffer))
            buffer = []
            index += 1
            continue

        buffer.append(char)
        index += 1

    statements.append("".join(buffer))
    return [stmt.strip() for stmt in statements if stmt.strip()]


def _skip_to_eol(script: str, index: int) -> int:
    end = script.find("\n", index)
    return len(script) if end == -1 else end + 1


_READ_ONLY_PREFIXES = (
    "select", "show", "describe", "desc", "explain", "with", "analyze", "check", "help",
)


def statement_kind(statement: str) -> str:
    """Classify a statement as 'read' or 'write' so the UI can pick a result view."""
    token = _first_keyword(statement)
    return "read" if token in _READ_ONLY_PREFIXES else "write"


def _first_keyword(statement: str) -> str:
    for word in _iter_words(statement):
        return word.lower()
    return ""


def _iter_words(statement: str) -> Iterator[str]:
    current: list[str] = []
    for char in statement.strip():
        if char.isalpha() or char == "_":
            current.append(char)
        elif current:
            yield "".join(current)
            current = []
    if current:
        yield "".join(current)


def jsonify(value: Any) -> Any:
    """Convert a driver value into something JSONResponse can encode."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        raw = bytes(value)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return {"__binary__": base64.b64encode(raw).decode("ascii"), "size": len(raw)}
    if isinstance(value, _dt.datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, (_dt.date, _dt.time)):
        return value.isoformat()
    if isinstance(value, _dt.timedelta):
        return str(value)
    if isinstance(value, set):
        return sorted(str(item) for item in value)
    if isinstance(value, (list, tuple)):
        return [jsonify(item) for item in value]
    if isinstance(value, dict):
        return {str(key): jsonify(item) for key, item in value.items()}
    return str(value)
