from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.output.mysql.db.base import get_async_session_dependency
from src.adapter.output.mysql.repositories.arena_repository import ArenaRepository
from src.application.usecases.arena_usecase import ArenaUseCase


def get_arena_usecase(db: AsyncSession = Depends(get_async_session_dependency)) -> ArenaUseCase:
    """One use case per request, bound to that request's session."""
    return ArenaUseCase(ArenaRepository(db))
