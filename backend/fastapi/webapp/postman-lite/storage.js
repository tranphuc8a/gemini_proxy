// Storage Manager - localStorage operations
const Storage = {
  KEYS: {
    COLLECTIONS: 'postman_lite_collections',
    REQUESTS: 'postman_lite_requests',
    HISTORY: 'postman_lite_history',
    ENVIRONMENTS: 'postman_lite_environments',
    META: 'postman_lite_meta'
  },

  // Collections
  getCollections() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.COLLECTIONS) || '[]');
    } catch {
      return [];
    }
  },

  saveCollections(collections) {
    localStorage.setItem(this.KEYS.COLLECTIONS, JSON.stringify(collections));
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
    if (index !== -1) {
      collections[index] = { ...collections[index], ...updates };
      this.saveCollections(collections);
      return collections[index];
    }
    return null;
  },

  deleteCollection(id) {
    let collections = this.getCollections();
    const requests = this.getRequests();
    
    // Recursively delete collection and its children
    const deleteRecursive = (collectionId) => {
      // Delete all requests in this collection
      const requestsToDelete = requests.filter(r => r.collectionId === collectionId);
      requestsToDelete.forEach(r => this.deleteRequest(r.id));
      
      // Find and delete child collections
      const children = collections.filter(c => c.parentId === collectionId);
      children.forEach(child => deleteRecursive(child.id));
      
      // Delete the collection itself
      collections = collections.filter(c => c.id !== collectionId);
    };
    
    deleteRecursive(id);
    this.saveCollections(collections);
  },

  // Requests
  getRequests() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.REQUESTS) || '[]');
    } catch {
      return [];
    }
  },

  saveRequests(requests) {
    localStorage.setItem(this.KEYS.REQUESTS, JSON.stringify(requests));
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
    if (index !== -1) {
      requests[index] = { ...requests[index], ...updates };
      this.saveRequests(requests);
      return requests[index];
    }
    return null;
  },

  deleteRequest(id) {
    const requests = this.getRequests();
    const filtered = requests.filter(r => r.id !== id);
    this.saveRequests(filtered);
  },

  getRequestsByCollection(collectionId) {
    return this.getRequests().filter(r => r.collectionId === collectionId);
  },

  // History
  getHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(this.KEYS.HISTORY) || '[]');
      return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  },

  saveHistory(history) {
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  addHistory(historyItem) {
    const history = this.getHistory();
    historyItem.id = historyItem.id || this.generateId();
    historyItem.timestamp = historyItem.timestamp || new Date().toISOString();
    
    // Limit history to last 100 items
    history.unshift(historyItem);
    if (history.length > 100) {
      history.splice(100);
    }
    
    this.saveHistory(history);
    return historyItem;
  },

  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
  },

  // Clear all data
  clearAll() {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },

  // Environments
  getEnvironments(){
    try { return JSON.parse(localStorage.getItem(this.KEYS.ENVIRONMENTS)||'[]'); } catch { return []; }
  },
  saveEnvironments(envs){ localStorage.setItem(this.KEYS.ENVIRONMENTS, JSON.stringify(envs)); },
  upsertEnvironment(name, vars){
    const envs = this.getEnvironments();
    const idx = envs.findIndex(e=>e.name===name);
    if(idx>-1) envs[idx].vars = vars; else envs.push({ name, vars });
    this.saveEnvironments(envs); return envs[idx]||envs[envs.length-1];
  },
  deleteEnvironment(name){
    const envs = this.getEnvironments().filter(e=>e.name!==name); this.saveEnvironments(envs);
  },

  // Utility
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },

  // Export/Import
  exportData() {
    return {
      meta: { version: 1, exportedAt: new Date().toISOString() },
      collections: this.getCollections(),
      requests: this.getRequests(),
      history: this.getHistory(),
      environments: this.getEnvironments()
    };
  },

  importData(data) {
    if (data.collections) this.saveCollections(data.collections);
    if (data.requests) this.saveRequests(data.requests);
    if (data.history) this.saveHistory(data.history);
    if (data.environments) this.saveEnvironments(data.environments);
  }
};
