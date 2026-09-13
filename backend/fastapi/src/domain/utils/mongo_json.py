"""MongoDB Extended JSON (v2) codec and namespace validation.

The browser speaks plain JSON, MongoDB speaks BSON. Everything crossing the
REST boundary is therefore Extended JSON: an ObjectId travels as
`{"$oid": "..."}`, a date as `{"$date": "..."}`. `to_extended_json` prepares a
driver document for `JSONResponse`; `from_extended_json` turns a filter or a
document typed in the UI back into BSON values.

`bson` is treated as optional so this module (and its tests) stay importable
without the driver: without it the encoder degrades to strings and the decoder
handles only the types plain Python can represent.
"""

from __future__ import annotations

import base64
import datetime as _dt
import json as _json
import math
import re
from typing import Any

try:  # pragma: no cover - whichever branch is installed is the one exercised
    from bson import (
        Binary,
        Code,
        DBRef,
        Decimal128,
        Int64,
        MaxKey,
        MinKey,
        ObjectId,
        Regex,
        Timestamp,
    )

    _BSON_AVAILABLE = True
except Exception:  # pragma: no cover
    Binary = Code = DBRef = Decimal128 = Int64 = MaxKey = MinKey = ObjectId = Regex = Timestamp = None  # type: ignore[assignment]
    _BSON_AVAILABLE = False


class InvalidNamespaceError(ValueError):
    """Raised when a database or collection name cannot be used as given."""


class ExtendedJsonError(ValueError):
    """Raised when a `$`-prefixed wrapper cannot be turned into a BSON value."""


def bson_available() -> bool:
    return _BSON_AVAILABLE


# ---------------------------------------------------------------------------
# namespace validation
# ---------------------------------------------------------------------------
# Characters MongoDB itself refuses inside a database name.
_DB_FORBIDDEN = set("/\\. \"$*<>:|?\x00")
MAX_DATABASE_NAME_BYTES = 63
MAX_COLLECTION_NAME_BYTES = 235

_RESERVED_DATABASES = {"admin", "local", "config"}


def validate_database_name(name: str) -> str:
    if not isinstance(name, str):
        raise InvalidNamespaceError("database name must be a string")
    stripped = name.strip()
    if not stripped:
        raise InvalidNamespaceError("database name must not be empty")
    if len(stripped.encode("utf-8")) > MAX_DATABASE_NAME_BYTES:
        raise InvalidNamespaceError(f"database name exceeds {MAX_DATABASE_NAME_BYTES} bytes")
    bad = sorted({ch for ch in stripped if ch in _DB_FORBIDDEN})
    if bad:
        listed = " ".join(repr(ch) for ch in bad)
        raise InvalidNamespaceError(f"database name may not contain {listed}")
    return stripped


def validate_collection_name(name: str, *, allow_system: bool = False) -> str:
    if not isinstance(name, str):
        raise InvalidNamespaceError("collection name must be a string")
    stripped = name.strip()
    if not stripped:
        raise InvalidNamespaceError("collection name must not be empty")
    if "\x00" in stripped or "$" in stripped:
        raise InvalidNamespaceError("collection name may not contain a '$' or a null character")
    if stripped.startswith("."):
        raise InvalidNamespaceError("collection name may not start with a '.'")
    if not allow_system and stripped.startswith("system."):
        raise InvalidNamespaceError("'system.*' collections are managed by the server")
    if len(stripped.encode("utf-8")) > MAX_COLLECTION_NAME_BYTES:
        raise InvalidNamespaceError(f"collection name exceeds {MAX_COLLECTION_NAME_BYTES} bytes")
    return stripped


def is_reserved_database(name: str) -> bool:
    return str(name).strip().lower() in _RESERVED_DATABASES


def namespace(database: str, collection: str) -> str:
    db = validate_database_name(database)
    coll = validate_collection_name(collection, allow_system=True)
    return f"{db}.{coll}"


# ---------------------------------------------------------------------------
# encoding: BSON -> Extended JSON (JSON-serialisable Python)
# ---------------------------------------------------------------------------
_FLAG_LETTERS = ((re.IGNORECASE, "i"), (re.MULTILINE, "m"), (re.DOTALL, "s"), (re.VERBOSE, "x"))


def _regex_flags(flags: int) -> str:
    return "".join(letter for flag, letter in _FLAG_LETTERS if flags & flag)


def _encode_datetime(value: _dt.datetime) -> dict[str, Any]:
    if value.tzinfo is None:
        value = value.replace(tzinfo=_dt.timezone.utc)
    iso = value.astimezone(_dt.timezone.utc).isoformat()
    return {"$date": iso.replace("+00:00", "Z")}


def _encode_binary(raw: bytes, subtype: int = 0) -> dict[str, Any]:
    encoded = base64.b64encode(raw).decode("ascii")
    return {"$binary": {"base64": encoded, "subType": f"{subtype:02x}"}}


def to_extended_json(value: Any) -> Any:
    """Convert a driver value into something `json.dumps` accepts."""
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, float):
        # JSON has no Infinity/NaN; Extended JSON spells them as strings.
        if math.isnan(value):
            return {"$numberDouble": "NaN"}
        if math.isinf(value):
            return {"$numberDouble": "Infinity" if value > 0 else "-Infinity"}
        return value
    if isinstance(value, int):
        # Int64 subclasses int, so it has to be checked before the plain branch.
        if _BSON_AVAILABLE and isinstance(value, Int64):
            return {"$numberLong": str(int(value))}
        return value
    if isinstance(value, _dt.datetime):
        return _encode_datetime(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        subtype = getattr(value, "subtype", 0)
        return _encode_binary(bytes(value), int(subtype))
    if isinstance(value, re.Pattern):
        return {"$regularExpression": {"pattern": value.pattern, "options": _regex_flags(value.flags)}}
    if isinstance(value, dict):
        return {str(key): to_extended_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [to_extended_json(item) for item in value]

    if _BSON_AVAILABLE:
        if isinstance(value, ObjectId):
            return {"$oid": str(value)}
        if isinstance(value, Decimal128):
            return {"$numberDecimal": str(value)}
        if isinstance(value, Regex):
            options = value.flags if isinstance(value.flags, str) else _regex_flags(int(value.flags))
            return {"$regularExpression": {"pattern": value.pattern, "options": options}}
        if isinstance(value, Timestamp):
            return {"$timestamp": {"t": value.time, "i": value.inc}}
        if isinstance(value, Code):
            payload: dict[str, Any] = {"$code": str(value)}
            if value.scope:
                payload["$scope"] = to_extended_json(dict(value.scope))
            return payload
        if isinstance(value, DBRef):
            ref: dict[str, Any] = {"$ref": value.collection, "$id": to_extended_json(value.id)}
            if value.database:
                ref["$db"] = value.database
            return ref
        if isinstance(value, MinKey):
            return {"$minKey": 1}
        if isinstance(value, MaxKey):
            return {"$maxKey": 1}

    return str(value)


# ---------------------------------------------------------------------------
# decoding: Extended JSON -> BSON
# ---------------------------------------------------------------------------
_NOT_A_WRAPPER = object()


def _parse_date(raw: Any) -> _dt.datetime:
    if isinstance(raw, dict) and "$numberLong" in raw:
        return _dt.datetime.fromtimestamp(int(raw["$numberLong"]) / 1000, tz=_dt.timezone.utc)
    if isinstance(raw, bool):
        raise ExtendedJsonError("$date must be a string, a number or a $numberLong wrapper")
    if isinstance(raw, (int, float)):
        return _dt.datetime.fromtimestamp(raw / 1000, tz=_dt.timezone.utc)
    if isinstance(raw, str):
        text = raw.replace("Z", "+00:00")
        try:
            parsed = _dt.datetime.fromisoformat(text)
        except ValueError as exc:
            raise ExtendedJsonError(f"$date is not a valid ISO-8601 timestamp: {raw!r}") from exc
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=_dt.timezone.utc)
    raise ExtendedJsonError("$date must be a string, a number or a $numberLong wrapper")


def _require_bson(wrapper: str) -> None:
    if not _BSON_AVAILABLE:
        raise ExtendedJsonError(f"{wrapper} needs the 'pymongo' package, which is not installed")


def _decode_wrapper(value: dict[str, Any]) -> Any:
    """Turn a single-key `$...` wrapper into its BSON value, or return a sentinel."""
    keys = set(value)

    if keys == {"$oid"}:
        _require_bson("$oid")
        try:
            return ObjectId(str(value["$oid"]))
        except Exception as exc:
            raise ExtendedJsonError(f"$oid is not a valid ObjectId: {value['$oid']!r}") from exc
    if keys == {"$date"}:
        return _parse_date(value["$date"])
    if keys == {"$numberInt"}:
        return int(value["$numberInt"])
    if keys == {"$numberLong"}:
        number = int(value["$numberLong"])
        return Int64(number) if _BSON_AVAILABLE else number
    if keys == {"$numberDouble"}:
        raw = value["$numberDouble"]
        if isinstance(raw, str):
            lowered = raw.strip().lower()
            if lowered == "nan":
                return float("nan")
            if lowered in {"infinity", "+infinity"}:
                return float("inf")
            if lowered == "-infinity":
                return float("-inf")
        return float(raw)
    if keys == {"$numberDecimal"}:
        _require_bson("$numberDecimal")
        try:
            return Decimal128(str(value["$numberDecimal"]))
        except Exception as exc:
            raise ExtendedJsonError(f"$numberDecimal is not a valid decimal: {value['$numberDecimal']!r}") from exc
    if keys == {"$binary"}:
        _require_bson("$binary")
        payload = value["$binary"]
        if not isinstance(payload, dict) or "base64" not in payload:
            raise ExtendedJsonError("$binary must carry a 'base64' and a 'subType' field")
        try:
            return Binary(base64.b64decode(payload["base64"]), int(str(payload.get("subType", "00")), 16))
        except Exception as exc:
            raise ExtendedJsonError("$binary payload is not valid base64") from exc
    if keys == {"$regularExpression"}:
        _require_bson("$regularExpression")
        payload = value["$regularExpression"]
        if not isinstance(payload, dict) or "pattern" not in payload:
            raise ExtendedJsonError("$regularExpression must carry a 'pattern' and an 'options' field")
        return Regex(str(payload["pattern"]), str(payload.get("options", "")))
    if keys == {"$timestamp"}:
        _require_bson("$timestamp")
        payload = value["$timestamp"]
        if not isinstance(payload, dict):
            raise ExtendedJsonError("$timestamp must carry a 't' and an 'i' field")
        return Timestamp(int(payload.get("t", 0)), int(payload.get("i", 0)))
    if keys in ({"$code"}, {"$code", "$scope"}):
        _require_bson("$code")
        scope = value.get("$scope")
        return Code(str(value["$code"]), from_extended_json(scope) if scope else None)
    if keys == {"$minKey"}:
        _require_bson("$minKey")
        return MinKey()
    if keys == {"$maxKey"}:
        _require_bson("$maxKey")
        return MaxKey()
    if {"$ref", "$id"} <= keys <= {"$ref", "$id", "$db"}:
        _require_bson("$ref")
        return DBRef(str(value["$ref"]), from_extended_json(value["$id"]), value.get("$db"))
    return _NOT_A_WRAPPER


def from_extended_json(value: Any) -> Any:
    """Convert Extended JSON (already parsed from text) into BSON values."""
    if isinstance(value, dict):
        decoded = _decode_wrapper(value)
        if decoded is not _NOT_A_WRAPPER:
            return decoded
        return {key: from_extended_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [from_extended_json(item) for item in value]
    return value


def coerce_document(value: Any, kind: str = "document") -> dict[str, Any]:
    """Decode `value` and insist the result is a document."""
    decoded = from_extended_json(value if value is not None else {})
    if not isinstance(decoded, dict):
        raise ExtendedJsonError(f"{kind} must be a JSON object")
    return decoded


def coerce_documents(value: Any, kind: str = "documents") -> list[dict[str, Any]]:
    """Accept either one document or a list of them and return a list."""
    if isinstance(value, dict):
        return [coerce_document(value, kind)]
    if not isinstance(value, list) or not value:
        raise ExtendedJsonError(f"{kind} must be an object or a non-empty list of objects")
    return [coerce_document(item, kind) for item in value]


def coerce_pipeline(value: Any) -> list[dict[str, Any]]:
    decoded = from_extended_json(value if value is not None else [])
    if not isinstance(decoded, list) or not all(isinstance(stage, dict) for stage in decoded):
        raise ExtendedJsonError("pipeline must be a list of stage objects")
    return decoded


def normalise_sort(value: Any) -> list[tuple[str, int]]:
    """Accept `{"field": -1}` or `[["field", -1]]` and return driver sort pairs."""
    if value in (None, "", {}, []):
        return []
    if isinstance(value, dict):
        items: list[tuple[Any, Any]] = list(value.items())
    elif isinstance(value, list):
        items = []
        for entry in value:
            if isinstance(entry, (list, tuple)) and len(entry) == 2:
                items.append((entry[0], entry[1]))
            elif isinstance(entry, dict) and len(entry) == 1:
                items.extend(entry.items())
            else:
                raise ExtendedJsonError("sort entries must be [field, direction] pairs")
    else:
        raise ExtendedJsonError("sort must be an object or a list of pairs")

    pairs: list[tuple[str, int]] = []
    for field, direction in items:
        if not isinstance(field, str) or not field.strip():
            raise ExtendedJsonError("sort field names must be non-empty strings")
        try:
            numeric = int(direction)
        except (TypeError, ValueError) as exc:
            raise ExtendedJsonError(f"sort direction for {field!r} must be 1 or -1") from exc
        if numeric not in (1, -1):
            raise ExtendedJsonError(f"sort direction for {field!r} must be 1 or -1")
        pairs.append((field, numeric))
    return pairs


# `update` payloads are either operator documents ({"$set": ...}) or a full
# replacement; mixing the two is an error MongoDB reports late and unhelpfully.
def is_update_operator_document(update: dict[str, Any]) -> bool:
    if not update:
        return False
    keys = list(update)
    operators = [key for key in keys if key.startswith("$")]
    if operators and len(operators) != len(keys):
        raise ExtendedJsonError("an update may not mix operators with plain fields")
    return bool(operators)


# ---------------------------------------------------------------------------
# export helpers
# ---------------------------------------------------------------------------
def flatten_for_csv(value: Any) -> str:
    """Render one Extended-JSON value as a single CSV cell."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float, str)):
        return str(value)
    if isinstance(value, dict):
        if set(value) == {"$oid"}:
            return str(value["$oid"])
        if set(value) == {"$date"}:
            return str(value["$date"])
        if len(value) == 1 and next(iter(value)).startswith("$number"):
            return str(next(iter(value.values())))
    return _json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def collect_field_names(documents: list[dict[str, Any]]) -> list[str]:
    """Union of top-level keys, `_id` first, otherwise in first-seen order."""
    seen: list[str] = []
    for doc in documents:
        for key in doc:
            if key not in seen:
                seen.append(key)
    if "_id" in seen:
        seen.remove("_id")
        seen.insert(0, "_id")
    return seen
