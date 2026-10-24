# Markdown Editor Pro — delta sync, version history and the old whole-tree store

Since 10/2026 (batch M4a, the backend; batch M4b, the browser: `markdown-editor/src/sync/`, `src/services/markdownSync.ts`). Backend:
`backend/fastapi/src/adapter/input/controllers/markdown_docs_controller.py` (+ `markdown_admin.py`), use case
`application/usecases/markdown_docs_usecase.py`, pure helpers `application/utils/{line_patch,history_retention,sync_paging,hashing}.py`,
stores `adapter/output/markdown_docs/{json,mysql,mongo}_repository.py` + `legacy_reader.py`, wiring `adapter/factory/markdown_docs_factory.py`.
Design: `tasks/2610/261023/cai-tien-webapp/thiet-ke/md-sync.md`; hand-over: `tasks/2610/261023/cai-tien-webapp/dot/M4a.md`.

## Model

- **One record per node of the editor's tree** (a file or a folder), the same shape in all three stores:
  `{id, kind, parentId, name, content, hash, size, rev, contentRev, metaRev, deleted, createdAt, updatedAt, serverUpdatedAt, device}`.
  `id` matches `^[A-Za-z0-9_.:-]{1,80}$` (`domain/vo/markdown_ids.py`, shared with the share links) and is compared exactly (MySQL columns
  are `utf8mb4_bin`). `hash` = SHA-256 of the UTF-8 text, lowercase hex (`application/utils/hashing.sha256_hex`; the browser's
  `src/lib/hash.ts` computes the same). A tombstone (`deleted: true`) has no `content` and an empty `hash`; the server never trusts
  the client's `updatedAt` for ordering (it only has to be < 1 day ahead of the server's clock).
- **Compare-and-set on `rev`** (bumped on every change). `contentRev` moves when the text or the deleted state changes, `metaRev` when
  `name`/`parentId` change; the two are judged apart, so a rename made on one device and an edit made on another both stand.
  Edit beats delete (an edit of a tombstone, or a delete of a node edited since, is a `conflict ["deleted"]`); only an explicit
  `deleted: false` with the text brings a node back. An op whose result already is the stored state answers `ok` and writes nothing
  (a push whose answer was lost can be sent again). There is no "newest wins": a stale write is a `conflict` the client merges.
- **A push carries only what changed**: whole text, or a **line patch** against the text the client last synced (`baseHash` must be the
  stored `hash`, the result must hash to `hash`, or the op is `rejected`). Renames and moves carry no text at all.
- **History from the first push**: a row whenever a file's text changes, on delete and on restore (restore: M8). A keyframe (whole text)
  for the first row, texts under 2 KB, every 50 revisions or when the delta would exceed half of the text; otherwise a line delta
  against the latest keyframe, so any version needs at most two reads. Edits of one device within `MARKDOWN_HISTORY_COALESCE_S`
  (600 s) share one row; bodies over 32 KB are zlib + base64. Kept: the newest `MARKDOWN_HISTORY_KEEP_RECENT` (50), the newest of
  each local day (`MARKDOWN_HISTORY_TZ`) for `MARKDOWN_HISTORY_DAILY_DAYS` (90) days, named versions (`label`), and the keyframe of
  every kept delta; hard cap 300 rows. A failing history write is logged and never fails the push. The delta is made by `difflib`
  (`autojunk=True`, after cutting the common head and tail) and is skipped - the text is stored whole instead - when the changed middle is
  over 50,000 lines or the lines repeat so much that the diff would cost more than ~0.4 s (`MAX_DIFF_PAIRS`); the diff, zlib and the
  patch application of a document over 32 KB run in a worker thread, never on the event loop.
- **Tombstones** are dropped (with their history) after `MARKDOWN_TOMBSTONE_DAYS` (90) — at most every 6 hours per process, or at once
  when the store is full. `horizon` is the newest purge: a client whose cursor is older gets `reset: true` and must re-reconcile.
- **Cursor** = a record's `serverUpdatedAt`; the next pull asks for strictly more. The final cursor of a pull trails the clock by 2 s
  (a write that began before the poll but committed after it is still newer than the cursor, so a record may be delivered twice,
  never missed). A page never ends between two equal stamps; a page that is nothing but such a run is delivered whole.

## Access (Q1)

| Route | Who |
|---|---|
| `GET /markdown/sync/changes`, `GET /markdown/docs/{id}` | **reader**: the administrator, or anyone when `MARKDOWN_PUBLIC_READ=true`. Default closed: a guest gets `403 markdown_private`. |
| `POST /markdown/sync/push`, `GET /markdown/docs/{id}/revisions`, `GET /markdown/docs/{id}/revisions/{rev}` | **administrator** always (`X-Admin-Session` or `X-Admin-Key`; wrong keys are counted and lock the address out, see `docs/markdown-share-api.md`). History is never public. |

## API (prefix `API_PREFIX`, default `/api/v1`; `?backend=json|mysql|mongo`, default `MARKDOWN_STORAGE_BACKEND`)

Every answer is bare JSON with `Cache-Control: no-store`. Errors: `{status_code, message (Vietnamese), data: {code, …}}`.

| Method + path | In | Out |
|---|---|---|
| `GET /markdown/sync/changes?since=0&limit=&device=` | `since` = the previous `cursor` (0 = everything; tombstones are left out of that first pull); `limit` ≤ 1000 but never above the server's page (200 records / about 3 MB); `device` = this device's id | `{items: [record], cursor, more, horizon, reset}`. On an **incremental** pull (`since > 0`) a record written by `device` comes back **without** `content` (its `hash` stays). On `since=0` (first sync, or a reset after IndexedDB was cleared while `deviceId` survived in localStorage) every record carries its text, `device` or not: the client has nothing to "already have". |
| `POST /markdown/sync/push` | `{device, ops: [op, …]}` — 1 to 200 ops, one per node, `device` matches `^[A-Za-z0-9_.:-]{1,64}$`; the name `legacy` is reserved for the migration (422) | `{results: [result, …] (same order), serverTime}` |
| `GET /markdown/docs/{id}` | — | the latest live record **with its text** (`hash` / `contentRev` make an ETag). 404 `md_doc_not_found` when absent or deleted. This is the door md-share's future live mode reads. |
| `GET /markdown/docs/{id}/revisions?before=&limit=` | `before` = only revs older than this; `limit` ≤ 200 (default 50) | `{items: [{rev, kind, name, parentId, deleted, hash, size, encoding, baseRev, origin, restoredFrom, label, device, savedAt, updatedAt}] newest first (no text), more}` |
| `GET /markdown/docs/{id}/revisions/{rev}` | `rev` from 1 to 2^31-1 (422 above) | one row with `content` rebuilt (`null` for the row of a delete); 404 `md_revision_not_found`; 500 `md_history_broken` if the row no longer rebuilds to its hash |

**Op** (one node):

```jsonc
{ "id": "file-…", "kind": "file"|"folder", "baseRev": 7,         // 0 = a node the server may not have
  "set": { "name": "x.md", "parentId": "folder-1" },             // optional; parentId null = the top, absent = unchanged
  "content": "…"  |  "patch": {"v":1,"h":[[offset, removed, ["inserted line", …]], …]},  "baseHash": "…",   // at most one text
  "hash": "<sha256 of the RESULTING text>",                      // required with content or patch
  "deleted": true | false,                                       // false only to revive a tombstone, with content
  "updatedAt": 1761000000000 }                                   // ms, the device's clock (display only)
```

A **line patch** treats a text as `text.split("\n")` (a `\r` stays on its line, a trailing newline is an empty last line): replace
`removed` lines of the base starting at line `offset` (0-based) with the inserted ones; hunks ascend and do not overlap. The shared
fixture `backend/fastapi/tests/fixtures/markdown_patches.json` is applied by the server tests and must be applied by the browser's
`lineDiff.ts` too.

**Result** of one op (ops are independent: a bad one does not stop the others):

- `{id, status: "ok", rev, contentRev, metaRev, hash, serverUpdatedAt}` — the text is not echoed back.
- `{id, status: "conflict", parts: ["content"|"meta"|"deleted"], record, contentOmitted?}` — `record` is the stored state (with `content`
  unless only `meta` clashed); the client merges and pushes again with `baseRev = record.rev`. **The text in one answer is budgeted**: a
  tiny patch can conflict with a 3.5 MB document, so the conflicting texts of one push share the page budget (`PAGE_BYTES` = 3,000,000, the same
  constant a pull page uses; charged `size + 400` per record, in op order; the edge is inclusive) - far under Vercel's 4.5 MB response cap. A record that does not
  fit comes back **without `content` and with `"contentOmitted": true`** (the flag is absent otherwise, and a name-only conflict never
  has text anyway): the client fetches it with `GET /markdown/docs/{id}` (its `rev`/`hash` are in the record, so it knows which version
  to expect) and then merges. Never treat a missing `content` as "empty" unless `contentOmitted` is absent and `parts` is `["meta"]`.
- `{id, status: "rejected", code, message}`, `code` ∈ `md_patch_mismatch` (resend the whole text), `md_hash_mismatch`,
  `md_doc_too_large`, `md_kind_changed`, `md_bad_name`, `md_bad_parent`, `md_space_full`, `md_bad_clock`, `md_bad_content`
  (a lone UTF-16 surrogate that reaches the use case; over HTTP the JSON body itself is refused first with a plain 400 -
  normalise with `toWellFormed()` before hashing and sending), `md_content_required` (reviving a file without text).
  An op whose `content` hashes to what is already stored is still checked: a text that does not hash to its `hash` is `md_hash_mismatch`
  even when `hash` equals the stored one (it is not an `ok` replay).

**Whole-request errors**: 400 `md_duplicate_op` (a node twice) · 400 `md_push_too_large` · 422 body of the wrong shape (a patch and a
content together, a patch without `baseHash`, a text without `hash`, a folder with text, an id off the pattern, 0 or > 200 ops, a
`since` above 2^53) · 403 as above · 400 `markdown_bad_backend` · 503 `markdown_backend_unavailable` (mongo without `MONGO_URI`) ·
503 `md_busy` (+`Retry-After: 1`: three lost compare-and-sets in a row) · 503 `md_migrating` (+`Retry-After: 2`: another process is
copying the old store) · 503 `md_store_unavailable` (+`Retry-After: 5`: the store failed — one generic message; the driver's text
holds the database host and the pushed text, so it is neither logged nor returned).

## Limits (`config.py`, block `MARKDOWN_*`; UTF-8 bytes)

| Variable | Default | |
|---|---|---|
| `MARKDOWN_DOC_MAX_BYTES` | 3 500 000 | one document (and so one pull page item: 3.5 MB < the 4.5 MB body limit of Vercel) |
| `MARKDOWN_PUSH_MAX_BYTES` | 4 000 000 | the text of one push request (JSON escaping makes the body a little bigger) — a client splits ops past it |
| `MARKDOWN_MAX_DOCS` | 20 000 | nodes per store, tombstones included; old tombstones are dropped first, then new nodes are `rejected md_space_full` |
| `MARKDOWN_DOCS_JSON_FILE` | `data/markdown-docs.json` | JSON store (history beside it in `markdown-history/<space>/<sha1(id)[:16]>.json`); in a temporary directory on a serverless platform it is a scratchpad |
| `MARKDOWN_HISTORY_*`, `MARKDOWN_TOMBSTONE_DAYS` | 50 / 90 / 600 s / `+07:00` / 90 | see Model |
| `MARKDOWN_LEGACY_PUT` | `reject` | see below |

Page size (200 records / 3 MB), the 2-second cursor lag and the 1-day clock window are constants of `domain/vo/markdown_docs_vo.py`.

## Tables (MySQL) and the first call

`markdown_docs`, `markdown_doc_revisions`, `markdown_meta` are created at run time with `CREATE TABLE IF NOT EXISTS` (Q2, no Alembic) by
the **first request of any kind that reaches the delta store in a process**; MySQL ids are `utf8mb4_bin`. Mongo: collections of the same names.
JSON: one file. The tables can be created on a test database beforehand by calling `GET /markdown/sync/changes?backend=mysql` with the
administrator's key against it.

**Lazy migration.** The first `changes`/`push` call copies the old whole-tree store of that backend (`markdown_files` table / collection /
`MARKDOWN_JSON_FILE`) into the delta store — every node at `rev` 1, `device: "legacy"`, a `migrate` history row for each file — once, claimed
with a `markdown_meta` row (`migrated_v1`) so exactly one process does it (a claim older than 5 minutes, or a failed run, is taken over;
the inserts are idempotent). **The old data is never written or deleted**, so the copy can be abandoned: the old editor keeps working
on the old store. Ids the pattern refuses are renamed (`legacy-<24 hex>`); the table old→new is kept in the flag and also applied to
`markdown_shares.doc_id`; a file over `MARKDOWN_DOC_MAX_BYTES` is left out and listed in the flag (`skipped`). Nothing is copied twice and
what the old editor saves afterwards is **not** pulled in. Each migrated node has its own `serverUpdatedAt`, all in the past
(`now - n .. now - 1`), so the tree pages normally and never gets ahead of the clock.

**`MARKDOWN_LEGACY_PUT`** (the whole-tree `PUT`/`GET /markdown/files` of the old editor):

- `reject` (default since the new editor shipped, M4b; anything that is not the literal `allow` counts as `reject`): once the copy
  exists, `PUT /files` is `409 md_legacy_client` (a whole-tree save would overwrite other devices' work without a version check; the old
  editor keeps its local copy) and `GET /files` rebuilds the tree from the delta store. Before the copy exists nothing changes. A guest
  still gets 403, not the 409. The new editor never calls `PUT /files`.
- `allow` (opt-out): both routes keep their old behaviour on the OLD store, which the new editor no longer reads - what an old editor saves
  there does not reach the synced documents, and the other way round.

## Deploying

1. Deploy with a private `MARKDOWN_ADMIN_KEY`; nothing is written to the database until a request reaches `/markdown/sync/*` (the new
   editor does that the first time Backend sync is switched on).
   `MARKDOWN_LEGACY_PUT` is `reject` by default: an old editor still open somewhere gets `409 md_legacy_client` on its next
   whole-tree save, once the old tree has been copied.
2. Set `MARKDOWN_STORAGE_BACKEND=mysql` on Vercel (a JSON file there lives in `/tmp` of one instance: history, links and the migration
   flag would vanish).
3. The first `/markdown/sync/*` call creates the tables and copies the old tree (a few seconds for ~200 documents; the editor retries
   after `md_migrating`). Set `MARKDOWN_LEGACY_PUT=allow` only to keep an old editor working on the old store.
4. Each op of a push costs a few round trips on MySQL (read, compare-and-set, history): a client should push at most a few dozen
   nodes per request when the database is far away.

## Tests

`pytest -q tests/application/test_line_patch.py tests/application/test_markdown_docs_*.py tests/adapter/output/markdown_docs
tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py`
(JSON on `tmp_path`, MySQL on the suite's SQLite, Mongo on `fake_mongo`; nothing reaches a real database).
