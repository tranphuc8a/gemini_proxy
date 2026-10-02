FastAPI backend scaffold for gemini-proxy

This folder contains a FastAPI implementation following a hexagonal architecture
to mirror the existing Java Spring Boot backend. It's a scaffold with:

- app/main.py: FastAPI app entrypoint
- app/config.py: environment configuration
- app/db/: SQLAlchemy engine and models
- app/application/: ports and usecases
- app/adapters/: controllers, repositories, gemini client

See `requirements.txt` (runtime) and `requirements-dev.txt` (tests, migrations), plus the quick start below.

Quick start (PowerShell):

```powershell
cd 'c:\Users\tranphuc8a\Desktop\gemini_proxy\backend\fastapi'
python -m venv .venv; .\.venv\Scripts\Activate.ps1
# requirements.txt is runtime only; -dev.txt adds pytest and alembic
pip install -r requirements.txt -r requirements-dev.txt
# copy and edit the example env file, then activate it
# copy .env.example to .env and set your secrets (or set env vars directly)
# cp .env.example .env  (on PowerShell: Copy-Item .env.example .env)
# then uvicorn will pick up values via pydantic BaseSettings
uvicorn app.main:app --host 0.0.0.0 --port 6789 --reload
```

Notes:
- The gemini client is a stub; integrate the real Gemini API where indicated.
- The repositories use SQLAlchemy and expect a MariaDB/MySQL-compatible URL.
  `DB_URL=sqlite+aiosqlite:///data/dev.sqlite3` runs everything on a local file instead.
- The SQLAdmin interface is available at `/admin/` and requires `ADMIN_USERNAME` and
	`ADMIN_PASSWORD` credentials. Set `ADMIN_SECRET_KEY` to a strong value outside local development.

## Course content (`/courses`)

The course pages under `webapp/courses/` no longer embed their lessons. Content
lives in four tables (`courses` → `course_sections` → `course_groups` → `course_docs`,
migration `0003`), and the pages read it through this API:

| Endpoint | Who | What |
|---|---|---|
| `GET /courses` | public (`?all=1` + admin: drafts too) | list |
| `GET /courses/{slug}` · `/manifest` | public | course + navigation tree · tree + document metadata, **no markdown** (ETag, gzip) |
| `GET /courses/{slug}/docs/{id}` | public | one document with markdown (ETag, gzip) |
| `GET /courses/{slug}/search?q=` | public | server-side ranking, diacritic-insensitive, word-start matching; at most 6 distinct terms of 2+ letters, ranked off the event loop, answers cached per revision |
| `GET /courses/{slug}/bundle` | public, small courses only | the whole course (`COURSE_BULK_MAX_BYTES`) |
| `POST /courses/admin/verify` · `/admin/session` | — | `COURSE_ADMIN_KEY` → session token · refresh (until `COURSE_SESSION_MAX_DAYS` after the login) |
| `POST /courses` · `POST /courses/import` | admin | create · create-or-replace from a bundle |
| `PATCH` / `DELETE /courses/{slug}` | admin | edit (title, publish…) · delete |
| `PUT /courses/{slug}/structure` | admin | replace the navigation tree |
| `PUT` / `DELETE /courses/{slug}/docs/{id}` | admin | create-or-update · delete a document |
| `GET /courses/{slug}/export` | admin | the bundle, as a file |

Unpublished courses answer 404 to the public. Every write bumps the course
`version` in SQL (`version = version + 1`, under a row lock); ETags and the
in-process search index are keyed on the *revision* — row id, creation time and
version — so a course deleted and imported again never matches an old cache.

`COURSE_ADMIN_KEY` has no default: while it is empty every write endpoint
answers 403 and no session token verifies. Set a long random value in
production.

Management: the web page `webapp/courses/quan-ly-khoa-hoc/`, the CLI
`tools/manage_courses.py` (the only way to load a bundle above Vercel's 4.5 MB
request limit), and the `Courses` views in `/admin`. Bundles (file backups) are in
`../course-content/`, outside the Vercel root directory.
