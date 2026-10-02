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
migration `0003`), plus uploaded files, document history and the trash
(`course_assets`, `course_doc_revisions`, `course_trash`, migration `0004`). The
pages read it through this API:

| Endpoint | Who | What |
|---|---|---|
| `GET /courses` | public (`?all=1` + admin: drafts too) | list |
| `GET /courses/{slug}` · `/manifest` | public | course + navigation tree · tree + document metadata, **no markdown** (ETag, gzip); the manifest carries `aliases` (old slug → document) and `idAliases` (old id → new id) |
| `GET /courses/{slug}/docs/{id}` | public | one document with markdown (ETag, gzip) |
| `GET /courses/{slug}/search?q=` | public | server-side ranking, diacritic-insensitive, word-start matching; at most 6 distinct terms of 2+ letters, ranked off the event loop, answers cached per revision |
| `GET /courses/{slug}/bundle` | public, small courses only | the whole course (`COURSE_BULK_MAX_BYTES`) |
| `GET /courses/{slug}/assets/{name}` | public like the course | an uploaded file (type from the extension; SVG under a sandbox CSP) |
| `POST /courses/admin/verify` · `/admin/session` | — | `COURSE_ADMIN_KEY` → session token (5 failures per address in 5 min, 50 overall → 429 `Retry-After`) · refresh (until `COURSE_SESSION_MAX_DAYS` after the login) |
| `POST /courses` · `/import` · `/{slug}/duplicate` | admin | create (empty or from a template: `trong`, `co-ban`, `chu-de`) · create-or-replace from a bundle (the replaced course goes to the trash) · copy as a draft |
| `PATCH` / `DELETE /courses/{slug}` | admin | edit (title, publish…) · move to the trash |
| `PUT /courses/{slug}/structure` | admin | replace the navigation tree |
| `PUT` / `DELETE /courses/{slug}/docs/{id}` · `POST /{slug}/rename` | admin | create-or-update (≤ `COURSE_DOC_MAX_BYTES`) · move to the trash · change a document's id (learner progress follows) |
| `GET /courses/{slug}/history?doc=` · `/history/{rev}` | admin | the last 30 versions of a document |
| `GET /courses/trash` · `POST …/trash/courses/{id}/restore` · `POST /{slug}/trash/{rev}/restore` · `DELETE /courses/trash/courses/{id}` | admin | deleted courses and documents (kept 30 days): list · restore · forget |
| `GET` / `PUT` / `DELETE /courses/{slug}/assets[/{name}]` | admin | list (with which documents use each file) · upload a raw body (≤ `COURSE_ASSET_MAX_BYTES`) · delete |
| `GET /courses/{slug}/links` | admin | broken links between documents and files, who links to whom |
| `GET /courses/{slug}/export` | admin | the bundle including files (base64), as a file |

Writes an editor makes from something it loaded accept `If-Match` with the
`rev` / `treeRev` / `infoRev` it was given; if someone saved in between the answer
is 409 with the current version in `data.current` instead of a silent overwrite.
`PUT …/docs/{id}` with `If-None-Match: *` only creates.

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
