/**
 * Logic tests for postman-lite. Zero dependencies:
 *
 *   node tests/logic.test.js
 *
 * The app is plain browser scripts, so we load each file into a Node context
 * with just enough of `window`, `localStorage` and `document` for the pure
 * logic (URL building, cURL round-tripping, env substitution, storage rules).
 * Anything that really needs a DOM stays out of scope here.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/**
 * deepEqual across the vm boundary.
 *
 * Objects built inside the sandbox have that realm's Object.prototype, so
 * assert.deepEqual reports "same structure but not reference-equal". Normalising
 * through JSON compares the values, which is what these tests care about.
 */
function deepEq(actual, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);
}

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    get size() { return map.size; },
    _map: map
  };
}

/** Load the given app scripts into one fresh sandbox and return its globals. */
function loadApp(files = ['storage.js', 'env.js', 'http-client.js', 'curl-parser.js']) {
  const sandbox = {
    localStorage: makeLocalStorage(),
    console,
    TextEncoder,
    TextDecoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    URL,
    URLSearchParams,
    crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
    performance,
    location: { origin: 'http://localhost:6789' },
    FormData: class FormData { constructor() { this.entries = []; } append(k, v) { this.entries.push([k, v]); } },
    Blob: class Blob {},
    setTimeout,
    clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }

  // storage.js and curl-parser.js use a top-level `const`, which lands in the
  // context's global *lexical* scope rather than on the sandbox object. The
  // browser resolves those the same way; Node just needs them copied across.
  vm.runInContext(
    "['Storage','CurlParser'].forEach(n => { try { globalThis[n] = eval(n); } catch {} });",
    sandbox
  );
  return sandbox;
}

// ---------------------------------------------------------------------------
// cURL parsing
// ---------------------------------------------------------------------------
test('parses a multi-line curl with backslash continuations', () => {
  const { CurlParser } = loadApp();
  const parsed = CurlParser.parse(`curl -X POST 'https://api.example.com/items?limit=10' \\
  -H 'Authorization: Bearer tok' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"foo"}'`);

  // The old shellSplit turned "\\\n" into a bare token that overwrote the URL.
  assert.equal(parsed.method, 'POST');
  assert.equal(parsed.baseUrl, 'https://api.example.com/items');
  deepEq(parsed.params, { limit: '10' });
  assert.equal(parsed.headers['Authorization'], 'Bearer tok');
  assert.equal(parsed.data, '{"name":"foo"}');
  assert.equal(parsed.contentType, 'application/json');
});

test('boolean flags do not swallow the URL', () => {
  const { CurlParser } = loadApp();
  const parsed = CurlParser.parse("curl --compressed -k -L 'https://api.example.com/x'");
  assert.equal(parsed.url, 'https://api.example.com/x');
  assert.equal(parsed.followRedirects, true);
});

test('accepts attached and --flag=value forms', () => {
  const { CurlParser } = loadApp();
  const parsed = CurlParser.parse("curl -XPUT --url=https://api.example.com/a -H'X-Trace: 1'");
  assert.equal(parsed.method, 'PUT');
  assert.equal(parsed.url, 'https://api.example.com/a');
  assert.equal(parsed.headers['X-Trace'], '1');
});

test("handles $'...' quoting emitted by Copy as cURL", () => {
  const { CurlParser } = loadApp();
  const parsed = CurlParser.parse("curl 'https://a.dev/x' -H $'X-Multi: a\\nb'");
  assert.equal(parsed.headers['X-Multi'], 'a\nb');
});

test('-u builds a UTF-8 safe Basic header', () => {
  const { CurlParser } = loadApp();
  const parsed = CurlParser.parse("curl -u 'tí:pass' https://a.dev/");
  const decoded = Buffer.from(parsed.headers.Authorization.slice(6), 'base64').toString('utf8');
  assert.equal(decoded, 'tí:pass');
});

test('a curl with no URL is rejected rather than silently sent', () => {
  const { CurlParser } = loadApp();
  assert.throws(() => CurlParser.parse('curl -X GET'), /Không tìm thấy URL/);
});

// ---------------------------------------------------------------------------
// cURL building
// ---------------------------------------------------------------------------
test('built command uses shell line continuations and survives a round trip', () => {
  const app = loadApp();
  const { CurlParser } = app;

  const spec = {
    method: 'POST',
    url: 'https://api.example.com/items',
    params: { limit: '10' },
    headers: { 'X-Trace': 'abc' },
    cookies: { session: 's1' },
    contentType: 'application/json',
    body: '{"name":"foo"}',
    auth: { type: 'bearer', token: 'tok' }
  };

  const command = CurlParser.build(spec);
  // Every joined line must end in a backslash; without it the shell reads the
  // command as several separate ones and curl reports "no URL specified".
  command.split('\n').slice(0, -1).forEach(line => assert.ok(line.endsWith('\\'), line));

  const parsed = CurlParser.parse(command);
  assert.equal(parsed.method, 'POST');
  assert.equal(parsed.baseUrl, 'https://api.example.com/items');
  deepEq(parsed.params, { limit: '10' });
  assert.equal(parsed.headers.Authorization, 'Bearer tok');
  deepEq(parsed.cookies, { session: 's1' });
  assert.equal(parsed.data, '{"name":"foo"}');
});

test('single quotes inside a body are escaped for the shell', () => {
  const { CurlParser } = loadApp();
  const command = CurlParser.build({
    method: 'POST', url: 'https://a.dev/x', headers: {}, cookies: {},
    contentType: 'application/json', body: `{"q":"it's"}`, auth: { type: 'none' }
  });
  assert.ok(command.includes(`'{"q":"it'\\''s"}'`));
  assert.equal(CurlParser.parse(command).data, `{"q":"it's"}`);
});

// ---------------------------------------------------------------------------
// URL / params
// ---------------------------------------------------------------------------
test('params replace same-named values already in the URL instead of duplicating', () => {
  const { HttpClient } = loadApp();
  const url = HttpClient.buildUrl('https://a.dev/x?page=1&keep=yes', { page: '2' });
  assert.equal(url, 'https://a.dev/x?keep=yes&page=2');
});

test('URL fragment is preserved after the query', () => {
  const { HttpClient } = loadApp();
  assert.equal(HttpClient.buildUrl('https://a.dev/x#top', { a: '1' }), 'https://a.dev/x?a=1#top');
});

test('extractParams and stripQuery are inverses of buildUrl', () => {
  const { HttpClient } = loadApp();
  const url = 'https://a.dev/x?a=1&b=two%20words';
  deepEq(HttpClient.extractParams(url), { a: '1', b: 'two words' });
  assert.equal(HttpClient.stripQuery(url), 'https://a.dev/x');
});

test('forbidden headers are recognised so auto mode can route around them', () => {
  const { HttpClient } = loadApp();
  ['Cookie', 'referer', 'Content-Length', 'Sec-Fetch-Mode', 'proxy-authorization']
    .forEach(name => assert.ok(HttpClient.isForbiddenHeader(name), name));
  ['Authorization', 'X-Api-Key', 'Content-Type']
    .forEach(name => assert.ok(!HttpClient.isForbiddenHeader(name), name));
});

test('base64 helpers round-trip binary data without corrupting it', () => {
  const { HttpClient } = loadApp();
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe]);
  deepEq([...HttpClient.base64ToBytes(HttpClient.bytesToBase64(bytes))], [...bytes]);
});

test('Basic auth encodes non-ASCII credentials', () => {
  const { HttpClient } = loadApp();
  const headers = {};
  HttpClient.applyAuth({ type: 'basic', username: 'tí', password: 'mật' }, headers, {});
  const decoded = Buffer.from(headers.Authorization.slice(6), 'base64').toString('utf8');
  assert.equal(decoded, 'tí:mật');
});

test('API key auth honours the query location', () => {
  const { HttpClient } = loadApp();
  const headers = {}; const params = {};
  HttpClient.applyAuth({ type: 'apikey', keyName: 'k', keyValue: 'v', location: 'query' }, headers, params);
  deepEq(params, { k: 'v' });
  deepEq(headers, {});
});

// ---------------------------------------------------------------------------
// Proxy discovery
// ---------------------------------------------------------------------------
test('proxy discovery finds the backend when API_PREFIX is empty', async () => {
  const app = loadApp();
  const seen = [];
  // This repo's own .env sets API_PREFIX= , so the routes live at /proxy/... and
  // the documented /api/v1 default 404s. Discovery has to cope with both.
  app.fetch = async (url) => {
    seen.push(url);
    if (url !== 'http://localhost:6789/proxy/status') return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({ data: { enabled: true, allowed_hosts: '*' } }) };
  };

  const status = await app.HttpClient.proxyStatus();

  assert.equal(status.available, true);
  assert.equal(status.base, 'http://localhost:6789');
  assert.ok(seen.includes('http://localhost:6789/api/v1/proxy/status'));
  // The working prefix is remembered so later sends do not probe again.
  assert.equal(app.Storage.getSettings().apiPrefix, '');
  assert.equal(app.HttpClient.proxyBase(), 'http://localhost:6789');
});

test('proxy discovery reports unavailable when nothing answers', async () => {
  const app = loadApp();
  app.fetch = async () => { throw new Error('Failed to fetch'); };
  const status = await app.HttpClient.proxyStatus();
  assert.equal(status.available, false);
  assert.match(status.reason, /Failed to fetch/);
});

test('a 200 that is not the proxy envelope is not mistaken for the proxy', async () => {
  const app = loadApp();
  // An SPA that serves index.html for every unknown path would otherwise look
  // like a working proxy on the very first candidate.
  app.fetch = async () => ({ ok: true, status: 200, json: async () => ({ hello: 'world' }) });
  const status = await app.HttpClient.proxyStatus();
  assert.equal(status.available, false);
});

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------
test('resolve substitutes known vars and leaves unknown ones visible', () => {
  const { EnvManager, Storage } = loadApp();
  Storage.upsertEnvironment('Local', { BASE: 'http://localhost:8000' });
  EnvManager.setActiveName('Local');

  assert.equal(EnvManager.resolve('{{BASE}}/users'), 'http://localhost:8000/users');
  // An unknown variable must NOT become "undefined" - the user has to see it.
  assert.equal(EnvManager.resolve('{{BASE}}/{{MISSING}}'), 'http://localhost:8000/{{MISSING}}');
  deepEq(EnvManager.findUnresolved('{{BASE}}/{{MISSING}}'), ['MISSING']);
});

test('findUnresolvedInSpec scans url, headers, cookies, body and auth', () => {
  const { EnvManager, Storage } = loadApp();
  Storage.upsertEnvironment('E', { A: '1' });
  EnvManager.setActiveName('E');

  const missing = EnvManager.findUnresolvedInSpec({
    url: '{{A}}/x',
    headers: { 'X-{{H}}': '{{A}}' },
    cookies: { s: '{{C}}' },
    body: '{"t":"{{B}}"}',
    auth: { type: 'bearer', token: '{{T}}' }
  });
  deepEq(missing.sort(), ['B', 'C', 'H', 'T']);
});

test('switching environments re-resolves the same template', () => {
  const { EnvManager, Storage } = loadApp();
  Storage.upsertEnvironment('Local', { BASE: 'http://localhost' });
  Storage.upsertEnvironment('Prod', { BASE: 'https://prod.example.com' });

  EnvManager.setActiveName('Local');
  assert.equal(EnvManager.resolve('{{BASE}}/u'), 'http://localhost/u');
  // The old build overwrote the form field on selection, so this second switch
  // silently did nothing.
  EnvManager.setActiveName('Prod');
  assert.equal(EnvManager.resolve('{{BASE}}/u'), 'https://prod.example.com/u');
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
test('legacy environment key is migrated into the exported one', () => {
  const app = loadApp();
  const { Storage } = app;
  app.localStorage.setItem('postmanLite:environments',
    JSON.stringify([{ name: 'Old', vars: { A: '1' } }]));

  Storage.migrate();

  deepEq(Storage.getEnvironment('Old').vars, { A: '1' });
  assert.equal(app.localStorage.getItem('postmanLite:environments'), null);
  // Export used to read a different key than env.js wrote, losing everything.
  assert.equal(Storage.exportData().environments.length, 1);
});

test('deleting a collection removes its whole subtree and their requests', () => {
  const { Storage } = loadApp();
  const root = Storage.addCollection({ name: 'root' });
  const child = Storage.addCollection({ name: 'child', parentId: root.id });
  Storage.addRequest({ name: 'r1', collectionId: root.id });
  Storage.addRequest({ name: 'r2', collectionId: child.id });
  const keep = Storage.addRequest({ name: 'keep' });

  Storage.deleteCollection(root.id);

  assert.equal(Storage.getCollections().length, 0);
  deepEq(Storage.getRequests().map(r => r.id), [keep.id]);
});

test('isDescendant blocks the drag that would detach a subtree', () => {
  const { Storage } = loadApp();
  const a = Storage.addCollection({ name: 'a' });
  const b = Storage.addCollection({ name: 'b', parentId: a.id });
  const c = Storage.addCollection({ name: 'c', parentId: b.id });

  assert.ok(Storage.isDescendant(a.id, c.id));   // dropping a into c => cycle
  assert.ok(!Storage.isDescendant(c.id, a.id));  // dropping c into a is fine
});

test('history is capped and long bodies are truncated', () => {
  const { Storage } = loadApp();
  Storage.updateSettings({ maxHistory: 3, historyBodyLimit: 10 });

  for (let i = 0; i < 5; i++) {
    Storage.addHistory({ method: 'GET', url: `https://a.dev/${i}`, response: { body: 'x'.repeat(50) } });
  }

  const history = Storage.getHistory();
  assert.equal(history.length, 3);
  assert.equal(history[0].response.body.length, 10);
  assert.equal(history[0].response.bodyTruncated, true);
});

test('a full quota sheds old history instead of throwing mid-send', () => {
  const app = loadApp();
  const { Storage } = app;
  for (let i = 0; i < 6; i++) Storage.addHistory({ method: 'GET', url: `https://a.dev/${i}` });

  let fail = true;
  const real = app.localStorage.setItem.bind(app.localStorage);
  app.localStorage.setItem = (k, v) => {
    // Fail the first write only, exactly as a browser does when the origin is
    // at its limit and the caller has not yet freed anything.
    if (fail && k === Storage.KEYS.REQUESTS) {
      fail = false;
      const err = new Error('full');
      err.name = 'QuotaExceededError';
      throw err;
    }
    real(k, v);
  };

  assert.doesNotThrow(() => Storage.addRequest({ name: 'r' }));
  assert.equal(Storage.getRequests().length, 1);
  assert.equal(Storage.getHistory().length, 3); // half of the history was shed
});

test('import merge keeps existing rows, replace does not', () => {
  const { Storage } = loadApp();
  Storage.addCollection({ id: 'c1', name: 'existing' });

  Storage.importData({ collections: [{ id: 'c2', name: 'incoming' }] }, 'merge');
  deepEq(Storage.getCollections().map(c => c.id).sort(), ['c1', 'c2']);

  Storage.importData({ collections: [{ id: 'c3', name: 'only' }] }, 'replace');
  deepEq(Storage.getCollections().map(c => c.id), ['c3']);
});

test('import rejects data that carries none of the known keys', () => {
  const { Storage } = loadApp();
  assert.throws(() => Storage.importData({ nope: 1 }), /Không tìm thấy khóa nào/);
  assert.throws(() => Storage.importData([]), /JSON object/);
});

test('export/import round-trips every store', () => {
  const source = loadApp();
  source.Storage.addCollection({ name: 'c' });
  source.Storage.addRequest({ name: 'r', method: 'POST', url: 'https://a.dev' });
  source.Storage.upsertEnvironment('Local', { A: '1' });
  source.Storage.addHistory({ method: 'GET', url: 'https://a.dev' });

  const target = loadApp();
  target.Storage.importData(JSON.parse(JSON.stringify(source.Storage.exportData())));

  assert.equal(target.Storage.getCollections().length, 1);
  assert.equal(target.Storage.getRequests().length, 1);
  assert.equal(target.Storage.getHistory().length, 1);
  deepEq(target.Storage.getEnvironment('Local').vars, { A: '1' });
});
