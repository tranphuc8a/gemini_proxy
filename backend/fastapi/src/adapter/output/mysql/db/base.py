import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import StaticPool
from src.application.config.config import settings


# SQLAlchemy async base
Base = declarative_base()


def _mysql_async_url() -> str:
    # using asyncmy driver for MySQL async support
    return (
        f"mysql+asyncmy://{settings.DB_USERNAME}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_DATABASE}"
    )


# Lazily created engine and sessionmaker to avoid importing DB driver at module import time
_async_engine: AsyncEngine | None = None
_AsyncSessionLocal = None


def _create_engine_and_session() -> None:
    """Internal: create module-level async engine and sessionmaker.

    Falls back to an in-memory sqlite+aiosqlite engine if the async MySQL driver is not available
    or when running tests.
    """
    global _async_engine, _AsyncSessionLocal

    if _async_engine is not None and _AsyncSessionLocal is not None:
        return

    running_under_pytest = any(k.startswith("pytest") or k == "pytest" for k in sys.modules.keys())
    try:
        if getattr(settings, "TESTING", False) or os.environ.get("PYTEST_CURRENT_TEST") or running_under_pytest:
            # in-memory sqlite async using a shared StaticPool so DB persists across connections in tests
            _async_engine = create_async_engine(
                "sqlite+aiosqlite:///:memory:",
                echo=False,
                poolclass=StaticPool,
                connect_args={"check_same_thread": False},
                future=True,
            )
        else:
            # attempt to create MySQL async engine; may raise ModuleNotFoundError if driver missing
            _async_engine = create_async_engine(_mysql_async_url(), echo=False, future=True)
    except ModuleNotFoundError:
        # Fallback: if the async mysql driver isn't installed, fall back to an on-disk sqlite to allow local runs
        # (This avoids crashing on import; for production install the proper async driver.)
        _async_engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            echo=False,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
            future=True,
        )

    _AsyncSessionLocal = async_sessionmaker(_async_engine, class_=AsyncSession, expire_on_commit=False, future=True)


def get_async_engine() -> AsyncEngine:
    _create_engine_and_session()
    assert _async_engine is not None
    return _async_engine


async def init_db_async():
    engine = get_async_engine()
    async with engine.begin() as conn:
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


def get_async_session() -> AsyncSession:
    _create_engine_and_session()
    assert _AsyncSessionLocal is not None, "Async sessionmaker was not initialized"
    return _AsyncSessionLocal()
