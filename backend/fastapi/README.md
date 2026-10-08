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
| `GET /courses/search?q=` | public | the same ranking across every published course (the portal's Ctrl+K); each hit carries `course`, `courseTitle`, `courseIcon`, `webapp` |
| `GET /courses/{slug}/graph` | public like the course | links between the course's documents `{edges, docCount}` (the knowledge map), cached per revision |
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

## AI features (`/ai`) and the Gemini quota

The chat (`/gemini/*`) and every AI feature spend one Gemini quota
(`GEMINI_URL` + `GEMINI_API_KEY`), so they go through one door
(`src/application/usecases/ai_usecase.py`):

| Rule | Setting |
|---|---|
| Kill switch — `false` stops every Gemini call, the chat included | `AI_ENABLED` |
| Who may use the AI features: `admin` (default), `code` (anyone holding `AI_ACCESS_CODE`, exchanged for a token), `public`. The chat keeps its public access | `AI_ACCESS`, `AI_ACCESS_CODE`, `AI_SESSION_DAYS` |
| Per client address, in-process (administrators are exempt) → 429 + `Retry-After` | `AI_RATE_PER_MINUTE`, `AI_RATE_PER_DAY` |
| Per UTC day for the whole deployment, counted in the database (one conditional UPDATE shared by every instance) → 429 until midnight UTC | `AI_DAILY_REQUESTS`, `AI_DAILY_TOKENS` |
| Model of the AI features (the chat picks its own) | `AI_MODEL`, `AI_TIMEOUT_SECONDS` |

Requests and tokens are booked per day and feature (table `ai_usage`; chat
tokens are estimates), and answers that depend only on their inputs are cached
30 days (table `ai_cache`) — migration `0005`. If the database is down the
budget and the books are skipped with a warning; the per-address limits stay.

| Endpoint | Who | What |
|---|---|---|
| `GET /ai/status` | public | what this caller may do: `enabled`, `access`, `allowed`, `needs` (`code` / `admin`) |
| `POST /ai/session` | public (rate limited) | `{code}` → AI token, sent back as `X-AI-Session` |
| `GET /ai/usage?days=30` | admin | rows per day and feature, today's budget, the configuration |
| `POST /ai/tutor` | `AI_ACCESS` | the tutor beside a lesson: `summary`, `explain` (+ a selected passage), `quiz`, `cards`, `ask` (answers from the lesson and related lessons, citing them); cached per lesson revision |
| `POST /ai/ask` | `AI_ACCESS` | a question about anything in the published courses, answered from the best lessons with citations; `found: false` and no model call when nothing matches |
| `POST /ai/draft/outline` · `/ai/draft/lesson` | admin | a course outline from a topic / text / URL (fetched SSRF-safe: public addresses only, no redirects to private ones, size cap) / PDF (≤ 3 MB base64, Vercel's body limit) · one lesson of it as markdown |
| `POST /ai/opic` | `AI_ACCESS` | feedback on a recorded OPIc answer (WAV ≤ 90 s): transcript, level NL…AL, five scores, fixes |
| `POST /ai/sql` | `AI_ACCESS` + SQL admin `X-Session-Token` | a question → SQL for one database. The model reads that connection's tables, columns and foreign keys (never rows); every statement comes back classified `readOnly` (strict: `FOR UPDATE`, `INTO OUTFILE`, `WITH … DELETE` are not) and EXPLAINed on the user's connection — EXPLAIN never runs it; the first failure goes back to the model once with MySQL's error. The app runs reads on request and asks before anything else |
| `POST /ai/mongo` | `AI_ACCESS` + Mongo admin `X-Session-Token` | a question → `find` (filter/projection/sort/limit) or an aggregation pipeline, as Extended JSON. The model sees field paths and types of a 30-document sample and only the values of short repeated strings; `writes` flags `$out`/`$merge`, `risky` flags `$where`/`$function`/`$accumulator` |
| `POST /ai/http` | `AI_ACCESS` | Postman Lite: `explain` a response (summary, details, problems, next steps) or write `tests` for it (`pm.*` only — scripts naming network, timers, eval, globals or prototype tricks are refused). Credentials in headers, query strings and JSON bodies, and JWTs, are masked before the model sees them |
| `POST /ai/spending` | `AI_ACCESS` | Quản lý chi tiêu: free text → proposed expenses/incomes (date, whole đồng, category, who paid, who shares, group). The model sees the text and the NAMES with ids of the user's categories, accounts, people and groups — never balances or past transactions; ids the page did not send are dropped, amounts must be whole positive đồng, exact splits must add up. Nothing is saved server-side and the answer is never cached |
| `POST /ai/chat` | `AI_ACCESS` | one stateless answer from a chosen model (`gemini-2.5-pro`, `…-flash`, `…-flash-lite`, `2.0-flash`, `2.0-flash-lite`, `flash-latest`) — Gemini Chat's "compare two models" sends two of these side by side. Never cached |

Each feature books its usage under its own name (`tutor_summary`, `ask`, `sql`,
`mongo`, `http_explain`, `http_tests`, `compare`, …). The course management page
shows the same as **🤖 AI**. Browser checks never reach the real Gemini:
`webapp/courses/engine/kiem_khoa_hoc.MayChuThu` points `GEMINI_URL` at a local
stand-in (`GeminiGia`) that answers by `responseSchema`; unit tests use
`tests/support/fake_ai.py`.

## Algorithm arena (`/arena`)

`webapp/dau-truong-thuat-toan/` — write a travelling-salesman heuristic in
JavaScript, run it in a Web Worker in the browser (10 s limit), submit the tour.
The server rebuilds the cities from the problem's seed, checks the tour visits
every city exactly once and measures it itself — the number the page shows is
never trusted. Table `arena_scores` (migration `0006`), best score per name.

| Endpoint | What |
|---|---|
| `GET /arena/problems` · `/arena/problems/{id}` | the problems (`tsp-60`, `tsp-200`, `tsp-1000`) · one with its city coordinates (cached a day) |
| `POST /arena/problems/{id}/submit` | `{name, tour}` → `{score, improved, rank}` (the server's own measurement); 60 submissions per hour per address |
| `GET /arena/problems/{id}/leaderboard` | `{problem, rows: [{rank, name, score, updatedAt}]}` — the top 20 |

## Spending (`/spending`)

`webapp/tranphuc8a/quan-ly-chi-tieu/` — a personal-spending ledger that works
offline in the browser and can sync to a server. Every figure is computed in the
browser; the server only keeps **one JSON document per workspace** with a
`revision`, so the document is opaque to it. Workspaces are reached with the
access key shown once at creation (`X-Workspace-Key` or `Authorization: Bearer`;
only its SHA-256 is stored). Storage: `?backend=json|mysql|mongo`, default
`SPENDING_STORAGE_BACKEND` (table / collection `spending_workspaces`, created on
first use). `SPENDING_MAX_BYTES` (4 000 000) caps the serialised document.

| Endpoint | Key | What |
|---|---|---|
| `GET /spending/backends` | — | `{default, backends: [{id, available, reason}]}` |
| `POST /spending/workspaces` | — | `{name?, data?}` → `201 {id, name, access_key, revision: 1, created_at}`; `data` becomes revision 1. 400 when `data` is not an object or exceeds the limit |
| `GET /spending/workspaces/{id}?since=N` | yes | the workspace; when `N` is still the current revision: `{unchanged: true}` and no `data`. 404 before 401 |
| `PUT /spending/workspaces/{id}` | yes | `{revision, name?, data}` → the new view (`revision + 1`). **409** with `data.current` when `revision` is stale or a concurrent save won (atomic compare-and-set in all three stores) |
| `DELETE /spending/workspaces/{id}` | yes | `{deleted: true}` |
