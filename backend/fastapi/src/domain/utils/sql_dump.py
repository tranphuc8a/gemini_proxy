"""Writing and reading back a SQL dump.

`mysqldump` is the obvious tool for this and is not available: the deployment
runs a Python process with no mysql client binary, and on a serverless platform
there is nowhere to install one. So the dump is produced from queries the server
already answers — `SHOW CREATE TABLE`, `SHOW CREATE VIEW`, `SHOW CREATE
PROCEDURE` and plain `SELECT` — and this module holds the two pieces of that
which are worth testing on their own: turning a row into a `VALUES` tuple, and
splitting a dump back into statements.

The splitting is the subtle half. A console script can be split on every
semicolon that sits outside a string, which is what `sql_script.split_statements`
does. A dump cannot: a stored procedure is *one* statement whose body is full of
semicolons, and `DELIMITER $$` is the client instruction that says so. Handling
`DELIMITER` here is what makes a dump containing routines restorable at all —
and, because the mysql CLI understands the same instruction, keeps the dump
usable outside this tool.
"""

from __future__ import annotations

import datetime as _dt
import decimal
import re
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

from src.domain.utils.sql_identifier import quote_string_literal
from src.domain.utils.sql_script import split_statements


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


#: The routine name in `CREATE [DEFINER=...] FUNCTION|PROCEDURE <name>(`.
#: Matches the whole (possibly schema-qualified) name, not just its first part:
#: `db`.`fn` has to be read as one name so the schema can be dropped from it,
#: rather than as the name `db`.
_ROUTINE_NAME_PATTERN = re.compile(
    r"CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?(?:FUNCTION|PROCEDURE)\s+"
    r"(?P<name>(?:`[^`]+`|[A-Za-z0-9_$]+)(?:\s*\.\s*(?:`[^`]+`|[A-Za-z0-9_$]+))?)",
    re.IGNORECASE,
)


def routine_name(statement: str) -> str | None:
    """The name a CREATE ROUTINE statement declares, so it can be dropped first.

    Returns the last path segment: ``db`.`fn`` and plain `fn` both name `fn`,
    because the schema is settled by the `USE` that precedes the create.
    """
    match = _ROUTINE_NAME_PATTERN.search(statement or "")
    if not match:
        return None
    # Split on the dot that separates schema from routine, then unquote. The
    # split has to come first: a quoted name may itself contain a dot.
    parts = re.findall(r"`[^`]+`|[A-Za-z0-9_$]+", match.group("name"))
    return parts[-1].strip("`") if parts else None


def render_values(row: Sequence[Any]) -> str:
    """One `VALUES (...)` tuple.

    Values cannot be bound here — the output is text, not a prepared statement —
    so everything that is not a number goes through `quote_string_literal`.
    Bytes become a hex literal because a BLOB has no valid UTF-8 spelling, and a
    dump that mangled one would restore corrupt data rather than fail.
    """
    rendered: list[str] = []
    for value in row:
        if value is None:
            rendered.append("NULL")
        elif isinstance(value, bool):
            rendered.append("1" if value else "0")
        elif isinstance(value, (int, float, decimal.Decimal)):
            rendered.append(str(value))
        elif isinstance(value, (bytes, bytearray)):
            rendered.append("0x" + bytes(value).hex() if value else "''")
        elif isinstance(value, _dt.datetime):
            # `sep` exists on datetime only; date.isoformat takes no arguments.
            rendered.append(quote_string_literal(value.isoformat(sep=" ")))
        elif isinstance(value, (_dt.date, _dt.time)):
            rendered.append(quote_string_literal(value.isoformat()))
        elif isinstance(value, _dt.timedelta):
            # MySQL TIME comes back as a timedelta; `str` renders it as HH:MM:SS.
            rendered.append(quote_string_literal(str(value)))
        else:
            rendered.append(quote_string_literal(str(value)))
    return ", ".join(rendered)


def strip_comments(statement: str) -> str:
    """Drop `--` comment lines. A chunk that is nothing else becomes empty."""
    kept = [line for line in statement.splitlines() if not line.strip().startswith("--")]
    return "\n".join(kept).strip()


def split_dump(content: str) -> list[str]:
    """Split a dump into executable statements, honouring `DELIMITER`.

    Within the default delimiter the text is handed to `split_statements`, which
    knows about strings and comments. Within a custom delimiter each chunk is
    taken whole — that is the entire reason the instruction exists.
    """
    statements: list[str] = []
    buffer: list[str] = []
    delimiter = ";"

    def flush_default(text: str) -> None:
        for piece in split_statements(text):
            cleaned = strip_comments(piece)
            if cleaned:
                statements.append(cleaned)

    for line in (content or "").splitlines():
        stripped = line.strip()

        if stripped.upper().startswith("DELIMITER "):
            # A delimiter change closes whatever was being accumulated.
            pending = "\n".join(buffer).strip()
            if pending:
                if delimiter == ";":
                    flush_default(pending)
                else:
                    cleaned = strip_comments(pending)
                    if cleaned:
                        statements.append(cleaned)
            buffer = []
            delimiter = stripped.split(None, 1)[1].strip() or ";"
            continue

        buffer.append(line)
        if not stripped.endswith(delimiter):
            continue

        joined = "\n".join(buffer).rstrip()
        joined = joined[: -len(delimiter)] if delimiter else joined
        buffer = []

        if delimiter == ";":
            flush_default(joined)
        else:
            cleaned = strip_comments(joined)
            if cleaned:
                statements.append(cleaned)

    trailing = "\n".join(buffer).strip()
    if trailing:
        flush_default(trailing)
    return statements


def insert_statement(target: str, columns: Iterable[str], row: Sequence[Any], quote) -> str:
    """`INSERT INTO t (a, b) VALUES (...)` for one row.

    One row per statement rather than a multi-row insert: a restore reports
    per-statement errors, and a thousand-row insert that fails tells the user
    nothing about which row was the problem.
    """
    columns_sql = ", ".join(quote(name, "column") for name in columns)
    return f"INSERT INTO {target} ({columns_sql}) VALUES ({render_values(row)});"
