// Main Application Logic - wires the DOM to Storage / EnvManager / HttpClient.
const App = {
  currentRequest: null,   // the saved request currently open, if any
  lastCurl: '',
  inFlight: null,         // AbortController of the request being sent
  proxyInfo: { available: false, reason: 'chưa kiểm tra' },
  syncingUrl: false,      // guards the URL <-> Params two-way sync

  KV_CONTAINERS: ['paramsContainer', 'headersContainer', 'cookiesContainer'],

  init() {
    Storage.migrate();

    this.setupTabs();
    this.setupAuthType();
    this.setupResponseTabs();
    this.setupContentType();
    this.setupButtons();
    this.setupModals();
    this.setupShortcuts();
    this.setupUrlParamSync();
    this.initKeyValuePairs();
    this.initEnvironments();
    this.applySettings();

    Search.initSearch();
    Sidebar.init();
    ResponseViewer.clear();

    this.refreshProxyStatus();
    this.updateTabBadges();
  },

  // ------------------------------------------------------------------- setup
  setupTabs() {
    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
          content.style.display = content.id === tab.dataset.tab ? 'flex' : 'none';
        });
        if (tab.dataset.tab === 'curl') this.refreshCurlPreview();
      });
    });
  },

  setupAuthType() {
    const select = document.getElementById('authType');
    const apply = () => {
      document.querySelectorAll('.auth-section').forEach(section => {
        section.style.display = section.id === `auth-${select.value}` ? 'block' : 'none';
      });
      this.updateTabBadges();
    };
    select.addEventListener('change', apply);
    apply();
  },

  setupResponseTabs() {
    document.querySelectorAll('.resp-tab').forEach(tab => {
      tab.addEventListener('click', () => ResponseViewer.setActive(tab.dataset.rtab));
    });
  },

  setupContentType() {
    const select = document.getElementById('contentType');
    const apply = () => {
      const isMultipart = select.value === 'multipart/form-data';
      document.getElementById('fileRow').style.display = isMultipart ? 'flex' : 'none';
      document.getElementById('bodyHint').textContent = {
        'application/json': 'Nhập JSON. Dùng {{VAR}} để chèn biến environment.',
        'application/x-www-form-urlencoded': 'Nhập JSON object — sẽ được encode thành a=1&b=2.',
        'multipart/form-data': 'Nhập JSON object cho các field text, chọn file ở dưới.',
        'application/xml': 'Nhập XML thô.',
        'text/plain': 'Nội dung thô, gửi nguyên văn.'
      }[select.value] || '';
    };
    select.addEventListener('change', apply);
    apply();
  },

  setupButtons() {
    document.getElementById('sendBtn').addEventListener('click', () => this.sendRequest());
    document.getElementById('cancelBtn').addEventListener('click', () => this.cancelRequest());
    document.getElementById('copyCurlBtn').addEventListener('click', () => this.copyCurl());
    document.getElementById('parseCurlBtn').addEventListener('click', () => this.parseCurl());
    document.getElementById('copyGeneratedCurlBtn').addEventListener('click', () => this.copyCurl());
    document.getElementById('saveCurrentBtn').addEventListener('click', () => this.saveCurrentRequest());
    document.getElementById('newBlankBtn').addEventListener('click', () => this.clearForm(true));
    document.getElementById('beautifyBodyBtn').addEventListener('click', () => this.beautifyBody());

    document.getElementById('copyResponseBtn').addEventListener('click', () => this.copyResponseBody());
    document.getElementById('downloadResponseBtn').addEventListener('click', () => ResponseViewer.download());
    document.getElementById('wrapToggle').addEventListener('change', (e) => {
      Storage.updateSettings({ wrapResponse: e.target.checked });
      ResponseViewer.setWrap(e.target.checked);
    });
    document.getElementById('respSearch').addEventListener('input', (e) => {
      ResponseViewer.setSearch(e.target.value);
    });

    document.getElementById('manageEnvsBtn').addEventListener('click', () => this.openEnvModal());
    document.getElementById('addEnvVarBtn').addEventListener('click', () => this.addEnvVarKV());
    document.getElementById('saveEnvBtn').addEventListener('click', () => this.saveEnvironment());
    document.getElementById('newEnvBtn').addEventListener('click', () => {
      document.getElementById('envName').value = '';
      this.setEnvVarsKV({});
      document.getElementById('envName').focus();
    });

    document.getElementById('exportDataBtn').addEventListener('click', () => this.showExportModal());
    document.getElementById('importDataBtn').addEventListener('click', () => this.showImportModal());
    document.getElementById('doImportBtn').addEventListener('click', () => this.doImportData());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.readImportFile(e));
    document.getElementById('downloadExportBtn').addEventListener('click', () => {
      this.downloadExport(Storage.exportData());
    });

    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('testProxyBtn').addEventListener('click', () => this.refreshProxyStatus(true));

    document.getElementById('toggleSidebarBtn').addEventListener('click', () => this.toggleSidebar());

    document.getElementById('sendMode').addEventListener('change', (e) => {
      Storage.updateSettings({ sendMode: e.target.value });
      this.updateSendModeHint();
    });

    this.KV_CONTAINERS.forEach(id => {
      document.querySelector(`[data-add-kv="${id}"]`)
        .addEventListener('click', () => this.addKV(id));
    });
  },

  setupModals() {
    document.querySelectorAll('.modal-close, .modal-dismiss').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.modal').classList.remove('active'));
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    });

    document.getElementById('saveCollectionBtn').addEventListener('click', () => this.saveCollection());
    document.getElementById('saveRequestBtn').addEventListener('click', () => this.saveRequestFromModal());
  },

  setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      if (e.key === 'Enter') {           // send from anywhere, including a textarea
        e.preventDefault();
        this.sendRequest();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveCurrentRequest();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
    });
  },

  /**
   * Keep the URL bar and the Params tab describing the same query string.
   *
   * Without this, typing `?page=2` in the URL and then adding a param in the tab
   * produced `?page=2&page=2`, and users had no idea which one the server saw.
   */
  setupUrlParamSync() {
    const urlInput = document.getElementById('url');
    let timer;
    urlInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (this.syncingUrl) return;
        this.syncingUrl = true;
        this.setKV('paramsContainer', HttpClient.extractParams(urlInput.value));
        this.syncingUrl = false;
        this.updateTabBadges();
      }, 350);
    });

    document.getElementById('paramsContainer').addEventListener('input', () => {
      if (this.syncingUrl) return;
      this.syncingUrl = true;
      const base = HttpClient.stripQuery(urlInput.value);
      const built = HttpClient.buildUrl(base, this.readKV('paramsContainer'));
      // URLSearchParams percent-encodes braces; keep {{VAR}} readable.
      urlInput.value = built.replace(/%7B%7B/gi, '{{').replace(/%7D%7D/gi, '}}');
      this.syncingUrl = false;
      this.updateTabBadges();
    });

    ['headersContainer', 'cookiesContainer', 'bodyContent'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateTabBadges());
    });
  },

  applySettings() {
    const settings = Storage.getSettings();
    document.getElementById('sendMode').value = settings.sendMode;
    document.getElementById('wrapToggle').checked = settings.wrapResponse;
    ResponseViewer.setWrap(settings.wrapResponse);
    this.applySidebarCollapsed();
    this.updateSendModeHint();
  },

  // ------------------------------------------------------------------ badges
  /** Show how many entries each tab holds, so nothing is configured invisibly. */
  updateTabBadges() {
    const counts = {
      params: Object.keys(this.readKV('paramsContainer')).length,
      headers: Object.keys(this.readKV('headersContainer')).length,
      cookies: Object.keys(this.readKV('cookiesContainer')).length
    };
    Object.entries(counts).forEach(([tab, count]) => {
      const badge = document.querySelector(`.tab[data-tab="${tab}"] .tab-badge`);
      if (badge) {
        badge.textContent = count || '';
        badge.style.display = count ? 'inline-block' : 'none';
      }
    });

    const authBadge = document.querySelector('.tab[data-tab="auth"] .tab-badge');
    const authType = document.getElementById('authType').value;
    if (authBadge) {
      authBadge.textContent = authType === 'none' ? '' : '●';
      authBadge.style.display = authType === 'none' ? 'none' : 'inline-block';
    }

    const bodyBadge = document.querySelector('.tab[data-tab="body"] .tab-badge');
    const hasBody = !!document.getElementById('bodyContent').value.trim();
    if (bodyBadge) {
      bodyBadge.textContent = hasBody ? '●' : '';
      bodyBadge.style.display = hasBody ? 'inline-block' : 'none';
    }
  },

  // ------------------------------------------------------------ environments
  initEnvironments() {
    this.refreshEnvironmentSelect();
    document.getElementById('environmentSelect').addEventListener('change', (e) => {
      EnvManager.setActiveName(e.target.value);
      this.updateEnvHint();
      Toast.info(e.target.value ? `Environment: ${e.target.value}` : 'Đã bỏ chọn environment');
    });
    this.updateEnvHint();
  },

  refreshEnvironmentSelect() {
    const select = document.getElementById('environmentSelect');
    let active = EnvManager.getActiveName();
    // The stored selection can name an environment that has since been deleted;
    // leaving it set would keep resolving every {{VAR}} against an empty table.
    if (active && !EnvManager.getEnvironment(active)) {
      EnvManager.setActiveName('');
      active = '';
    }
    const options = ['<option value="">(No Env)</option>'];
    EnvManager.listEnvironments().forEach(env => {
      const selected = env.name === active ? ' selected' : '';
      options.push(`<option value="${this.escapeAttr(env.name)}"${selected}>${this.escapeHtml(env.name)}</option>`);
    });
    select.innerHTML = options.join('');
    this.updateEnvHint();
  },

  /** Warn about {{VAR}} the active environment cannot fill, before sending. */
  updateEnvHint() {
    const hint = document.getElementById('envHint');
    if (!hint) return;
    const missing = EnvManager.findUnresolvedInSpec(this.getCurrentSpec());
    if (!missing.length) {
      hint.style.display = 'none';
      return;
    }
    hint.style.display = 'inline-block';
    hint.textContent = `⚠ ${missing.length} biến chưa có giá trị`;
    hint.title = missing.map(v => `{{${v}}}`).join(', ');
  },

  openEnvModal() {
    document.getElementById('envModal').classList.add('active');
    this.renderEnvList();
    const active = EnvManager.getActiveName();
    const env = active ? EnvManager.getEnvironment(active) : null;
    document.getElementById('envName').value = env ? env.name : '';
    this.setEnvVarsKV(env ? env.vars : {});
  },

  renderEnvList() {
    const list = document.getElementById('envList');
    const envs = EnvManager.listEnvironments();
    if (!envs.length) {
      list.innerHTML = '<em class="muted">Chưa có environment nào</em>';
      return;
    }
    list.innerHTML = envs.map(env => `
      <div class="env-item">
        <span class="env-name">${this.escapeHtml(env.name)}</span>
        <span class="muted">${Object.keys(env.vars || {}).length} biến</span>
        <button class="btn-secondary" data-env-action="load" data-env="${this.escapeAttr(env.name)}">Sửa</button>
        <button class="btn-danger" data-env-action="delete" data-env="${this.escapeAttr(env.name)}">Xóa</button>
      </div>`).join('');

    list.querySelectorAll('[data-env-action="load"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const env = EnvManager.getEnvironment(btn.dataset.env);
        if (!env) return;
        document.getElementById('envName').value = env.name;
        this.setEnvVarsKV(env.vars || {});
      });
    });

    list.querySelectorAll('[data-env-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!await Toast.confirm(`Xóa environment "${btn.dataset.env}"?`, { okLabel: 'Xóa' })) return;
        EnvManager.deleteEnvironment(btn.dataset.env);
        this.renderEnvList();
        this.refreshEnvironmentSelect();
        Toast.success('Đã xóa environment');
      });
    });
  },

  addEnvVarKV(key = '', value = '') {
    const container = document.getElementById('envVarsContainer');
    container.appendChild(this.makeKVRow(key, value, 'Tên biến', 'Giá trị'));
  },

  setEnvVarsKV(vars) {
    const container = document.getElementById('envVarsContainer');
    container.replaceChildren();
    const entries = Object.entries(vars || {});
    if (!entries.length) this.addEnvVarKV();
    else entries.forEach(([k, v]) => this.addEnvVarKV(k, v));
  },

  readEnvVars() {
    const vars = {};
    // children = [enabled checkbox, key, value, remove button] - see makeKVRow.
    document.querySelectorAll('#envVarsContainer .kv-pair').forEach(row => {
      const key = row.children[1].value.trim();
      if (key) vars[key] = row.children[2].value;
    });
    return vars;
  },

  saveEnvironment() {
    const name = document.getElementById('envName').value.trim();
    if (!name) {
      Toast.error('Tên environment không được để trống');
      return;
    }
    EnvManager.upsertEnvironment(name, this.readEnvVars());
    if (!EnvManager.getActiveName()) EnvManager.setActiveName(name);
    this.refreshEnvironmentSelect();
    this.renderEnvList();
    Toast.success(`Đã lưu environment "${name}"`);
  },

  // ---------------------------------------------------------------- settings
  openSettingsModal() {
    const settings = Storage.getSettings();
    document.getElementById('setApiPrefix').value = settings.apiPrefix;
    document.getElementById('setProxyBaseUrl').value = settings.proxyBaseUrl;
    document.getElementById('setTimeout').value = settings.timeoutSeconds;
    document.getElementById('setMaxHistory').value = settings.maxHistory;
    document.getElementById('setFollowRedirects').checked = settings.followRedirects;
    document.getElementById('settingsModal').classList.add('active');
    this.renderProxyStatus();
  },

  saveSettings() {
    const timeout = Number(document.getElementById('setTimeout').value);
    const maxHistory = Number(document.getElementById('setMaxHistory').value);
    if (!(timeout > 0) || !(maxHistory > 0)) {
      Toast.error('Timeout và số lượng history phải là số dương');
      return;
    }
    Storage.updateSettings({
      apiPrefix: document.getElementById('setApiPrefix').value.trim() || '/api/v1',
      proxyBaseUrl: document.getElementById('setProxyBaseUrl').value.trim(),
      timeoutSeconds: timeout,
      maxHistory: Math.min(maxHistory, 1000),
      followRedirects: document.getElementById('setFollowRedirects').checked
    });
    document.getElementById('settingsModal').classList.remove('active');
    Toast.success('Đã lưu cài đặt');
    this.refreshProxyStatus();
  },

  async refreshProxyStatus(verbose = false) {
    const status = await HttpClient.proxyStatus();
    this.proxyInfo = status;
    this.renderProxyStatus();
    this.updateSendModeHint();
    if (verbose) {
      if (status.available) Toast.success(`Proxy sẵn sàng tại ${HttpClient.proxyBase()}`);
      else Toast.error(`Proxy không khả dụng: ${status.reason}`);
    }
  },

  renderProxyStatus() {
    const el = document.getElementById('proxyStatus');
    if (!el) return;
    if (this.proxyInfo.available) {
      const info = this.proxyInfo.info || {};
      el.className = 'notice notice-ok';
      el.textContent = `✅ Proxy sẵn sàng (${HttpClient.proxyBase()}) · host cho phép: ${info.allowed_hosts || '*'} · tối đa ${ResponseViewer.formatBytes(info.max_bytes || 0)}`;
    } else {
      el.className = 'notice notice-warn';
      el.textContent = `⚠️ Proxy không khả dụng: ${this.proxyInfo.reason}. Kiểm tra backend FastAPI có đang chạy và PROXY_ENABLED=true không.`;
    }
  },

  updateSendModeHint() {
    const mode = document.getElementById('sendMode').value;
    const hint = document.getElementById('sendModeHint');
    if (!hint) return;
    const text = {
      auto: 'Auto: thử gửi thẳng, nếu bị CORS chặn thì tự chuyển qua proxy.',
      direct: 'Direct: gửi thẳng từ trình duyệt — nhanh nhưng dính CORS và bị bỏ header Cookie.',
      proxy: 'Proxy: backend gửi hộ — không dính CORS, gửi được mọi header, thấy đủ response header.'
    }[mode];
    hint.textContent = text;
    hint.className = (mode !== 'direct' && !this.proxyInfo.available) ? 'hint hint-warn' : 'hint';
    if (mode !== 'direct' && !this.proxyInfo.available) {
      hint.textContent += ' (Proxy đang không khả dụng!)';
    }
  },

  // ------------------------------------------------------------- key/value UI
  makeKVRow(key = '', value = '', keyPlaceholder = 'Key', valuePlaceholder = 'Value') {
    const row = document.createElement('div');
    row.className = 'kv-pair';

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.className = 'kv-enabled';
    enabled.checked = true;
    enabled.title = 'Bật/tắt dòng này';

    const keyInput = document.createElement('input');
    keyInput.placeholder = keyPlaceholder;
    keyInput.value = key;

    const valueInput = document.createElement('input');
    valueInput.placeholder = valuePlaceholder;
    valueInput.value = value ?? '';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'rm';
    remove.title = 'Xóa dòng';
    remove.textContent = '🗑';
    remove.addEventListener('click', () => {
      const container = row.parentElement;
      row.remove();
      if (container && !container.children.length) {
        container.appendChild(this.makeKVRow('', '', keyPlaceholder, valuePlaceholder));
      }
      this.updateTabBadges();
      this.updateEnvHint();
    });

    enabled.addEventListener('change', () => {
      row.classList.toggle('kv-disabled', !enabled.checked);
      this.updateTabBadges();
    });

    row.append(enabled, keyInput, valueInput, remove);
    return row;
  },

  addKV(containerId) {
    document.getElementById(containerId).appendChild(this.makeKVRow());
  },

  setKV(containerId, obj) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    const entries = Object.entries(obj || {});
    if (!entries.length) container.appendChild(this.makeKVRow());
    else entries.forEach(([k, v]) => container.appendChild(this.makeKVRow(k, String(v ?? ''))));
  },

  /** Read one key/value table, skipping blank and unchecked rows. */
  readKV(containerId) {
    const out = {};
    document.querySelectorAll(`#${containerId} .kv-pair`).forEach(row => {
      const enabled = row.querySelector('.kv-enabled');
      if (enabled && !enabled.checked) return;
      const key = row.children[1].value.trim();
      if (key) out[key] = row.children[2].value;
    });
    return out;
  },

  initKeyValuePairs() {
    this.KV_CONTAINERS.forEach(id => this.setKV(id, {}));
  },

  // ------------------------------------------------------------------- spec
  /** The request exactly as typed, with {{VAR}} still in place. */
  getCurrentSpec() {
    const authType = document.getElementById('authType').value;
    const auth = { type: authType };
    if (authType === 'basic') {
      auth.username = document.getElementById('basicUser').value;
      auth.password = document.getElementById('basicPass').value;
    } else if (authType === 'bearer') {
      auth.token = document.getElementById('bearerToken').value;
    } else if (authType === 'apikey') {
      auth.keyName = document.getElementById('apiKeyName').value;
      auth.keyValue = document.getElementById('apiKeyValue').value;
      auth.location = document.getElementById('apiKeyLocation').value;
    }

    return {
      method: document.getElementById('method').value,
      // Params live in the URL as well; readKV would duplicate them.
      url: document.getElementById('url').value.trim(),
      params: {},
      headers: this.readKV('headersContainer'),
      cookies: this.readKV('cookiesContainer'),
      contentType: document.getElementById('contentType').value,
      body: document.getElementById('bodyContent').value,
      auth,
      files: document.getElementById('fileInput').files
    };
  },

  /** The same request with every {{VAR}} replaced by the active environment. */
  resolveSpec(spec) {
    const vars = EnvManager.activeVars();
    return {
      ...spec,
      url: EnvManager.resolve(spec.url, vars),
      headers: EnvManager.resolveObject(spec.headers, vars),
      params: EnvManager.resolveObject(spec.params, vars),
      cookies: EnvManager.resolveObject(spec.cookies, vars),
      body: EnvManager.resolve(spec.body, vars),
      auth: Object.fromEntries(
        Object.entries(spec.auth || {}).map(([k, v]) =>
          [k, typeof v === 'string' ? EnvManager.resolve(v, vars) : v])
      )
    };
  },

  // -------------------------------------------------------------------- send
  async sendRequest() {
    if (this.inFlight) {
      Toast.warn('Đang có request chạy — hãy đợi hoặc bấm Hủy');
      return;
    }

    const spec = this.getCurrentSpec();
    if (!spec.url) {
      Toast.error('Vui lòng nhập URL');
      document.getElementById('url').focus();
      return;
    }

    const missing = EnvManager.findUnresolvedInSpec(spec);
    if (missing.length) {
      Toast.warn(`Biến chưa có giá trị, sẽ gửi nguyên văn: ${missing.map(v => `{{${v}}}`).join(', ')}`);
    }

    const resolved = this.resolveSpec(spec);
    const settings = Storage.getSettings();
    const mode = document.getElementById('sendMode').value;

    const controller = new AbortController();
    this.inFlight = controller;
    // Track the reason ourselves: not every engine propagates an abort reason,
    // and a timeout must not be reported to the user as "you cancelled it".
    let timedOut = false;
    const timeoutMs = Math.max(1, settings.timeoutSeconds) * 1000;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

    this.setSending(true);
    const statusBox = document.getElementById('status');
    statusBox.className = 'status-line sending';
    statusBox.textContent = '⏳ Đang gửi request...';

    const startedAt = Date.now();
    let result = null;
    let failure = null;

    try {
      result = await HttpClient.send(resolved, {
        mode,
        signal: controller.signal,
        timeoutSeconds: settings.timeoutSeconds,
        followRedirects: settings.followRedirects,
        withCredentials: document.getElementById('withCredentials').checked,
        onTransport: (via, message) => { statusBox.textContent = `⏳ ${message}...`; }
      });
    } catch (err) {
      failure = err;
    } finally {
      clearTimeout(timer);
      this.inFlight = null;
      this.setSending(false);
    }

    if (result) this.handleSuccess(result, spec, resolved);
    else this.handleFailure(failure, spec, resolved, Date.now() - startedAt, mode, timedOut);

    this.lastCurl = CurlParser.build(resolved, { followRedirects: settings.followRedirects });
    this.refreshCurlPreview();
  },

  handleSuccess(result, spec, resolved) {
    const statusBox = document.getElementById('status');
    statusBox.className = `status-line ${result.status >= 400 ? 'failed' : 'ok'}`;
    statusBox.textContent = `${result.status} ${result.statusText} · ${result.timeMs}ms · ${ResponseViewer.formatBytes(result.sizeBytes)} · ${result.via === 'proxy' ? 'qua proxy' : 'trực tiếp'}`;

    ResponseViewer.render(result);

    if (result.fellBackFrom) {
      Toast.info('Gửi trực tiếp bị chặn (CORS) — đã tự động gửi lại qua proxy backend.', { duration: 5200 });
    }

    const bodyText = ResponseViewer.getBodyText();
    const snapshot = {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      body: bodyText,
      contentType: result.contentType,
      duration: result.timeMs,
      sizeBytes: result.sizeBytes,
      via: result.via,
      timestamp: new Date().toISOString()
    };

    Storage.addHistory({
      spec: this.serialisableSpec(spec),
      method: resolved.method,
      url: result.finalUrl || resolved.url,
      response: snapshot,
      success: result.status < 400
    });

    if (this.currentRequest && this.currentRequest.id) {
      Storage.updateRequest(this.currentRequest.id, { lastResponse: snapshot });
      this.currentRequest.lastResponse = snapshot;
    }

    if (Sidebar.currentTab === 'history') Sidebar.render();
  },

  handleFailure(err, spec, resolved, elapsed, mode, timedOut = false) {
    const statusBox = document.getElementById('status');
    statusBox.className = 'status-line failed';

    let message;
    let hint = '';

    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      message = timedOut
        ? `Request quá ${Storage.getSettings().timeoutSeconds}s và đã bị hủy (timeout).`
        : 'Request đã bị hủy.';
      statusBox.textContent = timedOut ? '⏱️ Timeout' : '⛔ Đã hủy';
    } else if (err instanceof TypeError) {
      // This is the classic symptom the prompt describes: works in Postman,
      // fails here. The browser refuses to say why, so spell out the options.
      message = `Trình duyệt không gửi được request: ${err.message}`;
      hint = mode === 'direct'
        ? 'Nguyên nhân thường gặp nhất là <b>CORS</b>: server đích không trả header <code>Access-Control-Allow-Origin</code>. '
          + 'Hãy đổi chế độ gửi sang <b>Proxy</b> hoặc <b>Auto</b> ở thanh trên — backend sẽ gửi hộ và không bị CORS.'
        : 'Kiểm tra URL, DNS, hoặc server đích có đang chạy không.';
      statusBox.textContent = '❌ Không gửi được (CORS/mạng)';
    } else {
      message = (err && err.message) || 'Lỗi không xác định';
      if (err && err.isProxyError) {
        hint = 'Proxy backend từ chối request. Xem PROXY_ALLOWED_HOSTS và PROXY_ENABLED trong .env của FastAPI.';
      }
      statusBox.textContent = '❌ Lỗi gửi request';
    }

    ResponseViewer.renderError(message, { hint });
    Toast.error(message);

    Storage.addHistory({
      spec: this.serialisableSpec(spec),
      method: resolved.method,
      url: resolved.url,
      response: { error: message, duration: elapsed },
      success: false
    });

    if (Sidebar.currentTab === 'history') Sidebar.render();
  },

  cancelRequest() {
    if (!this.inFlight) return;
    this.inFlight.abort();
    Toast.info('Đã hủy request');
  },

  setSending(sending) {
    document.getElementById('sendBtn').disabled = sending;
    document.getElementById('sendBtn').textContent = sending ? 'Đang gửi…' : 'Gửi 🚀';
    document.getElementById('cancelBtn').style.display = sending ? 'inline-flex' : 'none';
  },

  /** History entries must survive JSON.stringify; a FileList does not. */
  serialisableSpec(spec) {
    const { files, ...rest } = spec;
    return { ...rest, fileNames: Array.from(files || []).map(f => f.name) };
  },

  // -------------------------------------------------------------------- cURL
  refreshCurlPreview() {
    const preview = document.getElementById('curlPreview');
    if (!preview) return;
    const settings = Storage.getSettings();
    const curl = this.lastCurl
      || CurlParser.build(this.resolveSpec(this.getCurrentSpec()), { followRedirects: settings.followRedirects });
    preview.textContent = curl;
  },

  copyCurl() {
    const settings = Storage.getSettings();
    // Always rebuild: the old version cached `lastCurl` from the previous send,
    // so Copy cURL handed you the command for a request you had already edited.
    const curl = CurlParser.build(
      this.resolveSpec(this.getCurrentSpec()),
      { followRedirects: settings.followRedirects }
    );
    this.lastCurl = curl;
    this.refreshCurlPreview();
    this.copyToClipboard(curl, 'Đã copy lệnh cURL');
  },

  parseCurl() {
    const command = document.getElementById('curlInput').value.trim();
    if (!command) {
      Toast.error('Hãy dán lệnh curl vào ô bên trên');
      return;
    }

    let parsed;
    try {
      parsed = CurlParser.parse(command);
    } catch (err) {
      Toast.error('Lỗi parse cURL: ' + err.message);
      return;
    }

    this.clearForm(false);

    document.getElementById('method').value = parsed.method;
    document.getElementById('url').value = parsed.baseUrl || parsed.url || '';
    this.setKV('paramsContainer', parsed.params);

    const headers = { ...parsed.headers };
    this.applyAuthFromHeaders(headers);

    let cookies = { ...parsed.cookies };
    Object.keys(headers).filter(k => k.toLowerCase() === 'cookie').forEach(key => {
      cookies = { ...cookies, ...CurlParser.parseCookieString(headers[key]) };
      delete headers[key];
    });

    this.setKV('headersContainer', headers);
    this.setKV('cookiesContainer', cookies);

    const contentType = parsed.contentType || 'application/json';
    const select = document.getElementById('contentType');
    if (![...select.options].some(o => o.value === contentType)) {
      // Keep an exotic Content-Type (e.g. application/vnd.api+json) as a header
      // rather than silently downgrading the body to something else.
      headers['Content-Type'] = contentType;
      this.setKV('headersContainer', headers);
      select.value = 'text/plain';
    } else {
      select.value = contentType;
    }
    select.dispatchEvent(new Event('change'));

    document.getElementById('bodyContent').value = parsed.isMultipart
      ? JSON.stringify(parsed.formFields || {}, null, 2)
      : (parsed.data || '');

    // The URL bar and Params tab both hold the query now; re-sync once.
    this.updateTabBadges();
    this.updateEnvHint();

    const explain = document.getElementById('curlExplain');
    explain.style.display = 'block';
    explain.replaceChildren();
    const summary = document.createElement('div');
    summary.innerHTML = `Đã nạp: <span class="tag">${this.escapeHtml(parsed.method)}</span> <span class="tag">${this.escapeHtml(parsed.baseUrl)}</span>`;
    explain.appendChild(summary);

    if (parsed.files.length) {
      const note = document.createElement('div');
      note.className = 'notice notice-warn';
      note.textContent = `Lệnh có upload file (${parsed.files.map(f => f.path).join(', ')}). Trình duyệt không đọc được đường dẫn — hãy chọn lại file ở tab Body.`;
      explain.appendChild(note);
    }
    if (parsed.unsupported.length) {
      const note = document.createElement('div');
      note.className = 'notice notice-info';
      note.textContent = `Bỏ qua tùy chọn không hỗ trợ: ${parsed.unsupported.join(', ')}`;
      explain.appendChild(note);
    }

    Toast.success('Đã nạp lệnh cURL vào form');
  },

  applyAuthFromHeaders(headers) {
    const authKey = Object.keys(headers).find(k => k.toLowerCase() === 'authorization');
    if (authKey) {
      const value = headers[authKey];
      if (/^Basic\s+/i.test(value)) {
        try {
          const decoded = new TextDecoder().decode(
            HttpClient.base64ToBytes(value.replace(/^Basic\s+/i, '').trim())
          );
          const idx = decoded.indexOf(':');
          this.setAuthType('basic');
          document.getElementById('basicUser').value = idx >= 0 ? decoded.slice(0, idx) : decoded;
          document.getElementById('basicPass').value = idx >= 0 ? decoded.slice(idx + 1) : '';
          delete headers[authKey];
        } catch { /* leave it as a plain header */ }
      } else if (/^Bearer\s+/i.test(value)) {
        this.setAuthType('bearer');
        document.getElementById('bearerToken').value = value.replace(/^Bearer\s+/i, '').trim();
        delete headers[authKey];
      }
    }

    const apiKeyHeader = Object.keys(headers).find(k => /^(x-api-key|api-key|apikey)$/i.test(k));
    if (apiKeyHeader) {
      this.setAuthType('apikey');
      document.getElementById('apiKeyName').value = apiKeyHeader;
      document.getElementById('apiKeyValue').value = headers[apiKeyHeader];
      document.getElementById('apiKeyLocation').value = 'header';
      delete headers[apiKeyHeader];
    }
  },

  setAuthType(type) {
    const select = document.getElementById('authType');
    select.value = type;
    select.dispatchEvent(new Event('change'));
  },

  // -------------------------------------------------------------------- load
  loadRequest(requestId) {
    const request = Storage.getRequests().find(r => r.id === requestId);
    if (!request) return;

    this.applySpecToForm(request);
    this.currentRequest = request;
    document.getElementById('requestNameInput').value = request.name || '';

    if (request.lastResponse) {
      this.renderStoredResponse(request.lastResponse);
      document.getElementById('status').className = 'status-line';
      document.getElementById('status').textContent =
        `Response đã lưu lúc ${Sidebar.formatDate(request.lastResponse.timestamp)}`;
    } else {
      ResponseViewer.clear();
      document.getElementById('status').textContent = '';
    }

    Toast.info(`Đã mở "${request.name || '(không tên)'}"`);
  },

  loadHistoryItem(historyId) {
    const item = Storage.getHistory().find(h => h.id === historyId);
    if (!item) return;

    // Newer entries carry the full spec; older ones only had loose fields.
    this.applySpecToForm(item.spec || {
      method: item.method,
      url: item.url,
      headers: item.headers,
      body: item.body,
      contentType: item.contentType
    });

    this.currentRequest = null;
    document.getElementById('requestNameInput').value = '';

    const statusBox = document.getElementById('status');
    if (item.response && item.response.error) {
      ResponseViewer.renderError(item.response.error);
      statusBox.className = 'status-line failed';
      statusBox.textContent = `❌ ${Sidebar.formatDate(item.timestamp)}`;
    } else if (item.response) {
      this.renderStoredResponse(item.response);
      statusBox.className = 'status-line';
      statusBox.textContent = `Lịch sử · ${Sidebar.formatDate(item.timestamp)}`;
    }
  },

  /**
   * Replay a stored response through the normal viewer.
   *
   * The old code poked `#responseBody.textContent` directly, which left the
   * status/time/size tags showing the *previous* request and the Raw and Preview
   * tabs showing stale content.
   */
  renderStoredResponse(stored) {
    ResponseViewer.render({
      status: stored.status,
      statusText: stored.statusText || '',
      headers: stored.headers || {},
      rawHeaders: Object.entries(stored.headers || {}),
      bytes: new TextEncoder().encode(stored.body || ''),
      contentType: stored.contentType || (stored.headers || {})['content-type'] || '',
      sizeBytes: stored.sizeBytes ?? (stored.body || '').length,
      timeMs: stored.duration || 0,
      via: stored.via || '',
      headersComplete: true,
      truncated: !!stored.bodyTruncated
    });
  },

  applySpecToForm(spec) {
    document.getElementById('method').value = (spec.method || 'GET').toUpperCase();
    document.getElementById('url').value = spec.url || '';

    this.syncingUrl = true;
    // A saved spec keeps the query inside the URL; params only appear separately
    // in very old entries, so merge both without duplicating.
    const params = { ...HttpClient.extractParams(spec.url || ''), ...(spec.params || {}) };
    this.setKV('paramsContainer', params);
    if (Object.keys(spec.params || {}).length) {
      document.getElementById('url').value =
        HttpClient.buildUrl(HttpClient.stripQuery(spec.url || ''), params)
          .replace(/%7B%7B/gi, '{{').replace(/%7D%7D/gi, '}}');
    }
    this.syncingUrl = false;

    this.setKV('headersContainer', spec.headers || {});
    this.setKV('cookiesContainer', spec.cookies || {});

    const auth = spec.auth || { type: 'none' };
    this.setAuthType(auth.type || 'none');
    document.getElementById('basicUser').value = auth.username || '';
    document.getElementById('basicPass').value = auth.password || '';
    document.getElementById('bearerToken').value = auth.token || '';
    document.getElementById('apiKeyName').value = auth.keyName || '';
    document.getElementById('apiKeyValue').value = auth.keyValue || '';
    document.getElementById('apiKeyLocation').value = auth.location || 'header';

    const contentType = document.getElementById('contentType');
    contentType.value = spec.contentType || 'application/json';
    contentType.dispatchEvent(new Event('change'));
    document.getElementById('bodyContent').value = spec.body || '';

    this.lastCurl = '';
    this.updateTabBadges();
    this.updateEnvHint();
  },

  // -------------------------------------------------------------------- save
  saveCurrentRequest() {
    const name = document.getElementById('requestNameInput').value.trim();
    if (!name) {
      // No name yet: the modal is the place to give it one and pick a folder.
      Sidebar.showRequestModal(this.currentRequest ? this.currentRequest.id : null);
      return;
    }

    const data = this.serialisableSpec(this.getCurrentSpec());
    data.name = name;
    if (this.currentRequest) {
      data.collectionId = this.currentRequest.collectionId || null;
      if (this.currentRequest.lastResponse) data.lastResponse = this.currentRequest.lastResponse;
    } else {
      data.collectionId = Sidebar.selectedCollection || null;
    }

    if (this.currentRequest && this.currentRequest.id) {
      this.currentRequest = Storage.updateRequest(this.currentRequest.id, data);
      Toast.success('Đã cập nhật request');
    } else {
      this.currentRequest = Storage.addRequest(data);
      Sidebar.selectedRequest = this.currentRequest.id;
      Toast.success('Đã lưu request mới');
    }

    Sidebar.render();
  },

  saveCollection() {
    const id = document.getElementById('collectionId').value;
    const name = document.getElementById('collectionName').value.trim();
    if (!name) {
      Toast.error('Vui lòng nhập tên collection');
      return;
    }

    const data = {
      name,
      description: document.getElementById('collectionDescription').value.trim(),
      parentId: document.getElementById('collectionParent').value || null
    };

    if (id) {
      Storage.updateCollection(id, data);
    } else {
      const saved = Storage.addCollection(data);
      if (saved.parentId) Sidebar.expandedCollections.add(saved.parentId);
      Sidebar.selectedCollection = saved.id;
    }

    document.getElementById('collectionModal').classList.remove('active');
    Sidebar.render();
    Toast.success(id ? 'Đã cập nhật collection' : 'Đã tạo collection');
  },

  saveRequestFromModal() {
    const id = document.getElementById('requestId').value;
    const name = document.getElementById('requestName').value.trim();
    if (!name) {
      Toast.error('Vui lòng nhập tên request');
      return;
    }

    const data = this.serialisableSpec(this.getCurrentSpec());
    data.name = name;
    data.collectionId = document.getElementById('requestCollection').value || null;
    if (this.currentRequest && this.currentRequest.lastResponse) {
      data.lastResponse = this.currentRequest.lastResponse;
    }

    if (id) {
      this.currentRequest = Storage.updateRequest(id, data);
    } else {
      this.currentRequest = Storage.addRequest(data);
      Sidebar.selectedRequest = this.currentRequest.id;
    }
    if (data.collectionId) Sidebar.expandedCollections.add(data.collectionId);

    document.getElementById('requestNameInput').value = name;
    document.getElementById('requestModal').classList.remove('active');
    Sidebar.render();
    Toast.success(id ? 'Đã cập nhật request' : 'Đã lưu request');
  },

  clearForm(alsoClearResponse = true) {
    document.getElementById('method').value = 'GET';
    document.getElementById('url').value = '';
    document.getElementById('requestNameInput').value = '';
    document.getElementById('bodyContent').value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('withCredentials').checked = false;

    this.setAuthType('none');
    ['basicUser', 'basicPass', 'bearerToken', 'apiKeyName', 'apiKeyValue'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('apiKeyLocation').value = 'header';

    const contentType = document.getElementById('contentType');
    contentType.value = 'application/json';
    contentType.dispatchEvent(new Event('change'));

    this.KV_CONTAINERS.forEach(id => this.setKV(id, {}));

    if (alsoClearResponse) {
      ResponseViewer.clear();
      document.getElementById('status').textContent = '';
      document.getElementById('status').className = 'status-line';
      document.getElementById('respSearch').value = '';
    }

    this.currentRequest = null;
    this.lastCurl = '';
    this.refreshCurlPreview();
    this.updateTabBadges();
    this.updateEnvHint();
  },

  // ----------------------------------------------------------- export/import
  showExportModal() {
    document.getElementById('exportDataTextarea').value =
      JSON.stringify(Storage.exportData(), null, 2);
    document.getElementById('exportModal').classList.add('active');
  },

  showImportModal() {
    document.getElementById('importModal').classList.add('active');
  },

  readImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.getElementById('importDataTextarea').value = reader.result; };
    reader.onerror = () => Toast.error('Không đọc được file');
    reader.readAsText(file);
  },

  doImportData() {
    const text = document.getElementById('importDataTextarea').value.trim();
    if (!text) {
      Toast.error('Chưa có dữ liệu để import');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      Toast.error('JSON không hợp lệ: ' + err.message);
      return;
    }

    const mode = document.querySelector('input[name="importMode"]:checked').value;
    try {
      const counts = Storage.importData(parsed, mode);
      Sidebar.render();
      this.refreshEnvironmentSelect();
      document.getElementById('importModal').classList.remove('active');
      Toast.success(`Import xong: ${counts.collections} collection, ${counts.requests} request, ${counts.environments} env, ${counts.history} history`);
    } catch (err) {
      Toast.error('Import lỗi: ' + err.message);
    }
  },

  downloadExport(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postman-lite-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // --------------------------------------------------------------- misc UI
  toggleSidebar() {
    const collapsed = !Storage.getSettings().sidebarCollapsed;
    Storage.updateSettings({ sidebarCollapsed: collapsed });
    this.applySidebarCollapsed();
  },

  applySidebarCollapsed() {
    const collapsed = Storage.getSettings().sidebarCollapsed;
    document.querySelector('.app-container').classList.toggle('sidebar-collapsed', collapsed);
    document.getElementById('toggleSidebarBtn').setAttribute('aria-expanded', String(!collapsed));
  },

  beautifyBody() {
    const textarea = document.getElementById('bodyContent');
    const value = textarea.value.trim();
    if (!value) return;
    try {
      textarea.value = JSON.stringify(JSON.parse(value), null, 2);
      Toast.success('Đã format JSON');
    } catch (err) {
      Toast.error('Không phải JSON hợp lệ: ' + err.message);
    }
  },

  copyResponseBody() {
    const text = ResponseViewer.getBodyText();
    if (!text) {
      Toast.warn('Không có body dạng text để copy');
      return;
    }
    this.copyToClipboard(text, 'Đã copy response body');
  },

  async copyToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success(successMessage);
    } catch {
      // clipboard API needs a secure context; http:// pages fall back to this.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      if (ok) Toast.success(successMessage);
      else Toast.error('Trình duyệt chặn clipboard — hãy copy thủ công');
    }
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  escapeAttr(text) {
    return this.escapeHtml(text).replace(/"/g, '&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
