"""Workspace use cases for the personal-spending app.

Four rules live here, and nowhere else:

1. **Access.** A workspace is reachable only with the key handed out at
   creation. Only its SHA-256 is stored, so a leaked JSON file or a dumped table
   does not hand over anybody's finances. "Does not exist" (404) is answered
   before "wrong key" (401), so a caller cannot probe which ids exist.
2. **Size and type.** The document must be a JSON object no larger than
   `max_bytes` once serialised. A serverless platform rejects larger request
   bodies anyway; refusing here gives the same answer on every deployment.
3. **Revisions.** Every save states the revision it was based on. If the stored
   revision has moved on, the save is refused with the current document attached
   so the client can merge instead of overwriting another device's work.
4. **No lost updates.** Comparing revisions here is only an early exit: two saves
   can both pass it. The store's `replace_if_revision` is the real guard, and
   when it reports that another save got there first the answer is the same 409.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from src.application.exceptions.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.input.spending_input_port import SpendingInputPort
from src.application.ports.output.spending_repository_port import SpendingRepositoryPort
from src.domain.vo.spending_vo import (
    DEFAULT_MAX_DATA_BYTES,
    DEFAULT_NAME,
    SpendingCreated,
    SpendingCreateRequest,
    SpendingRecord,
    SpendingSaveRequest,
    SpendingView,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# Defined here rather than imported from the postman use case: the digest is
# persisted, so it must not change because an unrelated feature was edited.
def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


class SpendingUseCase(SpendingInputPort):
    def __init__(self, repository: SpendingRepositoryPort, max_bytes: int = DEFAULT_MAX_DATA_BYTES):
        self._repo = repository
        self._max_bytes = max(1, max_bytes)

    # ------------------------------------------------------------- helpers
    async def _authorise(self, workspace_id: str, access_key: str) -> SpendingRecord:
        record = await self._repo.get(workspace_id)
        if record is None:
            raise NotFoundError("Sổ chi tiêu không tồn tại")
        if not access_key:
            raise UnauthorizedError("Thiếu header X-Workspace-Key")
        # compare_digest keeps the check constant-time, so the response latency
        # does not leak how much of a guessed key was correct.
        if not secrets.compare_digest(hash_key(access_key), record.key_hash):
            raise UnauthorizedError("Access key không đúng")
        return record

    def _check_data(self, data: Any) -> None:
        if not isinstance(data, dict):
            raise BadRequestError("Dữ liệu phải là một đối tượng JSON")
        try:
            size = len(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        except (TypeError, ValueError) as exc:
            raise BadRequestError("Dữ liệu không thể chuyển thành JSON") from exc
        if size > self._max_bytes:
            raise BadRequestError(
                f"Dữ liệu quá lớn ({size} byte, tối đa {self._max_bytes}). "
                "Hãy xuất sao lưu rồi xóa bớt dữ liệu cũ."
            )

    @staticmethod
    def _conflict(current: SpendingRecord) -> ConflictError:
        # Hand back the current document: the client can then merge and retry,
        # which is the whole point of refusing rather than blocking.
        return ConflictError(
            "Sổ chi tiêu đã được lưu từ nơi khác. Hãy gộp thay đổi rồi lưu lại.",
            payload={"current": current.to_view().model_dump()},
        )

    # ----------------------------------------------------------- workspace
    async def create_workspace(self, request: SpendingCreateRequest) -> SpendingCreated:
        data = request.data if request.data is not None else {}
        self._check_data(data)

        now = utc_now_iso()
        access_key = secrets.token_urlsafe(24)
        record = SpendingRecord(
            id="sp_" + secrets.token_urlsafe(12),
            name=request.name.strip() or DEFAULT_NAME,
            key_hash=hash_key(access_key),
            revision=1,
            created_at=now,
            updated_at=now,
            data=data,
        )
        await self._repo.create(record)
        return SpendingCreated(
            id=record.id,
            name=record.name,
            access_key=access_key,
            revision=record.revision,
            created_at=record.created_at,
        )

    async def get_workspace(
        self, workspace_id: str, access_key: str, since: Optional[int] = None
    ) -> SpendingView:
        record = await self._authorise(workspace_id, access_key)
        if since is not None and since == record.revision:
            # The client polls; answering without the document keeps an idle
            # poll to a few hundred bytes instead of up to megabytes.
            return SpendingView(
                id=record.id,
                name=record.name,
                revision=record.revision,
                created_at=record.created_at,
                updated_at=record.updated_at,
                data=None,
                unchanged=True,
            )
        return record.to_view()

    async def save_workspace(
        self, workspace_id: str, access_key: str, request: SpendingSaveRequest
    ) -> SpendingView:
        record = await self._authorise(workspace_id, access_key)
        self._check_data(request.data)

        name = record.name
        if request.name is not None:
            name = request.name.strip()
            if not name:
                raise BadRequestError("Tên sổ không được để trống")

        if request.revision != record.revision:
            raise self._conflict(record)

        updated = SpendingRecord(
            id=record.id,
            name=name,
            key_hash=record.key_hash,
            revision=record.revision + 1,
            created_at=record.created_at,
            updated_at=utc_now_iso(),
            data=request.data,
        )
        if not await self._repo.replace_if_revision(updated, expected_revision=record.revision):
            # Someone else saved between our read and our write. Report what
            # they stored, not what we read, so the client merges against it.
            fresh = await self._repo.get(workspace_id)
            if fresh is None:
                raise NotFoundError("Sổ chi tiêu không tồn tại")
            raise self._conflict(fresh)
        return updated.to_view()

    async def delete_workspace(self, workspace_id: str, access_key: str) -> bool:
        await self._authorise(workspace_id, access_key)
        return await self._repo.delete(workspace_id)
