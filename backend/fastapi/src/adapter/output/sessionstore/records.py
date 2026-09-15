"""Where administrator login sessions are kept between requests.

The SQL and MongoDB administrators both let a user stay logged in until they log
out. That worked on a laptop and failed everywhere else, for one reason: the
sessions were mirrored to a JSON file, and on a serverless platform that file
lives in a per-instance temp directory (see `application/utils/data_paths`). The
next request lands on a different instance, finds no session, and the user is
asked to log in again -- the "session không lâu" bug.

So the mirror is pluggable, exactly like every other store in this codebase:

* ``json``  - one file. Zero setup, and the right answer on one machine.
* ``mysql`` - one row per session in `admin_sessions`.
* ``mongo`` - one document per session in the same-named collection.

Whichever is chosen, the *contents* are unchanged: each record is already sealed
by the caller (AES-GCM, see `sqlgateway.crypto`) before it arrives here, because
the credential it carries must not be readable by anyone who can read the table.
This module never sees a plaintext password and does not need to.

`kind` separates the two administrators' sessions inside one table, so enabling
this costs one table rather than two.
"""

from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from src.application.config.config import settings
from src.application.utils.data_paths import seeded_data_path

logger = logging.getLogger(__name__)

SUPPORTED_BACKENDS = ("json", "mysql", "mongo")

MYSQL_TABLE = "admin_sessions"
MONGO_COLLECTION = "admin_sessions"


class SessionRecordStore(ABC):
    """Loads and saves the whole set of records for one administrator.

    Whole-set rather than per-record: a deployment has a handful of open
    sessions, the set is rewritten only on login and logout, and one round trip
    is easier to reason about than a diff.
    """

    @abstractmethod
    async def load(self, kind: str) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def save(self, kind: str, records: list[dict[str, Any]]) -> None:
        ...

    @property
    def label(self) -> str:
        return self.__class__.__name__


class JsonRecordStore(SessionRecordStore):
    def __init__(self, file_path: str | Path) -> None:
        self._path = seeded_data_path(file_path)

    @property
    def label(self) -> str:
        return f"json:{self._path}"

    async def load(self, kind: str) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as cause:
            # A truncated file must not lock everybody out; start empty and keep
            # the bad file where it can be looked at.
            logger.warning("Could not read session file %s: %s", self._path, cause)
            return []
        records = payload.get("sessions")
        return [r for r in records if isinstance(r, dict)] if isinstance(records, list) else []

    async def save(self, kind: str, records: list[dict[str, Any]]) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            temp = self._path.with_suffix(self._path.suffix + ".tmp")
            temp.write_text(json.dumps({"sessions": records}, indent=2), encoding="utf-8")
            os.replace(temp, self._path)
        except OSError as cause:
            # Losing the mirror costs persistence, not the running session.
            logger.warning("Could not persist sessions to %s: %s", self._path, cause)


_CREATE_TABLE = f"""
CREATE TABLE IF NOT EXISTS {MYSQL_TABLE} (
    kind VARCHAR(20) NOT NULL,
    token VARCHAR(128) NOT NULL,
    record LONGTEXT NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (kind, token)
)
"""


class MySqlRecordStore(SessionRecordStore):
    """Sessions in the application's own MySQL.

    The table is created on first use rather than by a migration: this backend
    is opt-in and must not impose a schema change on deployments that never
    select it, which is the same rule the postman and markdown stores follow.
    """

    def __init__(self) -> None:
        self._ready = False

    @property
    def label(self) -> str:
        return f"mysql:{MYSQL_TABLE}"

    async def _session(self):
        from sqlalchemy import text

        from src.adapter.output.mysql.db.base import get_async_session

        session = get_async_session()
        if not self._ready:
            await session.execute(text(_CREATE_TABLE))
            await session.commit()
            self._ready = True
        return session

    async def load(self, kind: str) -> list[dict[str, Any]]:
        from sqlalchemy import text

        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT record FROM {MYSQL_TABLE} WHERE kind = :kind"), {"kind": kind}
            )
            records: list[dict[str, Any]] = []
            for row in result.fetchall():
                try:
                    records.append(json.loads(row[0]))
                except (TypeError, ValueError):
                    continue  # one unreadable row must not hide the others
            return records
        except Exception as cause:  # noqa: BLE001 - a dead database is not a crash
            logger.warning("Could not read sessions from MySQL: %s", cause)
            return []
        finally:
            await session.close()

    async def save(self, kind: str, records: list[dict[str, Any]]) -> None:
        from sqlalchemy import text

        from src.adapter.output.sqlgateway.session_store import utc_now_iso

        session = await self._session()
        try:
            # Delete-then-insert for this kind only: the caller hands over the
            # complete set, so a diff would only add a way for the two to drift.
            await session.execute(text(f"DELETE FROM {MYSQL_TABLE} WHERE kind = :kind"), {"kind": kind})
            now = utc_now_iso()
            for record in records:
                await session.execute(
                    text(
                        f"INSERT INTO {MYSQL_TABLE} (kind, token, record, updated_at) "
                        "VALUES (:kind, :token, :record, :updated_at)"
                    ),
                    {
                        "kind": kind,
                        "token": str(record.get("token", "")),
                        "record": json.dumps(record, ensure_ascii=False),
                        "updated_at": now,
                    },
                )
            await session.commit()
        except Exception as cause:  # noqa: BLE001
            await session.rollback()
            logger.warning("Could not persist sessions to MySQL: %s", cause)
        finally:
            await session.close()


class MongoRecordStore(SessionRecordStore):
    def __init__(self) -> None:
        self._ready = False

    @property
    def label(self) -> str:
        return f"mongo:{MONGO_COLLECTION}"

    async def _collection(self):
        from src.adapter.output.mongostore import client as mongo_store

        collection = mongo_store.get_collection(MONGO_COLLECTION)
        if not self._ready:
            try:
                await collection.create_index("kind")
            except Exception:  # noqa: BLE001 - an index is an optimisation
                logger.warning("Could not create the admin_sessions index", exc_info=True)
            self._ready = True
        return collection

    async def load(self, kind: str) -> list[dict[str, Any]]:
        try:
            collection = await self._collection()
            records: list[dict[str, Any]] = []
            async for document in collection.find({"kind": kind}):
                record = document.get("record")
                if isinstance(record, dict):
                    records.append(record)
            return records
        except Exception as cause:  # noqa: BLE001
            logger.warning("Could not read sessions from MongoDB: %s", cause)
            return []

    async def save(self, kind: str, records: list[dict[str, Any]]) -> None:
        try:
            collection = await self._collection()
            await collection.delete_many({"kind": kind})
            if records:
                await collection.insert_many(
                    [
                        {"_id": f"{kind}:{record.get('token', '')}", "kind": kind, "record": record}
                        for record in records
                    ]
                )
        except Exception as cause:  # noqa: BLE001
            logger.warning("Could not persist sessions to MongoDB: %s", cause)


class NullRecordStore(SessionRecordStore):
    """Keeps nothing. Used when persistence is switched off or unavailable."""

    @property
    def label(self) -> str:
        return "memory"

    async def load(self, kind: str) -> list[dict[str, Any]]:
        return []

    async def save(self, kind: str, records: list[dict[str, Any]]) -> None:
        return None


def build_record_store(file_path: str | Path | None, backend: str | None = None) -> SessionRecordStore:
    """Pick a record store from configuration.

    Falls back to JSON rather than refusing to start: an unreachable MySQL
    should cost persistence, not the ability to log in at all. The adapters
    themselves also swallow their own errors for the same reason.
    """
    chosen = (backend or getattr(settings, "ADMIN_SESSION_BACKEND", "json") or "json").lower()
    if chosen not in SUPPORTED_BACKENDS:
        logger.warning("ADMIN_SESSION_BACKEND=%r is not one of %s; using json", chosen, SUPPORTED_BACKENDS)
        chosen = "json"

    if chosen == "mysql":
        return MySqlRecordStore()
    if chosen == "mongo":
        from src.adapter.output.mongostore import client as mongo_store

        if mongo_store.is_configured():
            return MongoRecordStore()
        logger.warning("ADMIN_SESSION_BACKEND=mongo but MONGO_URI is unset; using json")

    if not file_path:
        return NullRecordStore()
    return JsonRecordStore(file_path)
