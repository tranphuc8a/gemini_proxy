"""Outbound port: where spending workspaces live.

Three adapters implement this - a JSON file, a MySQL table and a MongoDB
collection - selected by `SPENDING_STORAGE_BACKEND` or `?backend=`. The contract
is deliberately four methods: the server never looks inside a document, so there
is nothing to query.

Unlike the postman port there is no unconditional `save`. Money data is edited
from several devices, and a read-check-write in the usecase leaves a window in
which two saves both pass the revision check and one silently overwrites the
other. `replace_if_revision` closes it: the comparison and the write are one
atomic step in the store.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.vo.spending_vo import SpendingRecord


class SpendingRepositoryPort(ABC):
    @abstractmethod
    async def create(self, record: SpendingRecord) -> SpendingRecord:
        ...

    @abstractmethod
    async def get(self, workspace_id: str) -> Optional[SpendingRecord]:
        """A copy the caller may mutate, or None when the workspace is absent."""

    @abstractmethod
    async def replace_if_revision(self, record: SpendingRecord, expected_revision: int) -> bool:
        """Atomic compare-and-set.

        Writes `record`'s name, revision, updated_at and data over the stored
        document **only if** the stored revision still equals `expected_revision`
        at the moment of the write, and says whether it did. The id, key hash and
        creation time are immutable: the values on `record` for them are ignored.
        Returns False both when another save won the race and when the workspace
        no longer exists; the usecase re-reads to tell the two apart.
        """

    @abstractmethod
    async def delete(self, workspace_id: str) -> bool:
        ...
