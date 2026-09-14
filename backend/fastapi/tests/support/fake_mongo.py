"""A tiny in-memory stand-in for the slice of PyMongo's async API we use.

Running the MongoDB adapters against a real server would make the suite depend
on one being installed, and mocking each call individually would test the mock
rather than the adapter. This fake implements the handful of operations the
adapters actually issue -- equality and `$in` filters, `$set` updates, sort/skip/
limit cursors, projections and `count_documents` -- so the adapter's own
serialisation, paging and trimming logic runs for real.

It is deliberately not a MongoDB: anything an adapter starts relying on that is
not here should be added, and anything it cannot express is a sign the adapter
has grown a query worth looking at.
"""

from __future__ import annotations

import copy
from typing import Any, Dict, Iterable, List


def _matches(document: Dict[str, Any], query: Dict[str, Any]) -> bool:
    for field, condition in query.items():
        value = document.get(field)
        if isinstance(condition, dict):
            if "$in" in condition and value not in condition["$in"]:
                return False
            unsupported = set(condition) - {"$in"}
            if unsupported:
                raise NotImplementedError(f"fake_mongo does not implement {sorted(unsupported)}")
        elif value != condition:
            return False
    return True


def _project(document: Dict[str, Any], projection: Dict[str, Any] | None) -> Dict[str, Any]:
    if not projection:
        return copy.deepcopy(document)
    keep = {field for field, flag in projection.items() if flag}
    keep.add("_id")
    return {field: copy.deepcopy(value) for field, value in document.items() if field in keep}


class _Cursor:
    """Holds whole documents and projects only on the way out.

    Sorting is a server-side step in MongoDB and sees every field, whether or
    not the projection returns it -- the history trim sorts by `timestamp` while
    asking for `_id` alone, and projecting first would leave nothing to sort on.
    """

    def __init__(self, documents: List[Dict[str, Any]], projection: Dict[str, Any] | None = None):
        self._documents = documents
        self._projection = projection

    def sort(self, field: Any, direction: int = 1) -> "_Cursor":
        if isinstance(field, list):
            # [(field, direction), ...] -- applied right to left, so the first
            # key of the list ends up as the primary one.
            for key, key_direction in reversed(field):
                self._documents.sort(key=lambda doc, k=key: doc.get(k), reverse=key_direction < 0)
            return self
        self._documents.sort(key=lambda doc: doc.get(field), reverse=direction < 0)
        return self

    def skip(self, count: int) -> "_Cursor":
        self._documents = self._documents[count:]
        return self

    def limit(self, count: int) -> "_Cursor":
        self._documents = self._documents[:count]
        return self

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for document in self._documents:
            yield _project(document, self._projection)


class _Result:
    def __init__(self, deleted_count: int = 0, modified_count: int = 0):
        self.deleted_count = deleted_count
        self.modified_count = modified_count


class FakeCollection:
    def __init__(self) -> None:
        self.documents: Dict[Any, Dict[str, Any]] = {}
        self.indexes: List[Any] = []

    # --- writes ----------------------------------------------------------
    async def create_index(self, keys: Any, **_options: Any) -> str:
        self.indexes.append(keys)
        return "index"

    async def insert_one(self, document: Dict[str, Any]) -> Any:
        key = document["_id"]
        if key in self.documents:
            raise KeyError(f"duplicate _id {key!r}")
        self.documents[key] = copy.deepcopy(document)
        return _Result()

    async def insert_many(self, documents: Iterable[Dict[str, Any]]) -> Any:
        for document in documents:
            await self.insert_one(document)
        return _Result()

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> Any:
        unsupported = set(update) - {"$set"}
        if unsupported:
            raise NotImplementedError(f"fake_mongo does not implement {sorted(unsupported)}")
        for document in self.documents.values():
            if _matches(document, query):
                document.update(copy.deepcopy(update.get("$set", {})))
                return _Result(modified_count=1)

        if not upsert:
            return _Result()
        # An upsert with no match inserts the equality fields of the query plus
        # the $set fields, which is what MongoDB does and what the callers rely
        # on to mint a document under the _id they asked for.
        created = {field: value for field, value in query.items() if not isinstance(value, dict)}
        created.update(copy.deepcopy(update.get("$set", {})))
        if "_id" not in created:
            raise NotImplementedError("fake_mongo cannot generate an _id for an upsert")
        self.documents[created["_id"]] = created
        return _Result(modified_count=1)

    async def delete_one(self, query: Dict[str, Any]) -> Any:
        for key, document in self.documents.items():
            if _matches(document, query):
                del self.documents[key]
                return _Result(deleted_count=1)
        return _Result()

    async def delete_many(self, query: Dict[str, Any]) -> Any:
        doomed = [key for key, document in self.documents.items() if _matches(document, query)]
        for key in doomed:
            del self.documents[key]
        return _Result(deleted_count=len(doomed))

    # --- reads -----------------------------------------------------------
    async def find_one(self, query: Dict[str, Any]) -> Dict[str, Any] | None:
        for document in self.documents.values():
            if _matches(document, query):
                return copy.deepcopy(document)
        return None

    def find(self, query: Dict[str, Any] | None = None, projection: Dict[str, Any] | None = None) -> _Cursor:
        matched = [
            copy.deepcopy(document)
            for document in self.documents.values()
            if _matches(document, query or {})
        ]
        return _Cursor(matched, projection)

    async def count_documents(self, query: Dict[str, Any]) -> int:
        return sum(1 for document in self.documents.values() if _matches(document, query))


class FakeDatabase:
    def __init__(self) -> None:
        self._collections: Dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self._collections.setdefault(name, FakeCollection())


def install(monkeypatch, module) -> FakeDatabase:
    """Point a module's `mongo_store` at a fresh in-memory database."""
    database = FakeDatabase()
    monkeypatch.setattr(module.mongo_store, "is_configured", lambda: True)
    monkeypatch.setattr(module.mongo_store, "get_database", lambda: database)
    monkeypatch.setattr(module.mongo_store, "get_collection", lambda name: database[name])
    return database
