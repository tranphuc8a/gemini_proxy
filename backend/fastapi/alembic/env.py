import os
import sys
from logging.config import fileConfig
import logging

from sqlalchemy import engine_from_config, pool
from alembic import context

# ensure both the fastapi package root and the repository root are importable
# so imports like `src.adapter...` and `backend.fastapi.src...` work when alembic runs
# env.py lives in backend/fastapi/alembic; fastapi_root points to backend/fastapi
fastapi_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
# Insert fastapi_root first so `import src...` resolves to backend/fastapi/src
sys.path.insert(0, fastapi_root)
sys.path.insert(1, repo_root)

# Import project settings and metadata
try:
    from src.application.config.config import settings
    from src.adapter.output.mysql.db.base import Base
except Exception as e:
    # If imports fail, raise a clear error for the user
    raise RuntimeError("Failed to import project settings or metadata for Alembic. Make sure PYTHONPATH includes project and dependencies are installed.") from e

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except Exception as e:
        # Some alembic.ini templates may omit logger sections referenced by
        # fileConfig (for example 'logger_sqlalchemy'). Don't fail the whole
        # migration run for missing logger config; fall back to basic logging.
        logging.basicConfig(level=logging.INFO)
        logging.getLogger(__name__).warning(
            "Could not configure logging from alembic.ini: %s. Using basicConfig instead.",
            e,
        )

# set the sqlalchemy.url programmatically from settings
# prefer explicit DB config (MySQL) when available
if getattr(settings, "DB_HOST", None):
    db_url = f"mysql+pymysql://{settings.DB_USERNAME}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_DATABASE}"
else:
    # fallback to sqlite file next to alembic.ini
    db_url = f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'alembic.db'))}"

config.set_main_option("sqlalchemy.url", db_url)

# target_metadata for 'autogenerate'
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py.
# The earlier guarded call to fileConfig already ran if a config file exists.
# Avoid calling fileConfig again unconditionally because some alembic.ini
# templates may not define all logger sections (which raises KeyError).

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    cfg_section = config.get_section(config.config_ini_section) or {}
    connectable = engine_from_config(
        cfg_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
