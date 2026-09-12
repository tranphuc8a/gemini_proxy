// http-client.js - turns a request spec into an actual HTTP call.
//
// Two transports, because the browser alone is not enough:
//
//   direct - window.fetch(). Fast and honest, but bound by the same-origin
//            policy: an API that sends no Access-Control-Allow-Origin is
//            unreachable, `Cookie`/`Referer`/`User-Agent` are silently dropped,
//            and a cross-origin response only exposes 6 of its headers.
//   proxy  - POST to the FastAPI backend, which makes the call server-side and
//            hands the whole response back. No CORS, no forbidden headers, all
//            response headers visible. This is what real Postman does natively.
//
// `auto` uses direct when it can work and proxy when it cannot, which is why the
// same request that failed in this app but worked in Postman now works here too.
(function (global) {
  // Header names window.fetch() refuses to set. Asking for any of them is proof
  // that the direct transport cannot reproduce the request faithfully.
  const FORBIDDEN_HEADERS = new Set([
    'accept-charset', 'accept-encoding', 'access-control-request-headers',
    'access-control-request-method', 'connection', 'content-length', 'cookie',
    'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive', 'origin',
    'referer', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via'
  ]);

  const FORBIDDEN_PREFIXES = ['proxy-', 'sec-'];

  const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

  // ------------------------------------------------------------------ helpers
  function isForbiddenHeader(name) {
    const lower = String(name || '').toLowerCase();
    return FORBIDDEN_HEADERS.has(lower) || FORBIDDEN_PREFIXES.some(p => lower.startsWith(p));
  }

  function headerValue(headers, name) {
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
  }

  function deleteHeader(headers, name) {
    Object.keys(headers || {})
      .filter(k => k.toLowerCase() === name.toLowerCase())
      .forEach(k => delete headers[k]);
  }

  function bytesToBase64(bytes) {
    // String.fromCharCode.apply blows the call stack past ~100 kB, so chunk it.
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64 || '');
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function readFileBytes(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Không đọc được file'));
      reader.readAsArrayBuffer(file);
    });
  }

  function concatBytes(chunks) {
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(c => { out.set(c, offset); offset += c.length; });
    return out;
  }

  // ---------------------------------------------------------------- URL/params
  /**
   * Merge `params` into `url`'s query string. Params win over a duplicate key
   * already present in the URL, so editing the Params tab actually takes effect
   * instead of appending a second copy the server may or may not honour.
   */
  function buildUrl(rawUrl, params) {
    const url = String(rawUrl || '').trim();
    const entries = Object.entries(params || {}).filter(([k]) => k);
    if (!entries.length) return url;

    const hashIndex = url.indexOf('#');
    const hash = hashIndex > -1 ? url.slice(hashIndex) : '';
    const withoutHash = hashIndex > -1 ? url.slice(0, hashIndex) : url;
    const queryIndex = withoutHash.indexOf('?');
    const base = queryIndex > -1 ? withoutHash.slice(0, queryIndex) : withoutHash;

    const search = new URLSearchParams(queryIndex > -1 ? withoutHash.slice(queryIndex + 1) : '');
    entries.forEach(([k]) => search.delete(k));
    entries.forEach(([k, v]) => search.append(k, v ?? ''));

    const query = search.toString();
    return base + (query ? '?' + query : '') + hash;
  }

  /** Query parameters currently encoded in a URL string. */
  function extractParams(rawUrl) {
    const url = String(rawUrl || '');
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return {};
    const hashIndex = url.indexOf('#');
    const query = hashIndex > -1 && hashIndex > queryIndex
      ? url.slice(queryIndex + 1, hashIndex)
      : url.slice(queryIndex + 1);
    const out = {};
    new URLSearchParams(query).forEach((v, k) => { out[k] = v; });
    return out;
  }

  function stripQuery(rawUrl) {
    const url = String(rawUrl || '');
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return url;
    const hashIndex = url.indexOf('#');
    return url.slice(0, queryIndex) + (hashIndex > queryIndex ? url.slice(hashIndex) : '');
  }

  // -------------------------------------------------------------------- auth
  /** Fold `spec.auth` into headers/params. Mutates both, mirroring curl's -u. */
  function applyAuth(auth, headers, params) {
    if (!auth || !auth.type || auth.type === 'none') return;

    if (auth.type === 'basic') {
      if (!auth.username) return;
      // btoa() is Latin-1 only; encode UTF-8 first so accented logins survive.
      const raw = `${auth.username}:${auth.password || ''}`;
      headers['Authorization'] = 'Basic ' + bytesToBase64(new TextEncoder().encode(raw));
    } else if (auth.type === 'bearer') {
      const token = (auth.token || '').trim();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    } else if (auth.type === 'apikey') {
      const name = (auth.keyName || '').trim();
      const value = (auth.keyValue || '').trim();
      if (!name || !value) return;
      if (auth.location === 'query') params[name] = value;
      else headers[name] = value;
    }
  }

  // -------------------------------------------------------------------- body
  /**
   * Produce everything both transports need from the body fields.
   * @returns {Promise<{direct: any, bytes: Uint8Array|null, contentType: string|null}>}
   */
  async function buildBody(spec) {
    const method = (spec.method || 'GET').toUpperCase();
    if (METHODS_WITHOUT_BODY.has(method)) {
      return { direct: undefined, bytes: null, contentType: null };
    }

    const contentType = spec.contentType || 'application/json';
    const text = spec.body || '';
    const files = spec.files || [];

    if (contentType === 'multipart/form-data') {
      return buildMultipart(text, files);
    }

    if (contentType === 'application/x-www-form-urlencoded') {
      let encoded = text;
      // A JSON object is the convenient way to type form fields; pass anything
      // else through verbatim so a pre-encoded "a=1&b=2" still works.
      try {
        const parsed = JSON.parse(text || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          encoded = new URLSearchParams(parsed).toString();
        }
      } catch { /* keep the raw text */ }
      return {
        direct: encoded,
        bytes: new TextEncoder().encode(encoded),
        contentType
      };
    }

    if (!text) return { direct: undefined, bytes: null, contentType };

    return {
      direct: text,
      bytes: new TextEncoder().encode(text),
      contentType
    };
  }

  /**
   * Build a multipart body.
   *
   * The direct transport hands back a FormData and lets the browser pick the
   * boundary; the proxy transport needs real bytes, so we assemble the envelope
   * ourselves with an explicit boundary. Without this, file uploads simply broke
   * the moment you switched to the proxy.
   */
  async function buildMultipart(text, files) {
    const fields = [];
    try {
      const parsed = JSON.parse(text || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([k, v]) => fields.push([k, String(v ?? '')]));
      }
    } catch { /* no text fields */ }

    const form = new FormData();
    fields.forEach(([k, v]) => form.append(k, v));
    Array.from(files).forEach(file => form.append(file.name, file, file.name));

    const boundary = '----PostmanLite' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const encoder = new TextEncoder();
    const chunks = [];

    fields.forEach(([name, value]) => {
      chunks.push(encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    });

    for (const file of Array.from(files)) {
      chunks.push(encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; ` +
        `filename="${file.name}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
      ));
      chunks.push(await readFileBytes(file));
      chunks.push(encoder.encode('\r\n'));
    }
    chunks.push(encoder.encode(`--${boundary}--\r\n`));

    return {
      direct: form,
      bytes: concatBytes(chunks),
      contentType: `multipart/form-data; boundary=${boundary}`
    };
  }

  // ------------------------------------------------------------------ prepare
  /**
   * Normalise a spec into everything both transports need.
   * Pure: it touches no DOM and performs no I/O, so it is what the cURL builder
   * uses too — the printed command therefore always matches what we send.
   */
  async function prepare(spec) {
    const method = (spec.method || 'GET').toUpperCase();
    const headers = { ...(spec.headers || {}) };
    const params = { ...(spec.params || {}) };

    applyAuth(spec.auth, headers, params);

    const cookies = spec.cookies || {};
    const cookieEntries = Object.entries(cookies).filter(([k]) => k);
    if (cookieEntries.length) {
      headers['Cookie'] = cookieEntries.map(([k, v]) => `${k}=${v}`).join('; ');
    }

    const url = buildUrl(spec.url, params);
    const body = await buildBody({ ...spec, method });

    // Never let a stale Content-Type contradict the body we actually built. For
    // multipart in direct mode the header must be absent so the browser can add
    // its own boundary.
    if (body.contentType) {
      const explicit = headerValue(headers, 'content-type');
      if (!explicit || body.contentType.startsWith('multipart/form-data')) {
        deleteHeader(headers, 'content-type');
        headers['Content-Type'] = body.contentType;
      }
    }

    return { method, url, headers, params, body };
  }

  // ------------------------------------------------------------- transport: direct
  function canUseDirect(prepared) {
    const blocked = Object.keys(prepared.headers).filter(isForbiddenHeader);
    return { ok: blocked.length === 0, blocked };
  }

  async function sendDirect(prepared, options) {
    const headers = {};
    Object.entries(prepared.headers).forEach(([k, v]) => {
      // The browser drops these anyway; leaving them in makes fetch() throw on
      // some engines instead of just ignoring them.
      if (!isForbiddenHeader(k)) headers[k] = v;
    });

    const init = {
      method: prepared.method,
      headers,
      mode: 'cors',
      credentials: options.withCredentials ? 'include' : 'omit',
      redirect: options.followRedirects === false ? 'manual' : 'follow',
      signal: options.signal
    };

    let direct = prepared.body.direct;
    if (direct instanceof FormData) delete init.headers['Content-Type'];
    if (direct !== undefined && direct !== null && direct !== '') init.body = direct;

    const started = performance.now();
    const res = await fetch(prepared.url, init);
    const buffer = await res.arrayBuffer();
    const elapsed = Math.round(performance.now() - started);

    const headerPairs = Array.from(res.headers.entries());
    return {
      via: 'direct',
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(headerPairs),
      rawHeaders: headerPairs,
      bytes: new Uint8Array(buffer),
      contentType: res.headers.get('content-type') || '',
      sizeBytes: buffer.byteLength,
      timeMs: elapsed,
      finalUrl: res.url || prepared.url,
      redirected: res.redirected,
      truncated: false,
      // A cross-origin response hides everything but the CORS-safelisted headers.
      headersComplete: res.type === 'basic'
    };
  }

  // -------------------------------------------------------------- transport: proxy
  let resolvedBase = null;   // set once discovery finds a working prefix

  /**
   * Where the backend's routers are mounted.
   *
   * `API_PREFIX` is a deployment choice - this repo's own .env leaves it empty,
   * so the routes sit at /proxy/... while the documented default is
   * /api/v1/proxy/... . Guessing wrong means every proxied request 404s, so
   * `proxyStatus()` probes the plausible mounts and remembers the one that
   * answers instead of making the user find the setting.
   */
  function candidateBases() {
    const settings = Storage.getSettings();
    const bases = [];
    const push = (value) => {
      const clean = String(value || '').replace(/\/+$/, '');
      if (!bases.includes(clean)) bases.push(clean);
    };

    if (settings.proxyBaseUrl) push(settings.proxyBaseUrl);
    if (resolvedBase) push(resolvedBase);
    push(location.origin + (settings.apiPrefix || '').replace(/\/+$/, ''));
    push(location.origin + '/api/v1');
    push(location.origin);
    return bases;
  }

  function proxyBase() {
    return resolvedBase || candidateBases()[0];
  }

  async function probe(base) {
    const res = await fetch(`${base}/proxy/status`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const data = payload && payload.data;
    // A 200 from some unrelated page is not a proxy; insist on our envelope.
    if (!data || typeof data.enabled !== 'boolean') throw new Error('Không phải endpoint proxy');
    return data;
  }

  async function proxyStatus() {
    let lastReason = 'không tìm thấy endpoint /proxy/status';

    for (const base of candidateBases()) {
      let data;
      try {
        data = await probe(base);
      } catch (err) {
        lastReason = err.message;
        continue;
      }

      resolvedBase = base;
      const settings = Storage.getSettings();
      if (!settings.proxyBaseUrl) {
        const prefix = base.slice(location.origin.length);
        if (prefix !== settings.apiPrefix) Storage.updateSettings({ apiPrefix: prefix });
      }
      return {
        available: !!data.enabled,
        reason: data.enabled ? '' : 'backend đang đặt PROXY_ENABLED=false',
        info: data,
        base
      };
    }

    return { available: false, reason: lastReason };
  }

  async function sendProxy(prepared, options) {
    // Discovery normally runs at boot; a send that beats it must not guess.
    if (!resolvedBase) await proxyStatus();

    const payload = {
      method: prepared.method,
      url: prepared.url,
      headers: prepared.headers,
      follow_redirects: options.followRedirects !== false
    };
    if (options.timeoutSeconds) payload.timeout_seconds = options.timeoutSeconds;

    if (prepared.body.bytes && prepared.body.bytes.length) {
      payload.body = bytesToBase64(prepared.body.bytes);
      payload.body_encoding = 'base64';
    }

    const started = performance.now();
    const res = await fetch(`${proxyBase()}/proxy/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    let envelope;
    try {
      envelope = await res.json();
    } catch {
      throw new Error(`Proxy trả về dữ liệu không phải JSON (HTTP ${res.status})`);
    }

    if (!res.ok) {
      const message = (envelope && envelope.message) || `HTTP ${res.status}`;
      const error = new Error(`Proxy từ chối: ${message}`);
      error.isProxyError = true;
      throw error;
    }

    const data = envelope.data || {};
    const bytes = data.body_encoding === 'base64'
      ? base64ToBytes(data.body)
      : new TextEncoder().encode(data.body || '');

    return {
      via: 'proxy',
      status: data.status,
      statusText: data.status_text || '',
      headers: data.headers || {},
      rawHeaders: (data.raw_headers || []).map(pair => [pair[0], pair[1]]),
      bytes,
      contentType: data.content_type || '',
      sizeBytes: data.size_bytes ?? bytes.length,
      timeMs: data.elapsed_ms ?? Math.round(performance.now() - started),
      finalUrl: data.final_url || prepared.url,
      redirected: !!data.redirected,
      truncated: !!data.truncated,
      headersComplete: true
    };
  }

  // --------------------------------------------------------------------- send
  /**
   * @param {object} spec     env-resolved request description
   * @param {object} options  { mode, signal, timeoutSeconds, followRedirects,
   *                            withCredentials, onTransport }
   */
  async function send(spec, options = {}) {
    const settings = Storage.getSettings();
    const mode = options.mode || settings.sendMode || 'auto';
    const opts = {
      followRedirects: options.followRedirects ?? settings.followRedirects,
      timeoutSeconds: options.timeoutSeconds ?? settings.timeoutSeconds,
      withCredentials: !!options.withCredentials,
      signal: options.signal
    };

    const prepared = await prepare(spec);
    const notify = typeof options.onTransport === 'function' ? options.onTransport : () => {};

    if (mode === 'proxy') {
      notify('proxy', 'Gửi qua proxy backend');
      return sendProxy(prepared, opts);
    }

    const direct = canUseDirect(prepared);

    if (mode === 'direct') {
      if (!direct.ok) {
        notify('direct', `Trình duyệt sẽ bỏ qua header: ${direct.blocked.join(', ')}`);
      }
      return sendDirect(prepared, opts);
    }

    // auto: skip a direct attempt we already know cannot be faithful.
    if (!direct.ok) {
      notify('proxy', `Dùng proxy vì trình duyệt cấm header: ${direct.blocked.join(', ')}`);
      return sendProxy(prepared, opts);
    }

    try {
      notify('direct', 'Thử gửi trực tiếp từ trình duyệt');
      return await sendDirect(prepared, opts);
    } catch (err) {
      // An aborted request is the user's decision, not a transport failure.
      if (err.name === 'AbortError') throw err;
      // fetch() reports CORS rejections, DNS failures and refused connections
      // all as the same opaque TypeError - the browser deliberately hides which.
      // Retrying through the proxy is the only way to tell them apart, and it is
      // also the fix for the common case.
      if (!(err instanceof TypeError)) throw err;

      notify('proxy', 'Trực tiếp thất bại (CORS/mạng) — thử lại qua proxy');
      const result = await sendProxy(prepared, opts);
      result.fellBackFrom = 'direct';
      result.fallbackReason = err.message || 'Failed to fetch';
      return result;
    }
  }

  global.HttpClient = {
    send,
    prepare,
    applyAuth,
    buildUrl,
    extractParams,
    stripQuery,
    proxyStatus,
    proxyBase,
    isForbiddenHeader,
    bytesToBase64,
    base64ToBytes
  };
})(window);
