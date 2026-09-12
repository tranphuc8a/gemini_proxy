"""Workspace use cases for postman-lite-pro.

Three rules live here, and nowhere else:

1. **Access.** A workspace is reachable only with the key handed out at
   creation. Only its SHA-256 is stored, so a leaked JSON file or a dumped table
   does not hand over anybody's collections.
2. **Revisions.** Every save states the revision it was based on. If the stored
   revision has moved on, the save is refused with the current document attached
   so the client can merge instead of silently overwriting a colleague's work.
3. **Sharing.** A share link exposes collections and requests, never
   environments - that is where tokens and passwords are kept.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from src.application.exceptions.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.input.postman_input_port import PostmanInputPort
from src.application.ports.output.postman_repository_port import PostmanRepositoryPort
from src.domain.vo.postman_vo import (
    MAX_ITEMS_PER_STORE,
    HistoryEntry,
    HistoryPage,
    ShareResult,
    SharedWorkspaceView,
    WorkspaceCreated,
    WorkspaceCreateRequest,
    WorkspaceRecord,
    WorkspaceSaveRequest,
    WorkspaceView,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


class PostmanUseCase(PostmanInputPort):
    def __init__(self, repository: PostmanRepositoryPort, max_history: int = 500):
        self._repo = repository
        self._max_history = max(1, max_history)

    # ------------------------------------------------------------- helpers
    async def _authorise(self, workspace_id: str, access_key: str) -> WorkspaceRecord:
        record = await self._repo.get(workspace_id)
        if record is None:
            raise NotFoundError("Workspace không tồn tại")
        if not access_key:
            raise UnauthorizedError("Thiếu header X-Workspace-Key")
        # compare_digest keeps the check constant-time, so the response latency
        # does not leak how much of a guessed key was correct.
        if not secrets.compare_digest(hash_key(access_key), record.key_hash):
            raise UnauthorizedError("Access key không đúng")
        return record

    @staticmethod
    def _check_size(request: WorkspaceSaveRequest) -> None:
        for label, items in (
            ("collections", request.collections),
            ("requests", request.requests),
            ("environments", request.environments),
        ):
            if len(items) > MAX_ITEMS_PER_STORE:
                raise BadRequestError(
                    f"{label} vượt giới hạn {MAX_ITEMS_PER_STORE} phần tử"
                )

    # ----------------------------------------------------------- workspace
    async def create_workspace(self, request: WorkspaceCreateRequest) -> WorkspaceCreated:
        now = utc_now_iso()
        access_key = secrets.token_urlsafe(24)
        record = WorkspaceRecord(
            id="ws_" + secrets.token_urlsafe(12),
            name=request.name.strip() or "My Workspace",
            key_hash=hash_key(access_key),
            revision=1,
            created_at=now,
            updated_at=now,
        )
        await self._repo.create(record)
        return WorkspaceCreated(
            id=record.id,
            name=record.name,
            access_key=access_key,
            revision=record.revision,
            created_at=record.created_at,
        )

    async def get_workspace(self, workspace_id: str, access_key: str) -> WorkspaceView:
        record = await self._authorise(workspace_id, access_key)
        return record.to_view()

    async def save_workspace(
        self, workspace_id: str, access_key: str, request: WorkspaceSaveRequest
    ) -> WorkspaceView:
        record = await self._authorise(workspace_id, access_key)
        self._check_size(request)

        if request.revision != record.revision:
            # Hand back the current document: the client can then merge and
            # retry, which is the whole point of refusing rather than blocking.
            raise ConflictError(
                "Workspace đã được lưu từ nơi khác. Hãy đồng bộ lại trước khi ghi đè.",
                payload={"current": record.to_view().model_dump()},
            )

        record.collections = request.collections
        record.requests = request.requests
        record.environments = request.environments
        if request.name:
            record.name = request.name.strip()
        record.revision += 1
        record.updated_at = utc_now_iso()

        await self._repo.save(record)
        return record.to_view()

    async def delete_workspace(self, workspace_id: str, access_key: str) -> bool:
        await self._authorise(workspace_id, access_key)
        return await self._repo.delete(workspace_id)

    # -------------------------------------------------------------- share
    async def set_share(self, workspace_id: str, access_key: str, enabled: bool) -> ShareResult:
        record = await self._authorise(workspace_id, access_key)

        if not enabled:
            record.share_token = None
        elif not record.share_token:
            record.share_token = secrets.token_urlsafe(18)

        record.updated_at = utc_now_iso()
        await self._repo.save(record)
        return ShareResult(share_token=record.share_token, enabled=bool(record.share_token))

    async def get_shared(self, share_token: str) -> SharedWorkspaceView:
        if not share_token:
            raise NotFoundError("Link chia sẻ không hợp lệ")
        record = await self._repo.find_by_share_token(share_token)
        if record is None:
            raise NotFoundError("Link chia sẻ không tồn tại hoặc đã bị thu hồi")
        return record.to_shared_view()

    # ------------------------------------------------------------ history
    async def list_history(
        self, workspace_id: str, access_key: str, limit: int, offset: int
    ) -> HistoryPage:
        await self._authorise(workspace_id, access_key)
        limit = max(1, min(limit, self._max_history))
        items, total = await self._repo.list_history(workspace_id, limit, max(0, offset))
        return HistoryPage(items=items, total=total)

    async def add_history(
        self, workspace_id: str, access_key: str, entry: HistoryEntry
    ) -> HistoryEntry:
        await self._authorise(workspace_id, access_key)
        if not entry.id:
            entry.id = "h_" + secrets.token_urlsafe(10)
        if not entry.timestamp:
            entry.timestamp = utc_now_iso()
        return await self._repo.append_history(workspace_id, entry, self._max_history)

    async def clear_history(self, workspace_id: str, access_key: str) -> int:
        await self._authorise(workspace_id, access_key)
        return await self._repo.clear_history(workspace_id)
