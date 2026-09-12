// curl-parser.js - read a curl command, and write one back.
//
// Both directions live here so they stay each other's inverse: the command we
// print is the command we can re-import.
const CurlParser = {
  // Flags that take no argument. Knowing them matters: treating `--compressed`
  // as "a value follows" swallowed the next token, which was often the URL.
  BOOLEAN_FLAGS: new Set([
    '-L', '--location', '-k', '--insecure', '-s', '--silent', '-S', '--show-error',
    '-v', '--verbose', '-i', '--include', '-g', '--globoff', '-f', '--fail',
    '--compressed', '--no-buffer', '-#', '--progress-bar', '-N', '--no-keepalive',
    '-4', '--ipv4', '-6', '--ipv6', '-j', '--junk-session-cookies'
  ]),

  parse(cmd) {
    const tokens = this.shellSplit(cmd);
    if (tokens.length === 0) throw new Error('Lệnh rỗng');

    let start = 0;
    if (tokens[0].toLowerCase() === 'curl') start = 1;
    else throw new Error("Lệnh phải bắt đầu bằng 'curl'");

    let method = null;
    let url = null;
    const headers = {};
    let data = null;
    let isMultipart = false;
    const formFields = {};
    const files = [];
    let cookies = {};
    let contentType = null;
    let followRedirects = false;
    const unsupported = [];

    for (let i = start; i < tokens.length; i++) {
      let token = tokens[i];
      let inlineValue = null;

      // `--header=value` and `-XPOST` both appear in the wild.
      if (token.startsWith('--') && token.includes('=')) {
        const eq = token.indexOf('=');
        inlineValue = token.slice(eq + 1);
        token = token.slice(0, eq);
      } else if (/^-[XHdbuFAe]./.test(token)) {
        inlineValue = token.slice(2);
        token = token.slice(0, 2);
      }

      const takeValue = () => {
        if (inlineValue !== null) return inlineValue;
        const next = i + 1 < tokens.length ? tokens[i + 1] : null;
        i++;
        return next;
      };

      if (this.BOOLEAN_FLAGS.has(token)) {
        if (token === '-L' || token === '--location') followRedirects = true;
        continue;
      }

      switch (token) {
        case '-X': case '--request':
          method = (takeValue() || 'GET').toUpperCase();
          continue;

        case '-I': case '--head':
          method = 'HEAD';
          continue;

        case '-H': case '--header': {
          const header = takeValue();
          if (header) {
            const idx = header.indexOf(':');
            if (idx > -1) {
              const key = header.slice(0, idx).trim();
              const value = header.slice(idx + 1).trim();
              if (key) {
                headers[key] = value;
                if (/^content-type$/i.test(key)) contentType = value;
              }
            }
          }
          continue;
        }

        case '-d': case '--data': case '--data-raw':
        case '--data-binary': case '--data-ascii': case '--data-urlencode': {
          const value = takeValue() || '';
          if (value.startsWith('@')) unsupported.push(`${token} ${value} (đọc file không khả dụng trong trình duyệt)`);
          else data = data === null ? value : data + '&' + value;
          if (!method) method = 'POST';
          continue;
        }

        case '-F': case '--form': case '--form-string': {
          const value = takeValue() || '';
          isMultipart = true;
          const eq = value.indexOf('=');
          if (eq > -1) {
            const key = value.slice(0, eq);
            const raw = value.slice(eq + 1);
            if (raw.startsWith('@') || raw.startsWith('<')) files.push({ field: key, path: raw.slice(1) });
            else formFields[key] = raw;
          }
          if (!method) method = 'POST';
          continue;
        }

        case '-b': case '--cookie': {
          const value = takeValue() || '';
          if (value.includes('=')) cookies = { ...cookies, ...this.parseCookieString(value) };
          else unsupported.push(`${token} ${value} (cookie jar dạng file)`);
          continue;
        }

        case '-u': case '--user': {
          const value = takeValue() || '';
          headers['Authorization'] = 'Basic ' + this.utf8Base64(value);
          continue;
        }

        case '-A': case '--user-agent':
          headers['User-Agent'] = takeValue() || '';
          continue;

        case '-e': case '--referer':
          headers['Referer'] = takeValue() || '';
          continue;

        case '--url':
          url = takeValue();
          continue;

        default:
          if (token.startsWith('-')) {
            // An unknown flag may or may not take a value; skipping only the
            // flag is the safer guess than silently eating the next token.
            unsupported.push(token);
            continue;
          }
          if (!url) url = token;
          continue;
      }
    }

    if (!url) throw new Error('Không tìm thấy URL trong lệnh curl');

    const params = {};
    let baseUrl = url;
    try {
      const parsed = new URL(url);
      baseUrl = `${parsed.origin}${parsed.pathname}`;
      parsed.searchParams.forEach((value, key) => { params[key] = value; });
    } catch {
      // Relative or templated URL ({{BASE}}/users) - keep the query inline.
      const queryIndex = url.indexOf('?');
      if (queryIndex > -1) {
        baseUrl = url.slice(0, queryIndex);
        new URLSearchParams(url.slice(queryIndex + 1)).forEach((value, key) => { params[key] = value; });
      }
    }

    if (!contentType) {
      if (isMultipart) contentType = 'multipart/form-data';
      else if (data != null) {
        const trimmed = data.trim();
        contentType = (trimmed.startsWith('{') || trimmed.startsWith('['))
          ? 'application/json'
          : 'application/x-www-form-urlencoded';
      }
    }

    return {
      method: method || 'GET',
      url,
      baseUrl,
      params,
      headers,
      data,
      isMultipart,
      formFields,
      files,
      cookies,
      contentType,
      followRedirects,
      unsupported
    };
  },

  /**
   * Split a shell command into tokens.
   *
   * Handles the backslash-newline continuation that every "Copy as cURL" in
   * every browser emits. The previous version turned that continuation into a
   * bare "\n" token, which then fell through to the "first non-flag token is the
   * URL" rule and overwrote the real URL - so no multi-line curl could be
   * imported at all.
   */
  shellSplit(str) {
    const out = [];
    let i = 0;
    let cur = '';
    let started = false;   // distinguishes '' (an empty token) from no token
    let quote = null;      // "'", '"' or "$'"

    const push = () => {
      if (started || cur.length) out.push(cur);
      cur = '';
      started = false;
    };

    while (i < str.length) {
      const ch = str[i];

      if (quote === "$'") {
        if (ch === "'") { quote = null; i++; continue; }
        if (ch === '\\' && i + 1 < str.length) {
          const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' };
          const next = str[i + 1];
          cur += Object.prototype.hasOwnProperty.call(escapes, next) ? escapes[next] : next;
          i += 2;
          continue;
        }
        cur += ch;
        i++;
        continue;
      }

      if (quote) {
        if (ch === quote) { quote = null; i++; continue; }
        if (quote === '"' && ch === '\\' && i + 1 < str.length) {
          // Inside double quotes a backslash only escapes a few characters.
          const next = str[i + 1];
          if (next === '\n') { i += 2; continue; }
          cur += '"$`\\'.includes(next) ? next : '\\' + next;
          i += 2;
          continue;
        }
        cur += ch;
        i++;
        continue;
      }

      if (ch === '$' && str[i + 1] === "'") { quote = "$'"; started = true; i += 2; continue; }
      if (ch === "'" || ch === '"') { quote = ch; started = true; i++; continue; }

      if (ch === '\\' && i + 1 < str.length) {
        if (str[i + 1] === '\n') { i += 2; continue; }          // line continuation
        if (str[i + 1] === '\r' && str[i + 2] === '\n') { i += 3; continue; }
        cur += str[i + 1];
        started = true;
        i += 2;
        continue;
      }

      // Windows "Copy as cURL (cmd)" uses ^ at end of line for continuation.
      if (ch === '^' && (str[i + 1] === '\n' || (str[i + 1] === '\r' && str[i + 2] === '\n'))) {
        i += str[i + 1] === '\r' ? 3 : 2;
        continue;
      }

      if (/\s/.test(ch)) {
        push();
        while (i < str.length && /\s/.test(str[i])) i++;
        continue;
      }

      cur += ch;
      started = true;
      i++;
    }

    push();
    return out;
  },

  parseCookieString(str) {
    const out = {};
    String(str || '').split(';').forEach(part => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const key = part.slice(0, idx).trim();
      if (key) out[key] = part.slice(idx + 1).trim();
    });
    return out;
  },

  utf8Base64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  },

  /** Wrap a value in single quotes, escaping any single quote inside it. */
  shQuote(value) {
    return "'" + String(value ?? '').replace(/'/g, "'\\''") + "'";
  },

  /**
   * Render a request spec as a runnable curl command.
   *
   * Note the trailing backslashes. The previous builder joined lines with a bare
   * newline, producing a command that a shell reads as several separate ones -
   * every copied command failed with "curl: no URL specified".
   */
  build(spec, options = {}) {
    const method = (spec.method || 'GET').toUpperCase();
    const headers = { ...(spec.headers || {}) };
    const params = { ...(spec.params || {}) };

    if (window.HttpClient) HttpClient.applyAuth(spec.auth, headers, params);

    const url = window.HttpClient
      ? HttpClient.buildUrl(spec.url, params)
      : spec.url;

    const lines = [];
    lines.push(`curl -X ${method} ${this.shQuote(url)}`);
    if (options.followRedirects) lines.push('--location');

    const contentType = spec.contentType || 'application/json';
    const isMultipart = contentType === 'multipart/form-data';
    const hasBody = !['GET', 'HEAD'].includes(method) && (spec.body || '').trim();

    Object.entries(headers).forEach(([key, value]) => {
      // curl derives the multipart Content-Type (with its own boundary) from -F.
      if (isMultipart && /^content-type$/i.test(key)) return;
      lines.push(`-H ${this.shQuote(`${key}: ${value}`)}`);
    });

    const cookieEntries = Object.entries(spec.cookies || {}).filter(([k]) => k);
    if (cookieEntries.length) {
      lines.push(`-b ${this.shQuote(cookieEntries.map(([k, v]) => `${k}=${v}`).join('; '))}`);
    }

    if (hasBody || (isMultipart && (spec.files || []).length)) {
      if (isMultipart) {
        try {
          const fields = JSON.parse(spec.body || '{}');
          Object.entries(fields).forEach(([k, v]) => lines.push(`-F ${this.shQuote(`${k}=${v}`)}`));
        } catch { /* no text fields */ }
        Array.from(spec.files || []).forEach(file => {
          lines.push(`-F ${this.shQuote(`${file.name}=@${file.name}`)}`);
        });
      } else if (contentType === 'application/x-www-form-urlencoded') {
        let encoded = spec.body;
        try {
          const parsed = JSON.parse(spec.body || '{}');
          if (parsed && typeof parsed === 'object') encoded = new URLSearchParams(parsed).toString();
        } catch { /* raw */ }
        lines.push(`-d ${this.shQuote(encoded)}`);
      } else {
        lines.push(`-d ${this.shQuote(spec.body)}`);
      }
    }

    return lines.join(' \\\n  ');
  }
};
