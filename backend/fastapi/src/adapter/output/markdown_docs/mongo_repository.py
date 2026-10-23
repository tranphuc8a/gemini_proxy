"""MongoDB store of the markdown delta sync (md-sync B5).

Three collections: `markdown_docs` (`_id = "<space>:<id>"`, the record's fields plus `space`),
`markdown_doc_revisions` (`_id = "<space>:<id>:<rev>"`) and `markdown_meta` (`_id =
"<space>:<key>"`, field `v`). Indexes (`space, serverUpdatedAt` and `space, docId, rev`) are
created inside try/except: a missing privilege must not break sync. Compare-and-set is
`update_one({_id, rev: expected}, {$set: ...})`, read through `matched_count`; a duplicate
`_id` on insert is the answer "it is there".

History listings project the body out by NAMING the fields to keep (an inclusion projection),
so they never move a megabyte keyframe.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.markdown_docs_repository_port import MarkdownDocsRepositoryPort
from src.domain.vo.markdown_docs_vo import DocRecord, Revision

DOCS = "markdown_docs"
REVISIONS = "markdown_doc_revisions"
META = "markdown_meta"

_DOC_FIELDS = list(DocRecord.model_fields)
_REV_META_FIELDS = [name for name in Revision.model_fields if name != "body"]
_REV_META_PROJECTION = {name: 1 for name in _REV_META_FIELDS}


def _doc_key(space: str, doc_id: str) -> str:
    return f"{space}:{doc_id}"


def _rev_key(space: str, doc_id: str, rev: int) -> str:
    return f"{space}:{doc_id}:{rev}"


def _to_doc(raw: Dict[str, Any]) -> DocRecord:
    return DocRecord(**{name: raw[name] for name in _DOC_FIELDS if name in raw})


def _to_revision(raw: Dict[str, Any]) -> Revision:
    return Revision(**{name: raw[name] for name in Revision.model_fields if name in raw})


class MongoMarkdownDocsRepository(MarkdownDocsRepositoryPort):
    def __init__(self) -> None:
        self._indexed = False

    async def _collection(self, name: str) -> Any:
        collection = mongo_store.get_collection(name)
        if not self._indexed and name == DOCS:
            self._indexed = True
            try:
                await collection.create_index([("space", 1), ("serverUpdatedAt", 1)])
                await mongo_store.get_collection(REVISIONS).create_index([("space", 1), ("docId", 1), ("rev", 1)])
            except Exception:  # noqa: BLE001 - an optimisation, not a correctness condition
                pass
        return collection

    @staticmethod
    def _doc_dump(space: str, record: DocRecord) -> Dict[str, Any]:
        return {"_id": _doc_key(space, record.id), "space": space, **record.model_dump()}

    # ----------------------------------------------------------- documents
    async def get(self, space: str, doc_id: str) -> Optional[DocRecord]:
        raw = await (await self._collection(DOCS)).find_one({"_id": _doc_key(space, doc_id)})
        return _to_doc(raw) if raw else None

    async def get_many(self, space: str, ids: Sequence[str]) -> Dict[str, DocRecord]:
        if not ids:
            return {}
        keys = [_doc_key(space, doc_id) for doc_id in ids]
        found: Dict[str, DocRecord] = {}
        async for raw in (await self._collection(DOCS)).find({"_id": {"$in": keys}}):
            record = _to_doc(raw)
            found[record.id] = record
        return found

    async def list_since(self, space: str, since: int, limit: int, include_deleted: bool) -> List[DocRecord]:
        query: Dict[str, Any] = {"space": space, "serverUpdatedAt": {"$gt": int(since)}}
        if not include_deleted:
            query["deleted"] = False
        cursor = (await self._collection(DOCS)).find(query).sort([("serverUpdatedAt", 1), ("id", 1)]).limit(max(0, int(limit)))
        return [_to_doc(raw) async for raw in cursor]

    async def list_live(self, space: str) -> List[DocRecord]:
        cursor = (await self._collection(DOCS)).find({"space": space, "deleted": False})
        return [_to_doc(raw) async for raw in cursor]

    async def insert(self, space: str, record: DocRecord) -> bool:
        collection = await self._collection(DOCS)
        try:
            await collection.insert_one(self._doc_dump(space, record))
            return True
        except Exception:  # noqa: BLE001 - a duplicate key is "someone inserted it first"; anything else is real
            if await collection.find_one({"_id": _doc_key(space, record.id)}) is None:
                raise
            return False

    async def cas_write(self, space: str, record: DocRecord, expected_rev: int) -> bool:
        fields = record.model_dump()
        result = await (await self._collection(DOCS)).update_one(
            {"_id": _doc_key(space, record.id), "rev": int(expected_rev)}, {"$set": fields}
        )
        return int(getattr(result, "matched_count", 0)) == 1

    async def count(self, space: str) -> int:
        return int(await (await self._collection(DOCS)).count_documents({"space": space}))

    async def purge_tombstones(self, space: str, before: int) -> List[str]:
        collection = await self._collection(DOCS)
        query = {"space": space, "deleted": True, "serverUpdatedAt": {"$lt": int(before)}}
        ids = sorted([raw["id"] async for raw in collection.find(query, {"id": 1})])
        if ids:
            revisions = await self._collection(REVISIONS)
            for start in range(0, len(ids), 1000):       # history first: no orphan rows if this is cut short
                await revisions.delete_many({"space": space, "docId": {"$in": ids[start:start + 1000]}})
            await collection.delete_many(query)
        return ids

    # ------------------------------------------------------------- history
    async def add_revision(self, space: str, revision: Revision) -> None:
        collection = await self._collection(REVISIONS)
        key = _rev_key(space, revision.docId, revision.rev)
        await collection.delete_one({"_id": key})
        await collection.insert_one({"_id": key, "space": space, **revision.model_dump()})

    async def list_revisions(self, space: str, doc_id: str) -> List[Revision]:
        cursor = (await self._collection(REVISIONS)).find({"space": space, "docId": doc_id}, _REV_META_PROJECTION).sort("rev", 1)
        return [_to_revision(raw) async for raw in cursor]

    async def get_revision(self, space: str, doc_id: str, rev: int) -> Optional[Revision]:
        raw = await (await self._collection(REVISIONS)).find_one({"_id": _rev_key(space, doc_id, int(rev))})
        return _to_revision(raw) if raw else None

    async def latest_keyframe(self, space: str, doc_id: str) -> Optional[Revision]:
        cursor = (await self._collection(REVISIONS)).find(
            {"space": space, "docId": doc_id, "encoding": "full"}
        ).sort("rev", -1).limit(1)
        async for raw in cursor:
            return _to_revision(raw)
        return None

    async def delete_revisions(self, space: str, doc_id: str, revs: Sequence[int]) -> None:
        if revs:
            await (await self._collection(REVISIONS)).delete_many(
                {"_id": {"$in": [_rev_key(space, doc_id, int(rev)) for rev in revs]}}
            )

    async def delete_all_revisions(self, space: str, doc_id: str) -> None:
        await (await self._collection(REVISIONS)).delete_many({"space": space, "docId": doc_id})

    # ---------------------------------------------------------------- meta
    async def get_meta(self, space: str, key: str) -> Optional[str]:
        raw = await (await self._collection(META)).find_one({"_id": f"{space}:{key}"})
        return raw.get("v") if raw else None

    async def put_meta_if_absent(self, space: str, key: str, value: str) -> bool:
        collection = await self._collection(META)
        try:
            await collection.insert_one({"_id": f"{space}:{key}", "space": space, "k": key, "v": value})
            return True
        except Exception:  # noqa: BLE001
            if await collection.find_one({"_id": f"{space}:{key}"}) is None:
                raise
            return False

    async def put_meta(self, space: str, key: str, value: str) -> None:
        await (await self._collection(META)).update_one(
            {"_id": f"{space}:{key}"}, {"$set": {"space": space, "k": key, "v": value}}, upsert=True
        )
