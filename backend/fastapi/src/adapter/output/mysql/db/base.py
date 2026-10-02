import atexit
import asyncio
import os
import sys
import tempfile
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession, async_sessionmaker
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from src.application.config.config import settings


# SQLAlchemy async base
Base = declarative_base()
_TEST_DATABASE_PATH = Path(tempfile.gettempdir()) / f"gemini_proxy_test_{os.getpid()}.sqlite3"


def _remove_test_database() -> None:
    try:
        _TEST_DATABASE_PATH.unlink()
    except FileNotFoundError:
        pass


atexit.register(_remove_test_database)


def _mysql_async_url() -> str:
    # using asyncmy driver for MySQL async support
    # Use aiomysql as the async DBAPI (preferred for better Windows wheel support).
    # Note: connection URL dialect is `mysql+aiomysql://` for SQLAlchemy async.
    return (
        f"mysql+aiomysql://{settings.DB_USERNAME}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_DATABASE}"
    )


# Lazily created engine and sessionmaker to avoid importing DB driver at module import time
_async_engine: AsyncEngine | None = None
_AsyncSessionLocal = None


def _create_engine_and_session() -> None:
    """Internal: create module-level async engine and sessionmaker.

    Falls back to a temporary sqlite+aiosqlite database when running tests.
    """
    global _async_engine, _AsyncSessionLocal

    if _async_engine is not None and _AsyncSessionLocal is not None:
        return

    running_under_pytest = any(k.startswith("pytest") or k == "pytest" for k in sys.modules.keys())
    try:
        if getattr(settings, "TESTING", False) or os.environ.get("PYTEST_CURRENT_TEST") or running_under_pytest:
            # File-backed SQLite lets tests create connections on separate event loops.
            _async_engine = create_async_engine(
                URL.create("sqlite+aiosqlite", database=str(_TEST_DATABASE_PATH)),
                echo=False,
                poolclass=NullPool,
                connect_args={"check_same_thread": False},
                future=True,
            )
        elif (os.environ.get("DB_URL") or getattr(settings, "DB_URL", "") or "").strip():
            # An explicit URL wins over the DB_* fields: this is how a laptop that
            # cannot reach the production MySQL still runs the app and the
            # course importer against a local SQLite file.
            db_url = (os.environ.get("DB_URL") or settings.DB_URL).strip()
            if db_url.startswith("sqlite"):
                db_path = db_url.split("///", 1)[1] if "///" in db_url else ""
                if db_path and db_path != ":memory:":
                    Path(db_path).expanduser().parent.mkdir(parents=True, exist_ok=True)
                _async_engine = create_async_engine(
                    db_url, echo=False, poolclass=NullPool, connect_args={"check_same_thread": False}, future=True
                )
            else:
                _async_engine = create_async_engine(db_url, echo=False, future=True, pool_pre_ping=True, pool_recycle=3600)
        else:
            # attempt to create MySQL async engine; may raise ModuleNotFoundError if driver missing
            _async_engine = create_async_engine(
                _mysql_async_url(),
                echo=False,
                future=True,
                pool_size=20,           # Increase pool size from default 5
                max_overflow=40,        # Increase overflow from default 10
                pool_timeout=30,        # Connection timeout in seconds
                pool_recycle=3600,      # Recycle connections after 1 hour
                pool_pre_ping=True,     # Verify connections before using
            )
    except ModuleNotFoundError as exc:
        # Fail fast in non-testing environments: do not silently fall back to in-memory sqlite.
        raise RuntimeError(
            "Async MySQL driver is not installed or not available.\n"
            "Install an async MySQL driver (for example: 'pip install asyncmy') and ensure your DB settings are correct,\n"
            "or set TESTING=True / run under pytest to use the in-memory sqlite fallback for tests.\n"
            f"Original error: {exc}"
        ) from exc
    except Exception as exc:
        # Any other failure creating the engine should also surface immediately so the application fails fast
        raise RuntimeError(f"Failed to create async DB engine: {exc}") from exc

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
    """Create a new AsyncSession. IMPORTANT: Caller must close the session when done."""
    _create_engine_and_session()
    assert _AsyncSessionLocal is not None, "Async sessionmaker was not initialized"
    return _AsyncSessionLocal()


async def get_async_session_dependency():
    """FastAPI dependency that yields a session and ensures it's closed after use."""
    _create_engine_and_session()
    assert _AsyncSessionLocal is not None, "Async sessionmaker was not initialized"
    session: AsyncSession = _AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.close()
