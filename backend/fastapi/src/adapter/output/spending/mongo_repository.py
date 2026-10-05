"""MongoDB spending store, the third `SPENDING_STORAGE_BACKEND`.

For the deployment that has a MongoDB and no MySQL -- on a serverless platform
the JSON backend's file is ephemeral, so "no database" and "no persistence" are
the same thing there.

One collection, one document per workspace: the envelope (identity, revision,
access) as top-level fields and the client's ledger as `payload_json`, a JSON
*string*. The ledger is opaque, client-supplied data. Stored as a nested BSON
document, a key that starts with `$` or contains `.` would be rejected or
reinterpreted by the server; as a string it can hold anything the client writes,
and it matches the single LONGTEXT column of the SQL adapter.

`replace_if_revision` is one `update_one` whose filter carries the expected
revision. MongoDB applies a single-document update atomically, so of two saves
from the same base revision only one matches.

No indexes: every read is by `_id`, which MongoDB indexes already.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.spending_repository_port import SpendingRepositoryPort
from src.domain.vo.spending_vo import SpendingRecord

WORKSPACES = "spending_workspaces"


class MongoSpendingRepository(SpendingRepositoryPort):
    @staticmethod
    def _collection() -> Any:
        return mongo_store.get_collection(WORKSPACES)

    # ---------------------------------------------------------- (de)serialise
    @staticmethod
    def _to_document(record: SpendingRecord) -> Dict[str, Any]:
        return {
            "_id": record.id,
            "name": record.name,
            "key_hash": record.key_hash,
            "revision": record.revision,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "payload_json": json.dumps(record.data, ensure_ascii=False),
        }

    @staticmethod
    def _from_document(doc: Dict[str, Any]) -> SpendingRecord:
        try:
            data = json.loads(doc.get("payload_json") or "{}")
        except (TypeError, ValueError):
            data = {}
        return SpendingRecord(
            id=doc["_id"],
            name=doc["name"],
            key_hash=doc["key_hash"],
            revision=int(doc["revision"]),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            data=data if isinstance(data, dict) else {},
        )

    # ----------------------------------------------------------- workspace
    async def create(self, record: SpendingRecord) -> SpendingRecord:
        await self._collection().insert_one(self._to_document(record))
        return record

    async def get(self, workspace_id: str) -> Optional[SpendingRecord]:
        doc = await self._collection().find_one({"_id": workspace_id})
        return self._from_document(doc) if doc else None

    async def replace_if_revision(self, record: SpendingRecord, expected_revision: int) -> bool:
        document = self._to_document(record)
        # Identity, key hash and creation time never change after creation.
        changes = {key: document[key] for key in ("name", "revision", "updated_at", "payload_json")}
        result = await self._collection().update_one(
            {"_id": record.id, "revision": expected_revision}, {"$set": changes}
        )
        return result.matched_count == 1

    async def delete(self, workspace_id: str) -> bool:
        result = await self._collection().delete_one({"_id": workspace_id})
        return result.deleted_count > 0
