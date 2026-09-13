# Mongo Administrator

A browser-based administration console for MongoDB — mongo-express and Compass in
a web app. Connect to any deployment, browse databases and collections, edit
documents, manage indexes, run aggregation pipelines, and read server status.

The console itself is a pure front-end build (static HTML, CSS and JS). It talks
to one RESTful bridge in `backend/fastapi`, because a browser cannot open a raw
TCP socket and MongoDB has no HTTP interface of its own.

---

## Features

### Connect

- Fill in **host, port, username, password**, or paste a **connection string**
  (`mongodb://`, `mongodb+srv://`) — whichever you have to hand.
- TLS, SRV lookup, replica set and auth source are all supported.
- **You stay signed in until you log out**, across page reloads and across a
  backend restart. The password never reaches browser storage; the server keeps
  the connection string sealed with AES-GCM.

### Browse

- A database → collection tree with live filtering.
- Query with the syntax you already know:
  `{ status: "active" }`, `{ _id: ObjectId("…") }`, `{ created: { $gte: ISODate("2026-01-01") } }`.
  Unquoted keys, single quotes, trailing commas, `//` comments and `/regex/i`
  literals all work.
- **Table view** colours values by BSON type; **JSON view** shows whole documents
  in mongosh spelling.
- Sort, project, page, and select rows for bulk delete.
- Export the current filter as **JSON, JSONL or CSV**.

### Edit

- Insert one document or an array of them.
- Edit any document as text; saving replaces it, matched by `_id`.
- Delete one, delete a selection, or empty the whole collection — each behind a
  confirmation that makes you type the name.

### Indexes

List, create (unique, sparse, TTL, `2dsphere`, `text`, `hashed`) and drop.
The `_id_` index is protected.

### Aggregate

A pipeline editor with live validation, result cards, a few starting snippets,
and a per-collection history you can click back into.

### Stats and server

`dbStats` and `collStats` as headline tiles plus the full raw output;
`serverStatus`, `buildInfo`, connection counters, opcounters and the operations
currently in progress.

### Everything else

Light and dark themes, keyboard submit (`⌘`/`Ctrl` + `Enter`), copy-to-clipboard,
and a layout that survives a phone-width window.

---

## Requirements

| | Version | Notes |
|---|---|---|
| Node.js | 20.19+ or 22.12+ | Vite 8 requires it |
| Python | 3.11+ | for the API bridge |
| MongoDB | 4.4+ | the server you want to administer |

---

## Installation

### 1. The API bridge (`backend/fastapi`)

The bridge lives in the existing FastAPI service. If you already run it for the
other web apps in this repository, you only need to install `pymongo` and set the
new environment variables.

```bash
cd backend/fastapi

# create and activate a virtual environment
python -m venv .venv
.venv/Scripts/activate          # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

`requirements.txt` now includes `pymongo>=4.13`, which is where PyMongo's native
async API (`AsyncMongoClient`) lives. Motor is not used — it reached end of life
in May 2026.

Copy `.env.example` to `.env` and set at least this:

```bash
# Seals stored session credentials at rest. CHANGE THIS before any shared
# deployment — rotating it invalidates every open session.
MONGOADMIN_SECRET_KEY=something-long-and-random

# Where sessions are mirrored so a restart does not sign everybody out.
MONGOADMIN_SESSION_FILE=data/mongoadmin-sessions.json
MONGOADMIN_PERSIST_SESSIONS=true

MONGOADMIN_CONNECT_TIMEOUT=10       # seconds to reach the deployment
MONGOADMIN_OPERATION_TIMEOUT=60     # seconds before an operation is abandoned
MONGOADMIN_POOL_SIZE=10             # pooled connections per session
MONGOADMIN_MAX_DOCUMENTS=1000       # hard cap on documents returned by one call
```

Run it:

```bash
./run_fastapi.ps1
# or: python -m uvicorn src.main:app --reload --port 6789
```

Check that it is up: `http://localhost:6789/docs` should list a
**mongo-administrator** section with 21 paths.

> **Note on `API_PREFIX`.** The bridge mounts every router under
> `settings.API_PREFIX`. In this repository's `.env` it is empty, so the routes
> are `/mongoadmin/…`. If you set it to `/api/v1`, they become
> `/api/v1/mongoadmin/…` and the front-end's `VITE_API_BASE` has to match.

### 2. The front-end (this folder)

```bash
cd mongo-administrator
npm install
cp .env.example .env     # the defaults are fine for local development
npm run dev
```

The dev server opens `http://localhost:5175` and proxies `/mongoadmin` to
`VITE_DEV_API_TARGET` (default `http://localhost:6789`), so the browser stays on
one origin and CORS never enters the picture.

---

## Development

```bash
npm run dev          # dev server with hot reload, port 5175
npm run build        # type-check and build into dist/
npm run preview      # serve the build locally
npm run lint         # eslint, zero warnings allowed
npm run typecheck    # tsc --noEmit
npm test             # vitest, single run
npm run test:watch   # vitest in watch mode
npm run coverage     # coverage for src/lib and src/store
```

Back-end tests:

```bash
cd backend/fastapi
TESTING=1 .venv/Scripts/python -m pytest tests/domain/test_mongo_utils.py \
  tests/application/test_mongo_admin_usecase.py \
  tests/adapter/input/controller/test_mongo_admin_controller.py \
  tests/adapter/output/mongogateway -q
```

Neither suite needs a running MongoDB.

---

## Building for production

```bash
npm run build
```

`dist/` then holds a static site — about 68 KB gzipped in total:

```
dist/index.html                  0.67 kB │ gzip:  0.36 kB
dist/assets/index-*.css         19.13 kB │ gzip:  4.44 kB
dist/assets/index-*.js          65.26 kB │ gzip: 17.85 kB
dist/assets/react-*.js         139.82 kB │ gzip: 45.33 kB
```

Serve it with any static file server. The build uses relative asset paths
(`base: './'`), so it works from a sub-path without reconfiguration.

Point it at the bridge with an `.env` at build time:

```bash
# .env — include the backend's API_PREFIX if it has one
VITE_API_BASE=https://api.example.com
```

### Serving from the FastAPI app

The bridge already serves static web apps out of `backend/fastapi/webapp/`.
Copy the build in and it is reachable without a second server:

```bash
npm run build
cp -r dist ../backend/fastapi/webapp/mongo-administrator
```

Then open `http://localhost:6789/webapp/mongo-administrator/`. Same origin as the
API, so leave `VITE_API_BASE` empty.

### Cross-origin deployments

If the console is served from a different origin than the bridge, set the
backend's CORS list:

```bash
# backend/fastapi/.env
FRONTEND_ALLOWED_ORIGINS=https://mongo-admin.example.com
```

---

## Security notes

Read these before putting this anywhere shared.

- **This is an administration console.** Anyone who can reach it can reach every
  MongoDB deployment the backend can reach, with whatever credentials they type.
  It belongs behind your own authentication, on an internal network, or on
  localhost.
- **`MONGOADMIN_SECRET_KEY` is the one secret that matters.** It seals stored
  connection strings. Change it from the default, keep it out of version control,
  and rotate it to invalidate every open session at once.
- **Sessions do not expire.** That is what "stay logged in until you log out"
  means. Logging out closes the driver client and deletes the session.
- **Without `cryptography` installed**, the session file mirror disables itself
  rather than writing credentials in the clear — sessions then last only as long
  as the process.
- **`$out` and `$merge` in the aggregation console write to collections.** They
  are not blocked.
- **System databases are protected.** `admin`, `local` and `config` cannot be
  dropped through the UI.

---

## Troubleshooting

**"Cannot reach the API bridge. Is the FastAPI backend running?"**
The bridge is not up, or `VITE_DEV_API_TARGET` / `VITE_API_BASE` points somewhere
else. Check `http://localhost:6789/docs`.

**Every request returns 404**
`API_PREFIX` and `VITE_API_BASE` disagree. If the backend mounts at `/api/v1`,
`VITE_API_BASE` must end in `/api/v1`.

**"Could not reach the MongoDB deployment"**
The host, port or firewall, not the app. The message includes what the driver
tried. For a container, remember that `localhost` inside the backend is not
`localhost` on your machine.

**"Authentication failed"**
Usually the auth source. The user is defined in a specific database — often
`admin`, not the one you are browsing. Set **Auth source** on the login form, or
add `?authSource=admin` to the connection string.

**Connected, but no databases are listed**
The account can authenticate but lacks `listDatabases`. Either grant it, or
connect with a database named in the form, which scopes the console to it.

**Sessions disappear after a backend restart**
`MONGOADMIN_PERSIST_SESSIONS` is false, `MONGOADMIN_SECRET_KEY` is empty, or
`cryptography` is not installed. The backend log says which.

**`mongodb+srv://` fails to resolve**
SRV needs DNS TXT and SRV lookups from the backend host. `dnspython` ships with
`pymongo`, but the network still has to allow the query.

---

## Tech stack

React 18 · TypeScript 5 (strict) · Vite 8 · zustand 4 · Vitest 5 · plain CSS with
design tokens. No UI framework, no CSS framework, no editor library — the whole
front-end is four dependencies and 68 KB.

On the server: FastAPI, pydantic v2, `pymongo>=4.13` (`AsyncMongoClient`), and
`cryptography` for session sealing, laid out in the same hexagonal structure as
the rest of `backend/fastapi`.
