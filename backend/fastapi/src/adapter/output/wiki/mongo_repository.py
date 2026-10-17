"""MongoDB Personal Wiki store, the third `WIKI_STORAGE_BACKEND`.

For the deployment that has a MongoDB and no MySQL (on a serverless platform the
JSON backend's file is ephemeral). Two collections:

* `wiki_workspaces` - `{_id, keyHash, createdAt}`;
* `wiki_items` - one document per record, `_id = "<workspace>:<item id>"` (a
  workspace id never contains `:`, so the pair stays unambiguous), with the
  queried values as top-level fields (`workspaceId`, `itemId`, `kind`, `updatedAt`,
  `serverUpdatedAt`, `deleted`) and the client's opaque `data` object as `dataJson`,
  a JSON *string*. Stored as a nested BSON document a key starting with `$` or
  containing `.` would be rejected or reinterpreted by the server (and a note's
  `data` is whatever the browser built); as a string it holds anything. A record is
  well under BSON's 16 MB document limit (`MAX_ITEM_BYTES` is 1.6 MB).

The sync query is served by a compound index on (`workspaceId`, `serverUpdatedAt`).

`upsert_newer` is last-writer-wins done by the server: an `update_one` whose
FILTER carries the rule (`updatedAt < new`, or the tie case "same time, a
deletion over an edit"), so comparing and writing are one atomic step. A record
that does not exist yet is inserted; if that loses a race on `_id` the decision is
simply taken again.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.wiki_repository_port import WikiRepositoryPort
from src.domain.vo.wiki_vo import Record, WorkspaceRecord

WORKSPACES = "wiki_workspaces"
ITEMS = "wiki_items"


def _key(workspace_id: str, item_id: str) -> str:
    return f"{workspace_id}:{item_id}"


def _document(workspace_id: str, item: Record) -> Dict[str, Any]:
    return {
        "_id": _key(workspace_id, item.id),
        "workspaceId": workspace_id,
        "itemId": item.id,
        "kind": item.kind,
        "updatedAt": item.updatedAt,
        "serverUpdatedAt": item.serverUpdatedAt,
        "deleted": bool(item.deleted),
        "dataJson": json.dumps(item.data, ensure_ascii=False),
    }


def _item(doc: Dict[str, Any]) -> Record:
    return Record(
        id=doc["itemId"], kind=doc["kind"], updatedAt=int(doc["updatedAt"]), deleted=bool(doc["deleted"]),
        data=json.loads(doc["dataJson"] or "{}"), serverUpdatedAt=int(doc["serverUpdatedAt"]),
    )


class MongoWikiRepository(WikiRepositoryPort):
    def __init__(self) -> None:
        self._indexed = False

    @staticmethod
    def _workspaces() -> Any:
        return mongo_store.get_collection(WORKSPACES)

    async def _items(self) -> Any:
        collection = mongo_store.get_collection(ITEMS)
        if not self._indexed:
            try:
                await collection.create_index([("workspaceId", 1), ("serverUpdatedAt", 1)])
            except Exception:  # noqa: BLE001 - a missing privilege must not break saving
                pass
            self._indexed = True
        return collection

    # ----------------------------------------------------------- workspaces
    async def create_workspace(self, record: WorkspaceRecord) -> None:
        await self._workspaces().insert_one(
            {"_id": record.id, "keyHash": record.key_hash, "createdAt": record.created_at}
        )

    async def get_workspace(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        doc = await self._workspaces().find_one({"_id": workspace_id})
        if not doc:
            return None
        return WorkspaceRecord(id=doc["_id"], key_hash=doc["keyHash"], created_at=doc["createdAt"])

    async def delete_workspace(self, workspace_id: str) -> bool:
        await (await self._items()).delete_many({"workspaceId": workspace_id})
        result = await self._workspaces().delete_one({"_id": workspace_id})
        return result.deleted_count > 0

    # -------------------------------------------------------------- records
    async def count_items(self, workspace_id: str) -> int:
        return int(await (await self._items()).count_documents({"workspaceId": workspace_id}))

    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, Record]:
        if not ids:
            return {}
        collection = await self._items()
        found: Dict[str, Record] = {}
        async for doc in collection.find({"workspaceId": workspace_id, "itemId": {"$in": list(ids)}}):
            item = _item(doc)
            found[item.id] = item
        return found

    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[Record]:
        collection = await self._items()
        cursor = (
            collection.find({"workspaceId": workspace_id, "serverUpdatedAt": {"$gt": since}})
            .sort([("serverUpdatedAt", 1), ("itemId", 1)])
            .limit(limit)
        )
        return [_item(doc) async for doc in cursor]

    async def upsert_newer(self, workspace_id: str, items: Sequence[Record]) -> List[str]:
        collection = await self._items()
        return [item.id for item in items if await self._upsert_one(collection, workspace_id, item)]

    @staticmethod
    async def _upsert_one(collection: Any, workspace_id: str, item: Record) -> bool:
        document = _document(workspace_id, item)
        key = document["_id"]
        changes = {name: value for name, value in document.items() if name != "_id"}
        for _attempt in range(3):
            newer = await collection.update_one(
                {"_id": key, "updatedAt": {"$lt": item.updatedAt}}, {"$set": changes}
            )
            if newer.matched_count:
                return True
            if item.deleted:
                # Same moment: the deletion beats an edit that is still live.
                tie = await collection.update_one(
                    {"_id": key, "updatedAt": item.updatedAt, "deleted": False}, {"$set": changes}
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

    async def delete_old_tombstones(self, workspace_id: str, before: int) -> int:
        result = await (await self._items()).delete_many(
            {"workspaceId": workspace_id, "deleted": True, "serverUpdatedAt": {"$lt": before}}
        )
        return int(result.deleted_count)
