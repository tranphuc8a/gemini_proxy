# Markdown Editor Pro — read-only share links and the private store

Since 10/2026 (batch M3). Backend: `backend/fastapi/src/adapter/input/controllers/markdown_share_controller.py`
(+ `markdown_admin.py`, use case `application/usecases/markdown_share_usecase.py`, stores `adapter/output/markdown_share/`).
Front end: `markdown-editor/src/components/ShareDialog.tsx`, `src/share/SharePage.tsx`, `src/boot.ts`.

## Model

- A link is a **snapshot**: the administrator sends the open document (`docId`, `title`, `content`) from the editor. The
  server's saved tree is never read for it (saving that tree overwrites it whole).
- **One link per document** and store. Sharing again refreshes the snapshot and keeps the token and `sharedAt`. Revoke, then
  share again ⇒ a new token. So does sharing after the link **expired**: the expired link is dropped and a new one made
  (`201`), so whoever kept the old address cannot read the new snapshot. Optional expiry: never / 1 / 7 / 30 days. At most `MARKDOWN_MAX_SHARES` (50) links per store;
  expired ones are dropped first when the store is full.
- The token (`secrets.token_urlsafe(16)`, 22 characters) is the read key. It is never logged and never travels in a URL:
  the page keeps it after `#`, the API takes it from the `X-Share-Token` header.
- `mode` is always `"snapshot"`. The column/field is reserved for `"live"` (postponed: md-share V17b, Q8).

## Access (Q1)

| Variable | Default | Meaning |
|---|---|---|
| `MARKDOWN_PUBLIC_READ` | `false` | `false` = the store is private: `GET /markdown/files` (and later `/markdown/sync/changes`, `/markdown/docs/{id}`) needs the admin. A guest gets `403 markdown_private`. |
| `MARKDOWN_ADMIN_KEY` | public default | Set a private value on every deployment. The default is accepted only from the machine itself (loopback peer — `127.0.0.0/8`, `::1`, `::ffff:127.x` — and no proxy header). Any length a header can carry (no 200-character cap since M3V). |
| `MARKDOWN_ALLOW_DEFAULT_KEY` | `false` | `true` accepts the public default key from anywhere (unsafe). |
| `MARKDOWN_ADMIN_MAX_FAILURES` / `_FAILURE_WINDOW_S` | 20 / 600 | Wrong keys or forged sessions per client address, then `429 markdown_admin_locked` + `Retry-After` (also for the right key). No credential at all, or an expired session, is not counted. |
| `MARKDOWN_SHARES_JSON_FILE` | `data/markdown-shares.json` | JSON backend file (temporary directory on a serverless platform ⇒ `persistent: false`). |
| `MARKDOWN_MAX_SHARES` | 50 | Links per store. |
| `MARKDOWN_SHARE_MAX_BYTES` | 2 000 000 | UTF-8 bytes of one snapshot. Keep ≤ 2 MB (Vercel body limit 4.5 MB, JSON escaping grows the body). |
| `MARKDOWN_SHARE_READS_PER_MIN` | 120 | Public reads per client address per minute. |

Every admin route goes through `markdown_admin.require_markdown_admin` (or `check_markdown_admin`; the old
`markdown_storage_controller._check_admin` name is an alias). Reads of the stored documents use `require_markdown_reader`.

## API (prefix `API_PREFIX`, default `/api/v1`; `?backend=json|mysql|mongo`)

| Method + path | Who | In | Out |
|---|---|---|---|
| `POST /markdown/shares` | admin | `{"docId", "title", "content", "expiresInDays": null\|1\|7\|30, "mode": "snapshot"}` | `201` new / `200` refreshed: `{"token","docId","title","mode","sharedAt","updatedAt","expiresAt","bytes","contentHash"}` |
| `GET /markdown/shares` | admin | — | `{"shares":[summary + "expired"], "limits":{"maxShares","maxBytes"}, "persistent"}` (newest first, no `content`) |
| `DELETE /markdown/shares?docId=` | admin | — | `{"revoked": true}` |
| `GET /markdown/shared` + `X-Share-Token` | public | — | `{"title","content","mode","sharedAt","updatedAt","expiresAt"}` |

- `docId`: `^[A-Za-z0-9_.:-]{1,80}$` (`domain/vo/markdown_ids.py`, the same pattern the delta sync uses); `root` is refused.
- `title` is trimmed, 1–200 characters, no control characters. `contentHash` = SHA-256 of the UTF-8 text
  (`application/utils/hashing.sha256_hex`; the browser's `src/lib/hash.ts` computes the same, with a pure-JS fallback on http).
- Every answer: `Cache-Control: no-store`. The public read also: `X-Robots-Tag: noindex, nofollow, noarchive`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` (errors included).
- Errors (`{status_code, message (Vietnamese), data: {code, …}}`):

| HTTP | `data.code` |
|---|---|
| 400 | `markdown_share_too_large` (+`limit`, `bytes`), `markdown_share_bad_input` (+`field`), `markdown_too_many_shares` (+`limit`), `markdown_bad_backend` |
| 409 | `markdown_share_conflict` — another document's link holds this id on a case-insensitive store (MySQL): `Doc-A` vs `doc-a` |
| 403 | `markdown_admin_required`, `markdown_admin_invalid`, `markdown_session_invalid`, `markdown_session_expired`, `markdown_default_key_refused`, `markdown_admin_disabled`, `markdown_private` |
| 404 | `markdown_share_not_found` — one message for unknown, malformed, revoked and expired tokens; also revoking a document that has no link |
| 422 | schema (bad `docId` shape, title > 200, `expiresInDays` not in the list) |
| 429 | `markdown_rate_limited` (reads, wrong tokens) / `markdown_admin_locked`, with `retryAfter` and `Retry-After` |
| 503 | `markdown_backend_unavailable` (mongo without `MONGO_URI`) · `markdown_share_unavailable` (the store failed while a link was read; one generic message — the driver's text holds the token, so it is neither logged nor returned) |

## Storage

- MySQL: table `markdown_shares (token PK, doc_id UNIQUE, title, mode, shared_at, updated_at, expires_at NULL, bytes,
  content_hash, content LONGTEXT NULL)`, created on first use with `CREATE TABLE IF NOT EXISTS` (Q2: no migration) — by the first
  request of any kind that reaches the store in a process, a guest's public read included. Lookups
  re-check the exact token / doc id (MySQL's default collation ignores case).
- Mongo: collection `markdown_shares`, `_id` = token, unique index on `doc_id`.
- JSON: `{"version":1, "shares": {"<token>": {"docId", "title", "mode", "sharedAt", "updatedAt", "expiresAt", "bytes",
  "contentHash", "content"}}}`, written to a temporary file then moved into place; a corrupt file is renamed `.corrupt`.

## The page (`…/markdown-editor-pro/#share=<token>&backend=<store>`)

- `src/boot.ts` decides before React renders: a share address renders `SharePage` (loaded on demand) — no service worker,
  no local workspace, no admin session; anything else renders the editor. A hash change that switches between the two reloads.
- Hardening inserted first in `<head>`: `robots noindex`, `referrer no-referrer` and a CSP meta:
  `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' https:; font-src 'self' data:; connect-src 'self' [API origin]; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'`.
  `frame-ancestors` cannot be set by a meta (needs a header).
- The snapshot renders through the one pipeline (`markdownPipeline.ts`: sanitiser, KaTeX, Mermaid `strict` drawn in the
  browser — never through a server, `rehypeStyleGuard`) on the reading surface (`ReadingSurface.tsx`) with `links="shared"`:
  links to other documents and `javascript:` become plain text (`span.md-dead-link`), images load with `no-referrer`, a relative
  image becomes `[image: alt]`, task boxes are disabled. The article is `contain: paint` so pasted absolute/fixed HTML cannot
  cover the page.
- The request: `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`, no admin header.
- States: loading · ready · not found (one message) · rate limited (wait N s, Try again) · offline (Try again) · error.
- The link the dialog hands out is the app **folder** (`…/markdown-editor-pro/`), never `index.html?source=pwa`.

## Checks

```bash
cd backend/fastapi && .venv/Scripts/python.exe -m pytest tests/application/test_share_links.py tests/application/test_markdown_share_usecase.py tests/adapter/output/markdownshare tests/adapter/input/controller/test_markdown_share_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py -q
cd markdown-editor && npm test && npm run type-check && npm run lint
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-chia-se.py [--anh <dir>]   # Edge, real server
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-pwa.py
```

## Not done (Q8)

QR in the dialog (V13), live links (V17b), moving Code Studio onto `share_links.py` (V18), OG previews (never: the token
would have to be in the path).
