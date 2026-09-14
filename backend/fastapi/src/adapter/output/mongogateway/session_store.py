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
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.adapter.output.sqlgateway.crypto import PasswordSealer, SealError
from src.application.ports.output.mongo_gateway_output_port import MongoConnectionProfile
from src.application.ports.output.mongo_session_output_port import (
    MongoSessionOutputPort,
    StoredMongoSession,
)
from src.application.utils.data_paths import seeded_data_path

logger = logging.getLogger(__name__)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class FileMongoSessionStore(MongoSessionOutputPort):
    def __init__(self, file_path: str | Path | None, secret: str, persist: bool = True):
        self._sessions: dict[str, StoredMongoSession] = {}
        self._lock = asyncio.Lock()
        self._loaded = False
        self._sealer: PasswordSealer | None = None
        self._path: Path | None = None

        if persist and file_path:
            try:
                self._sealer = PasswordSealer(secret)
            except ValueError:
                logger.warning("MONGOADMIN_SECRET_KEY is empty; sessions will not be persisted")
            if self._sealer and not self._sealer.available:
                logger.warning("cryptography is not installed; sessions will not be persisted")
                self._sealer = None
            if self._sealer:
                # Resolved against a writable root rather than the working
                # directory: a serverless deployment is unpacked read-only.
                self._path = seeded_data_path(file_path)

    @property
    def persistent(self) -> bool:
        return self._path is not None and self._sealer is not None

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

    def _load_locked(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        if not self.persistent or not self._path or not self._path.exists():
            return
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read session file %s: %s", self._path, exc)
            return
        for record in payload.get("sessions", []):
            try:
                session = self._from_record(record)
            except (SealError, KeyError, TypeError, ValueError) as exc:
                # A rotated secret invalidates old sessions; drop them quietly.
                logger.info("Discarding unreadable stored session: %s", exc)
                continue
            self._sessions[session.token] = session

    def _flush_locked(self) -> None:
        if not self.persistent or not self._path:
            return
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"sessions": [self._to_record(s) for s in self._sessions.values()]}
            tmp = self._path.with_suffix(self._path.suffix + ".tmp")
            tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            tmp.replace(self._path)
        except (OSError, SealError) as exc:
            logger.warning("Could not persist sessions to %s: %s", self._path, exc)

    # --- port ------------------------------------------------------------
    async def create(self, session: StoredMongoSession) -> StoredMongoSession:
        async with self._lock:
            self._load_locked()
            now = utc_now_iso()
            session.connected_at = session.connected_at or now
            session.last_used_at = now
            self._sessions[session.token] = session
            self._flush_locked()
            return session

    async def get(self, token: str) -> StoredMongoSession | None:
        async with self._lock:
            self._load_locked()
            return self._sessions.get(token)

    async def touch(self, token: str) -> StoredMongoSession | None:
        async with self._lock:
            self._load_locked()
            session = self._sessions.get(token)
            if session is None:
                return None
            session.last_used_at = utc_now_iso()
            # Deliberately not flushed: a timestamp bump per request would make
            # every read hit the disk. The file is rewritten on create/delete.
            return session

    async def update(self, session: StoredMongoSession) -> StoredMongoSession:
        async with self._lock:
            self._load_locked()
            session.last_used_at = utc_now_iso()
            self._sessions[session.token] = session
            self._flush_locked()
            return session

    async def delete(self, token: str) -> bool:
        async with self._lock:
            self._load_locked()
            existed = self._sessions.pop(token, None) is not None
            if existed:
                self._flush_locked()
            return existed
