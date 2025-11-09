// Main Application Logic
const App = {
  currentRequest: null,
  lastCurl: '',

  init() {
    this.setupTabs();
    this.setupAuthType();
    this.setupResponseTabs();
    this.setupContentType();
    this.setupButtons();
    this.setupModals();
    this.initKeyValuePairs();
    this.initEnvironments();
    this.initExportImport();
    Search.initSearch();
    
    // Initialize sidebar
    Sidebar.init();
  },

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        contents.forEach(c => c.style.display = c.id === tab.dataset.tab ? 'block' : 'none');
      });
    });
  },

  setupAuthType() {
    const authTypeSelect = document.getElementById('authType');
    const authSections = {
      basic: document.getElementById('auth-basic'),
      bearer: document.getElementById('auth-bearer'),
      apikey: document.getElementById('auth-apikey')
    };

    authTypeSelect.addEventListener('change', () => {
      Object.values(authSections).forEach(sec => sec.style.display = 'none');
      const val = authTypeSelect.value;
      if (val !== 'none' && authSections[val]) {
        authSections[val].style.display = 'block';
      }
    });
  },

  setupResponseTabs() {
    const respTabs = document.querySelectorAll('.resp-tab');
    respTabs.forEach(rt => {
      rt.addEventListener('click', () => {
        ResponseViewer.setActive(rt.dataset.rtab);
      });
    });
  },

  setupContentType() {
    const contentTypeSelect = document.getElementById('contentType');
    contentTypeSelect.addEventListener('change', () => {
      const fileInput = document.getElementById('fileInput');
      fileInput.style.display = contentTypeSelect.value === 'multipart/form-data' ? 'block' : 'none';
    });
  },

  setupButtons() {
    // Send button
    document.getElementById('sendBtn').addEventListener('click', () => this.sendRequest());

    // Copy cURL button
    document.getElementById('copyCurlBtn').addEventListener('click', () => this.copyCurl());

    // Parse cURL button
    document.getElementById('parseCurlBtn').addEventListener('click', () => this.parseCurl());

    // Save request button
    document.getElementById('saveCurrentBtn').addEventListener('click', () => this.saveCurrentRequest());

    // Copy response body button
    const copyBtn = document.getElementById('copyResponseBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = (window.ResponseViewer && ResponseViewer.getBodyText) ? ResponseViewer.getBodyText() : document.getElementById('responseBody').textContent;
        navigator.clipboard.writeText(text || '').then(() => {
          const old = copyBtn.textContent;
          copyBtn.textContent = 'Đã copy ✅';
          setTimeout(() => (copyBtn.textContent = old), 1200);
        });
      });
    }

    // Manage environments
    document.getElementById('manageEnvsBtn').addEventListener('click', ()=>{
      this.openEnvModal();
    });

    // Add env var
    document.getElementById('addEnvVarBtn').addEventListener('click', ()=>{
      this.addEnvVarKV();
    });

    // Save environment
    document.getElementById('saveEnvBtn').addEventListener('click', ()=>{
      this.saveEnvironment();
    });

    // Export / Import buttons
    document.getElementById('exportDataBtn').addEventListener('click', ()=> this.showExportModal());
    document.getElementById('importDataBtn').addEventListener('click', ()=> this.showImportModal());
    document.getElementById('doImportBtn').addEventListener('click', ()=> this.doImportData());
    document.getElementById('downloadExportBtn').addEventListener('click', ()=> this.downloadExport());

    // Sidebar toggle
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }
  },

  setupModals() {
    // Close modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
      });
    });

    // Close via dismiss buttons (footer Cancel/Close)
    document.querySelectorAll('.modal-dismiss').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Save collection
    document.getElementById('saveCollectionBtn').addEventListener('click', () => this.saveCollection());

    // Save request
    document.getElementById('saveRequestBtn').addEventListener('click', () => this.saveRequestFromModal());
  },

  initKeyValuePairs() {
    ['paramsContainer', 'headersContainer', 'cookiesContainer'].forEach(containerId => {
      this.addKV(containerId);
    });
  },

  initEnvironments(){
    this.refreshEnvironmentSelect();
    document.getElementById('environmentSelect').addEventListener('change', (e)=>{
      const name = e.target.value; if(name) EnvManager.applyEnvironmentToRequest(name);
    });
    // Apply sidebar preference on init
    this.applySidebarCollapsed();
  },

  refreshEnvironmentSelect(){
    const sel = document.getElementById('environmentSelect');
    const envs = EnvManager.listEnvironments();
    sel.innerHTML = '<option value="">(No Env)</option>' + envs.map(e=>`<option value="${e.name}">${e.name}</option>`).join('');
  },

  openEnvModal(){
    const modal = document.getElementById('envModal');
    modal.classList.add('active');
    this.renderEnvList();
    this.renderEnvVarsKV();
  },

  renderEnvList(){
    const listDiv = document.getElementById('envList');
    const envs = EnvManager.listEnvironments();
    if(envs.length===0){ listDiv.innerHTML = '<em>Chưa có environment</em>'; return; }
    listDiv.innerHTML = envs.map(e=>`<div class="env-item" data-name="${e.name}">
      <span class="env-name">${e.name}</span>
      <button class="env-load" data-action="load" data-name="${e.name}">Tải</button>
      <button class="env-delete" data-action="delete" data-name="${e.name}">Xóa</button>
    </div>`).join('');
    listDiv.querySelectorAll('button[data-action="load"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const env = EnvManager.getEnvironment(btn.dataset.name);
        document.getElementById('envName').value = env.name;
        this.setEnvVarsKV(env.vars||{});
      });
    });
    listDiv.querySelectorAll('button[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(confirm('Xóa environment?')){ EnvManager.deleteEnvironment(btn.dataset.name); this.renderEnvList(); this.refreshEnvironmentSelect(); }
      });
    });
  },

  renderEnvVarsKV(){
    const container = document.getElementById('envVarsContainer');
    while(container.firstChild) container.removeChild(container.firstChild);
    this.addEnvVarKV();
  },
  addEnvVarKV(key='', value=''){
    const container = document.getElementById('envVarsContainer');
    const row = document.createElement('div'); row.className='kv-pair';
    row.innerHTML = `<input placeholder="Key" value="${this.escapeHtml(key)}"><input placeholder="Value" value="${this.escapeHtml(value)}"><button type="button" class="rm" onclick="this.parentElement.remove()">🗑</button>`;
    container.appendChild(row);
  },
  setEnvVarsKV(vars){
    const container = document.getElementById('envVarsContainer');
    while(container.firstChild) container.removeChild(container.firstChild);
    const entries = Object.entries(vars||{}); if(entries.length===0){ this.addEnvVarKV(); return; }
    entries.forEach(([k,v])=> this.addEnvVarKV(k,v));
  },
  readEnvVars(){
    const vars={};
    document.querySelectorAll('#envVarsContainer .kv-pair').forEach(row=>{ const k=row.children[0].value.trim(); const v=row.children[1].value.trim(); if(k) vars[k]=v; });
    return vars;
  },
  saveEnvironment(){
    const name = document.getElementById('envName').value.trim(); if(!name){ alert('Tên environment không được trống'); return; }
    const vars = this.readEnvVars(); EnvManager.upsertEnvironment(name, vars); this.refreshEnvironmentSelect(); this.renderEnvList(); alert('✅ Đã lưu environment');
  },

  initExportImport(){ /* placeholder for any startup logic */ },
  showImportModal(){ document.getElementById('importModal').classList.add('active'); },
  showExportModal(){
    const modal = document.getElementById('exportModal');
    const data = Storage.exportData();
    document.getElementById('exportDataTextarea').value = JSON.stringify(data, null, 2);
    modal.classList.add('active');
  },
  doImportData(){
    try {
      const txt = document.getElementById('importDataTextarea').value.trim();
      if(!txt) return alert('Không có dữ liệu');
      const obj = JSON.parse(txt);
      Storage.importData(obj); Sidebar.render(); alert('✅ Import thành công');
    } catch(err){ alert('Import lỗi: '+ err.message); }
  },
  downloadExport(){
    const txt = document.getElementById('exportDataTextarea').value; const blob = new Blob([txt], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'postman-lite-export.json'; a.click();
  },

  // Sidebar collapse/expand
  toggleSidebar(){
    const collapsed = localStorage.getItem('postman_lite_sidebar_collapsed') === 'true';
    localStorage.setItem('postman_lite_sidebar_collapsed', (!collapsed).toString());
    this.applySidebarCollapsed();
  },
  applySidebarCollapsed(){
    const collapsed = localStorage.getItem('postman_lite_sidebar_collapsed') === 'true';
    const sidebar = document.querySelector('.sidebar');
    const app = document.querySelector('.app-container');
    if(!sidebar || !app) return;
    if(collapsed){ sidebar.classList.add('collapsed'); app.classList.add('sidebar-collapsed'); }
    else { sidebar.classList.remove('collapsed'); app.classList.remove('sidebar-collapsed'); }
  },

  // Key-Value Pair Management
  addKV(containerId) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'kv-pair';
    row.innerHTML = `
      <input placeholder="Key">
      <input placeholder="Value">
      <button type="button" class="rm" title="Xóa" onclick="this.parentElement.remove()">🗑</button>
    `;
    container.appendChild(row);
  },

  addKVWithValue(containerId, key, value) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'kv-pair';
    const escKey = this.escapeHtml(key);
    const escValue = this.escapeHtml(String(value));
    row.innerHTML = `
      <input placeholder="Key" value="${escKey}">
      <input placeholder="Value" value="${escValue}">
      <button type="button" class="rm" title="Xóa" onclick="this.parentElement.remove()">🗑</button>
    `;
    container.appendChild(row);
  },

  clearKV(containerId) {
    const container = document.getElementById(containerId);
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  },

  setKV(containerId, obj) {
    this.clearKV(containerId);
    const entries = Object.entries(obj || {});
    if (entries.length === 0) {
      this.addKV(containerId);
      return;
    }
    entries.forEach(([k, v]) => this.addKVWithValue(containerId, k, v));
  },

  readKV(containerId) {
    const obj = {};
    document.querySelectorAll(`#${containerId} .kv-pair`).forEach(row => {
      const k = row.children[0].value.trim();
      const v = row.children[1].value.trim();
      if (k) obj[k] = v;
    });
    return obj;
  },

  // Send Request
  async sendRequest() {
    let requestData = null;
    const method = document.getElementById('method').value;
    let url = document.getElementById('url').value.trim();
    const params = this.readKV('paramsContainer');
    const headers = this.readKV('headersContainer');
    const cookies = this.readKV('cookiesContainer');
    const contentType = document.getElementById('contentType').value;
    const bodyInput = document.getElementById('bodyContent').value;
    const fileInput = document.getElementById('fileInput');

    if (!url) {
      alert('Vui lòng nhập URL!');
      return;
    }

    // Apply auth
    this.applyAuth(headers, params);

    // Build final URL with params
    if (Object.keys(params).length) {
      const queryString = new URLSearchParams(params).toString();
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Build request body
    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      body = this.buildRequestBody(contentType, bodyInput, fileInput, headers);
    }

    // Add cookies
    if (Object.keys(cookies).length) {
      headers['Cookie'] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    // Execute request
    requestData = {
      method,
      url,
      params,
      headers,
      body: bodyInput,
      contentType,
      timestamp: new Date().toISOString(),
      collectionId: (this.currentRequest && this.currentRequest.collectionId) || Sidebar.selectedCollection || null
    };

    await this.executeRequest(method, url, headers, body, requestData);
  },

  applyAuth(headers, params) {
    const authType = document.getElementById('authType').value;

    if (authType === 'basic') {
      const u = document.getElementById('basicUser').value;
      const p = document.getElementById('basicPass').value;
      if (u) headers['Authorization'] = 'Basic ' + btoa(`${u}:${p}`);
    } else if (authType === 'bearer') {
      const t = document.getElementById('bearerToken').value.trim();
      if (t) headers['Authorization'] = 'Bearer ' + t;
    } else if (authType === 'apikey') {
      const kName = document.getElementById('apiKeyName').value.trim();
      const kVal = document.getElementById('apiKeyValue').value.trim();
      const loc = document.getElementById('apiKeyLocation').value;
      if (kName && kVal) {
        if (loc === 'header') headers[kName] = kVal;
        else params[kName] = kVal;
      }
    }
  },

  buildRequestBody(contentType, bodyInput, fileInput, headers) {
    let body;

    if (contentType === 'application/json') {
      try {
        body = JSON.parse(bodyInput);
        body = JSON.stringify(body);
      } catch {
        body = bodyInput;
      }
      headers['Content-Type'] = 'application/json';
    } else if (contentType === 'application/x-www-form-urlencoded') {
      try {
        body = new URLSearchParams(JSON.parse(bodyInput || '{}')).toString();
      } catch {
        body = bodyInput;
      }
      headers['Content-Type'] = contentType;
    } else if (contentType === 'multipart/form-data') {
      body = new FormData();
      try {
        const json = JSON.parse(bodyInput || '{}');
        Object.entries(json).forEach(([k, v]) => body.append(k, v));
      } catch {}
      for (const file of fileInput.files) {
        body.append(file.name, file);
      }
    } else {
      body = bodyInput;
      headers['Content-Type'] = contentType;
    }

    return body;
  },

  async executeRequest(method, url, headers, body, requestData) {
    const statusBox = document.getElementById('status');
    statusBox.textContent = '⏳ Đang gửi request...';

    const startTime = Date.now();

    try {
      const opts = { method, headers };
      if (body) opts.body = body;

      const res = await fetch(url, opts);
      const arrayBuf = await res.arrayBuffer();
      const decoder = new TextDecoder();
      const text = decoder.decode(arrayBuf);
      const duration = Date.now() - startTime;
      const headerEntries = Array.from(res.headers.entries());
      const headersObj = Object.fromEntries(headerEntries);
      statusBox.textContent = `Hoàn tất (${duration}ms)`;
      ResponseViewer.render({
        status: `${res.status} ${res.statusText}`,
        timeMs: duration,
        sizeBytes: arrayBuf.byteLength,
        headers: headersObj,
        body: text,
        contentType: headersObj['content-type']||''
      });

      // Save to history
      const histItem = {
        ...requestData,
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: headersObj,
          body: text.substring(0, 10000),
          duration,
          sizeBytes: arrayBuf.byteLength
        },
        success: res.ok
      };
      Storage.addHistory(histItem);

      // Update saved request snapshot with last response
      if (this.currentRequest && this.currentRequest.id) {
        const snapshot = { ...histItem.response, timestamp: new Date().toISOString() };
        Storage.updateRequest(this.currentRequest.id, { lastResponse: snapshot });
        this.currentRequest.lastResponse = snapshot;
      }

      // Update history sidebar if active
      if (Sidebar.currentTab === 'history') {
        Sidebar.render();
      }

    } catch (err) {
      statusBox.textContent = '❌ Lỗi gửi request!';
      ResponseViewer.render({ status: 'ERROR', timeMs: 0, sizeBytes: 0, headers:{}, body: err.message, contentType:'text/plain' });

      // Save error to history
      Storage.addHistory({
        ...requestData,
        response: { error: err.message },
        success: false
      });

      if (Sidebar.currentTab === 'history') {
        Sidebar.render();
      }
    }

    // Build cURL
    this.lastCurl = this.buildCurl({ method, finalUrl: url, headers, bodyInput: requestData.body, contentType: requestData.contentType });
    const curlPrev = document.getElementById('curlPreview');
    curlPrev.style.display = 'block';
    curlPrev.textContent = this.lastCurl;
  },

  // cURL Operations
  buildCurl({ method, finalUrl, headers, bodyInput, contentType }) {
    let cmd = `curl -X ${method.toUpperCase()} '${this.shEscape(finalUrl)}'`;

    Object.entries(headers || {}).forEach(([k, v]) => {
      cmd += ` \n  -H '${this.shEscape(k)}: ${this.shEscape(v)}'`;
    });

    if (method !== 'GET' && method !== 'HEAD' && bodyInput && bodyInput.trim()) {
      if (contentType === 'application/json') {
        cmd += ` \n  -H 'Content-Type: application/json' \n  -d '${this.shEscape(bodyInput.trim())}'`;
      } else {
        cmd += ` \n  -H 'Content-Type: ${this.shEscape(contentType)}' \n  -d '${this.shEscape(bodyInput.trim())}'`;
      }
    }

    return cmd;
  },

  copyCurl() {
    if (!this.lastCurl) {
      this.lastCurl = this.buildCurl({
        method: document.getElementById('method').value,
        finalUrl: document.getElementById('url').value.trim(),
        headers: this.readKV('headersContainer'),
        bodyInput: document.getElementById('bodyContent').value,
        contentType: document.getElementById('contentType').value
      });
    }

    navigator.clipboard.writeText(this.lastCurl).then(() => {
      const btn = document.getElementById('copyCurlBtn');
      btn.textContent = 'Đã copy ✅';
      setTimeout(() => btn.textContent = 'Copy cURL 📋', 1500);
    });
  },

  parseCurl() {
    const cmd = document.getElementById('curlInput').value.trim();
    if (!cmd) return;

    try {
      const parsed = CurlParser.parse(cmd);

      // Set method and URL
      document.getElementById('method').value = parsed.method || 'GET';
      document.getElementById('url').value = parsed.baseUrl || parsed.url || '';

      // Set params
      this.setKV('paramsContainer', parsed.params);

      // Handle headers and auth
      const headers = { ...(parsed.headers || {}) };
      this.handleAuthFromHeaders(headers);

      // Set headers
      this.setKV('headersContainer', headers);

      // Handle cookies
      let cookiesObj = parsed.cookies || {};
      if (headers['cookie'] || headers['Cookie']) {
        const cookieStr = headers['cookie'] || headers['Cookie'];
        delete headers['cookie'];
        delete headers['Cookie'];
        cookiesObj = { ...cookiesObj, ...this.parseCookieString(cookieStr) };
      }
      this.setKV('cookiesContainer', cookiesObj);

      // Set body
      const ct = parsed.contentType || this.guessContentType(parsed);
      document.getElementById('contentType').value = ct;

      if (parsed.isMultipart && parsed.formFields) {
        document.getElementById('bodyContent').value = JSON.stringify(parsed.formFields, null, 2);
      } else if (parsed.data != null) {
        document.getElementById('bodyContent').value = parsed.data;
      } else {
        document.getElementById('bodyContent').value = '';
      }

      // Show explanation
      const exp = document.getElementById('curlExplain');
      exp.style.display = 'block';
      exp.innerHTML = `Đã parse: <span class="tag">${parsed.method}</span> <span class="tag">${parsed.baseUrl}</span>`;

    } catch (err) {
      alert('Lỗi parse cURL: ' + err.message);
    }
  },

  handleAuthFromHeaders(headers) {
    const authVal = headers['authorization'] || headers['Authorization'];
    if (authVal) {
      delete headers['authorization'];
      delete headers['Authorization'];

      if (/^Basic\s+/i.test(authVal)) {
        const b64 = authVal.replace(/^Basic\s+/i, '').trim();
        try {
          const dec = atob(b64);
          const idx = dec.indexOf(':');
          const u = idx >= 0 ? dec.slice(0, idx) : dec;
          const p = idx >= 0 ? dec.slice(idx + 1) : '';
          document.getElementById('authType').value = 'basic';
          document.getElementById('authType').dispatchEvent(new Event('change'));
          document.getElementById('basicUser').value = u;
          document.getElementById('basicPass').value = p;
        } catch {}
      } else if (/^Bearer\s+/i.test(authVal)) {
        const token = authVal.replace(/^Bearer\s+/i, '').trim();
        document.getElementById('authType').value = 'bearer';
        document.getElementById('authType').dispatchEvent(new Event('change'));
        document.getElementById('bearerToken').value = token;
      }
    }

    // API Key heuristic
    const apiKeyHeader = Object.keys(headers).find(k => /^x-api-key$|^api-key$/i.test(k));
    if (apiKeyHeader) {
      document.getElementById('authType').value = 'apikey';
      document.getElementById('authType').dispatchEvent(new Event('change'));
      document.getElementById('apiKeyName').value = apiKeyHeader;
      document.getElementById('apiKeyValue').value = headers[apiKeyHeader];
      document.getElementById('apiKeyLocation').value = 'header';
      delete headers[apiKeyHeader];
    }
  },

  // Load from sidebar
  loadRequest(requestId) {
    const request = Storage.getRequests().find(r => r.id === requestId);
    if (!request) return;

    this.currentRequest = request;

    // Set basic fields
    document.getElementById('method').value = request.method || 'GET';
    document.getElementById('url').value = request.url || '';
    document.getElementById('requestNameInput').value = request.name || '';

    // Set params, headers, cookies
    this.setKV('paramsContainer', request.params || {});
    this.setKV('headersContainer', request.headers || {});
    this.setKV('cookiesContainer', request.cookies || {});

    // Set auth
    if (request.auth) {
      document.getElementById('authType').value = request.auth.type || 'none';
      document.getElementById('authType').dispatchEvent(new Event('change'));

      if (request.auth.type === 'basic') {
        document.getElementById('basicUser').value = request.auth.username || '';
        document.getElementById('basicPass').value = request.auth.password || '';
      } else if (request.auth.type === 'bearer') {
        document.getElementById('bearerToken').value = request.auth.token || '';
      } else if (request.auth.type === 'apikey') {
        document.getElementById('apiKeyName').value = request.auth.keyName || '';
        document.getElementById('apiKeyValue').value = request.auth.keyValue || '';
        document.getElementById('apiKeyLocation').value = request.auth.location || 'header';
      }
    }

    // Set body
    document.getElementById('contentType').value = request.contentType || 'application/json';
    document.getElementById('bodyContent').value = request.body || '';

    // Render last response if saved
    if (request.lastResponse) {
      ResponseViewer.render({
        status: `${request.lastResponse.status} ${request.lastResponse.statusText||''}`.trim(),
        timeMs: request.lastResponse.duration || 0,
        sizeBytes: request.lastResponse.sizeBytes || 0,
        headers: request.lastResponse.headers || {},
        body: request.lastResponse.body || '',
        contentType: (request.lastResponse.headers||{})['content-type'] || ''
      });
    }
  },

  loadCollection(collectionId) {
    // Just select collection, no action needed
    const collection = Storage.getCollections().find(c => c.id === collectionId);
    if (collection) {
      console.log('Selected collection:', collection.name);
    }
  },

  loadHistoryItem(historyId) {
    const item = Storage.getHistory().find(h => h.id === historyId);
    if (!item) return;

    // Load request data
    document.getElementById('method').value = item.method || 'GET';
    document.getElementById('url').value = item.url || '';
    this.setKV('paramsContainer', item.params || {});
    this.setKV('headersContainer', item.headers || {});
    document.getElementById('bodyContent').value = item.body || '';
    document.getElementById('contentType').value = item.contentType || 'application/json';

    // Show response if available
    if (item.response) {
      const statusBox = document.getElementById('status');
      const respBodyBox = document.getElementById('responseBody');
      const respHeadersBox = document.getElementById('responseHeaders');

      if (item.response.error) {
        statusBox.textContent = '❌ Lỗi';
        respBodyBox.textContent = item.response.error;
      } else {
        statusBox.textContent = `Status: ${item.response.status} ${item.response.statusText} | Time: ${item.response.duration}ms`;
        respBodyBox.textContent = item.response.body || '';

        const headerEntries = Object.entries(item.response.headers || {});
        respHeadersBox.innerHTML = headerEntries.length
          ? headerEntries.map(([k, v]) => `<div><span class="tag">${k}</span> ${v}</div>`).join('')
          : '<em>Không có header</em>';
      }
    }
  },

  // Save Operations
  saveCurrentRequest() {
    const requestName = document.getElementById('requestNameInput').value.trim();
    if (!requestName) {
      alert('Vui lòng nhập tên request!');
      return;
    }

    const requestData = this.getCurrentRequestData();
    if (this.currentRequest && this.currentRequest.lastResponse) {
      requestData.lastResponse = this.currentRequest.lastResponse;
    }
    requestData.name = requestName;

    if (this.currentRequest && this.currentRequest.id) {
      // Update existing
      Storage.updateRequest(this.currentRequest.id, requestData);
      alert('✅ Đã cập nhật request!');
    } else {
      // Create new
      const saved = Storage.addRequest(requestData);
      this.currentRequest = saved;
      alert('✅ Đã lưu request mới!');
    }

    Sidebar.render();
  },

  getCurrentRequestData() {
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
      name: document.getElementById('requestNameInput').value.trim(),
      method: document.getElementById('method').value,
      url: document.getElementById('url').value.trim(),
      params: this.readKV('paramsContainer'),
      headers: this.readKV('headersContainer'),
      cookies: this.readKV('cookiesContainer'),
      contentType: document.getElementById('contentType').value,
      body: document.getElementById('bodyContent').value,
      auth
    };
  },

  saveCollection() {
    const collectionId = document.getElementById('collectionId').value;
    const name = document.getElementById('collectionName').value.trim();
    const description = document.getElementById('collectionDescription').value.trim();
    const parentId = document.getElementById('collectionParent').value || null;

    if (!name) {
      alert('Vui lòng nhập tên collection!');
      return;
    }

    const collectionData = { name, description, parentId };

    let saved;
    if (collectionId) {
      saved = Storage.updateCollection(collectionId, collectionData);
    } else {
      saved = Storage.addCollection(collectionData);
      if (saved && saved.parentId) Sidebar.expandedCollections.add(saved.parentId);
    }

    document.getElementById('collectionModal').classList.remove('active');
    Sidebar.render();
  },

  saveRequestFromModal() {
    const requestId = document.getElementById('requestId').value;
    const name = document.getElementById('requestName').value.trim();
    const collectionId = document.getElementById('requestCollection').value || null;

    if (!name) {
      alert('Vui lòng nhập tên request!');
      return;
    }

    const requestData = this.getCurrentRequestData();
    if (this.currentRequest && this.currentRequest.lastResponse) {
      requestData.lastResponse = this.currentRequest.lastResponse;
    }
    requestData.name = name;
    requestData.collectionId = collectionId;

    if (requestId) {
      Storage.updateRequest(requestId, requestData);
    } else {
      const saved = Storage.addRequest(requestData);
      this.currentRequest = saved;
    }

    document.getElementById('requestModal').classList.remove('active');
    Sidebar.render();
  },

  clearForm() {
    document.getElementById('method').value = 'GET';
    document.getElementById('url').value = '';
    document.getElementById('requestNameInput').value = '';
    document.getElementById('bodyContent').value = '';
    document.getElementById('authType').value = 'none';
    document.getElementById('authType').dispatchEvent(new Event('change'));

    ['paramsContainer', 'headersContainer', 'cookiesContainer'].forEach(id => {
      this.clearKV(id);
      this.addKV(id);
    });

    document.getElementById('responseBody').textContent = 'Response sẽ hiển thị ở đây...';
    document.getElementById('responseHeaders').textContent = '';
    document.getElementById('status').textContent = '';

    this.currentRequest = null;
  },

  // Utilities
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  shEscape(str) {
    return str.replace(/'/g, "'\\''");
  },

  syntaxHighlightHTML(html) {
    return `<pre style="color:#b0e0e6;white-space:pre-wrap;">${html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  },

  parseCookieString(s) {
    const out = {};
    s.split(';').forEach(part => {
      const [k, ...rest] = part.split('=');
      if (!k) return;
      out[k.trim()] = (rest.join('=') || '').trim();
    });
    return out;
  },

  guessContentType(parsed) {
    if (parsed.contentType) return parsed.contentType;
    if (parsed.isMultipart) return 'multipart/form-data';
    if (parsed.data != null) {
      const t = parsed.data.trim();
      if (t.startsWith('{') || t.startsWith('[')) return 'application/json';
    }
    return 'text/plain';
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
