from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.output.mysql.db.base import get_async_session_dependency
from src.adapter.output.mysql.repositories.course_repository import CourseRepository
from src.application.usecases.course_usecase import CourseUseCase


def get_course_usecase(db: AsyncSession = Depends(get_async_session_dependency)) -> CourseUseCase:
    """One use case per request, bound to that request's session."""
    return CourseUseCase(CourseRepository(db))
