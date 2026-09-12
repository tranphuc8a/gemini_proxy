// Storage Manager - the single source of truth for everything we persist.
//
// Every module reads and writes through here. An earlier version kept
// environments in two different localStorage keys (`postman_lite_environments`
// from this file and `postmanLite:environments` from env.js), so Export produced
// a file that Import could not restore. `migrate()` folds the legacy key in.
const Storage = {
  KEYS: {
    COLLECTIONS: 'postman_lite_collections',
    REQUESTS: 'postman_lite_requests',
    HISTORY: 'postman_lite_history',
    ENVIRONMENTS: 'postman_lite_environments',
    SETTINGS: 'postman_lite_settings',
    META: 'postman_lite_meta'
  },

  LEGACY_KEYS: {
    ENVIRONMENTS: 'postmanLite:environments',
    SIDEBAR: 'postman_lite_sidebar_collapsed'
  },

  DEFAULT_SETTINGS: {
    sendMode: 'auto',            // 'direct' | 'proxy' | 'auto'
    proxyBaseUrl: '',            // '' => same origin + apiPrefix
    apiPrefix: '/api/v1',
    timeoutSeconds: 60,
    followRedirects: true,
    maxHistory: 100,
    historyBodyLimit: 8000,      // chars kept per history entry
    activeEnvironment: '',
    sidebarCollapsed: false,
    wrapResponse: true
  },

  // ---------------------------------------------------------------- internals
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /**
   * Persist, surviving a full quota.
   *
   * localStorage throws once the origin's ~5 MB budget is gone. The old code let
   * that exception escape mid-send, so a perfectly good response was reported as
   * "Loi gui request". Now we shed the oldest history and retry instead.
   */
  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      if (!this._isQuotaError(err)) throw err;
      if (this._shedHistory()) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch { /* fall through to the warning */ }
      }
      if (window.Toast) {
        Toast.warn('Bộ nhớ trình duyệt đã đầy — lịch sử cũ đã bị cắt bớt. Hãy Export rồi xóa bớt dữ liệu.');
      }
      return false;
    }
  },

  _isQuotaError(err) {
    if (!err) return false;
    return err.name === 'QuotaExceededError'
      || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || err.code === 22;
  },

  /** Drop the oldest half of the history. Returns false when there is none left. */
  _shedHistory() {
    const history = this._read(this.KEYS.HISTORY, []);
    if (!Array.isArray(history) || !history.length) return false;
    const kept = history.slice(0, Math.floor(history.length / 2));
    try {
      localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(kept));
    } catch {
      localStorage.removeItem(this.KEYS.HISTORY);
    }
    return true;
  },

  /** Fold data written by older builds into the current keys. Runs once at boot. */
  migrate() {
    const legacyEnvs = this._read(this.LEGACY_KEYS.ENVIRONMENTS, null);
    if (Array.isArray(legacyEnvs) && legacyEnvs.length) {
      const byName = new Map(this.getEnvironments().map(e => [e.name, e]));
      legacyEnvs.forEach(env => {
        if (env && env.name && !byName.has(env.name)) byName.set(env.name, env);
      });
      this.saveEnvironments([...byName.values()]);
      localStorage.removeItem(this.LEGACY_KEYS.ENVIRONMENTS);
    }

    const legacySidebar = localStorage.getItem(this.LEGACY_KEYS.SIDEBAR);
    if (legacySidebar != null) {
      this.updateSettings({ sidebarCollapsed: legacySidebar === 'true' });
      localStorage.removeItem(this.LEGACY_KEYS.SIDEBAR);
    }
  },

  // -------------------------------------------------------------- collections
  getCollections() {
    const list = this._read(this.KEYS.COLLECTIONS, []);
    return Array.isArray(list) ? list : [];
  },

  saveCollections(collections) {
    return this._write(this.KEYS.COLLECTIONS, collections);
  },

  addCollection(collection) {
    const collections = this.getCollections();
    collection.id = collection.id || this.generateId();
    collection.createdAt = collection.createdAt || new Date().toISOString();
    collections.push(collection);
    this.saveCollections(collections);
    return collection;
  },

  updateCollection(id, updates) {
    const collections = this.getCollections();
    const index = collections.findIndex(c => c.id === id);
    if (index === -1) return null;
    collections[index] = { ...collections[index], ...updates, updatedAt: new Date().toISOString() };
    this.saveCollections(collections);
    return collections[index];
  },

  deleteCollection(id) {
    const collections = this.getCollections();
    const requests = this.getRequests();

    // Collect the whole subtree first, then write once. The previous version
    // re-read and re-wrote localStorage for every single request it deleted.
    const doomed = new Set();
    const walk = (collectionId) => {
      doomed.add(collectionId);
      collections.filter(c => c.parentId === collectionId && !doomed.has(c.id))
        .forEach(child => walk(child.id));
    };
    walk(id);

    this.saveCollections(collections.filter(c => !doomed.has(c.id)));
    this.saveRequests(requests.filter(r => !doomed.has(r.collectionId)));
  },

  /** True when `candidateParentId` sits inside `collectionId`'s own subtree. */
  isDescendant(collectionId, candidateParentId) {
    const byId = new Map(this.getCollections().map(c => [c.id, c]));
    let cursor = byId.get(candidateParentId);
    const seen = new Set();
    while (cursor) {
      if (cursor.id === collectionId) return true;
      if (seen.has(cursor.id)) return true; // pre-existing cycle; refuse anyway
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
    }
    return false;
  },

  // ----------------------------------------------------------------- requests
  getRequests() {
    const list = this._read(this.KEYS.REQUESTS, []);
    return Array.isArray(list) ? list : [];
  },

  saveRequests(requests) {
    return this._write(this.KEYS.REQUESTS, requests);
  },

  addRequest(request) {
    const requests = this.getRequests();
    request.id = request.id || this.generateId();
    request.createdAt = request.createdAt || new Date().toISOString();
    requests.push(request);
    this.saveRequests(requests);
    return request;
  },

  updateRequest(id, updates) {
    const requests = this.getRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index === -1) return null;
    requests[index] = { ...requests[index], ...updates, updatedAt: new Date().toISOString() };
    this.saveRequests(requests);
    return requests[index];
  },

  deleteRequest(id) {
    this.saveRequests(this.getRequests().filter(r => r.id !== id));
  },

  // ------------------------------------------------------------------ history
  getHistory() {
    const history = this._read(this.KEYS.HISTORY, []);
    if (!Array.isArray(history)) return [];
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  saveHistory(history) {
    return this._write(this.KEYS.HISTORY, history);
  },

  addHistory(historyItem) {
    const settings = this.getSettings();
    const history = this.getHistory();
    historyItem.id = historyItem.id || this.generateId();
    historyItem.timestamp = historyItem.timestamp || new Date().toISOString();

    // A 30 MB response body would exhaust the whole origin's quota on its own.
    if (historyItem.response && typeof historyItem.response.body === 'string') {
      const limit = settings.historyBodyLimit;
      if (historyItem.response.body.length > limit) {
        historyItem.response.body = historyItem.response.body.slice(0, limit);
        historyItem.response.bodyTruncated = true;
      }
    }

    history.unshift(historyItem);
    if (history.length > settings.maxHistory) history.splice(settings.maxHistory);

    this.saveHistory(history);
    return historyItem;
  },

  deleteHistoryItem(id) {
    this.saveHistory(this.getHistory().filter(h => h.id !== id));
  },

  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
  },

  // ------------------------------------------------------------- environments
  getEnvironments() {
    const list = this._read(this.KEYS.ENVIRONMENTS, []);
    return Array.isArray(list) ? list : [];
  },

  saveEnvironments(envs) {
    return this._write(this.KEYS.ENVIRONMENTS, envs);
  },

  getEnvironment(name) {
    return this.getEnvironments().find(e => e.name === name) || null;
  },

  upsertEnvironment(name, vars) {
    const envs = this.getEnvironments();
    const index = envs.findIndex(e => e.name === name);
    if (index > -1) envs[index] = { ...envs[index], name, vars };
    else envs.push({ name, vars });
    this.saveEnvironments(envs);
    return this.getEnvironment(name);
  },

  deleteEnvironment(name) {
    this.saveEnvironments(this.getEnvironments().filter(e => e.name !== name));
    if (this.getSettings().activeEnvironment === name) {
      this.updateSettings({ activeEnvironment: '' });
    }
  },

  // ----------------------------------------------------------------- settings
  getSettings() {
    const stored = this._read(this.KEYS.SETTINGS, {});
    return { ...this.DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
  },

  updateSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    this._write(this.KEYS.SETTINGS, next);
    return next;
  },

  // ---------------------------------------------------------------- utilities
  clearAll() {
    Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    Object.values(this.LEGACY_KEYS).forEach(key => localStorage.removeItem(key));
  },

  generateId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  // ------------------------------------------------------------ export/import
  exportData() {
    return {
      meta: { app: 'postman-lite', version: 2, exportedAt: new Date().toISOString() },
      collections: this.getCollections(),
      requests: this.getRequests(),
      history: this.getHistory(),
      environments: this.getEnvironments()
    };
  },

  /**
   * @param {object} data  parsed export file
   * @param {'replace'|'merge'} mode
   * @returns {{collections:number, requests:number, environments:number, history:number}}
   */
  importData(data, mode = 'replace') {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Dữ liệu phải là một JSON object');
    }
    if (!data.collections && !data.requests && !data.environments && !data.history) {
      throw new Error('Không tìm thấy khóa nào trong: collections, requests, environments, history');
    }

    const counts = { collections: 0, requests: 0, environments: 0, history: 0 };
    const merge = mode === 'merge';

    if (Array.isArray(data.collections)) {
      const byId = new Map((merge ? this.getCollections() : []).map(c => [c.id, c]));
      data.collections.forEach(c => {
        if (c && typeof c === 'object') {
          c.id = c.id || this.generateId();
          byId.set(c.id, c);
          counts.collections++;
        }
      });
      this.saveCollections([...byId.values()]);
    }

    if (Array.isArray(data.requests)) {
      const byId = new Map((merge ? this.getRequests() : []).map(r => [r.id, r]));
      data.requests.forEach(r => {
        if (r && typeof r === 'object') {
          r.id = r.id || this.generateId();
          byId.set(r.id, r);
          counts.requests++;
        }
      });
      this.saveRequests([...byId.values()]);
    }

    if (Array.isArray(data.environments)) {
      const byName = new Map((merge ? this.getEnvironments() : []).map(e => [e.name, e]));
      data.environments.forEach(e => {
        if (e && e.name) { byName.set(e.name, e); counts.environments++; }
      });
      this.saveEnvironments([...byName.values()]);
    }

    if (Array.isArray(data.history)) {
      const byId = new Map((merge ? this.getHistory() : []).map(h => [h.id, h]));
      data.history.forEach(h => {
        if (h && typeof h === 'object') {
          h.id = h.id || this.generateId();
          byId.set(h.id, h);
          counts.history++;
        }
      });
      this.saveHistory([...byId.values()]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, this.getSettings().maxHistory));
    }

    // Settings are deliberately NOT imported: proxy URL and timeouts describe the
    // machine you are sitting at, not the file somebody sent you.
    return counts;
  }
};
