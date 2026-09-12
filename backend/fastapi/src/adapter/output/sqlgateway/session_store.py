"""File-backed session registry for SQL administrator logins.

Sessions live until the user logs out, so they are held in memory for speed and
mirrored to a JSON file so a server restart does not sign everybody out. The
target-server password is the only sensitive field and it is sealed (AES-GCM)
before it is written; if `cryptography` is unavailable the file mirror is
disabled rather than writing a password in the clear.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.adapter.output.sqlgateway.crypto import PasswordSealer, SealError
from src.application.ports.output.sql_gateway_output_port import ConnectionProfile
from src.application.ports.output.sql_session_output_port import SqlSessionOutputPort, StoredSession

logger = logging.getLogger(__name__)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class FileSessionStore(SqlSessionOutputPort):
    def __init__(self, file_path: str | Path | None, secret: str, persist: bool = True):
        self._sessions: dict[str, StoredSession] = {}
        self._lock = asyncio.Lock()
        self._loaded = False
        self._sealer: PasswordSealer | None = None
        self._path: Path | None = None

        if persist and file_path:
            try:
                self._sealer = PasswordSealer(secret)
            except ValueError:
                logger.warning("SQLADMIN_SECRET_KEY is empty; sessions will not be persisted")
            if self._sealer and not self._sealer.available:
                logger.warning("cryptography is not installed; sessions will not be persisted")
                self._sealer = None
            if self._sealer:
                path = Path(file_path)
                self._path = path if path.is_absolute() else Path.cwd() / path

    @property
    def persistent(self) -> bool:
        return self._path is not None and self._sealer is not None

    # --- persistence -----------------------------------------------------
    def _to_record(self, session: StoredSession) -> dict[str, Any]:
        assert self._sealer is not None
        return {
            "token": session.token,
            "host": session.profile.host,
            "port": session.profile.port,
            "username": session.profile.username,
            "password": self._sealer.seal(session.profile.password),
            "database": session.profile.database,
            "charset": session.profile.charset,
            "label": session.label,
            "server_version": session.server_version,
            "server_flavor": session.server_flavor,
            "connected_at": session.connected_at,
            "last_used_at": session.last_used_at,
            "metadata": session.metadata,
        }

    def _from_record(self, record: dict[str, Any]) -> StoredSession:
        assert self._sealer is not None
        return StoredSession(
            token=record["token"],
            profile=ConnectionProfile(
                host=record["host"],
                port=int(record["port"]),
                username=record["username"],
                password=self._sealer.unseal(record.get("password") or ""),
                database=record.get("database"),
                charset=record.get("charset") or "utf8mb4",
            ),
            label=record.get("label"),
            server_version=record.get("server_version"),
            server_flavor=record.get("server_flavor"),
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
    async def create(self, session: StoredSession) -> StoredSession:
        async with self._lock:
            self._load_locked()
            now = utc_now_iso()
            session.connected_at = session.connected_at or now
            session.last_used_at = now
            self._sessions[session.token] = session
            self._flush_locked()
            return session

    async def get(self, token: str) -> StoredSession | None:
        async with self._lock:
            self._load_locked()
            return self._sessions.get(token)

    async def touch(self, token: str) -> StoredSession | None:
        async with self._lock:
            self._load_locked()
            session = self._sessions.get(token)
            if session is None:
                return None
            session.last_used_at = utc_now_iso()
            # Deliberately not flushed: a timestamp bump per request would make
            # every read hit the disk. The file is rewritten on create/delete.
            return session

    async def update(self, session: StoredSession) -> StoredSession:
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
