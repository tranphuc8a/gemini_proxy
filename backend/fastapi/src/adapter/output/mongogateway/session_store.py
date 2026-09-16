"""File-backed session registry for MongoDB administrator logins.

Sessions live until the user logs out, so they are held in memory for speed and
mirrored to a JSON file so a server restart does not sign everybody out.

The whole connection URI is sensitive here, not just a password field: it is the
credential. It is sealed with AES-GCM (`sqlgateway.crypto`, shared with the SQL
administrator) before being written, and when `cryptography` is unavailable the
file mirror is disabled rather than writing a URI with a password in the clear.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.adapter.output.sqlgateway.crypto import PasswordSealer, SealError
from src.application.ports.output.mongo_gateway_output_port import MongoConnectionProfile
from src.application.ports.output.mongo_session_output_port import (
    MongoSessionOutputPort,
    StoredMongoSession,
)
from src.adapter.output.sessionstore.records import SessionRecordStore, build_record_store

logger = logging.getLogger(__name__)

#: Separates this administrator's sessions from the other one's in a shared table.
#: Floor between mirror re-reads, so a client holding a dead token cannot turn
#: every request into a database round trip.
RELOAD_MIN_INTERVAL_SECONDS = 1.0

#: How stale this worker's copy may get before it is refreshed even on a hit.
#:
#: Without this, "log out" only logs you out of the worker that handled it: any
#: other worker keeps its own copy of the session and goes on accepting the
#: token indefinitely. That is a revocation that does not revoke, so the copy is
#: given a bounded life. The cost is one round trip per worker per window.
RELOAD_MAX_AGE_SECONDS = 15.0

SESSION_KIND = "mongo"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class FileMongoSessionStore(MongoSessionOutputPort):
    def __init__(self, file_path: str | Path | None, secret: str, persist: bool = True):
        self._sessions: dict[str, StoredMongoSession] = {}
        self._lock = asyncio.Lock()
        self._loaded = False
        self._last_reload = 0.0
        self._sealer: PasswordSealer | None = None
        self._records: SessionRecordStore | None = None

        if persist and file_path:
            try:
                self._sealer = PasswordSealer(secret)
            except ValueError:
                logger.warning("MONGOADMIN_SECRET_KEY is empty; sessions will not be persisted")
            if self._sealer and not self._sealer.available:
                logger.warning("cryptography is not installed; sessions will not be persisted")
                self._sealer = None
            if self._sealer:
                # Not a bare file any more: where the mirror lives is
                # configurable, because a file in a serverless temp directory
                # signed everybody out on the next request. See
                # adapter/output/sessionstore/records.py.
                self._records = build_record_store(file_path)

    @property
    def persistent(self) -> bool:
        return self._records is not None and self._sealer is not None

    @property
    def storage_label(self) -> str:
        """Where sessions are mirrored, for the administrator's status panel."""
        return self._records.label if self._records else "memory"

    # --- persistence -----------------------------------------------------
    def _to_record(self, session: StoredMongoSession) -> dict[str, Any]:
        assert self._sealer is not None
        return {
            "token": session.token,
            "uri": self._sealer.seal(session.profile.uri),
            "host": session.profile.host,
            "port": session.profile.port,
            "username": session.profile.username,
            "database": session.profile.database,
            "auth_source": session.profile.auth_source,
            "tls": session.profile.tls,
            "srv": session.profile.srv,
            "options": session.profile.options,
            "label": session.label,
            "server_version": session.server_version,
            "server_flavor": session.server_flavor,
            "topology": session.topology,
            "connected_at": session.connected_at,
            "last_used_at": session.last_used_at,
            "metadata": session.metadata,
        }

    def _from_record(self, record: dict[str, Any]) -> StoredMongoSession:
        assert self._sealer is not None
        return StoredMongoSession(
            token=record["token"],
            profile=MongoConnectionProfile(
                uri=self._sealer.unseal(record.get("uri") or ""),
                host=record.get("host") or "localhost",
                port=int(record["port"]) if record.get("port") is not None else None,
                username=record.get("username"),
                database=record.get("database"),
                auth_source=record.get("auth_source"),
                tls=bool(record.get("tls")),
                srv=bool(record.get("srv")),
                options=record.get("options") or {},
            ),
            label=record.get("label"),
            server_version=record.get("server_version"),
            server_flavor=record.get("server_flavor"),
            topology=record.get("topology"),
            connected_at=record.get("connected_at") or "",
            last_used_at=record.get("last_used_at") or "",
            metadata=record.get("metadata") or {},
        )

    async def _load_locked(self) -> None:
        """Read the mirror once per process, on first use.

        Once, not per request: the mirror exists so a restart does not sign
        people out, and re-reading it on every call would put a database round
        trip in front of every query the administrator runs.

        `_reload_locked` below handles the case this misses.
        """
        if self._loaded:
            return
        self._loaded = True
        await self._read_into_memory(replace=False)
        # A fresh read is a fresh read; without this the next call would see an
        # age of "since the epoch" and immediately read again.
        self._last_reload = time.monotonic()

    async def _reload_locked(self, *, stale_only: bool = False) -> bool:
        """Re-read the mirror.

        This is what makes the store correct with more than one worker. A
        session created by worker A is written to the shared mirror, but worker
        B read that mirror once — at *its* first request, before the session
        existed — and `_loaded` stopped it ever looking again. So B never saw
        the session, answered 401, and the user was signed out mid-session at
        random; with N workers it happened to roughly (N-1)/N of requests.

        Called on the miss path, and — via `stale_only` — once the copy passes
        `RELOAD_MAX_AGE_SECONDS`, so that a logout elsewhere takes effect here
        too. Rate limited because a client holding a dead token would otherwise
        hit the database on every single request.
        """
        if not self.persistent or not self._records:
            return False

        now = time.monotonic()
        age = now - self._last_reload
        if age < (RELOAD_MAX_AGE_SECONDS if stale_only else RELOAD_MIN_INTERVAL_SECONDS):
            return False
        self._last_reload = now

        # Replaces rather than merges: a logout on another worker removed the
        # record, and merging would resurrect the session it just ended.
        await self._read_into_memory(replace=True)
        return True

    async def _read_into_memory(self, *, replace: bool) -> None:
        if not self.persistent or not self._records:
            return
        try:
            stored = await self._records.load(SESSION_KIND)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not read sessions from %s: %s", self._records.label, exc)
            return

        loaded: dict[str, Any] = {}
        for record in stored:
            try:
                session = self._from_record(record)
            except (SealError, KeyError, TypeError, ValueError) as exc:
                # A rotated secret invalidates old sessions; drop them quietly.
                logger.info("Discarding unreadable stored session: %s", exc)
                continue
            loaded[session.token] = session

        if replace:
            self._sessions = loaded
        else:
            self._sessions.update(loaded)

    async def _flush_locked(self) -> None:
        if not self.persistent or not self._records:
            return
        try:
            records = [self._to_record(s) for s in self._sessions.values()]
            await self._records.save(SESSION_KIND, records)
        except Exception as exc:  # noqa: BLE001
            # Persistence is best-effort. Losing the mirror costs a login after
            # the next restart; letting the error out would cost the login
            # happening right now, which is strictly worse.
            logger.warning("Could not persist sessions to %s: %s", self._records.label, exc)

    # --- port ------------------------------------------------------------
    async def create(self, session: StoredMongoSession) -> StoredMongoSession:
        async with self._lock:
            await self._load_locked()
            now = utc_now_iso()
            session.connected_at = session.connected_at or now
            session.last_used_at = now
            self._sessions[session.token] = session
            await self._flush_locked()
            return session

    async def get(self, token: str) -> StoredMongoSession | None:
        async with self._lock:
            await self._load_locked()
            # Bounded staleness, so a logout on another worker reaches this one.
            await self._reload_locked(stale_only=True)
            found = self._sessions.get(token)
            if found is None and await self._reload_locked():
                # Another worker may have created it since this one last looked.
                found = self._sessions.get(token)
            return found

    async def touch(self, token: str) -> StoredMongoSession | None:
        async with self._lock:
            await self._load_locked()
            # Bounded staleness, so a logout on another worker reaches this one.
            await self._reload_locked(stale_only=True)
            session = self._sessions.get(token)
            if session is None and await self._reload_locked():
                session = self._sessions.get(token)
            if session is None:
                return None
            session.last_used_at = utc_now_iso()
            # Deliberately not flushed: a timestamp bump per request would make
            # every read hit the disk. The file is rewritten on create/delete.
            return session

    async def update(self, session: StoredMongoSession) -> StoredMongoSession:
        async with self._lock:
            await self._load_locked()
            session.last_used_at = utc_now_iso()
            self._sessions[session.token] = session
            await self._flush_locked()
            return session

    async def delete(self, token: str) -> bool:
        async with self._lock:
            await self._load_locked()
            existed = self._sessions.pop(token, None) is not None
            if existed:
                await self._flush_locked()
            return existed
