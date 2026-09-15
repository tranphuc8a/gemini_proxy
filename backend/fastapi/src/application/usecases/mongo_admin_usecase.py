"""MongoDB administrator use cases: sessions, browsing, document editing, console.

Everything the browser sends is Extended JSON and everything it receives is
Extended JSON; converting between that and BSON is this layer's job, as is
deciding which operations are safe enough to expose at all.
"""

from __future__ import annotations

import csv
import io
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from src.application.exceptions.exceptions import BadRequestError, ConflictError, NotFoundError, UnauthorizedError
from src.application.ports.input.mongo_admin_input_port import MongoAdminInputPort
from src.application.ports.output.mongo_gateway_output_port import (
    MongoConnectionProfile,
    MongoGatewayOutputPort,
)
from src.application.ports.output.mongo_session_output_port import (
    MongoSessionOutputPort,
    StoredMongoSession,
)
from src.domain.utils.mongo_json import (
    ExtendedJsonError,
    InvalidNamespaceError,
    coerce_document,
    coerce_documents,
    coerce_pipeline,
    collect_field_names,
    flatten_for_csv,
    from_extended_json,
    is_reserved_database,
    is_update_operator_document,
    normalise_sort,
    to_extended_json,
    validate_collection_name,
    validate_database_name,
)
from src.domain.utils.mongo_uri import (
    InvalidConnectionStringError,
    build_uri,
    describe,
    parse_uri,
)
from src.domain.vo.mongoadmin_vo import (
    MongoBackupRequest,
    MongoBackupResult,
    MongoRestoreRequest,
    MongoRestoreResult,
    AggregateRequest,
    CollectionInfo,
    CommandRequest,
    CommandResult,
    ConnectRequest,
    CountRequest,
    CreateCollectionRequest,
    CreateDatabaseRequest,
    CreateIndexRequest,
    DatabaseInfo,
    DeleteRequest,
    DocumentPage,
    FindRequest,
    IndexInfo,
    InsertRequest,
    MutationResult,
    OperationInfo,
    RenameCollectionRequest,
    ServerOverview,
    SessionInfo,
    StatsResult,
    UpdateRequest,
)

# Index key directions MongoDB accepts beyond the usual 1 / -1.
_SPECIAL_INDEX_TYPES = {"text", "hashed", "2d", "2dsphere", "geoHaystack"}

_EXPORT_FORMATS = {
    "json": ("application/json", "json"),
    "jsonl": ("application/x-ndjson", "jsonl"),
    "csv": ("text/csv", "csv"),
}

# Enriching a collection listing costs one round trip per collection, so it is
# opt-in and capped: a server with thousands of collections must stay usable.
MAX_ENRICHED_COLLECTIONS = 60


def _wrap_value_errors(func):
    """Turn the domain's validation errors into 400s, preserving the message."""

    def _inner(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except (InvalidNamespaceError, ExtendedJsonError, InvalidConnectionStringError) as exc:
            raise BadRequestError(str(exc)) from exc

    return _inner


_db_name = _wrap_value_errors(validate_database_name)
_coll_name = _wrap_value_errors(validate_collection_name)
_document = _wrap_value_errors(coerce_document)
_documents = _wrap_value_errors(coerce_documents)
_pipeline = _wrap_value_errors(coerce_pipeline)
_sort = _wrap_value_errors(normalise_sort)
_is_operator_update = _wrap_value_errors(is_update_operator_document)



def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


#: Documents per insert during a restore. One insert_many of a hundred thousand
#: documents can exceed MongoDB's 48MB command limit, and a failure there loses
#: the whole collection instead of one batch.
_RESTORE_BATCH = 500


class MongoAdminUseCase(MongoAdminInputPort):
    def __init__(
        self,
        gateway: MongoGatewayOutputPort,
        sessions: MongoSessionOutputPort,
        max_documents_hard_limit: int = 1000,
        allow_reserved_database_drop: bool = False,
    ):
        self._gateway = gateway
        self._sessions = sessions
        self._max_documents = max_documents_hard_limit
        self._allow_reserved_database_drop = allow_reserved_database_drop

    # ------------------------------------------------------------------
    # session
    # ------------------------------------------------------------------
    async def connect(self, request: ConnectRequest) -> SessionInfo:
        profile = self._build_profile(request)
        facts = await self._gateway.probe(profile)

        session = StoredMongoSession(
            token=secrets.token_urlsafe(32),
            profile=profile,
            label=request.label or describe(profile.uri),
            server_version=facts.get("server_version") or None,
            server_flavor=facts.get("server_flavor") or None,
            topology=facts.get("topology") or None,
            metadata={
                "current_user": facts.get("current_user"),
                "host": facts.get("host"),
                "max_wire_version": facts.get("max_wire_version"),
            },
        )
        stored = await self._sessions.create(session)
        return self._to_session_info(stored)

    @staticmethod
    def _build_profile(request: ConnectRequest) -> MongoConnectionProfile:
        """Turn either a pasted URI or the individual fields into one profile."""
        try:
            if request.uri and request.uri.strip():
                uri = request.uri.strip()
                parts = parse_uri(uri)
            else:
                if request.database:
                    validate_database_name(request.database)
                uri = build_uri(
                    host=request.host,
                    port=request.port,
                    username=request.username or None,
                    password=request.password or None,
                    database=request.database or None,
                    auth_source=request.auth_source or None,
                    auth_mechanism=request.auth_mechanism or None,
                    replica_set=request.replica_set or None,
                    tls=request.tls,
                    srv=request.srv,
                    direct_connection=request.direct_connection,
                )
                parts = parse_uri(uri)
        except (InvalidConnectionStringError, InvalidNamespaceError) as exc:
            raise BadRequestError(str(exc)) from exc

        return MongoConnectionProfile(
            uri=uri,
            host=parts["host"],
            port=parts["port"],
            username=parts["username"],
            database=parts["database"],
            auth_source=parts["auth_source"],
            tls=bool(parts["tls"]),
            srv=bool(parts["srv"]),
            options=parts["options"],
        )

    async def current_session(self, token: str) -> SessionInfo:
        return self._to_session_info(await self._require_session(token))

    async def disconnect(self, token: str) -> bool:
        session = await self._sessions.get(token)
        if session is None:
            return False
        await self._gateway.release(token)
        return await self._sessions.delete(token)

    @staticmethod
    def _to_session_info(session: StoredMongoSession) -> SessionInfo:
        return SessionInfo(
            token=session.token,
            host=session.profile.host,
            port=session.profile.port,
            username=session.profile.username,
            database=session.profile.database,
            auth_source=session.profile.auth_source,
            tls=session.profile.tls,
            srv=session.profile.srv,
            label=session.label,
            server_version=session.server_version,
            server_flavor=session.server_flavor,
            topology=session.topology,
            connected_at=session.connected_at,
            last_used_at=session.last_used_at,
        )

    async def _require_session(self, token: str) -> StoredMongoSession:
        if not token:
            raise UnauthorizedError("A session token is required")
        session = await self._sessions.touch(token)
        if session is None:
            raise UnauthorizedError("Session expired or not found; please connect again")
        return session

    # ------------------------------------------------------------------
    # databases
    # ------------------------------------------------------------------
    async def list_databases(self, token: str) -> list[DatabaseInfo]:
        session = await self._require_session(token)
        entries = await self._gateway.list_databases(token, session.profile)
        databases = [
            DatabaseInfo(
                name=str(entry.get("name")),
                size_on_disk=_as_int(entry.get("sizeOnDisk")),
                empty=bool(entry.get("empty", False)),
            )
            for entry in entries
            if entry.get("name")
        ]
        databases.sort(key=lambda item: item.name.lower())
        return databases

    async def create_database(self, token: str, request: CreateDatabaseRequest) -> MutationResult:
        session = await self._require_session(token)
        database = _db_name(request.name)
        collection = _coll_name(request.collection)
        existing = {entry.name for entry in await self.list_databases(token)}
        if database in existing:
            raise ConflictError(f"Database {database!r} already exists")
        # MongoDB has no CREATE DATABASE: a database starts existing when its
        # first collection does.
        await self._gateway.run_command(token, session.profile, database, {"create": collection})
        return MutationResult(detail=f"Created database {database!r} with collection {collection!r}")

    async def drop_database(self, token: str, database: str) -> MutationResult:
        session = await self._require_session(token)
        name = _db_name(database)
        if is_reserved_database(name) and not self._allow_reserved_database_drop:
            raise BadRequestError(f"{name!r} is a system database and cannot be dropped from here")
        await self._gateway.run_command(token, session.profile, name, {"dropDatabase": 1})
        return MutationResult(detail=f"Dropped database {name!r}")

    async def database_stats(self, token: str, database: str) -> StatsResult:
        session = await self._require_session(token)
        name = _db_name(database)
        raw = await self._gateway.run_command(token, session.profile, name, {"dbStats": 1, "scale": 1})
        return StatsResult(database=name, stats=to_extended_json(_without_ok(raw)))

    # ------------------------------------------------------------------
    # collections
    # ------------------------------------------------------------------
    async def list_collections(
        self, token: str, database: str, with_stats: bool = False
    ) -> list[CollectionInfo]:
        session = await self._require_session(token)
        name = _db_name(database)
        entries = await self._gateway.list_collections(token, session.profile, name)

        collections: list[CollectionInfo] = []
        for entry in entries:
            options = entry.get("options") or {}
            collections.append(
                CollectionInfo(
                    name=str(entry.get("name")),
                    type=str(entry.get("type") or "collection"),
                    capped=bool(options.get("capped", False)),
                    view_on=options.get("viewOn"),
                )
            )
        collections.sort(key=lambda item: item.name.lower())

        if with_stats and len(collections) <= MAX_ENRICHED_COLLECTIONS:
            for info in collections:
                if info.type == "view":
                    continue
                stats = await self._safe_collection_stats(token, session.profile, name, info.name)
                if stats:
                    _apply_collection_stats(info, stats)
        return collections

    async def create_collection(
        self, token: str, database: str, request: CreateCollectionRequest
    ) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        collection = _coll_name(request.name)
        command: dict[str, Any] = {"create": collection}
        if request.capped:
            if not request.size:
                raise BadRequestError("A capped collection needs a maximum size in bytes")
            command["capped"] = True
            command["size"] = int(request.size)
            if request.max_documents:
                command["max"] = int(request.max_documents)
        await self._gateway.run_command(token, session.profile, db, command)
        return MutationResult(detail=f"Created collection {collection!r}")

    async def drop_collection(self, token: str, database: str, collection: str) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        await self._gateway.run_command(token, session.profile, db, {"drop": coll})
        return MutationResult(detail=f"Dropped collection {coll!r}")

    async def rename_collection(
        self, token: str, database: str, collection: str, request: RenameCollectionRequest
    ) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        source = _coll_name(collection)
        target = _coll_name(request.name)
        if source == target:
            raise BadRequestError("The new name is the same as the current one")
        # renameCollection is an admin command and takes fully qualified names.
        await self._gateway.run_command(
            token,
            session.profile,
            "admin",
            {
                "renameCollection": f"{db}.{source}",
                "to": f"{db}.{target}",
                "dropTarget": bool(request.drop_target),
            },
        )
        return MutationResult(detail=f"Renamed {source!r} to {target!r}")

    async def truncate_collection(self, token: str, database: str, collection: str) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        # Deleting every document keeps the indexes and the collection options,
        # which is what "empty this collection" means to the user.
        outcome = await self._gateway.delete(token, session.profile, db, coll, {}, many=True)
        return MutationResult(
            acknowledged=outcome.acknowledged,
            deleted=outcome.deleted,
            duration_ms=outcome.duration_ms,
            detail=f"Removed {outcome.deleted} document(s) from {coll!r}",
        )

    async def collection_stats(self, token: str, database: str, collection: str) -> StatsResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection, allow_system=True)
        stats = await self._safe_collection_stats(token, session.profile, db, coll)
        if stats is None:
            raise NotFoundError(f"No statistics available for {db}.{coll}")
        return StatsResult(database=db, collection=coll, stats=to_extended_json(stats))

    async def _safe_collection_stats(
        self, token: str, profile: MongoConnectionProfile, database: str, collection: str
    ) -> dict[str, Any] | None:
        """collStats first, then $collStats, because the command is on its way out."""
        try:
            raw = await self._gateway.run_command(token, profile, database, {"collStats": collection})
            return _without_ok(raw)
        except Exception:
            try:
                outcome = await self._gateway.aggregate(
                    token,
                    profile,
                    database,
                    collection,
                    [{"$collStats": {"storageStats": {}, "count": {}}}],
                    max_rows=1,
                )
            except Exception:
                return None
        if not outcome.documents:
            return None
        document = dict(outcome.documents[0])
        storage = document.pop("storageStats", None)
        if isinstance(storage, dict):
            document.update(storage)
        return document

    # ------------------------------------------------------------------
    # documents
    # ------------------------------------------------------------------
    async def find_documents(
        self, token: str, database: str, collection: str, request: FindRequest
    ) -> DocumentPage:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection, allow_system=True)
        query = _document(request.filter, "filter")
        projection = _document(request.projection, "projection") if request.projection else None
        sort = _sort(request.sort)
        limit = min(int(request.limit), self._max_documents)

        outcome = await self._gateway.find(
            token, session.profile, db, coll, query, projection, sort, int(request.skip), limit
        )
        documents = [to_extended_json(doc) for doc in outcome.documents]

        total = 0
        if request.with_count:
            total = await self._gateway.count(token, session.profile, db, coll, query)
        return DocumentPage(
            database=db,
            collection=coll,
            documents=documents,
            fields=collect_field_names(outcome.documents),
            total=total,
            skip=int(request.skip),
            limit=limit,
            duration_ms=outcome.duration_ms,
            truncated=outcome.truncated,
        )

    async def count_documents(self, token: str, database: str, collection: str, request: CountRequest) -> int:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection, allow_system=True)
        return await self._gateway.count(
            token, session.profile, db, coll, _document(request.filter, "filter")
        )

    async def insert_documents(
        self, token: str, database: str, collection: str, request: InsertRequest
    ) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        documents = _documents(request.documents, "documents")
        outcome = await self._gateway.insert(token, session.profile, db, coll, documents)
        return MutationResult(
            acknowledged=outcome.acknowledged,
            inserted=outcome.inserted,
            inserted_ids=[to_extended_json(value) for value in outcome.inserted_ids],
            duration_ms=outcome.duration_ms,
            detail=f"Inserted {outcome.inserted} document(s)",
        )

    async def update_documents(
        self, token: str, database: str, collection: str, request: UpdateRequest
    ) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        query = _document(request.filter, "filter")
        update = _document(request.update, "update")
        if not update:
            raise BadRequestError("An update needs at least one field or operator")
        if not query and not request.many:
            # update_one with no filter rewrites whichever document the server
            # happens to return first, which is never what the user meant.
            raise BadRequestError("Updating a single document needs a filter that identifies it")

        replace = not _is_operator_update(update)
        if replace and request.many:
            raise BadRequestError("A replacement document can only be applied to one document")

        outcome = await self._gateway.update(
            token,
            session.profile,
            db,
            coll,
            query,
            update,
            many=request.many,
            upsert=request.upsert,
            replace=replace,
        )
        return MutationResult(
            acknowledged=outcome.acknowledged,
            matched=outcome.matched,
            modified=outcome.modified,
            upserted_id=to_extended_json(outcome.upserted_id) if outcome.upserted_id is not None else None,
            duration_ms=outcome.duration_ms,
            detail=f"Matched {outcome.matched}, modified {outcome.modified}",
        )

    async def delete_documents(
        self, token: str, database: str, collection: str, request: DeleteRequest
    ) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        query = _document(request.filter, "filter")
        if not query and not request.many:
            raise BadRequestError("Deleting a single document needs a filter that identifies it")
        if not query and request.many:
            raise BadRequestError(
                "Deleting every document needs the explicit 'empty collection' action"
            )
        outcome = await self._gateway.delete(
            token, session.profile, db, coll, query, many=request.many
        )
        return MutationResult(
            acknowledged=outcome.acknowledged,
            deleted=outcome.deleted,
            duration_ms=outcome.duration_ms,
            detail=f"Deleted {outcome.deleted} document(s)",
        )

    async def export_collection(
        self, token: str, database: str, collection: str, fmt: str, limit: int, filter_text: str | None = None
    ) -> dict[str, Any]:
        chosen = (fmt or "json").strip().lower()
        if chosen not in _EXPORT_FORMATS:
            raise BadRequestError("format must be one of json, jsonl or csv")

        query: Any = {}
        if filter_text and filter_text.strip():
            try:
                query = json.loads(filter_text)
            except json.JSONDecodeError as exc:
                raise BadRequestError(f"filter is not valid JSON: {exc.msg}") from exc

        page = await self.find_documents(
            token,
            database,
            collection,
            FindRequest(filter=query, limit=min(int(limit), self._max_documents), with_count=False),
        )
        media_type, extension = _EXPORT_FORMATS[chosen]
        content = _render_export(chosen, page.documents)
        return {
            "content": content,
            "media_type": media_type,
            "filename": f"{page.database}.{page.collection}.{extension}",
        }

    # ------------------------------------------------------------------
    # indexes
    # ------------------------------------------------------------------
    async def list_indexes(self, token: str, database: str, collection: str) -> list[IndexInfo]:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection, allow_system=True)
        entries = await self._gateway.list_indexes(token, session.profile, db, coll)
        return [
            IndexInfo(
                name=str(entry.get("name")),
                keys=[[field, to_extended_json(direction)] for field, direction in (entry.get("key") or {}).items()],
                unique=bool(entry.get("unique", False)),
                sparse=bool(entry.get("sparse", False)),
                ttl_seconds=_as_int(entry.get("expireAfterSeconds")),
                partial_filter=to_extended_json(entry.get("partialFilterExpression")) if entry.get("partialFilterExpression") else None,
            )
            for entry in entries
            if entry.get("name")
        ]

    async def create_index(
        self, token: str, database: str, collection: str, request: CreateIndexRequest
    ) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        keys = self._index_keys(request.keys)

        options: dict[str, Any] = {}
        if request.name:
            options["name"] = request.name
        if request.unique:
            options["unique"] = True
        if request.sparse:
            options["sparse"] = True
        if request.ttl_seconds is not None:
            options["expireAfterSeconds"] = int(request.ttl_seconds)
        if request.partial_filter:
            options["partialFilterExpression"] = _document(request.partial_filter, "partial_filter")

        name = await self._gateway.create_index(token, session.profile, db, coll, keys, options)
        return MutationResult(detail=f"Created index {name!r}")

    @staticmethod
    def _index_keys(raw: Any) -> list[tuple[str, Any]]:
        """Accept `{"field": 1}` or `[["field", "text"]]`; 1/-1 and the special types."""
        if isinstance(raw, dict):
            items = list(raw.items())
        elif isinstance(raw, list):
            items = []
            for entry in raw:
                if isinstance(entry, (list, tuple)) and len(entry) == 2:
                    items.append((entry[0], entry[1]))
                elif isinstance(entry, dict) and len(entry) == 1:
                    items.extend(entry.items())
                else:
                    raise BadRequestError("index keys must be [field, direction] pairs")
        else:
            raise BadRequestError("index keys must be an object or a list of pairs")
        if not items:
            raise BadRequestError("an index needs at least one key")

        keys: list[tuple[str, Any]] = []
        for field, direction in items:
            if not isinstance(field, str) or not field.strip():
                raise BadRequestError("index field names must be non-empty strings")
            if isinstance(direction, str):
                if direction not in _SPECIAL_INDEX_TYPES:
                    raise BadRequestError(
                        f"{direction!r} is not a valid index type; use 1, -1 or one of "
                        + ", ".join(sorted(_SPECIAL_INDEX_TYPES))
                    )
                keys.append((field, direction))
                continue
            try:
                numeric = int(direction)
            except (TypeError, ValueError) as exc:
                raise BadRequestError(f"index direction for {field!r} must be 1 or -1") from exc
            if numeric not in (1, -1):
                raise BadRequestError(f"index direction for {field!r} must be 1 or -1")
            keys.append((field, numeric))
        return keys

    async def drop_index(self, token: str, database: str, collection: str, name: str) -> MutationResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection)
        index_name = (name or "").strip()
        if not index_name:
            raise BadRequestError("An index name is required")
        if index_name == "_id_":
            raise BadRequestError("The _id index is required by MongoDB and cannot be dropped")
        await self._gateway.drop_index(token, session.profile, db, coll, index_name)
        return MutationResult(detail=f"Dropped index {index_name!r}")

    # ------------------------------------------------------------------
    # console and server
    # ------------------------------------------------------------------
    async def aggregate(
        self, token: str, database: str, collection: str, request: AggregateRequest
    ) -> CommandResult:
        session = await self._require_session(token)
        db = _db_name(database)
        coll = _coll_name(collection, allow_system=True)
        pipeline = _pipeline(request.pipeline)
        if not pipeline:
            raise BadRequestError("A pipeline needs at least one stage")

        outcome = await self._gateway.aggregate(
            token, session.profile, db, coll, pipeline, max_rows=int(request.max_rows)
        )
        documents = [to_extended_json(doc) for doc in outcome.documents]
        return CommandResult(
            kind="aggregate",
            database=db,
            documents=documents,
            row_count=len(documents),
            duration_ms=outcome.duration_ms,
            truncated=outcome.truncated,
        )

    async def run_command(self, token: str, request: CommandRequest) -> CommandResult:
        session = await self._require_session(token)
        database = _db_name(request.database) if request.database else (session.profile.database or "admin")
        command = _document(request.command, "command")
        if not command:
            raise BadRequestError("A command document is required")
        raw = await self._gateway.run_command(token, session.profile, database, command)
        result = to_extended_json(raw)

        # A command that opened a cursor puts its rows in cursor.firstBatch;
        # surfacing them separately lets the UI render a table either way.
        documents: list[Any] = []
        cursor = raw.get("cursor")
        if isinstance(cursor, dict) and isinstance(cursor.get("firstBatch"), list):
            documents = [to_extended_json(doc) for doc in cursor["firstBatch"]]
        return CommandResult(
            kind="command",
            database=database,
            result=result,
            documents=documents,
            row_count=len(documents),
        )

    async def server_overview(self, token: str) -> ServerOverview:
        session = await self._require_session(token)
        status = await self._gateway.run_command(token, session.profile, "admin", {"serverStatus": 1})
        try:
            build = await self._gateway.run_command(token, session.profile, "admin", {"buildInfo": 1})
        except Exception:
            build = {}

        return ServerOverview(
            version=str(status.get("version") or build.get("version") or "") or None,
            flavor=session.server_flavor,
            topology=session.topology,
            host=str(status.get("host") or "") or None,
            uptime_seconds=_as_int(status.get("uptime")),
            current_user=session.metadata.get("current_user"),
            connections=to_extended_json(status.get("connections") or {}),
            opcounters=to_extended_json(status.get("opcounters") or {}),
            memory=to_extended_json(status.get("mem") or {}),
            storage_engine=str((status.get("storageEngine") or {}).get("name") or "") or None,
            build=to_extended_json(
                {
                    key: build.get(key)
                    for key in ("version", "gitVersion", "javascriptEngine", "bits", "maxBsonObjectSize", "modules")
                    if build.get(key) is not None
                }
            ),
        )

    async def current_operations(self, token: str) -> list[OperationInfo]:
        session = await self._require_session(token)
        try:
            raw = await self._gateway.run_command(
                token, session.profile, "admin", {"currentOp": 1, "idleConnections": False}
            )
            entries = raw.get("inprog") or []
        except Exception:
            # The currentOp command is deprecated; newer deployments expect the
            # $currentOp aggregation stage instead.
            raw = await self._gateway.run_command(
                token,
                session.profile,
                "admin",
                {"aggregate": 1, "pipeline": [{"$currentOp": {}}], "cursor": {}},
            )
            entries = ((raw.get("cursor") or {}).get("firstBatch")) or []

        return [
            OperationInfo(
                opid=to_extended_json(entry.get("opid")),
                op=str(entry.get("op") or "") or None,
                ns=str(entry.get("ns") or "") or None,
                secs_running=_as_int(entry.get("secs_running")),
                client=str(entry.get("client") or entry.get("client_s") or "") or None,
                description=str(entry.get("desc") or "") or None,
                active=bool(entry.get("active", False)),
                command=to_extended_json(entry.get("command")) if entry.get("command") else None,
            )
            for entry in entries
            if isinstance(entry, dict)
        ]



    # ------------------------------------------------------------------
    # backup & restore
    # ------------------------------------------------------------------
    async def backup_database(
        self, token: str, database: str, request: MongoBackupRequest
    ) -> MongoBackupResult:
        """Dump a database as one Extended JSON document.

        `mongodump` is the obvious tool and is not available here: the process
        has no mongo tools installed and, on a serverless platform, nowhere to
        install them. So the dump is assembled from the same driver calls the
        rest of this administrator uses.

        The format is Extended JSON, not BSON, because a dump that can be opened
        in a text editor and diffed is worth more than a compact one — and
        `mongo_json` already round-trips ObjectId, dates, Decimal128 and binary
        through it, so nothing is lost on the way back.
        """
        session = await self._require_session(token)
        db = _db_name(database)
        generated_at = _utc_now()

        available = await self._gateway.list_collections(token, session.profile, db)
        names = [item.get("name") for item in available if item.get("name")]
        wanted = set(request.collections or [])
        if wanted:
            names = [name for name in names if name in wanted]

        dumped: list[dict[str, Any]] = []
        total_documents = 0
        total_indexes = 0
        truncated: list[str] = []

        for name in sorted(names):
            entry: dict[str, Any] = {"name": name, "documents": [], "indexes": []}

            if request.include_indexes:
                try:
                    indexes = await self._gateway.list_indexes(token, session.profile, db, name)
                except Exception:  # noqa: BLE001 - a view has no indexes; keep going
                    indexes = []
                for index in indexes:
                    # `_id_` is created automatically; restoring it would fail
                    # and reporting it would overstate what the dump carries.
                    if index.get("name") == "_id_":
                        continue
                    entry["indexes"].append(to_extended_json(index))
                    total_indexes += 1

            if request.include_documents:
                # One over the cap, so the dump can say it was truncated rather
                # than silently losing the rest.
                probe = min(request.max_documents_per_collection + 1, self._max_documents)
                outcome = await self._gateway.find(
                    token, session.profile, db, name, {}, None, None, 0, probe
                )
                documents = list(outcome.documents)
                if len(documents) > request.max_documents_per_collection:
                    documents = documents[: request.max_documents_per_collection]
                    truncated.append(name)
                entry["documents"] = [to_extended_json(document) for document in documents]
                total_documents += len(documents)

            dumped.append(entry)

        payload = {
            "format": "gemini-proxy/mongo-dump",
            "version": 1,
            "database": db,
            "generated_at": generated_at,
            "collections": dumped,
        }
        content = json.dumps(payload, ensure_ascii=False, indent=2)

        return MongoBackupResult(
            database=db,
            filename=f"{db}-{generated_at[:10]}.json",
            content=content,
            collections=len(dumped),
            documents=total_documents,
            indexes=total_indexes,
            bytes=len(content.encode("utf-8")),
            generated_at=generated_at,
            truncated_collections=truncated,
        )

    async def restore_database(
        self, token: str, database: str, request: MongoRestoreRequest
    ) -> MongoRestoreResult:
        """Load a dump back into `database`.

        `confirm_database` must name the target when supplied, for the same
        reason the SQL side insists on it: with `drop_existing` on, a restore
        aimed at the wrong database destroys it, and that is not a mistake a
        dialog alone should be trusted to prevent.
        """
        session = await self._require_session(token)
        db = _db_name(database)

        if request.confirm_database is not None and request.confirm_database != db:
            raise BadRequestError(
                f"Xac nhan khong khop: ban go '{request.confirm_database}' "
                f"nhung dang phuc hoi vao '{db}'"
            )

        try:
            payload = json.loads(request.content)
        except json.JSONDecodeError as cause:
            raise BadRequestError(f"Noi dung backup khong phai JSON hop le: {cause.msg}") from cause

        collections = payload.get("collections") if isinstance(payload, dict) else None
        if not isinstance(collections, list):
            raise BadRequestError("Backup thieu danh sach 'collections'")

        started = time.perf_counter()
        restored_collections = 0
        restored_documents = 0
        restored_indexes = 0
        failed = 0
        errors: list[str] = []

        for entry in collections:
            if not isinstance(entry, dict) or not entry.get("name"):
                continue
            name = _coll_name(str(entry["name"]))
            restored_collections += 1

            try:
                if request.drop_existing:
                    # No drop_collection on the port; `drop` is the command the
                    # rest of this usecase uses for the same thing.
                    await self._gateway.run_command(token, session.profile, db, {"drop": name})

                documents = entry.get("documents") or []
                if documents:
                    decoded = [from_extended_json(document) for document in documents]
                    # In batches: one insert_many of a hundred thousand documents
                    # can exceed the 48MB command limit, and a failure there
                    # loses the whole collection rather than one batch.
                    for start in range(0, len(decoded), _RESTORE_BATCH):
                        batch = decoded[start : start + _RESTORE_BATCH]
                        outcome = await self._gateway.insert(token, session.profile, db, name, batch)
                        restored_documents += outcome.inserted or len(batch)

                for index in entry.get("indexes") or []:
                    decoded_index = from_extended_json(index)
                    keys = decoded_index.get("key") or {}
                    if not keys:
                        continue
                    options = {
                        option: decoded_index[option]
                        for option in ("unique", "sparse", "expireAfterSeconds", "partialFilterExpression")
                        if option in decoded_index
                    }
                    if decoded_index.get("name"):
                        options["name"] = decoded_index["name"]
                    # A direction may be a string ("text", "2dsphere"), so it is
                    # passed through rather than coerced to an int.
                    await self._gateway.create_index(
                        token, session.profile, db, name,
                        [(field, direction) for field, direction in keys.items()],
                        options,
                    )
                    restored_indexes += 1
            except Exception as cause:  # noqa: BLE001 - reported per collection
                failed += 1
                errors.append(f"{name}: {str(cause)[:200]}")
                if request.stop_on_error:
                    break

        return MongoRestoreResult(
            database=db,
            collections=restored_collections,
            documents=restored_documents,
            indexes=restored_indexes,
            failed=failed,
            duration_ms=(time.perf_counter() - started) * 1000,
            errors=errors[:50],
        )


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _as_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _without_ok(raw: dict[str, Any]) -> dict[str, Any]:
    """Drop the command envelope fields nobody wants to look at."""
    return {key: value for key, value in raw.items() if key not in {"ok", "$clusterTime", "operationTime"}}


def _apply_collection_stats(info: CollectionInfo, stats: dict[str, Any]) -> None:
    info.count = _as_int(stats.get("count"))
    info.size = _as_int(stats.get("size"))
    info.storage_size = _as_int(stats.get("storageSize"))
    info.avg_obj_size = _as_int(stats.get("avgObjSize"))
    info.index_count = _as_int(stats.get("nindexes")) or (
        len(stats.get("indexSizes") or {}) or None
    )


def _render_export(fmt: str, documents: list[Any]) -> str:
    if fmt == "json":
        return json.dumps(documents, ensure_ascii=False, indent=2)
    if fmt == "jsonl":
        return "\n".join(json.dumps(doc, ensure_ascii=False) for doc in documents)

    rows = [doc for doc in documents if isinstance(doc, dict)]
    fields = collect_field_names(rows)
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(fields)
    for doc in rows:
        writer.writerow([flatten_for_csv(doc.get(field)) for field in fields])
    return buffer.getvalue()
