"""MongoDB store of the markdown share links (collection `markdown_shares`).

One document per link: `_id` is the token (the public read is a lookup by `_id`), the
other fields are the SQL columns in snake_case. A unique index on `doc_id` keeps one
link per document; it is created inside try/except, because a missing privilege must
not break sharing. Listing projects the snapshot (`content`) out.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.markdown_share_repository_port import MarkdownShareRepositoryPort
from src.domain.vo.markdown_share_vo import MarkdownShareRecord, MarkdownShareSummary

COLLECTION = "markdown_shares"
SUMMARY_FIELDS = {
    "doc_id": 1, "title": 1, "mode": 1, "shared_at": 1, "updated_at": 1, "expires_at": 1, "bytes": 1, "content_hash": 1,
}


def _summary(doc: Dict[str, Any]) -> MarkdownShareSummary:
    expires = doc.get("expires_at")
    return MarkdownShareSummary(
        token=doc["_id"], doc_id=doc["doc_id"], title=doc["title"], mode=doc.get("mode") or "snapshot",
        shared_at=int(doc["shared_at"]), updated_at=int(doc["updated_at"]),
        expires_at=int(expires) if expires is not None else None,
        bytes=int(doc.get("bytes") or 0), content_hash=doc.get("content_hash") or "",
    )


class MongoMarkdownShareRepository(MarkdownShareRepositoryPort):
    def __init__(self) -> None:
        self._indexed = False

    async def _collection(self) -> Any:
        collection = mongo_store.get_collection(COLLECTION)
        if not self._indexed:
            try:
                await collection.create_index("doc_id", unique=True)
            except Exception:  # noqa: BLE001 - a missing privilege must not break sharing
                pass
            self._indexed = True
        return collection

    async def get_by_doc(self, doc_id: str) -> Optional[MarkdownShareSummary]:
        doc = await (await self._collection()).find_one({"doc_id": doc_id})
        return _summary(doc) if doc else None

    async def save(self, record: MarkdownShareRecord) -> MarkdownShareSummary:
        collection = await self._collection()
        where = {"doc_id": record.doc_id}
        refresh = {
            "title": record.title, "mode": record.mode, "updated_at": record.updated_at, "expires_at": record.expires_at,
            "bytes": record.bytes, "content_hash": record.content_hash, "content": record.content,
        }
        for _attempt in range(3):
            if await collection.find_one(where) is not None:
                # One link per document: its token and `shared_at` stay.
                await collection.update_one(where, {"$set": refresh})
            else:
                try:
                    await collection.insert_one({"_id": record.token, **where, **refresh, "shared_at": record.shared_at})
                except Exception:  # noqa: BLE001 - a duplicate: another request made the link first
                    if await collection.find_one(where) is None:
                        raise
                    continue
            stored = await collection.find_one(where)
            if stored is not None:
                return _summary(stored)
        raise RuntimeError("could not save the share link")

    async def count(self) -> int:
        return int(await (await self._collection()).count_documents({}))

    async def list(self) -> List[MarkdownShareSummary]:
        cursor = (await self._collection()).find({}, SUMMARY_FIELDS).sort([("shared_at", -1), ("doc_id", 1)])
        return [_summary(doc) async for doc in cursor]

    async def get(self, token: str) -> Optional[MarkdownShareRecord]:
        doc = await (await self._collection()).find_one({"_id": token})
        if not doc:
            return None
        return MarkdownShareRecord(**_summary(doc).model_dump(), content=doc.get("content"))

    async def delete_by_doc(self, doc_id: str) -> bool:
        result = await (await self._collection()).delete_one({"doc_id": doc_id})
        return result.deleted_count > 0

    async def purge_expired(self, now: int) -> int:
        result = await (await self._collection()).delete_many({"expires_at": {"$lte": int(now)}})
        return int(result.deleted_count)

    async def rename_docs(self, mapping: Dict[str, str]) -> int:
        collection = await self._collection()
        moved = 0
        for old, new in mapping.items():
            if await collection.find_one({"doc_id": new}) is not None:
                continue                                # the new id already has a link
            result = await collection.update_one({"doc_id": old}, {"$set": {"doc_id": new}})
            moved += int(getattr(result, "matched_count", 0) or 0)
        return moved
