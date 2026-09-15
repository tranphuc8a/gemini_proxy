"""The application's *own* MongoDB connection.

Not to be confused with `adapter/output/mongogateway`, which opens connections to
whatever server a mongo-administrator user logs into. This module is the single
database this deployment stores its own documents in, and it exists because the
JSON backend cannot survive a serverless deployment: `/tmp` there lives as long
as the instance does (see `application/utils/data_paths`).

One `AsyncMongoClient` per event loop, created on first use. Per *loop*, not per
process: an `AsyncMongoClient` binds to the loop that created it, and reusing one
across loops raises "Event loop is closed" or hangs. A long-running uvicorn has
exactly one loop and so exactly one client, but a serverless invocation, a
`asyncio.run` in a script and pytest all bring their own -- and those are the
environments where the failure showed up.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from src.application.config.config import settings

logger = logging.getLogger(__name__)

#: Keyed by the event loop the client belongs to. A plain dict rather than a
#: WeakValueDictionary because the values are clients, not loops; the loop key is
#: held weakly by `_forget_loop` instead.
_clients: dict[int, Any] = {}


class MongoNotConfigured(RuntimeError):
    """`MONGO_URI` is empty, so the mongo backend cannot be used."""


class MongoUnreachable(RuntimeError):
    """A URI is configured but the server did not answer."""


def is_configured() -> bool:
    return bool(_uri())


def _uri() -> str:
    return (getattr(settings, "MONGO_URI", "") or "").strip()


def _timeout_ms() -> int:
    return max(1, int(getattr(settings, "MONGO_CONNECT_TIMEOUT", 10))) * 1000


def _loop_key() -> int:
    try:
        return id(asyncio.get_running_loop())
    except RuntimeError:
        # Called outside a loop -- `is_configured` and friends do this. Key 0 is
        # the "no loop yet" slot; the first real await will key its own.
        return 0


def get_client() -> Any:
    key = _loop_key()
    existing = _clients.get(key)
    if existing is not None:
        return existing

    uri = _uri()
    if not uri:
        raise MongoNotConfigured(
            "Mongo backend cần MONGO_URI (ví dụ mongodb://localhost:27017 "
            "hoặc một URI mongodb+srv:// của Atlas)"
        )

    try:
        from pymongo import AsyncMongoClient
    except ImportError as cause:  # pragma: no cover - pymongo is a hard dependency
        raise MongoNotConfigured("pymongo chưa được cài") from cause

    client = AsyncMongoClient(
        uri,
        serverSelectionTimeoutMS=_timeout_ms(),
        connectTimeoutMS=_timeout_ms(),
        tz_aware=True,
        appname="gemini-proxy",
    )
    _clients[key] = client
    return client


def get_database() -> Any:
    """The database this deployment writes its own collections into."""
    name = (getattr(settings, "MONGO_DATABASE", "") or "gemini_proxy").strip()
    return get_client()[name]


def get_collection(name: str) -> Any:
    return get_database()[name]


async def ping() -> dict[str, Any]:
    """Actually talk to the server, and say plainly what happened.

    The storage pickers used to report a backend as "available" purely because a
    URI was set, so a wrong host or password only surfaced as a failed save much
    later. This is what lets the apps tell the difference between "configured"
    and "working", and show the driver's own message when it is not.
    """
    if not is_configured():
        raise MongoNotConfigured(
            "MONGO_URI chưa được đặt trên máy chủ"
        )

    client = get_client()
    try:
        result = await client.admin.command("ping")
        info = await client.server_info()
    except Exception as cause:  # noqa: BLE001 - every driver error becomes one answer
        # Drop the cached client: a failed handshake often leaves it in a state
        # where every later call fails the same way even once the server is back.
        _clients.pop(_loop_key(), None)
        raise MongoUnreachable(str(cause) or cause.__class__.__name__) from cause

    database = get_database()
    return {
        "ok": bool(result.get("ok")),
        "server_version": info.get("version"),
        "database": database.name,
        # Proves read access, not just that the handshake succeeded.
        "collections": sorted(await database.list_collection_names()),
    }


async def shutdown() -> None:
    """Close every pool on application shutdown."""
    clients = list(_clients.values())
    _clients.clear()
    for client in clients:
        try:
            await client.close()
        except Exception:  # pragma: no cover - shutdown must not raise
            logger.warning("Closing the MongoDB client failed", exc_info=True)


def reset_for_tests() -> None:
    _clients.clear()
