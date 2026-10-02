# Database migrations (Alembic)

This folder contains Alembic configuration for database migrations for the FastAPI backend.

Quick start:

1. Activate your Python environment and install requirements (if not already):

```powershell
cd backend/fastapi
# alembic lives in requirements-dev.txt, not the runtime file
python -m pip install -r requirements.txt -r requirements-dev.txt
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
- `DB_URL` (an async URL, e.g. `sqlite+aiosqlite:///data/dev.sqlite3`) overrides the DB_* fields; `env.py` swaps in the sync driver for Alembic.
- If you prefer to run migrations against a local SQLite file for testing, set no DB_HOST env vars and the env will fall back to `alembic.db` in the FastAPI folder.
- For CI, set environment variables (DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE) before running `alembic upgrade head`.

## Revisions

| Revision | What |
|---|---|
| `0001_create_initial_tables` | `conversations`, `messages` |
| `0002_change_erole_bot_to_model` | message role `bot` → `model` |
| `0003_create_course_tables` | course content: `courses`, `course_sections`, `course_groups`, `course_docs` (utf8mb4; identifiers in `utf8mb4_bin`) |

The application's startup also runs `create_all`, so on a deployment that started
before `alembic upgrade head` the course tables may already exist; `0003` creates
each table only when it is missing. After the tables exist, load the content:

```bash
python tools/manage_courses.py info
python tools/manage_courses.py import-all --yes      # backend/course-content/*.json
```
