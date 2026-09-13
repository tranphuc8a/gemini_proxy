# Mongo Administrator — Project Structure & Design

A browser-based administration console for MongoDB, in the spirit of mongo-express
and Compass: connect to any deployment, browse databases and collections, edit
documents, manage indexes, run aggregations, and read server status.

## Architecture at a glance

```
┌────────────────────────────┐        ┌──────────────────────────────┐        ┌──────────────┐
│  /mongo-administrator      │  REST  │  backend/fastapi             │ driver │              │
│  React 18 · TS · Vite      │───────▶│  /api/v1/mongoadmin/*        │───────▶│   MongoDB    │
│  zustand · no UI framework │  JSON  │  hexagonal, 4 new layers     │ pymongo│  (any host)  │
└────────────────────────────┘        └──────────────────────────────┘        └──────────────┘
        browser                           the only server-side part            chosen by the
                                          this app depends on                  user at login
```

### Why a backend exists at all

The prompt asks for a pure front-end application, "at most with a RESTful API".
That last clause is load-bearing, because a browser genuinely cannot administer
MongoDB on its own:

- MongoDB speaks a **binary wire protocol over a raw TCP socket**. A browser has
  `fetch` and `WebSocket`, neither of which can open one.
- The **Atlas Data API**, which used to offer an HTTPS route into MongoDB, was
  retired. There is no first-party HTTP endpoint left to talk to.
- Even if there were, shipping database credentials into JavaScript and letting
  every browser tab hold a connection pool is not something to design towards.

So the bridge is the minimum viable server: it holds the driver, holds the
credential, and exposes exactly the operations the UI needs. Everything above it
— the whole console — is static files.

The bridge is added to the existing `backend/fastapi` service rather than being a
new process, because that service already solves the same problem for MySQL
(`/sqladmin`, the `sql-administrator` app), including the session-sealing scheme
this feature reuses.

## Directory layout

### Front-end — `/mongo-administrator`

```
mongo-administrator/
├── index.html                  Vite entry document
├── package.json                scripts: dev, build, lint, typecheck, test, coverage
├── vite.config.ts              dev proxy (/mongoadmin → :6789), build, vitest config
├── tsconfig.json               strict, noUnusedLocals, noUnusedParameters
├── eslint.config.js            flat config, typescript-eslint + react-hooks
├── .env.example                VITE_API_BASE, VITE_DEV_API_TARGET
├── README.md                   install, build, run, deploy, troubleshoot
├── prompt/
│   ├── prompt.md               the original brief
│   ├── PROJECT_STRUCTURE.md    this file
│   └── compact_260913.md       handoff notes (Vietnamese)
└── src/
    ├── main.tsx                React root
    ├── App.tsx                 shell: splash → connect screen → workspace
    ├── types.ts                the wire contract with the bridge
    ├── store.ts                the entire application state (zustand)
    ├── lib/
    │   ├── api.ts              fetch wrapper, envelope unwrapping, ApiError
    │   ├── ejson.ts            Extended JSON: relaxed parser + shell printer
    │   ├── format.ts           bytes, numbers, durations, uptime, ranges
    │   └── storage.ts          localStorage, history, downloads
    ├── components/
    │   ├── ConnectScreen.tsx   fields-or-URI login
    │   ├── Topbar.tsx          identity, breadcrumb, tabs, theme, logout
    │   ├── Sidebar.tsx         database → collection tree, create/drop
    │   ├── DocumentBrowser.tsx query bar, table/JSON views, paging, export
    │   ├── DocumentEditor.tsx  insert/edit modal
    │   ├── IndexView.tsx       list, create, drop indexes
    │   ├── AggregateConsole.tsx pipeline editor, results, history
    │   ├── StatsView.tsx       dbStats / collStats, rename collection
    │   ├── ServerView.tsx      serverStatus, buildInfo, currentOp
    │   ├── JsonEditor.tsx      textarea with live validation
    │   ├── ConfirmDialog.tsx   type-the-name-to-confirm dialog
    │   ├── useConfirm.tsx      promise-based confirm hook
    │   ├── Toasts.tsx          transient notifications
    │   └── Icons.tsx           inline SVG icon set
    ├── styles/
    │   ├── tokens.css          design tokens, light + dark
    │   └── app.css             component styles
    └── test/                   vitest: ejson, api, store, format, storage
```

### Back-end additions — `/backend/fastapi`

Nothing existing was rewritten; the feature is a parallel set of files in the
layers the project already has.

| Layer | File | Lines | Responsibility |
|---|---|---:|---|
| domain/utils | `mongo_json.py` | 396 | Extended JSON v2 codec, namespace validation, CSV flattening |
| domain/utils | `mongo_uri.py` | 198 | build / parse / redact connection strings, no DNS, no driver |
| domain/vo | `mongoadmin_vo.py` | 210 | request + response value objects |
| ports/input | `mongo_admin_input_port.py` | 139 | the use-case contract |
| ports/output | `mongo_gateway_output_port.py` | 201 | driver contract + `MongoConnectionProfile`, `QueryOutcome`, `WriteOutcome` |
| ports/output | `mongo_session_output_port.py` | 44 | session persistence contract |
| usecases | `mongo_admin_usecase.py` | 786 | all behaviour: sessions, browsing, writes, indexes, console, export |
| adapter/output | `mongogateway/mongo_gateway.py` | 446 | `pymongo.AsyncMongoClient`, one client per session, error translation |
| adapter/output | `mongogateway/session_store.py` | 179 | in-memory sessions mirrored to a sealed JSON file |
| adapter/factory | `mongo_admin_factory.py` | 69 | process-wide singletons + shutdown hook |
| adapter/input | `mongo_admin_controller.py` | 347 | the 26 routes under `/mongoadmin` |

Modified: `src/main.py` (router + shutdown), `src/application/config/config.py`
(`MONGOADMIN_*`), `requirements.txt` (`pymongo>=4.13`), `.env.example`.

**Driver choice.** `pymongo.AsyncMongoClient` — PyMongo's native async API — not
Motor. Motor is deprecated and reached end of life in May 2026; its replacement
is the API used here, which needs `pymongo>=4.13`.

## REST contract

All routes sit under `{API_PREFIX}/mongoadmin` and every one but `POST /sessions`
requires the `X-Session-Token` header (a `Bearer` `Authorization` header also
works). Responses use the project's standard envelope:
`{status_code, message, data}`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | connect; returns the session token |
| GET | `/sessions/current` | restore a stored session |
| DELETE | `/sessions/current` | log out, close the driver client |
| GET | `/databases` | list databases |
| POST | `/databases` | create a database (and its first collection) |
| DELETE | `/databases/{db}` | drop a database |
| GET | `/databases/{db}/stats` | `dbStats` |
| GET | `/databases/{db}/collections` | list collections; `?with_stats=true` adds counts |
| POST | `/databases/{db}/collections` | create a collection (optionally capped) |
| DELETE | `/databases/{db}/collections/{c}` | drop a collection |
| POST | `/databases/{db}/collections/{c}/rename` | rename |
| POST | `/databases/{db}/collections/{c}/truncate` | delete every document |
| GET | `/databases/{db}/collections/{c}/stats` | `collStats` |
| POST | `…/documents/find` | query with filter, projection, sort, skip, limit |
| POST | `…/documents/count` | count matching documents |
| POST | `…/documents` | insert one or many |
| PATCH | `…/documents` | update (operators) or replace |
| POST | `…/documents/delete` | delete by filter |
| GET | `…/export?format=json\|jsonl\|csv` | download |
| GET / POST | `…/indexes` | list / create |
| DELETE | `…/indexes/{name}` | drop |
| POST | `…/aggregate` | run a pipeline |
| POST | `/command` | run a raw database command |
| GET | `/server/overview` | version, uptime, connections, opcounters |
| GET | `/server/operations` | operations in progress |

**Why reads use POST.** A filter, a projection and a pipeline are JSON documents.
Percent-encoding a nested document into a query string makes the URL unreadable,
runs into length limits, and gains nothing: these requests are not cacheable
anyway. `find`, `count`, `delete` and `aggregate` therefore take a JSON body.

## Extended JSON

MongoDB's type system does not fit in JSON, so everything crossing the boundary
is **Extended JSON v2** — an ObjectId travels as `{"$oid": "..."}`, a date as
`{"$date": "..."}`. Both sides convert:

- **Server**, `mongo_json.py`: `to_extended_json` walks a driver document and
  encodes BSON values; `from_extended_json` reverses it. `bson` is an optional
  import, so the module and its tests stay usable without the driver installed.
- **Browser**, `ejson.ts`: `parseRelaxed` reads what a person actually types —
  unquoted keys, single quotes, trailing commas, `//` comments, `ObjectId(…)`,
  `ISODate(…)`, `NumberLong(…)`, `/regex/i` — and rewrites it as strict Extended
  JSON. `toShell` prints in the same spelling, so anything the editor shows can
  be typed straight back in.

`parseRelaxed` is a small character scanner rather than a set of regular
expressions, because a regex cannot distinguish `ObjectId(` inside a string from
one outside it. `{note: "call ObjectId(x) later"}` has a test to that effect.

## Session model

The brief requires the login to survive until the user logs out. Three pieces:

1. **Token.** `POST /sessions` probes the deployment (`hello` + `buildInfo`) and,
   on success, mints a 32-byte `secrets.token_urlsafe` token.
2. **Browser.** The token — and only the token — goes into `localStorage`. The
   password never does. On load, `bootstrap()` calls `GET /sessions/current`; a
   401 clears the token silently and shows the login screen.
3. **Server.** `FileMongoSessionStore` keeps sessions in memory and mirrors them
   to `data/mongoadmin-sessions.json`. The **whole connection URI** is the
   credential here, so the URI is sealed with AES-GCM (`sqlgateway/crypto.py`,
   shared with the SQL administrator) under a key derived from
   `MONGOADMIN_SECRET_KEY` before being written. Host, port and username are
   stored in the clear so the session list stays readable.

Consequences worth knowing:

- A backend restart does **not** log anyone out.
- Rotating `MONGOADMIN_SECRET_KEY` invalidates every stored session — that is the
  kill switch.
- Without the `cryptography` package the file mirror turns itself off rather than
  writing a password in the clear; sessions then last only as long as the process.
- Sessions have no expiry. That is the requirement, and it is why the secret key
  matters.

## Safety model

The console is an administration tool, so it can drop things. The guard rails are
placed where a mistake is plausible rather than where they would be merely
annoying:

| Guard | Where | Why |
|---|---|---|
| `admin`, `local`, `config` cannot be dropped | use case | Dropping them breaks the deployment. Off by default; `allow_reserved_database_drop` lifts it. |
| `_id_` index cannot be dropped | use case | MongoDB requires it. |
| Single-document update/delete needs a filter | use case | `update_one({})` rewrites whichever document the server returns first. |
| `delete_many({})` is refused | use case | Emptying a collection goes through the explicit truncate route instead. |
| A replacement cannot target many documents | use case | Writing the same body over every match is never intended. |
| Mixing `$set` with plain fields is refused | domain | MongoDB reports this late and unhelpfully. |
| Names validated before any I/O | domain | `$`, nulls, `system.*`, over-long names, forbidden characters. |
| Typed confirmation for drops | UI | The user types the database or collection name. |
| Document limit capped | use case | `MONGOADMIN_MAX_DOCUMENTS`, default 1000. |
| Unfiltered counts use the metadata estimate | gateway | `count_documents({})` scans the collection; Compass does the same. |

Errors from the driver are translated once, in the gateway, into the
application's exception vocabulary — `UnauthorizedError` (auth codes 13/18/31),
`GatewayTimeoutError` (server selection), `ConflictError` (duplicate key,
namespace exists), `NotFoundError` (namespace/index missing), `BadRequestError`
(everything the client got wrong). Nothing above the gateway imports pymongo.

## State management

One zustand store, `src/store.ts`. Components read slices and call actions;
they hold no server state of their own.

Every API call goes through an internal `guard` helper which:

- flips `busy` on and off (the topbar spinner),
- catches `ApiError`, shows it as a toast, and returns `null` so callers branch
  without `try`/`catch`,
- on a 401, clears the token and resets to the login screen — so an expired
  session cannot leave a shell full of stale data behind.

Two deliberate exceptions bypass the toast: `connect` (failures belong on the
login form) and `bootstrap` (a stale token is not worth an error message).

## Testing

| Suite | Tests | What it pins down |
|---|---:|---|
| `tests/domain/test_mongo_utils.py` | 84 | Extended JSON both ways, namespace rules, URI build/parse/redact |
| `tests/application/test_mongo_admin_usecase.py` | 90 | every use case against a fake gateway — the calls it makes are the assertion |
| `tests/adapter/input/controller/test_mongo_admin_controller.py` | 43 | routing, token plumbing, envelope, status codes |
| `tests/adapter/output/mongogateway/test_mongo_session_store.py` | 12 | persistence, sealing, secret rotation, corrupt files |
| `src/test/ejson.test.ts` | 47 | the relaxed parser, shell printer, round trips |
| `src/test/store.test.ts` | 47 | actions, guard behaviour, 401 handling, history |
| `src/test/api.test.ts` | 27 | URL building, envelope, headers, every endpoint |
| `src/test/format.test.ts` + `storage.test.ts` | 36 | formatting, localStorage, password stripping |

Back end: 229 new tests, 476 in the suite overall. Front end: 157.

Neither suite needs a MongoDB server. The use-case tests drive a `FakeGateway`
that records calls; the controller tests replace the use case through
`dependency_overrides`.

## Known limits

- **No live run against a real MongoDB.** Neither a `mongod` nor Docker was
  available in the environment this was built in. The stack was exercised
  end-to-end against an unreachable endpoint, which proves the wiring and the
  error translation but not a successful query. The first thing to do with a real
  server is a manual pass: connect, browse, insert, edit, delete, index, aggregate.
- **Collection counts are opt-in.** `?with_stats=true` costs one round trip per
  collection and is capped at 60 collections.
- **`$out` and `$merge` are not blocked** in the aggregation console. They write.
  That is consistent with a tool that also drops databases, but it is worth knowing.
- **No replica-set or sharding administration** — no `rs.*`, no balancer control.
- **No user/role management** — the console administers data, not accounts.
