# SQL Administrator — Project Structure & Design

A browser-based administration console for MySQL/MariaDB, in the spirit of phpMyAdmin and Adminer.

## Architecture at a glance

```
┌──────────────────────────────┐        ┌──────────────────────────────────┐       ┌──────────────┐
│  sql-administrator  (pure FE)│  HTTP  │  backend/fastapi   (REST bridge) │ MySQL │  Any MySQL / │
│  React + TS + Vite + Zustand │ ─────► │  hexagonal: port → usecase → adp │ ────► │  MariaDB     │
│  all UI state in the browser │  JSON  │  /sqladmin/*                     │ wire  │  server      │
└──────────────────────────────┘        └──────────────────────────────────┘       └──────────────┘
```

### Why a backend exists at all

The requirement is a **pure front-end app**, "at most with an added RESTful API". A browser cannot
open a TCP socket and speak the MySQL binary wire protocol — `fetch` and `WebSocket` are the only
transports available to page JavaScript. So a thin REST bridge is mandatory, exactly as phpMyAdmin
needs PHP. Everything else lives in the browser:

| Concern | Where it lives |
|---|---|
| Routing, views, tabs, modals | Browser (React) |
| Paging, sorting, filtering state | Browser (Zustand) |
| Query history, theme, remembered host | Browser (`localStorage`) |
| Client-side CSV/JSON export of a result set | Browser |
| SQL generation with bound parameters | Backend (never trust the client with it) |
| Connection pooling, session sealing | Backend |

The bridge holds **no business state of its own** — it has no schema, no migrations and no tables.
It only forwards statements to whatever server the user logged into.

---

## Directory layout

### Front-end — `/sql-administrator`

```
sql-administrator/
├── index.html                    # Vite entry document
├── package.json                  # scripts: dev, build, preview, lint, typecheck, test, coverage
├── vite.config.ts                # dev server + /sqladmin proxy + vitest config
├── tsconfig.json                 # app compilation (strict, ES2022)
├── tsconfig.node.json            # vite.config.ts compilation (composite project)
├── eslint.config.js              # flat config: typescript-eslint + react-hooks + react-refresh
├── .env.example                  # VITE_API_BASE, VITE_DEV_API_TARGET
├── README.md                     # install / build / run / deploy
│
├── prompt/
│   ├── prompt.md                 # the original request
│   ├── PROJECT_STRUCTURE.md      # this file
│   └── compact_260912.md         # Vietnamese handoff summary
│
└── src/
    ├── main.tsx                  # React root, stylesheet imports
    ├── App.tsx                   # session gate → shell, view switch, theme attribute
    ├── types.ts                  # mirrors the backend value objects, 1:1
    ├── store.ts                  # Zustand store: all state + every action
    ├── vite-env.d.ts             # typed import.meta.env
    │
    ├── lib/
    │   ├── api.ts                # REST client, envelope unwrapping, ApiError
    │   ├── sql.ts                # identifier quoting, statement templates, row keys, CSV/JSON
    │   ├── format.ts             # cell rendering, byte/number/duration formatting
    │   └── storage.ts            # localStorage wrappers, history, blob downloads
    │
    ├── components/
    │   ├── ConnectScreen.tsx     # host / port / user / password / database form
    │   ├── Topbar.tsx            # target identity, view tabs, theme, log out
    │   ├── Sidebar.tsx           # database picker, table list, filter, create/drop DB
    │   ├── TableBrowser.tsx      # data view: toolbar, grid, pager, export, row editor
    │   ├── StructureView.tsx     # columns, indexes, foreign keys, DDL, templates
    │   ├── SqlConsole.tsx        # editor, run / run-statement, results, history
    │   ├── ServerView.tsx        # status tiles, process list, variables
    │   ├── DataGrid.tsx          # the one table renderer, shared by browse and console
    │   ├── RowEditor.tsx         # insert/edit modal with per-field NULL toggles
    │   ├── ConfirmDialog.tsx     # destructive-action dialog (type-to-confirm)
    │   ├── useConfirm.tsx        # promise-based wrapper around ConfirmDialog
    │   ├── Toasts.tsx            # notification stack
    │   └── Icons.tsx             # inline 16px SVG set (no icon dependency)
    │
    ├── styles/
    │   ├── tokens.css            # colour/typography tokens, light + dark palettes
    │   └── app.css               # every component style, grouped by area
    │
    └── test/
        ├── setup.ts              # jsdom shims for clipboard and object URLs
        ├── api.test.ts           # request shapes, envelope, auth, export (19)
        ├── sql.test.ts           # quoting, templates, row keys, CSV/JSON (37)
        ├── format.test.ts        # cell rendering and formatting (29)
        ├── storage.test.ts       # persistence, history dedupe, hostile storage (17)
        └── store.test.ts         # every store action against a mocked API (23)
```

### Back-end additions — `/backend/fastapi`

Follows the existing hexagonal layout of the project (`domain` → `application` → `adapter`).

```
backend/fastapi/src/
├── domain/
│   ├── vo/sqladmin_vo.py                    # NEW  pydantic request/response models
│   └── utils/
│       ├── sql_identifier.py                # NEW  backtick quoting, literal escaping, sort direction
│       └── sql_script.py                    # NEW  statement splitter, read/write classifier, JSON coercion
│
├── application/
│   ├── ports/input/sql_admin_input_port.py   # NEW  the use-case contract
│   ├── ports/output/
│   │   ├── sql_gateway_output_port.py        # NEW  ConnectionProfile, RawResult, gateway contract
│   │   └── sql_session_output_port.py        # NEW  StoredSession, session-store contract
│   └── usecases/sql_admin_usecase.py         # NEW  all behaviour; builds SQL with bound parameters
│
└── adapter/
    ├── input/controllers/sql_admin_controller.py  # NEW  14 routes under /sqladmin
    ├── factory/sql_admin_factory.py               # NEW  process-wide singletons + shutdown hook
    └── output/sqlgateway/
        ├── mysql_gateway.py                        # NEW  aiomysql pools, error translation
        ├── session_store.py                        # NEW  in-memory + sealed JSON mirror
        └── crypto.py                               # NEW  AES-GCM seal/unseal for stored passwords

Modified: src/main.py (router + shutdown), src/application/config/config.py (7 settings), requirements.txt (cryptography)
```

---

## REST contract

All routes sit under `${API_PREFIX}/sqladmin` and answer with the project's standard envelope
`{status_code, message, data}`. The session token travels in `X-Session-Token` (an
`Authorization: Bearer` header is also accepted).

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Connect; returns the session token |
| GET | `/sessions/current` | Restore a session after a page reload |
| DELETE | `/sessions/current` | Log out; closes the pooled connections |
| GET | `/databases` | List schemas with charset/collation |
| POST | `/databases` | `CREATE DATABASE` |
| DELETE | `/databases/{db}` | `DROP DATABASE` (system schemas refused) |
| GET | `/databases/{db}/tables` | Tables and views with engine, row estimate, size |
| GET | `/databases/{db}/tables/{t}/structure` | Columns, indexes, foreign keys, primary key, DDL |
| DELETE | `/databases/{db}/tables/{t}` | `DROP TABLE` |
| POST | `/databases/{db}/tables/{t}/truncate` | `TRUNCATE TABLE` |
| GET | `/databases/{db}/tables/{t}/rows` | Browse with `limit`, `offset`, `order_by`, `direction`, `search` |
| POST | `/databases/{db}/tables/{t}/rows` | Insert a row |
| PATCH | `/databases/{db}/tables/{t}/rows` | Update a row identified by `key` |
| POST | `/databases/{db}/tables/{t}/rows/delete` | Delete rows (keys travel in the body) |
| POST | `/query` | Run an ad-hoc script; one result object per statement |
| GET | `/server/overview` | Version, uptime, status counters, variables |
| GET | `/server/processes` | `SHOW FULL PROCESSLIST` |
| GET | `/databases/{db}/tables/{t}/export` | Download the table as `csv`, `json` or `sql` |

---

## Session model

The requirement is that a login **survives until the user logs out**. Three pieces cooperate:

1. **Browser** — `localStorage['sqladmin.token']` holds only an opaque 32-byte token. The password
   is never written to the browser; the login form remembers host/port/user/database only.
2. **Backend registry** — `FileSessionStore` keeps sessions in memory and mirrors them to
   `data/sqladmin-sessions.json`. The target password is sealed with **AES-GCM** under a key derived
   from `SQLADMIN_SECRET_KEY` (PBKDF2-SHA256, 120k iterations), so the file alone does not disclose
   credentials. Rotating the secret invalidates every stored session, by design.
3. **Connection pool** — `MySqlGateway` keeps one `aiomysql` pool per session token, created lazily
   on first use and closed on logout or application shutdown.

On reload the app calls `GET /sessions/current`; a 401 clears the token and returns to the login form.

```
login → probe credentials → token issued ─┐
                                          ├─► memory registry ──► sealed JSON file
reload → GET /sessions/current ───────────┘
logout → DELETE /sessions/current → pool closed, record removed, token cleared
```

---

## Safety model

This is an administration tool: running arbitrary SQL is the *feature*, exactly as in phpMyAdmin.
The protections therefore target mistakes and injection into generated SQL, not the user's own
intent.

- **Values are always bound.** Every generated statement (browse, insert, update, delete, count,
  export) passes user data as `%s` parameters. No user value is ever concatenated into SQL.
- **Identifiers are validated and quoted.** Schema/table/column names go through
  `quote_identifier()` (backticks, doubled internal backticks, length and NUL checks). A sort column
  must additionally appear in the table's real column list; a sort direction must be `asc`/`desc`.
- **Charset and collation** in `CREATE DATABASE` match `^[A-Za-z0-9_]{1,64}$`.
- **System schemas** (`mysql`, `information_schema`, `performance_schema`, `sys`) cannot be dropped.
- **Row edits are capped** with `LIMIT 1` and require a key; the UI marks a key-less wide table
  read-only rather than guessing which row the user meant.
- **Destructive actions** (drop table, drop database, truncate) require typing the object's name.
- **Result sets are capped** (`max_rows`, hard limit `SQLADMIN_MAX_ROWS`) and flagged as truncated.
- **Statement timeout** (`SQLADMIN_STATEMENT_TIMEOUT`) stops a runaway query from pinning a worker.

---

## State management

A single Zustand store (`src/store.ts`) owns everything; components subscribe to individual slices
so a row-selection change does not re-render the sidebar.

```
session ── connect / restoreSession / disconnect
navigation ── databases, tables, currentDatabase, currentTable, view
browse ── page, structure, limit, offset, sort, search, selectedRows
console ── sql, results, running, history
server ── overview, processes
chrome ── toasts, theme
```

Notable behaviours encoded in the store rather than in components:

- Sorting a column cycles **ascending → descending → unsorted**.
- Changing the page size or the search term returns to the first page.
- A successful *write* run from the SQL console refreshes the table currently on screen.
- An update that matched a row but changed nothing reports "no row changed" as info, not success.
- Error toasts stay until dismissed; success and info toasts self-dismiss after 4s.

---

## Testing

| Suite | Command | Count |
|---|---|---|
| Front-end (vitest + jsdom) | `npm test` | 125 |
| Back-end domain utils | `pytest tests/domain` | 40 |
| Back-end session store + crypto | `pytest tests/adapter/output/sqlgateway` | 20 |
| Back-end use cases (fake gateway asserts the generated SQL) | `pytest tests/application/test_sql_admin_usecase.py` | 55 |
| Back-end router (dependency-overridden use case) | `pytest tests/adapter/input/controller/test_sql_admin_controller.py` | 25 |

The use-case suite is the important one: a `FakeGateway` records every statement and parameter list,
so the tests assert the *exact* SQL produced — `UPDATE \`shop\`.\`users\` SET \`name\` = %s WHERE
\`id\` = %s LIMIT 1` with `['bo', 7]` — which is what keeps the injection defences honest.
