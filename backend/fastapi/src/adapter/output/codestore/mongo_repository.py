"""MongoDB Code Studio store, the third `CODESTORE_STORAGE_BACKEND`.

For the deployment that has a MongoDB and no MySQL (on a serverless platform the
JSON backend's file is ephemeral). Two collections:

* `codestore_workspaces` - `{_id, key_hash, created_at}`;
* `codestore_items` - one document per record, `_id = "<workspace>:<item id>"`
  (a workspace id never contains `:`, so the pair stays unambiguous), with the
  queried values as top-level fields (`workspace_id`, `item_id`, `updated_at`,
  `server_updated_at`, `deleted`) and the record itself as `payload_json`, a JSON
  *string*. The client's `meta` is opaque data; stored as a nested BSON document a
  key starting with `$` or containing `.` would be rejected or reinterpreted by the
  server, as a string it holds anything.

`upsert_newer` is last-writer-wins done by the server: an `update_one` whose
FILTER carries the rule (`updated_at < new`, or the tie case "same time, a
deletion over an edit"), so comparing and writing are one atomic step. A record
that does not exist yet is inserted; if that loses a race on `_id` the decision is
simply taken again.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.codestore_repository_port import CodestoreRepositoryPort
from src.domain.vo.codestore_vo import CodeItem, WorkspaceRecord

WORKSPACES = "codestore_workspaces"
ITEMS = "codestore_items"


def _key(workspace_id: str, item_id: str) -> str:
    return f"{workspace_id}:{item_id}"


def _document(workspace_id: str, item: CodeItem) -> Dict[str, Any]:
    return {
        "_id": _key(workspace_id, item.id),
        "workspace_id": workspace_id,
        "item_id": item.id,
        "updated_at": item.updatedAt,
        "server_updated_at": item.serverUpdatedAt,
        "deleted": bool(item.deleted),
        "payload_json": json.dumps(item.model_dump(), ensure_ascii=False),
    }


def _item(doc: Dict[str, Any]) -> CodeItem:
    data = json.loads(doc["payload_json"])
    data["serverUpdatedAt"] = int(doc["server_updated_at"])
    return CodeItem(**data)


class MongoCodestoreRepository(CodestoreRepositoryPort):
    def __init__(self) -> None:
        self._indexed = False

    @staticmethod
    def _workspaces() -> Any:
        return mongo_store.get_collection(WORKSPACES)

    async def _items(self) -> Any:
        collection = mongo_store.get_collection(ITEMS)
        if not self._indexed:
            try:
                await collection.create_index([("workspace_id", 1), ("server_updated_at", 1)])
            except Exception:  # noqa: BLE001 - a missing privilege must not break saving
                pass
            self._indexed = True
        return collection

    # ----------------------------------------------------------- workspaces
    async def create_workspace(self, record: WorkspaceRecord) -> None:
        await self._workspaces().insert_one(
            {"_id": record.id, "key_hash": record.key_hash, "created_at": record.created_at}
        )

    async def get_workspace(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        doc = await self._workspaces().find_one({"_id": workspace_id})
        if not doc:
            return None
        return WorkspaceRecord(id=doc["_id"], key_hash=doc["key_hash"], created_at=doc["created_at"])

    async def delete_workspace(self, workspace_id: str) -> bool:
        await (await self._items()).delete_many({"workspace_id": workspace_id})
        result = await self._workspaces().delete_one({"_id": workspace_id})
        return result.deleted_count > 0

    # -------------------------------------------------------------- records
    async def count_items(self, workspace_id: str) -> int:
        return int(await (await self._items()).count_documents({"workspace_id": workspace_id}))

    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, CodeItem]:
        if not ids:
            return {}
        collection = await self._items()
        found: Dict[str, CodeItem] = {}
        async for doc in collection.find({"workspace_id": workspace_id, "item_id": {"$in": list(ids)}}):
            item = _item(doc)
            found[item.id] = item
        return found

    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[CodeItem]:
        collection = await self._items()
        cursor = (
            collection.find({"workspace_id": workspace_id, "server_updated_at": {"$gt": since}})
            .sort([("server_updated_at", 1), ("item_id", 1)])
            .limit(limit)
        )
        return [_item(doc) async for doc in cursor]

    async def upsert_newer(self, workspace_id: str, items: Sequence[CodeItem]) -> List[str]:
        collection = await self._items()
        return [item.id for item in items if await self._upsert_one(collection, workspace_id, item)]

    @staticmethod
    async def _upsert_one(collection: Any, workspace_id: str, item: CodeItem) -> bool:
        document = _document(workspace_id, item)
        key = document["_id"]
        changes = {name: value for name, value in document.items() if name != "_id"}
        for _attempt in range(3):
            newer = await collection.update_one(
                {"_id": key, "updated_at": {"$lt": item.updatedAt}}, {"$set": changes}
            )
            if newer.matched_count:
                return True
            if item.deleted:
                # Same moment: the deletion beats an edit that is still live.
                tie = await collection.update_one(
                    {"_id": key, "updated_at": item.updatedAt, "deleted": False}, {"$set": changes}
                )
                if tie.matched_count:
                    return True
            if await collection.count_documents({"_id": key}) > 0:
                return False                   # it is there, and it wins
            try:
                await collection.insert_one(document)
                return True
            except Exception:  # noqa: BLE001 - a duplicate _id: someone inserted it first
                if await collection.count_documents({"_id": key}) == 0:
                    raise
        return False

    async def purge_tombstones(self, workspace_id: str, before: int) -> int:
        result = await (await self._items()).delete_many(
            {"workspace_id": workspace_id, "deleted": True, "server_updated_at": {"$lt": before}}
        )
        return int(result.deleted_count)
