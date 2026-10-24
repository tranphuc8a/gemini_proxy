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
| Default model of the AI features and the chat (a caller may pick another with `X-AI-Model`; see `GET /ai/models`) | `AI_MODEL` (default `gemini-3.5-flash`), `AI_TIMEOUT_SECONDS` |
| Models a caller may pick: empty = the live `models.list` of Gemini (text models, newest first, cached `AI_MODELS_TTL_SECONDS`); a comma-separated list pins it. Pro models are administrators' only | `AI_MODELS`, `AI_MODELS_TTL_SECONDS` |

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
| `GET /ai/models` | public | the Gemini models this caller may pick (`X-AI-Model` header on any AI call, or `model` in the chat body), newest first, each `allowed` for this caller; `source` is `api` (live list), `config` (`AI_MODELS`) or `fallback`. An unknown name is 400 `ai_model_unknown`, a Pro model for a non-administrator 403 `ai_model_admin_only` — the chat no longer falls back silently to 2.5 Flash |
| `POST /ai/review` | `AI_ACCESS` | grade a learner's own answer to a review card against the card's answer: 0–5 (what SM-2 needs), verdict, feedback, what is missing. An empty answer is graded 0 without a model call |
| `POST /ai/hint` | `AI_ACCESS` | a hint for a failing self-checked code exercise, level 1 (direction) / 2 (where it goes wrong) / 3 (steps) — never the finished code: long code blocks are cut at levels 1–2 |
| `POST /ai/notes` | `AI_ACCESS` | a course notebook → a study summary or review cards, each pointing at its lesson; not cached (the learner's own writing) |
| `POST /ai/opic/script` | `AI_ACCESS` | feedback on a WRITTEN OPIc script before practising it: level, grammar / vocabulary / task / coherence, fixes, a better version |
| `POST /ai/draft/assist` | admin | the lesson editor's assistant on a selected passage: rewrite, expand, shorten, simplify, translate, quiz, or a self-checked Python/JS exercise (rejected unless it carries hidden checks) |
| `POST /ai/markdown` | `AI_ACCESS` | Markdown Editor's "smart format": raw text, notes, logs or code → readable markdown (`smart`, `tidy`, `summary`); the answer is flagged `shrunk` if it lost much of the text; never cached |
| `POST /ai/code/explain` | `AI_ACCESS` | Code Studio: explain a compile or run error. Body `{language, filename, kind: compile|runtime, code ≤ 30 000, diagnostics[≤20] {line, col, severity, message}, stderr ≤ 4 000}` → `{summary, items[1–8] {line|null, title, why, fix}, patch|null {line, endLine, replacement}, cached}`. Source and compiler output are fenced as untrusted data; the answer is re-checked against the file (a `line` or `patch` outside it is dropped, a patch is ≤ 40 lines / 4 000 chars, never identical to the text it replaces, an empty `replacement` deletes the lines). Cached per (language, file name, kind, code, diagnostics, stderr, model); no address or name reaches the model |
| `POST /ai/ask` also takes `course` | `AI_ACCESS` | with `course`, answers only from that course's own lessons (an unpublished course stays an administrator's) |
| `POST /ai/spending` | `AI_ACCESS` | Quản lý chi tiêu: free text → proposed expenses/incomes (date, whole đồng, category, who paid, who shares, group). The model sees the text and the NAMES with ids of the user's categories, accounts, people and groups — never balances or past transactions; ids the page did not send are dropped, amounts must be whole positive đồng, exact splits must add up. Nothing is saved server-side and the answer is never cached |
| `POST /ai/wiki` | `AI_ACCESS` | Personal Wiki "Soạn bằng AI": raw notes → 1–5 wiki notes `{text ≤ 12 000, hint ≤ 300, maxNotes 1–5, candidates[≤40] {ref c1…, title ≤ 200, tags ≤ 8, snippet ≤ 160}, tags[≤60]}` → `{notes[] {key, title, tags, markdown, summary, relations[] {type, target {kind: existing|batch|new, …}, reason}, existing}, newTopics[], dropped[], words, shrunk, truncated}`. The page picks the related notes on the device and sends only a ref, title, a few tags and a snippet (or titles only). A `[[link]]` or relation stays only when it names a candidate, a note of the same answer or a declared new topic; links inside code or math are not links (`application/utils/wiki_links.py`, same rules and shared fixture as the page). Nothing is saved; never cached |
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

## Markdown Editor: store, admin and read-only links (`/markdown`)

One document tree per backend (`?backend=json|mysql|mongo`, default `MARKDOWN_STORAGE_BACKEND`). Admin = `X-Admin-Session`
(minted by `/markdown/admin/verify`) or `X-Admin-Key`; the key is compared in constant time, wrong keys / forged sessions are
counted per address (`MARKDOWN_ADMIN_MAX_FAILURES` in `MARKDOWN_ADMIN_FAILURE_WINDOW_S`, then `429 markdown_admin_locked` +
`Retry-After`, even for the right key), and the public default key is accepted only from this machine itself (loopback, no proxy
header) unless `MARKDOWN_ALLOW_DEFAULT_KEY=true` — elsewhere `403 markdown_default_key_refused`. One check for every route:
`adapter/input/controllers/markdown_admin.py` (`require_markdown_admin`, `require_markdown_reader`). Details:
`docs/markdown-share-api.md`; delta sync, history and the old tree: `docs/markdown-sync-api.md`.

| Endpoint | Who | What |
|---|---|---|
| `POST /markdown/admin/verify` · `/admin/session` | key · session | `{session, expiresAt}` (`MARKDOWN_SESSION_HOURS`) |
| `GET /markdown/files` | **admin** while `MARKDOWN_PUBLIC_READ=false` (default), else public | the whole tree; a guest gets `403 markdown_private` |
| `PUT /markdown/files` | admin | replaces the whole tree (the OLD editor's save; the new editor never calls it). By default (`MARKDOWN_LEGACY_PUT=reject`), once the delta store holds a copy: `409 md_legacy_client`; `allow` restores the old behaviour |
| `GET /markdown/sync/changes?since=&limit=&device=` | **reader** (admin unless `MARKDOWN_PUBLIC_READ=true`) | delta pull: `{items: [record], cursor, more, horizon, reset}`; records newer than the cursor, a page ≤ 200 records / ~3 MB; the device's own writes come without text. The first call copies the old tree into the delta store (lazy, once, read-only on the old data) |
| `POST /markdown/sync/push` | admin | `{device, ops[≤ 200]}`, each op `{id, kind, baseRev, set?, content \| patch + baseHash, hash, deleted?, updatedAt}` → `{results: [ok \| conflict \| rejected], serverTime}`; compare-and-set on `rev`, line patches verified by hash, history written from the first push |
| `GET /markdown/docs/{id}` | **reader** | the latest text of one document (what md-share's live mode will read); `404 md_doc_not_found` |
| `GET /markdown/docs/{id}/revisions` · `/revisions/{rev}` | admin | version history (50 newest + one per day for 90 days + named), newest first without text · one version rebuilt |
| `POST /markdown/shares` | admin | `{docId, title ≤ 200, content, expiresInDays: null\|1\|7\|30}` → `201` new link / `200` refreshed snapshot (same token, same `sharedAt`): `{token, docId, title, mode, sharedAt, updatedAt, expiresAt, bytes, contentHash}`. `docId` matches `^[A-Za-z0-9_.:-]{1,80}$` (shared with the sync), `root` refused; ≤ `MARKDOWN_SHARE_MAX_BYTES` UTF-8 bytes (`400 markdown_share_too_large`); ≤ `MARKDOWN_MAX_SHARES` links (expired ones are dropped first; `400 markdown_too_many_shares`) |
| `GET /markdown/shares` | admin | `{shares: [summary + expired], limits: {maxShares, maxBytes}, persistent}` — newest first, no snapshots; `persistent: false` = JSON file in a temporary directory |
| `DELETE /markdown/shares?docId=` | admin | `{revoked: true}` (`404 markdown_share_not_found`) |
| `GET /markdown/shared` + header `X-Share-Token` | — (**public**) | `{title, content, mode, sharedAt, updatedAt, expiresAt}` — nothing else (no doc id, token, hash, store). Unknown, malformed, revoked and expired tokens: the same `404`; `MARKDOWN_SHARE_READS_PER_MIN` reads per address, 20 wrong tokens / 10 min → `429 markdown_rate_limited`. `no-store`, `X-Robots-Tag: noindex`. The token never travels in a URL |

Sharing a document whose link has **expired** makes a new link (`201`, new token): the old address stays dead.
Two documents whose ids differ only in letter case collide on MySQL's default collation: `409 markdown_share_conflict`.
A store failure while a stranger opens a link is one generic `503 markdown_share_unavailable` (the driver's message carries the
token, so it is neither logged nor returned). `X-Admin-Key` has no length cap of its own (anything a header can carry); the client
address of the wrong-key counter is `X-Real-IP` / `X-Forwarded-For` when present (shared with `/codestore`, `/wiki`, `/courses`, `/ai`): Vercel's
documentation says the platform sets/overwrites them (not verified in this repo), but a self-hosted deployment needs a proxy that
overwrites them too, or a client can dodge the counter - or burn it on somebody else's address - by sending the header.

`markdown_shares` (MySQL) is created on first use (`CREATE TABLE IF NOT EXISTS`) — by the first request of any kind that reaches the
store in a process, including a guest's `GET /markdown/shared?backend=mysql`; Mongo uses the `markdown_shares` collection; the
JSON backend `MARKDOWN_SHARES_JSON_FILE`. On a serverless platform choose mysql or mongo: the JSON file lives in a temporary directory there.

## Code Studio: running code (`/run`) and syncing it (`/codestore`)

The editor web app runs code and keeps snippets and projects. Full contract, security
model and how to host Piston/Judge0 yourself: [`docs/code-studio-api.md`](../../docs/code-studio-api.md). Ready-made compose files and a runtime
installer for the self-hosted providers are in [`deploy/code-runner/`](../../deploy/code-runner/README.md) (Piston verified against a real server).

**`/run`** — the backend is deployed serverless (no compiler, no sandbox), so code runs
at a provider the user picks per request **by id, never by URL**: `piston`, `judge0`,
`wandbox` (remote services) or `local` (programs on the server's own machine; **off by
default, not a sandbox, administrator session required**). A fault of the user's code
is a 200 with `ok: false`; a broken provider is 502/504 with `data.code`.

| Endpoint | What |
|---|---|
| `GET /run/providers` | `{providers: [{id, label, kind, available, reason, languages, multiFile, multiFileLanguages, needsSession}], default}` — no network access |
| `POST /run` | `{provider, language, files: [{name, content}], mainFile?, stdin?, args?, compileArgs?, runTimeoutMs?, compileTimeoutMs?}` → `{ok, provider, language, version, compile, run, error, warnings}`; 20 runs/min/address (`RUN_RATE_PER_MIN`) |

Settings: `RUN_ENABLED`, `RUN_DEFAULT_PROVIDER`, `RUN_PISTON_URL/KEY`, `RUN_JUDGE0_URL/KEY/KEY_HEADER/LANGUAGE_IDS`,
`RUN_WANDBOX_URL/COMPILERS`, `RUN_LOCAL_ENABLED` and `RUN_LOCAL_GCC/GXX/JAVAC/JAVA/PYTHON/NODE`, `RUN_RATE_PER_MIN`,
`RUN_HTTP_TIMEOUT_S`.

**`/codestore`** — workspaces with a secret key (no accounts), records `{id, kind: snippet|project, name,
language, files, meta, updatedAt, deleted}` merged last-writer-wins per record, deletions kept as tombstones.
`?backend=json|mysql|mongo`, default `CODESTORE_STORAGE_BACKEND` (tables `codestore_workspaces` /
`codestore_items` / `codestore_shares`, collections of the same names, created on first use).

| Endpoint | Key | What |
|---|---|---|
| `GET /codestore/backends` | — | `{default, backends: [{id, label, available, reason, persistent}]}` (no host or database names) |
| `POST /codestore/workspaces` | — | `201 {workspaceId, key}`; the key is shown once, only its SHA-256 is stored; `CODESTORE_WORKSPACES_PER_HOUR` per address |
| `GET /codestore/{id}/items?since=&limit=` | `X-Codestore-Key` | `{items, serverTime, more}` — records stored on the server after `since`; send `serverTime` back as `since` |
| `PUT /codestore/{id}/items` | `X-Codestore-Key` | `{items: [≤ 100 records, ≤ 512 KB each, ≤ 2 MB]}` → `{items, serverTime}`: what the server holds for those ids |
| `DELETE /codestore/{id}` | `X-Codestore-Key` | `{deleted: true}` — also revokes every read-only link of the workspace |
| `POST /codestore/{id}/items/{itemId}/share` | `X-Codestore-Key` | read-only link: freezes the record as the server holds it → `201 {token, sharedAt, updatedAt}`; sharing again refreshes the snapshot and keeps the token (`200`); the record must be synced and not deleted (`404 codestore_item_not_found`) |
| `GET /codestore/{id}/shares` | `X-Codestore-Key` | `{shares: [{token, itemId, name, sharedAt, updatedAt}]}` |
| `DELETE /codestore/{id}/items/{itemId}/share` | `X-Codestore-Key` | `{revoked: true}` (`404 codestore_share_not_found` if it was not shared) |
| `GET /codestore/shared/{token}` | — (**public**) | `{item: {id, kind, name, language, files, meta, updatedAt}, sharedAt}` — the snapshot, without `meta.pinned/openTabs/activeFile`, workspace id, key or server clock; unknown and revoked tokens give the same `404`; `no-store`; `CODESTORE_SHARE_READS_PER_MIN` per address, wrong tokens counted (20 / 10 min). Pass the same `?backend=` the link was made in |

Settings: `CODESTORE_STORAGE_BACKEND`, `CODESTORE_JSON_FILE`, `CODESTORE_MAX_ITEMS` (2000), `CODESTORE_WORKSPACES_PER_HOUR`,
`CODESTORE_TOMBSTONE_DAYS`, `CODESTORE_MAX_SHARES` (50 active links per workspace), `CODESTORE_SHARE_READS_PER_MIN` (120).

## Personal Wiki: syncing notes (`/wiki`)

**`/wiki`** — a simplified sibling of `/codestore` for the Personal Wiki PWA: workspaces with a secret key (no accounts), records
`{id, kind: note|card, updatedAt, deleted, data}` merged last-writer-wins per record (a tie goes to a deletion), deletions kept as
tombstones (their `data` dropped). `data` is the whole note or card and is opaque to the server (a JSON object, ≤ 1,600,000 bytes).
No share links, no files. `?backend=json|mysql|mongo`, default `WIKI_STORAGE_BACKEND` (tables `wiki_workspaces` / `wiki_items`,
collections of the same names, created on first use). Answers are bare JSON with `Cache-Control: no-store`; errors carry
`data.code` prefixed `wiki_`.

| Endpoint | Key | What |
|---|---|---|
| `GET /wiki/backends` | — | `{default, backends: [{id, label, available, reason, persistent}]}` |
| `POST /wiki/workspaces` | — | `201 {workspaceId, key}`; the key is shown once, only its SHA-256 is stored; `WIKI_WORKSPACES_PER_HOUR` per address |
| `GET /wiki/{id}/items?since=&limit=` | `X-Wiki-Key` or `Authorization: Bearer` | `{items, serverTime, more}` — records whose `serverUpdatedAt > since`, oldest first; send `serverTime` back as `since`; `limit` ≤ 500 (default page 200 records / 3 MB) |
| `PUT /wiki/{id}/items` | same | `{items: [≤ 200 records, ≤ 1.6 MB of data each, ≤ 4 MB]}` → `{items, serverTime}`: what the server holds for those ids. One bad record refuses the whole request (`400 wiki_bad_item`, `wiki_bad_clock`, `wiki_too_large`, `wiki_workspace_full`; `422` for a malformed id/kind) |
| `DELETE /wiki/{id}` | same | `{deleted: true}` |

Wrong keys are counted per address (20 in ten minutes, then `429 wiki_rate_limited` with `Retry-After`).
Settings: `WIKI_STORAGE_BACKEND`, `WIKI_JSON_FILE` (`data/wiki.json`), `WIKI_MAX_ITEMS` (300000 notes + cards + tombstones),
`WIKI_WORKSPACES_PER_HOUR` (10), `WIKI_TOMBSTONE_DAYS` (90). The JSON backend rewrites its whole file on every write: for a very
large workspace use MySQL or MongoDB.

**Rate limits and several instances.** On a serverless deployment every instance has its own memory, so a counter kept in
memory only slows abuse down. The limits of `/run` (`RUN_RATE_PER_MIN`), `/codestore` (new workspaces, wrong keys, link reads,
wrong tokens) and `/wiki` (new workspaces, wrong keys) are counted by a `RateLimiterPort` chosen with `RATE_LIMIT_BACKEND`:

| Value | Counts in | Notes |
|---|---|---|
| `memory` | the instance's memory | exact sliding window; development and tests |
| `database` | table `rate_limit_hits` of the application's SQL database (created on first use, no migration) | atomic upsert (MySQL `ON DUPLICATE KEY UPDATE`, SQLite/PostgreSQL `ON CONFLICT`); keys stored as SHA-256 |
| `mongo` | collection `rate_limits` of `MONGO_URI` (TTL index on `expire_at`) | atomic `$inc` + upsert; **never picked by `auto`** |
| `auto` (default) | `database` when `DB_URL` is not SQLite (or is unset, i.e. the `DB_*` MySQL fields) and this is not a test run; else `memory` | |

If the shared counter fails (database down, network, slower than `RATE_LIMIT_TIMEOUT_S`) the request is still served: a warning is
logged (error class only, no host, key or URI) and that instance counts in memory for 30 seconds before trying again. The `/ai/*`
limits are not affected (still in memory).
