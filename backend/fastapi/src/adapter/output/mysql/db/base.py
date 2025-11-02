import os
import sys
import asyncio
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from backend.fastapi.src.application.config.config import settings


# SQLAlchemy async base
Base = declarative_base()


def _mysql_async_url() -> str:
    # using asyncmy driver for MySQL async support
    return (
        f"mysql+asyncmy://{settings.DB_USERNAME}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_DATABASE}"
    )


def get_async_engine() -> AsyncEngine:
    running_under_pytest = any(k.startswith("pytest") or k == "pytest" for k in sys.modules.keys())
    if getattr(settings, "TESTING", False) or os.environ.get("PYTEST_CURRENT_TEST") or running_under_pytest:
        # in-memory sqlite async using a shared StaticPool so DB persists across connections in tests
        return create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            echo=False,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
            future=True,
        )

    return create_async_engine(_mysql_async_url(), echo=False, future=True)


# create the async engine and sessionmaker
async_engine: AsyncEngine = get_async_engine()
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False, future=True)


async def init_db_async():
    # ensure domain models are imported so metadata exists
    from src.domain import models as _models  # noqa: F401

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def init_db():
    """Sync wrapper to initialize DB. If called inside an active event loop, schedules the async init as a task; otherwise runs it synchronously."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(init_db_async())
    else:
        # running event loop (e.g., uvicorn); schedule task and don't block
        asyncio.create_task(init_db_async())


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
