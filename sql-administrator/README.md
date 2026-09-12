# SQL Administrator

A browser-based administration console for MySQL and MariaDB — browse and edit data, inspect
structure, run SQL and watch the server, the way phpMyAdmin or Adminer let you.

Connect to **any** host, port, username and password. The session stays open until you log out,
including across page reloads and a backend restart.

---

## Features

### Connect
- Log in to any `host:port` with any username/password, optionally opening a database straight away.
- The session survives reloads: only an opaque token is kept in the browser, never your password.
- The login form remembers host, port, username and database — never the password.

### Browse
- Paginated data grid (25 – 500 rows per page) with first/prev/next/last.
- Click a header to sort: ascending → descending → unsorted.
- Search every column of a table at once.
- Insert, edit and delete rows through a form with per-column `NULL` toggles and type hints.
- NULLs, BLOBs and numeric columns are rendered distinctly; numbers are right-aligned.
- Tables without a primary key are shown read-only rather than guessing which row you meant.
- Export a table as **CSV**, **JSON** or a **SQL dump** (with its `CREATE TABLE`).

### Structure
- Columns with type, nullability, key, default, extra and comment.
- Indexes (with their column order) and foreign keys.
- The full `SHOW CREATE TABLE` output, copyable in one click.
- One-click `INSERT` / `UPDATE` / `DELETE` templates sent to the SQL console.

### SQL console
- Multi-statement scripts; each statement gets its own result panel with timing and row counts.
- `Ctrl/Cmd + Enter` runs everything, `Ctrl/Cmd + Shift + Enter` runs just the statement at the caret.
- Errors are reported per statement and execution stops there.
- Query history (last 50, kept in this browser) — click any entry to load it back.
- Download any result set as CSV or JSON.

### Server
- Version, uptime, connected user, thread and query counters.
- Live process list.
- The server variables that usually matter (`sql_mode`, `max_connections`, charset, …).

### Everything else
- Dark and light themes, remembered per browser.
- Create and drop databases; truncate and drop tables — each behind a type-the-name confirmation.
- Works down to phone width.

---

## Requirements

| | Version |
|---|---|
| Node.js | 18 or newer (20+ recommended) |
| Python | 3.10 or newer — for the API bridge |
| MySQL / MariaDB | any reachable server; nothing is installed by this project |

---

## Installation

### 1. The API bridge (`backend/fastapi`)

A browser cannot speak the MySQL wire protocol, so this small RESTful bridge does it. It is part of
the existing FastAPI application in this repository.

```powershell
cd backend/fastapi
.\create_venv.ps1              # or: python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Add the SQL-administrator settings to `backend/fastapi/.env` (all are optional and have defaults):

```dotenv
# Seals stored session passwords at rest. CHANGE THIS before any shared deployment —
# rotating it invalidates every open session.
SQLADMIN_SECRET_KEY=please-change-me

SQLADMIN_SESSION_FILE=data/sqladmin-sessions.json
SQLADMIN_PERSIST_SESSIONS=true     # false keeps sessions in memory only
SQLADMIN_CONNECT_TIMEOUT=10        # seconds to establish a connection
SQLADMIN_STATEMENT_TIMEOUT=60      # seconds before a statement is abandoned
SQLADMIN_POOL_SIZE=5               # pooled connections per session
SQLADMIN_MAX_ROWS=10000            # hard cap on rows returned by any single call
```

Run it:

```powershell
.\run_fastapi.ps1
# or: python -m uvicorn src.main:app --reload --port 6789
```

The endpoints live under `${API_PREFIX}/sqladmin`. With the repository's default `API_PREFIX=` that
is `http://localhost:6789/sqladmin`; interactive docs are at `/docs`.

### 2. The front-end (this folder)

```bash
cd sql-administrator
npm install
cp .env.example .env      # optional; the defaults work for local development
```

---

## Development

```bash
npm run dev
```

Opens <http://localhost:5174>. The dev server proxies `/sqladmin` to `VITE_DEV_API_TARGET`
(default `http://localhost:6789`), so the browser stays on one origin and **no CORS configuration is
needed**.

Then log in with whatever server you want to administer:

| Field | Example |
|---|---|
| Host | `localhost` or `db.example.com` |
| Port | `3306` |
| Username | `root` |
| Password | your password |
| Database | optional — leave empty to browse every schema |

---

## Building for production

```bash
npm run build      # tsc -b && vite build  →  dist/
npm run preview    # serve dist/ locally to check the build
```

The build is a static bundle (~59 KB gzipped) that can be served by any web server. Because it is
built with `base: './'`, it also works from a nested path.

Point it at the API by setting the base URL **before** building:

```dotenv
# .env — include the backend's API_PREFIX if it has one
VITE_API_BASE=https://api.example.com
```

Leave `VITE_API_BASE` empty when the bundle is served from the same origin as the API (for example
through the repository's `webapp` controller) — then requests go to `/sqladmin/...` directly and CORS
never enters the picture.

### Serving from the FastAPI app

```powershell
npm run build
Copy-Item -Recurse -Force dist ..\backend\fastapi\webapp\sql-administrator
```

It is then reachable at `http://localhost:6789/webapp/sql-administrator`.

### Cross-origin deployments

If the bundle is served from a different origin than the API, allow that origin in the backend's
`.env`:

```dotenv
FRONTEND_ALLOWED_ORIGINS=https://sqladmin.example.com
```

---

## Quality checks

```bash
npm test           # 125 vitest tests
npm run coverage   # with an HTML report in coverage/
npm run lint       # eslint, zero warnings tolerated
npm run typecheck  # tsc --noEmit
```

Back-end tests (from `backend/fastapi`, with the virtualenv active):

```bash
python -m pytest tests/domain tests/adapter/output/sqlgateway \
                 tests/application/test_sql_admin_usecase.py \
                 tests/adapter/input/controller/test_sql_admin_controller.py -q
# 140 passed
```

---

## Security notes

This is an administration tool, so running arbitrary SQL against the server you logged into is the
point. What the app does protect against is injection into the SQL *it* generates, and accidents:

- Every generated statement binds user data as parameters; identifiers are validated and backtick-quoted.
- A sort column must exist in the table; a sort direction must be `asc` or `desc`.
- `mysql`, `information_schema`, `performance_schema` and `sys` cannot be dropped.
- Row updates and deletes are keyed and capped with `LIMIT 1`.
- Dropping or truncating requires typing the object's name.
- Stored passwords are sealed with AES-GCM under `SQLADMIN_SECRET_KEY`.

Before exposing the bridge beyond localhost, put it behind your own authentication and TLS: anyone
who can reach `/sqladmin/sessions` can attempt a connection to any host your server can route to.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Cannot reach the API bridge" | The FastAPI app is not running, or `VITE_API_BASE` points at the wrong origin. |
| `Can't connect to MySQL server` (502) | Host/port wrong, the server is not listening, or a firewall is in the way. |
| `Access denied for user` (401) | Wrong credentials, or the account is not allowed to connect from the bridge's host. |
| Logged out after restarting the backend | `SQLADMIN_SECRET_KEY` changed, `SQLADMIN_PERSIST_SESSIONS=false`, or `cryptography` is not installed. |
| Table shows "read-only: no primary key" | The table has no primary key and too many columns to key a row safely. Use the SQL console. |
| Result says "truncated" | The row cap was hit — add a `LIMIT`, or raise `SQLADMIN_MAX_ROWS`. |

---

## Tech stack

**Front-end:** React 18, TypeScript 5 (strict), Vite 8, Zustand 4, Vitest 5 + Testing Library.
No UI framework, no icon package, no SQL parser — the CSS and the 16px SVG icon set are part of the
source.

**Bridge:** FastAPI, Pydantic v2, aiomysql, `cryptography` — added to the existing hexagonal
application under `backend/fastapi` (`ports → usecase → adapters`), holding no state of its own.
