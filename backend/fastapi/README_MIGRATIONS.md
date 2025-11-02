# Database migrations (Alembic)

This folder contains Alembic configuration for database migrations for the FastAPI backend.

Quick start:

1. Activate your Python environment and install requirements (if not already):

```powershell
cd backend/fastapi
python -m pip install -r requirements.txt
```

2. Generate a new migration (autogenerate based on SQLAlchemy models):

```powershell
cd backend/fastapi
# create an autogenerate revision
alembic revision --autogenerate -m "create tables"
```

3. Apply migrations to the configured database (will use DB config from `src/config.py` environment variables):

```powershell
alembic upgrade head
```

Notes:
- `alembic.ini` is present at the FastAPI folder root and `alembic/env.py` configures the database URL using `src.config.settings`.
- If you prefer to run migrations against a local SQLite file for testing, set no DB_HOST env vars and the env will fall back to `alembic.db` in the FastAPI folder.
- For CI, set environment variables (DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE) before running `alembic upgrade head`.
