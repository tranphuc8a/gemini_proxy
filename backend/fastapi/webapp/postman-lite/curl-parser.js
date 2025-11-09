// cURL Command Parser
const CurlParser = {
  parse(cmd) {
    const tokens = this.shellSplit(cmd);
    if (tokens.length === 0) throw new Error('Empty command');
    if (tokens[0].toLowerCase() !== 'curl') throw new Error("Phải bắt đầu bằng 'curl'");

    let method = 'GET';
    let url = null;
    const headers = {};
    let data = null;
    let isMultipart = false;
    const formFields = {};
    const files = [];
    let cookies = {};
    let contentType = null;

    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      const next = (j = 1) => (i + j < tokens.length ? tokens[i + j] : null);

      if (t === '-X' || t === '--request') {
        method = (next() || method).toUpperCase();
        i++;
        continue;
      }

      if (t === '-H' || t === '--header') {
        const h = next();
        i++;
        if (h) {
          const idx = h.indexOf(':');
          if (idx > -1) {
            const k = h.slice(0, idx).trim();
            const v = h.slice(idx + 1).trim();
            headers[k] = v;
            if (/^content-type$/i.test(k)) contentType = v;
          }
        }
        continue;
      }

      if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary' || t === '--data-urlencode') {
        const d = next() || '';
        i++;
        data = data ? (data + '&' + d) : d;
        if (method === 'GET') method = 'POST';
        continue;
      }

      if (t === '-F' || t === '--form') {
        const f = next() || '';
        i++;
        isMultipart = true;
        const eq = f.indexOf('=');
        if (eq > -1) {
          const k = f.slice(0, eq);
          const v = f.slice(eq + 1);
          if (v.startsWith('@')) {
            files.push(v.slice(1));
          } else {
            formFields[k] = v;
          }
        }
        if (method === 'GET') method = 'POST';
        continue;
      }

      if (t === '-b' || t === '--cookie') {
        const c = next() || '';
        i++;
        cookies = { ...cookies, ...this.parseCookieString(c) };
        continue;
      }

      if (t === '-u' || t === '--user') {
        const u = next() || '';
        i++;
        headers['Authorization'] = 'Basic ' + btoa(u);
        continue;
      }

      if (t === '--url') {
        url = next();
        i++;
        continue;
      }

      if (t.startsWith('-')) {
        continue;
      }

      // First non-flag token assumed url
      url = t;
    }

    let baseUrl = url || '';
    const params = {};

    try {
      const u = new URL(url);
      baseUrl = `${u.origin}${u.pathname}`;
      for (const [k, v] of u.searchParams.entries()) {
        params[k] = v;
      }
    } catch {}

    // Heuristic content type
    if (!contentType) {
      if (isMultipart) {
        contentType = 'multipart/form-data';
      } else if (data != null) {
        const t = data.trim();
        if (t.startsWith('{') || t.startsWith('[')) {
          contentType = 'application/json';
        } else {
          contentType = 'application/x-www-form-urlencoded';
        }
      }
    }

    return {
      method,
      url,
      baseUrl,
      params,
      headers,
      data,
      isMultipart,
      formFields,
      files,
      cookies,
      contentType
    };
  },

  shellSplit(str) {
    const out = [];
    let i = 0;
    let cur = '';
    let q = null; // quote: ' or "

    while (i < str.length) {
      const ch = str[i];

      if (q) {
        if (ch === q) {
          q = null;
          i++;
          continue;
        }
        if (q === '"' && ch === '\\' && i + 1 < str.length) {
          cur += str[i + 1];
          i += 2;
          continue;
        }
        cur += ch;
        i++;
        continue;
      }

      if (ch === "'" || ch === '"') {
        q = ch;
        i++;
        continue;
      }

      if (/\s/.test(ch)) {
        if (cur.length) {
          out.push(cur);
          cur = '';
        }
        i++;
        while (i < str.length && /\s/.test(str[i])) i++;
        continue;
      }

      if (ch === '\\' && i + 1 < str.length) {
        cur += str[i + 1];
        i += 2;
        continue;
      }

      cur += ch;
      i++;
    }

    if (cur.length) out.push(cur);
    return out;
  },

  parseCookieString(s) {
    const out = {};
    s.split(';').forEach(part => {
      const [k, ...rest] = part.split('=');
      if (!k) return;
      out[k.trim()] = (rest.join('=') || '').trim();
    });
    return out;
  }
};
