"""pymongo-backed gateway to arbitrary MongoDB deployments.

Uses `pymongo.AsyncMongoClient` (PyMongo's native async API, which replaced
Motor) so the event loop is never blocked. One client — and therefore one
connection pool — is kept per session and torn down on logout, mirroring how
`sqlgateway` handles MySQL.

Every driver exception is translated into the application's exception
vocabulary here, so nothing above this module needs to import pymongo.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from src.application.exceptions.exceptions import (
    BadGatewayError,
    BadRequestError,
    ConflictError,
    GatewayTimeoutError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.output.mongo_gateway_output_port import (
    MongoConnectionProfile,
    MongoGatewayOutputPort,
    QueryOutcome,
    WriteOutcome,
)

logger = logging.getLogger(__name__)

# MongoDB server error codes worth mapping onto a specific HTTP status.
_AUTH_CODES = {13, 18, 31, 8000}  # Unauthorized, AuthenticationFailed, ...
_NOT_FOUND_CODES = {26, 27, 59}  # NamespaceNotFound, IndexNotFound, CommandNotFound
_CONFLICT_CODES = {11000, 11001, 48, 68, 85, 86}  # duplicate key, NamespaceExists, index conflicts


def _error_code(exc: Exception) -> int | None:
    code = getattr(exc, "code", None)
    if isinstance(code, int):
        return code
    details = getattr(exc, "details", None)
    if isinstance(details, dict):
        raw = details.get("code")
        if isinstance(raw, int):
            return raw
        errors = details.get("writeErrors")
        if isinstance(errors, list) and errors and isinstance(errors[0], dict):
            inner = errors[0].get("code")
            if isinstance(inner, int):
                return inner
    return None


def _translate_error(exc: Exception) -> Exception:
    """Map a driver error onto the application's exception vocabulary."""
    if isinstance(exc, asyncio.TimeoutError):
        return GatewayTimeoutError("The MongoDB server did not respond in time")

    message = str(exc).strip() or exc.__class__.__name__
    try:
        from pymongo import errors as mongo_errors
    except ModuleNotFoundError:  # pragma: no cover - install-time problem
        return BadGatewayError(message)

    code = _error_code(exc)
    if code in _AUTH_CODES or isinstance(exc, mongo_errors.OperationFailure) and "auth" in message.lower():
        return UnauthorizedError(message)
    if isinstance(exc, mongo_errors.ServerSelectionTimeoutError):
        # The hostname is wrong, the port is closed, or the server is down: the
        # message the driver builds lists every host it tried, which is the most
        # useful thing we can show on the login screen.
        return GatewayTimeoutError(f"Could not reach the MongoDB deployment: {message}")
    if isinstance(exc, (mongo_errors.NetworkTimeout, mongo_errors.ExecutionTimeout, mongo_errors.WTimeoutError)):
        return GatewayTimeoutError(message)
    if isinstance(exc, (mongo_errors.ConfigurationError, mongo_errors.InvalidURI)):
        return BadRequestError(message)
    if isinstance(exc, mongo_errors.DuplicateKeyError) or code in _CONFLICT_CODES:
        return ConflictError(message, payload={"mongo_code": code})
    if code in _NOT_FOUND_CODES:
        return NotFoundError(message)
    if isinstance(exc, (mongo_errors.OperationFailure, mongo_errors.WriteError, mongo_errors.BulkWriteError)):
        # A bad filter, a bad pipeline stage or an invalid update: the client's fault.
        return BadRequestError(message, payload={"mongo_code": code})
    if isinstance(exc, mongo_errors.ConnectionFailure):
        return BadGatewayError(message)
    if isinstance(exc, (mongo_errors.InvalidOperation, mongo_errors.InvalidName, ValueError, TypeError)):
        return BadRequestError(message)
    try:
        from bson.errors import BSONError

        if isinstance(exc, BSONError):
            return BadRequestError(message)
    except ModuleNotFoundError:  # pragma: no cover
        pass
    return BadGatewayError(message or "Could not reach the MongoDB server")


class MongoGateway(MongoGatewayOutputPort):
    def __init__(
        self,
        connect_timeout: int = 10,
        operation_timeout: int = 60,
        pool_max_size: int = 10,
        app_name: str = "mongo-administrator",
    ):
        self._clients: dict[str, Any] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._connect_timeout = connect_timeout
        self._operation_timeout = operation_timeout
        self._pool_max_size = pool_max_size
        self._app_name = app_name

    # --- connection management -------------------------------------------
    @staticmethod
    def _import_driver():
        try:
            from pymongo import AsyncMongoClient
        except ImportError as exc:  # pragma: no cover - install-time problem
            raise BadGatewayError(
                "pymongo (>=4.13, for AsyncMongoClient) is not installed; "
                "run 'pip install -r requirements.txt'"
            ) from exc
        return AsyncMongoClient

    def _client_options(self) -> dict[str, Any]:
        return {
            "appname": self._app_name,
            "serverSelectionTimeoutMS": self._connect_timeout * 1000,
            "connectTimeoutMS": self._connect_timeout * 1000,
            "socketTimeoutMS": self._operation_timeout * 1000,
            "maxPoolSize": self._pool_max_size,
            "retryWrites": True,
        }

    def _build_client(self, profile: MongoConnectionProfile):
        client_cls = self._import_driver()
        try:
            return client_cls(profile.uri, **self._client_options())
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def probe(self, profile: MongoConnectionProfile) -> dict[str, Any]:
        client = self._build_client(profile)
        try:
            hello = await asyncio.wait_for(
                client.admin.command("hello"), timeout=self._connect_timeout + 2
            )
            build = await client.admin.command("buildInfo")
            facts: dict[str, Any] = {
                "server_version": str(build.get("version") or hello.get("version") or ""),
                "server_flavor": _flavor(build),
                "topology": _topology(hello),
                "host": str(hello.get("me") or ""),
                "max_wire_version": hello.get("maxWireVersion"),
            }
            try:
                status = await client.admin.command("connectionStatus")
                users = (status.get("authInfo") or {}).get("authenticatedUsers") or []
                if users:
                    facts["current_user"] = f"{users[0].get('user')}@{users[0].get('db')}"
            except Exception:  # pragma: no cover - not every deployment allows it
                logger.debug("connectionStatus unavailable on %s", profile.host)
            return facts
        except Exception as exc:
            raise _translate_error(exc) from exc
        finally:
            await _close_quietly(client)

    async def _get_client(self, session_id: str, profile: MongoConnectionProfile):
        client = self._clients.get(session_id)
        if client is not None:
            return client
        lock = self._locks.setdefault(session_id, asyncio.Lock())
        async with lock:
            client = self._clients.get(session_id)
            if client is None:
                client = self._build_client(profile)
                self._clients[session_id] = client
            return client

    # --- operations -------------------------------------------------------
    async def run_command(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        command: dict[str, Any],
    ) -> dict[str, Any]:
        client = await self._get_client(session_id, profile)
        try:
            result = await asyncio.wait_for(
                client[database].command(command), timeout=self._operation_timeout
            )
            return dict(result)
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def list_databases(self, session_id: str, profile: MongoConnectionProfile) -> list[dict[str, Any]]:
        client = await self._get_client(session_id, profile)
        try:
            return [dict(entry) async for entry in await client.list_databases()]
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def list_collections(
        self, session_id: str, profile: MongoConnectionProfile, database: str
    ) -> list[dict[str, Any]]:
        client = await self._get_client(session_id, profile)
        try:
            cursor = await client[database].list_collections()
            return [dict(entry) async for entry in cursor]
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def find(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
        projection: dict[str, Any] | None = None,
        sort: list[tuple[str, int]] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> QueryOutcome:
        client = await self._get_client(session_id, profile)
        started = time.perf_counter()
        try:
            cursor = client[database][collection].find(filter, projection or None)
            if sort:
                cursor = cursor.sort(sort)
            if skip:
                cursor = cursor.skip(skip)
            # One extra document tells the UI whether another page exists without
            # paying for a second count.
            cursor = cursor.limit(limit + 1)
            documents = [dict(doc) async for doc in cursor]
        except Exception as exc:
            raise _translate_error(exc) from exc
        truncated = len(documents) > limit
        return QueryOutcome(
            documents=documents[:limit],
            duration_ms=round((time.perf_counter() - started) * 1000, 3),
            truncated=truncated,
        )

    async def count(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
    ) -> int:
        client = await self._get_client(session_id, profile)
        try:
            if not filter:
                # An unfiltered count_documents scans the collection; the metadata
                # estimate is what Compass shows and is orders of magnitude faster.
                return int(await client[database][collection].estimated_document_count())
            return int(await client[database][collection].count_documents(filter))
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def insert(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        documents: list[dict[str, Any]],
    ) -> WriteOutcome:
        client = await self._get_client(session_id, profile)
        started = time.perf_counter()
        try:
            result = await client[database][collection].insert_many(documents)
            ids = list(result.inserted_ids)
            return WriteOutcome(
                acknowledged=bool(result.acknowledged),
                inserted=len(ids),
                inserted_ids=ids,
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
            )
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def update(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
        update: dict[str, Any],
        many: bool = False,
        upsert: bool = False,
        replace: bool = False,
    ) -> WriteOutcome:
        client = await self._get_client(session_id, profile)
        target = client[database][collection]
        started = time.perf_counter()
        try:
            if replace:
                result = await target.replace_one(filter, update, upsert=upsert)
            elif many:
                result = await target.update_many(filter, update, upsert=upsert)
            else:
                result = await target.update_one(filter, update, upsert=upsert)
            return WriteOutcome(
                acknowledged=bool(result.acknowledged),
                matched=int(result.matched_count),
                modified=int(result.modified_count),
                upserted_id=result.upserted_id,
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
            )
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def delete(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
        many: bool = False,
    ) -> WriteOutcome:
        client = await self._get_client(session_id, profile)
        target = client[database][collection]
        started = time.perf_counter()
        try:
            result = await (target.delete_many(filter) if many else target.delete_one(filter))
            return WriteOutcome(
                acknowledged=bool(result.acknowledged),
                deleted=int(result.deleted_count),
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
            )
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def aggregate(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        pipeline: list[dict[str, Any]],
        max_rows: int = 200,
    ) -> QueryOutcome:
        client = await self._get_client(session_id, profile)
        started = time.perf_counter()
        documents: list[dict[str, Any]] = []
        truncated = False
        try:
            cursor = await client[database][collection].aggregate(pipeline)
            async for doc in cursor:
                if len(documents) >= max_rows:
                    truncated = True
                    break
                documents.append(dict(doc))
        except Exception as exc:
            raise _translate_error(exc) from exc
        return QueryOutcome(
            documents=documents,
            duration_ms=round((time.perf_counter() - started) * 1000, 3),
            truncated=truncated,
        )

    async def list_indexes(
        self, session_id: str, profile: MongoConnectionProfile, database: str, collection: str
    ) -> list[dict[str, Any]]:
        client = await self._get_client(session_id, profile)
        try:
            cursor = await client[database][collection].list_indexes()
            return [dict(entry) async for entry in cursor]
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def create_index(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        keys: list[tuple[str, Any]],
        options: dict[str, Any],
    ) -> str:
        client = await self._get_client(session_id, profile)
        try:
            return str(await client[database][collection].create_index(keys, **options))
        except Exception as exc:
            raise _translate_error(exc) from exc

    async def drop_index(
        self, session_id: str, profile: MongoConnectionProfile, database: str, collection: str, name: str
    ) -> None:
        client = await self._get_client(session_id, profile)
        try:
            await client[database][collection].drop_index(name)
        except Exception as exc:
            raise _translate_error(exc) from exc

    # --- teardown ---------------------------------------------------------
    async def release(self, session_id: str) -> None:
        client = self._clients.pop(session_id, None)
        self._locks.pop(session_id, None)
        if client is not None:
            await _close_quietly(client)

    async def release_all(self) -> None:
        for session_id in list(self._clients.keys()):
            await self.release(session_id)


async def _close_quietly(client: Any) -> None:
    try:
        result = client.close()
        if asyncio.iscoroutine(result):
            await result
    except Exception as exc:  # pragma: no cover - teardown is best effort
        logger.debug("Ignoring error while closing a MongoDB client: %s", exc)


def _flavor(build_info: dict[str, Any]) -> str:
    if build_info.get("psmdbVersion"):
        return "Percona Server for MongoDB"
    modules = build_info.get("modules") or []
    if any("enterprise" in str(module).lower() for module in modules):
        return "MongoDB Enterprise"
    if build_info.get("documentdbVersion") or build_info.get("azureVersion"):
        return "Azure Cosmos DB"
    return "MongoDB"


def _topology(hello: dict[str, Any]) -> str:
    if hello.get("msg") == "isdbgrid":
        return "sharded"
    if hello.get("setName"):
        return "replicaSet"
    return "standalone"
