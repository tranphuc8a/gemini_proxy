"""One place to ask "which storage backends work, and if not, why not".

Three apps -- markdown-editor, postman-lite-pro and graphuc -- offer the same
json/mysql/mongo choice, and each used to answer the question for itself by
looking at whether a URI string was set. That is not the same question. A URI
can be present and wrong, and the picker would happily offer the backend right
up until the first save failed with a driver error nobody could read.

So this router *connects*. `GET /storage/backends` reports what is reachable
right now, with the driver's own message when something is not, and
`POST /storage/mongo/ping` is the "test connection" button in the apps.

Reachability is a fact about the server, not a secret, so reading it needs no
admin key -- and knowing that the mongo option will fail is exactly what a user
needs *before* they spend an afternoon drawing something.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from src.adapter.output.mongostore import client as mongo_store
from src.adapter.output.mysql.db.base import get_async_session
from src.application.config.config import settings
from src.application.utils.data_paths import data_root

router = APIRouter(prefix="/storage", tags=["storage"])


class BackendStatus(BaseModel):
    id: str
    label: str
    available: bool
    #: Why it is unavailable, or a useful fact when it is.
    detail: str | None = None
    #: Round-trip time of the check, so a slow backend is visible as slow.
    latency_ms: int | None = None


async def _check_json() -> BackendStatus:
    started = time.perf_counter()
    try:
        root = data_root()
    except Exception as cause:  # noqa: BLE001
        return BackendStatus(id="json", label="JSON file", available=False, detail=str(cause))

    # `data_root` already probed that it can be written to, so reaching here
    # means the backend works. What is worth reporting is *where*, because a
    # temp-directory answer is the signal that the data will not survive.
    ephemeral = "tmp" in str(root).lower().replace("\\", "/").split("/")
    detail = str(root)
    if ephemeral:
        detail += " — thư mục tạm: dữ liệu KHÔNG bền qua mỗi lần deploy, hãy dùng mysql hoặc mongo"
    return BackendStatus(
        id="json",
        label="JSON file",
        available=True,
        detail=detail,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )


async def _check_mysql() -> BackendStatus:
    started = time.perf_counter()
    session = get_async_session()
    try:
        # `SELECT 1` is the reachability test and works on every engine,
        # including the SQLite the suite falls back to. The version is a nicety
        # asked for separately, because `VERSION()` is MySQL-only and a missing
        # function must not make a working database look broken.
        await session.execute(text("SELECT 1"))
        try:
            version = (await session.execute(text("SELECT VERSION()"))).scalar()
        except Exception:  # noqa: BLE001 - not MySQL; the connection is still fine
            await session.rollback()
            version = None

        where = f"{settings.DB_DATABASE} @ {settings.DB_HOST}"
        return BackendStatus(
            id="mysql",
            label="MySQL / MariaDB",
            available=True,
            detail=f"{where} · {version}" if version else where,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
    except Exception as cause:  # noqa: BLE001 - the driver's message is the answer
        return BackendStatus(id="mysql", label="MySQL / MariaDB", available=False, detail=str(cause)[:300])
    finally:
        await session.close()


async def _check_mongo() -> BackendStatus:
    started = time.perf_counter()
    try:
        facts = await mongo_store.ping()
    except mongo_store.MongoNotConfigured as cause:
        return BackendStatus(id="mongo", label="MongoDB", available=False, detail=str(cause))
    except mongo_store.MongoUnreachable as cause:
        return BackendStatus(id="mongo", label="MongoDB", available=False, detail=str(cause)[:300])
    except Exception as cause:  # noqa: BLE001
        return BackendStatus(id="mongo", label="MongoDB", available=False, detail=str(cause)[:300])

    return BackendStatus(
        id="mongo",
        label="MongoDB",
        available=True,
        detail=f"{facts['database']} · MongoDB {facts['server_version']} · "
        f"{len(facts['collections'])} collection",
        latency_ms=int((time.perf_counter() - started) * 1000),
    )


@router.get("/backends", response_model=list[BackendStatus])
async def list_backends():
    """Which storage backends are reachable right now.

    Each is checked by actually using it, so this is slower than reading config
    -- a wrong Atlas host costs the connect timeout. Worth it: the alternative
    is telling the user a backend works when it does not.
    """
    return [await _check_json(), await _check_mysql(), await _check_mongo()]


@router.post("/mongo/ping")
async def ping_mongo() -> dict[str, Any]:
    """The apps' "test connection" button.

    Returns the driver's message verbatim on failure rather than a tidied one:
    "Authentication failed", "getaddrinfo ENOTFOUND" and "connection refused"
    each need a different fix, and only the original text says which.
    """
    try:
        return {"ok": True, **await mongo_store.ping()}
    except (mongo_store.MongoNotConfigured, mongo_store.MongoUnreachable) as cause:
        return {"ok": False, "error": str(cause)}
    except Exception as cause:  # noqa: BLE001
        return {"ok": False, "error": f"{cause.__class__.__name__}: {cause}"}
