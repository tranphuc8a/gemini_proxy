"""Inbound port for the MongoDB administrator use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

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


class MongoAdminInputPort(ABC):
    # --- session ---------------------------------------------------------
    @abstractmethod
    async def connect(self, request: ConnectRequest) -> SessionInfo: ...

    @abstractmethod
    async def current_session(self, token: str) -> SessionInfo: ...

    @abstractmethod
    async def disconnect(self, token: str) -> bool: ...

    # --- databases -------------------------------------------------------
    @abstractmethod
    async def list_databases(self, token: str) -> list[DatabaseInfo]: ...

    @abstractmethod
    async def create_database(self, token: str, request: CreateDatabaseRequest) -> MutationResult: ...

    @abstractmethod
    async def drop_database(self, token: str, database: str) -> MutationResult: ...

    @abstractmethod
    async def database_stats(self, token: str, database: str) -> StatsResult: ...

    # --- collections -----------------------------------------------------
    @abstractmethod
    async def list_collections(
        self, token: str, database: str, with_stats: bool = False
    ) -> list[CollectionInfo]: ...

    @abstractmethod
    async def create_collection(
        self, token: str, database: str, request: CreateCollectionRequest
    ) -> MutationResult: ...

    @abstractmethod
    async def drop_collection(self, token: str, database: str, collection: str) -> MutationResult: ...

    @abstractmethod
    async def rename_collection(
        self, token: str, database: str, collection: str, request: RenameCollectionRequest
    ) -> MutationResult: ...

    @abstractmethod
    async def truncate_collection(self, token: str, database: str, collection: str) -> MutationResult: ...

    @abstractmethod
    async def collection_stats(self, token: str, database: str, collection: str) -> StatsResult: ...

    # --- documents -------------------------------------------------------
    @abstractmethod
    async def find_documents(
        self, token: str, database: str, collection: str, request: FindRequest
    ) -> DocumentPage: ...

    @abstractmethod
    async def count_documents(
        self, token: str, database: str, collection: str, request: CountRequest
    ) -> int: ...

    @abstractmethod
    async def insert_documents(
        self, token: str, database: str, collection: str, request: InsertRequest
    ) -> MutationResult: ...

    @abstractmethod
    async def update_documents(
        self, token: str, database: str, collection: str, request: UpdateRequest
    ) -> MutationResult: ...

    @abstractmethod
    async def delete_documents(
        self, token: str, database: str, collection: str, request: DeleteRequest
    ) -> MutationResult: ...

    @abstractmethod
    async def export_collection(
        self, token: str, database: str, collection: str, fmt: str, limit: int, filter_text: str | None = None
    ) -> dict[str, Any]: ...

    # --- indexes ---------------------------------------------------------
    @abstractmethod
    async def list_indexes(self, token: str, database: str, collection: str) -> list[IndexInfo]: ...

    @abstractmethod
    async def create_index(
        self, token: str, database: str, collection: str, request: CreateIndexRequest
    ) -> MutationResult: ...

    @abstractmethod
    async def drop_index(self, token: str, database: str, collection: str, name: str) -> MutationResult: ...

    # --- console and server ----------------------------------------------
    @abstractmethod
    async def aggregate(
        self, token: str, database: str, collection: str, request: AggregateRequest
    ) -> CommandResult: ...

    @abstractmethod
    async def run_command(self, token: str, request: CommandRequest) -> CommandResult: ...

    @abstractmethod
    async def server_overview(self, token: str) -> ServerOverview: ...

    @abstractmethod
    async def current_operations(self, token: str) -> list[OperationInfo]: ...

    # --- backup & restore ------------------------------------------------
    # Declared but not abstract, for the same reason as the SQL side: an
    # implementation that only browses is legitimate and should not have to
    # stub these out.
    async def backup_database(
        self, token: str, database: str, request: MongoBackupRequest
    ) -> MongoBackupResult: ...

    async def restore_database(
        self, token: str, database: str, request: MongoRestoreRequest
    ) -> MongoRestoreResult: ...
