"""The application's *own* MongoDB connection.

Not to be confused with `adapter/output/mongogateway`, which opens connections to
whatever server a mongo-administrator user logs into. This module is the single
database this deployment stores its own documents in, and it exists because the
JSON backend cannot survive a serverless deployment: `/tmp` there lives as long
as the instance does (see `application/utils/data_paths`).

One `AsyncMongoClient` per process, created on first use. The driver pools
connections internally, so a second client would be a second pool for no reason.
"""

from __future__ import annotations

import logging
from typing import Any

from src.application.config.config import settings

logger = logging.getLogger(__name__)

_client: Any | None = None


class MongoNotConfigured(RuntimeError):
    """`MONGO_URI` is empty, so the mongo backend cannot be used."""


def is_configured() -> bool:
    return bool((getattr(settings, "MONGO_URI", "") or "").strip())


def get_client() -> Any:
    global _client
    if _client is not None:
        return _client

    uri = (getattr(settings, "MONGO_URI", "") or "").strip()
    if not uri:
        raise MongoNotConfigured(
            "The mongo storage backend needs MONGO_URI (for example "
            "mongodb://localhost:27017 or a mongodb+srv:// Atlas URI)"
        )

    try:
        from pymongo import AsyncMongoClient
    except ImportError as cause:  # pragma: no cover - pymongo is a hard dependency
        raise MongoNotConfigured("pymongo is not installed") from cause

    _client = AsyncMongoClient(
        uri,
        serverSelectionTimeoutMS=int(getattr(settings, "MONGO_CONNECT_TIMEOUT", 10)) * 1000,
        tz_aware=True,
    )
    return _client


def get_database() -> Any:
    """The database this deployment writes its own collections into."""
    name = (getattr(settings, "MONGO_DATABASE", "") or "gemini_proxy").strip()
    return get_client()[name]


def get_collection(name: str) -> Any:
    return get_database()[name]


async def shutdown() -> None:
    """Close the pool on application shutdown."""
    global _client
    if _client is None:
        return
    client, _client = _client, None
    try:
        await client.close()
    except Exception:  # pragma: no cover - shutdown must not raise
        logger.warning("Closing the MongoDB client failed", exc_info=True)


def reset_for_tests() -> None:
    global _client
    _client = None
