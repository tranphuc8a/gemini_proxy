// response-viewer.js - render one response across the Body/Headers/Preview/Raw tabs.
//
// Works from bytes, not from a pre-decoded string. The old version decoded every
// response as UTF-8 and then did `new Blob([thatString])` for image previews,
// which re-encoded the mangled text and produced a broken image every time.
(function (global) {
  let current = null;     // the response being displayed
  let searchTerm = '';
  let previewUrl = null;  // object URL to revoke before creating the next one

  // ---------------------------------------------------------------- utilities
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function charsetOf(contentType) {
    const match = /charset=["']?([\w-]+)/i.exec(contentType || '');
    return (match && match[1].toLowerCase()) || 'utf-8';
  }

  function decode(bytes, contentType) {
    if (!bytes || !bytes.length) return '';
    try {
      return new TextDecoder(charsetOf(contentType), { fatal: false }).decode(bytes);
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
  }

  function isTextual(contentType) {
    const ct = (contentType || '').toLowerCase();
    if (!ct) return true; // no header: assume text, the usual case for plain APIs
    return ct.startsWith('text/')
      || ct.includes('json')
      || ct.includes('xml')
      || ct.includes('javascript')
      || ct.includes('x-www-form-urlencoded')
      || ct.includes('csv');
  }

  function prettyJSON(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  function statusClass(status) {
    if (status === 'ERROR' || status === 0) return 'status-error';
    const code = parseInt(status, 10);
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 300 && code < 400) return 'status-3xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    if (code >= 500) return 'status-5xx';
    return '';
  }

  // ------------------------------------------------------------- body rendering
  /** Colourise a pretty-printed JSON document. Input must already be escaped. */
  function highlightJSON(escaped) {
    return escaped.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match, str, colon, literal, number) => {
        if (str) return `<span class="${colon ? 'json-key' : 'json-string'}">${str}</span>${colon || ''}`;
        if (literal) return `<span class="json-literal">${literal}</span>`;
        if (number) return `<span class="json-number">${number}</span>`;
        return match;
      }
    );
  }

  function markMatches(html, term) {
    if (!term) return html;
    // The haystack is already escaped, so escape the needle the same way to make
    // a search for "<div>" or "&amp;" actually line up with the text.
    const needle = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(needle, 'gi'), m => `<mark>${m}</mark>`);
  }

  function countMatches(text, term) {
    if (!term) return 0;
    const needle = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (text.match(new RegExp(needle, 'gi')) || []).length;
  }

  function renderBody() {
    const el = document.getElementById('responseBody');
    if (!current) return;

    if (!current.isText) {
      el.innerHTML = `<em class="muted">[dữ liệu nhị phân - ${formatBytes(current.sizeBytes)} - ${escapeHtml(current.contentType || 'không rõ kiểu')}]<br>Xem ở tab Preview hoặc bấm "Tải body".</em>`;
      return;
    }

    const isJSON = (current.contentType || '').toLowerCase().includes('json');
    const text = isJSON ? prettyJSON(current.text) : current.text;
    let html = escapeHtml(text);
    // Highlighting and search marking both inject tags, and running them over
    // each other corrupts the markup (searching for "span" would match the
    // highlighter's own elements). While searching, plain text is what matters.
    if (isJSON && !searchTerm) html = highlightJSON(html);
    html = markMatches(html, searchTerm);
    el.innerHTML = html || '<em class="muted">(body rỗng)</em>';

    const info = document.getElementById('respSearchInfo');
    if (info) {
      const count = countMatches(text, searchTerm);
      info.textContent = searchTerm ? `${count} kết quả` : '';
    }
  }

  function renderHeaders() {
    const el = document.getElementById('responseHeaders');
    const pairs = current && current.rawHeaders && current.rawHeaders.length
      ? current.rawHeaders
      : Object.entries((current && current.headers) || {});

    if (!pairs.length) {
      el.innerHTML = '<em class="muted">Không có header</em>';
      return;
    }

    const rows = pairs
      .map(([k, v]) => `<div class="header-row"><span class="header-name">${escapeHtml(k)}</span><span class="header-value">${escapeHtml(v)}</span></div>`)
      .join('');

    const warning = current && current.headersComplete === false
      ? `<div class="notice notice-warn">Trình duyệt chỉ cho phép đọc 6 header an toàn với response cross-origin.
         Đổi sang chế độ <b>Proxy</b> để xem đầy đủ header.</div>`
      : '';

    el.innerHTML = warning + rows;
  }

  function renderPreview() {
    const el = document.getElementById('responsePreview');
    el.innerHTML = '';
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    if (!current) return;

    const ct = (current.contentType || '').toLowerCase();

    if (ct.includes('html')) {
      const iframe = document.createElement('iframe');
      // No allow-scripts: a response body is untrusted input, and we are only
      // showing the user what it looks like, not running it.
      iframe.setAttribute('sandbox', '');
      iframe.className = 'preview-frame';
      el.appendChild(iframe);
      iframe.srcdoc = current.text;
      return;
    }

    if (ct.includes('image/') || ct.includes('application/pdf')) {
      const blob = new Blob([current.bytes], { type: current.contentType.split(';')[0] });
      previewUrl = URL.createObjectURL(blob);
      if (ct.includes('application/pdf')) {
        const frame = document.createElement('iframe');
        frame.className = 'preview-frame';
        frame.src = previewUrl;
        el.appendChild(frame);
      } else {
        const img = document.createElement('img');
        img.alt = 'Response image';
        img.className = 'preview-image';
        img.src = previewUrl;
        el.appendChild(img);
      }
      return;
    }

    if (current.isText) {
      const pre = document.createElement('pre');
      pre.className = 'preview-text';
      pre.textContent = current.text;
      el.appendChild(pre);
      return;
    }

    el.innerHTML = '<em class="muted">Không có preview cho kiểu dữ liệu này</em>';
  }

  function renderMeta() {
    const statusEl = document.getElementById('respStatusCode');
    statusEl.textContent = `${current.status}${current.statusText ? ' ' + current.statusText : ''}`;
    statusEl.className = `tag ${statusClass(current.status)}`;

    document.getElementById('respTime').textContent = `${current.timeMs} ms`;
    document.getElementById('respSize').textContent = formatBytes(current.sizeBytes);

    const viaEl = document.getElementById('respVia');
    if (viaEl) {
      viaEl.textContent = current.via === 'proxy' ? 'qua proxy' : 'trực tiếp';
      viaEl.className = `tag ${current.via === 'proxy' ? 'tag-proxy' : 'tag-direct'}`;
      viaEl.style.display = current.via ? '' : 'none';
      viaEl.title = current.finalUrl || '';
    }

    const notes = [];
    if (current.fellBackFrom) {
      notes.push(`Gửi trực tiếp thất bại (${current.fallbackReason || 'CORS'}) — đã tự chuyển sang proxy.`);
    }
    if (current.truncated) {
      notes.push(`Body bị cắt bớt: chỉ nhận ${formatBytes(current.bytes.length)} trong tổng ${formatBytes(current.sizeBytes)} (PROXY_MAX_BYTES).`);
    }
    if (current.redirected && current.finalUrl) {
      notes.push(`Đã redirect tới ${current.finalUrl}`);
    }

    const noteEl = document.getElementById('respNotes');
    if (noteEl) {
      noteEl.innerHTML = notes.map(n => `<div class="notice notice-info">${escapeHtml(n)}</div>`).join('');
      noteEl.style.display = notes.length ? 'block' : 'none';
    }
  }

  // --------------------------------------------------------------------- API
  function setActive(tabId) {
    document.querySelectorAll('#responseTabs .resp-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.rtab === tabId);
    });
    document.querySelectorAll('.response-area').forEach(area => {
      area.style.display = area.id === tabId ? 'block' : 'none';
    });
  }

  /**
   * @param {object} result  normalised response from HttpClient.send, or an
   *                         error shape { status:'ERROR', errorMessage }
   */
  function render(result) {
    const bytes = result.bytes instanceof Uint8Array
      ? result.bytes
      : new TextEncoder().encode(result.body || '');

    current = {
      status: result.status,
      statusText: result.statusText || '',
      headers: result.headers || {},
      rawHeaders: result.rawHeaders || [],
      bytes,
      contentType: result.contentType || '',
      sizeBytes: result.sizeBytes ?? bytes.length,
      timeMs: result.timeMs || 0,
      via: result.via || '',
      finalUrl: result.finalUrl || '',
      redirected: !!result.redirected,
      truncated: !!result.truncated,
      headersComplete: result.headersComplete,
      fellBackFrom: result.fellBackFrom,
      fallbackReason: result.fallbackReason,
      isText: isTextual(result.contentType || '')
    };
    current.text = current.isText ? decode(bytes, current.contentType) : '';

    document.getElementById('responseRaw').textContent = current.isText
      ? current.text
      : `[${formatBytes(current.sizeBytes)} dữ liệu nhị phân]`;

    renderMeta();
    renderBody();
    renderHeaders();
    renderPreview();
    setActive('responseBody');
  }

  /** Render a failed attempt, where there is no HTTP response at all. */
  function renderError(message, { hint = '' } = {}) {
    current = {
      status: 'ERROR', statusText: '', headers: {}, rawHeaders: [],
      bytes: new Uint8Array(), contentType: 'text/plain', sizeBytes: 0,
      timeMs: 0, via: '', finalUrl: '', redirected: false, truncated: false,
      headersComplete: true, isText: true, text: message
    };

    renderMeta();
    document.getElementById('responseBody').innerHTML =
      `<div class="notice notice-error">${escapeHtml(message)}</div>` +
      (hint ? `<div class="notice notice-info">${hint}</div>` : '');
    document.getElementById('responseRaw').textContent = message;
    document.getElementById('responseHeaders').innerHTML = '<em class="muted">Không có header</em>';
    document.getElementById('responsePreview').innerHTML = '<em class="muted">Không có preview</em>';
    setActive('responseBody');
  }

  function setSearch(term) {
    searchTerm = term || '';
    renderBody();
  }

  function setWrap(enabled) {
    document.querySelectorAll('.response-area').forEach(area => {
      area.classList.toggle('nowrap', !enabled);
    });
  }

  function getBodyText() {
    return current ? (current.isText ? current.text : '') : '';
  }

  function getCurrent() {
    return current;
  }

  /** Hand the raw bytes to the user as a file, named from the URL and type. */
  function download() {
    if (!current) return;
    const ext = (current.contentType || '').includes('json') ? 'json'
      : (current.contentType || '').includes('html') ? 'html'
      : (current.contentType || '').includes('xml') ? 'xml'
      : (current.contentType || '').split('/')[1]?.split(';')[0] || 'txt';
    const blob = new Blob([current.bytes], { type: current.contentType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clear() {
    current = null;
    searchTerm = '';
    ['respStatusCode', 'respTime', 'respSize', 'respVia'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.className = 'tag'; }
    });
    const notes = document.getElementById('respNotes');
    if (notes) { notes.innerHTML = ''; notes.style.display = 'none'; }
    document.getElementById('responseBody').innerHTML =
      '<em class="muted">Response sẽ hiển thị ở đây...</em>';
    document.getElementById('responseHeaders').innerHTML = '';
    document.getElementById('responseRaw').textContent = '';
    document.getElementById('responsePreview').innerHTML = '';
    setActive('responseBody');
  }

  global.ResponseViewer = {
    render, renderError, setActive, setSearch, setWrap,
    getBodyText, getCurrent, download, clear, formatBytes
  };
})(window);
