// Sidebar Manager - the Collections tree and the History list.
const Sidebar = {
  currentTab: 'collections',
  selectedRequest: null,
  selectedCollection: null,
  expandedCollections: new Set(),
  filterTerm: '',

  init() {
    this.setupTabs();
    this.setupEventListeners();
    this.render();
  },

  setupTabs() {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this.render();
      });
    });
  },

  setupEventListeners() {
    document.getElementById('newCollectionBtn')
      .addEventListener('click', () => this.showCollectionModal());
    document.getElementById('newRequestBtn')
      .addEventListener('click', () => this.showRequestModal());
    document.getElementById('clearAllBtn')
      .addEventListener('click', () => this.confirmClearAll());
  },

  render() {
    const container = document.getElementById('sidebarContent');
    if (this.currentTab === 'collections') this.renderCollections(container);
    else this.renderHistory(container);
    this.updateCounts();
  },

  updateCounts() {
    const el = document.getElementById('sidebarCounts');
    if (!el) return;
    el.textContent = this.currentTab === 'collections'
      ? `${Storage.getCollections().length} collection · ${Storage.getRequests().length} request`
      : `${Storage.getHistory().length} lần gửi`;
  },

  // ------------------------------------------------------------- collections
  renderCollections(container) {
    const collections = Storage.getCollections();
    const requests = Storage.getRequests();

    if (!collections.length && !requests.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-text">Chưa có collection nào<br>Nhấn 📁+ để tạo mới</div>
        </div>`;
      return;
    }

    const tree = this.applyFilter(this.buildTree(collections, requests));
    if (!tree.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">Không khớp với "${this.escapeHtml(this.filterTerm)}"</div>
        </div>`;
      return;
    }

    container.innerHTML = `<ul class="collection-tree">${this.renderTree(tree)}</ul>`;
    this.attachTreeEvents(container);
  },

  buildTree(collections, requests) {
    const byParent = new Map();
    collections.forEach(c => {
      const key = c.parentId || '';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    });

    const requestsByCollection = new Map();
    requests.forEach(r => {
      const key = r.collectionId || '';
      if (!requestsByCollection.has(key)) requestsByCollection.set(key, []);
      requestsByCollection.get(key).push(r);
    });

    // A parentId pointing at a deleted collection would otherwise make the whole
    // subtree invisible, so those collections are surfaced at the root instead.
    const knownIds = new Set(collections.map(c => c.id));
    const orphanCollections = collections.filter(c => c.parentId && !knownIds.has(c.parentId));

    const seen = new Set();
    const buildNode = (collection) => {
      if (seen.has(collection.id)) return null; // cycle guard
      seen.add(collection.id);
      const children = (byParent.get(collection.id) || []).map(buildNode).filter(Boolean);
      const items = (requestsByCollection.get(collection.id) || [])
        .map(r => ({ type: 'request', data: r }));
      return { type: 'collection', data: collection, children: [...children, ...items] };
    };

    return [
      ...(byParent.get('') || []).map(buildNode).filter(Boolean),
      ...orphanCollections.map(buildNode).filter(Boolean),
      ...(requestsByCollection.get('') || []).map(r => ({ type: 'request', data: r }))
    ];
  },

  /**
   * Keep nodes whose name matches, plus their ancestors.
   *
   * A collection that matches by name keeps ALL of its children. The previous
   * version replaced them with an empty list, so searching for a collection
   * showed the folder and hid everything you were looking for inside it.
   */
  applyFilter(nodes) {
    const term = (this.filterTerm || '').toLowerCase();
    if (!term) return nodes;

    const matchNode = (node) => {
      const name = (node.data.name || '').toLowerCase();
      if (node.type === 'request') {
        const url = (node.data.url || '').toLowerCase();
        return (name.includes(term) || url.includes(term)) ? node : null;
      }
      if (name.includes(term)) return node;                       // keep subtree intact
      const matches = (node.children || []).map(matchNode).filter(Boolean);
      return matches.length ? { ...node, children: matches } : null;
    };

    return nodes.map(matchNode).filter(Boolean);
  },

  filter(term) {
    this.filterTerm = term;
    // While searching, show every match rather than making the user expand each
    // folder by hand to discover where the hits are.
    if (term) Storage.getCollections().forEach(c => this.expandedCollections.add(c.id));
    this.render();
  },

  renderTree(nodes) {
    return nodes.map(node => {
      if (node.type === 'collection') {
        const expanded = this.expandedCollections.has(node.data.id);
        const hasChildren = node.children && node.children.length > 0;
        const selected = this.selectedCollection === node.data.id;
        const count = hasChildren ? `<span class="tree-count">${node.children.length}</span>` : '';

        return `
          <li class="tree-item">
            <div class="tree-node collection ${selected ? 'active' : ''}"
                 data-id="${node.data.id}" data-type="collection" draggable="true"
                 title="${this.escapeHtml(node.data.description || node.data.name)}">
              <span class="tree-toggle" data-collection-id="${node.data.id}">${hasChildren ? (expanded ? '▼' : '▶') : ''}</span>
              <span class="tree-icon">📁</span>
              <span class="tree-label">${this.escapeHtml(node.data.name)}</span>
              ${count}
              <div class="tree-actions">
                <button class="tree-action-btn" data-action="add-request" data-id="${node.data.id}" title="Thêm request">➕</button>
                <button class="tree-action-btn" data-action="edit-collection" data-id="${node.data.id}" title="Sửa">✏️</button>
                <button class="tree-action-btn" data-action="delete-collection" data-id="${node.data.id}" title="Xóa">🗑️</button>
              </div>
            </div>
            ${hasChildren ? `<ul class="tree-children ${expanded ? '' : 'collapsed'}">${this.renderTree(node.children)}</ul>` : ''}
          </li>`;
      }

      const selected = this.selectedRequest === node.data.id;
      const method = node.data.method || 'GET';
      return `
        <li class="tree-item">
          <div class="tree-node request ${selected ? 'active' : ''}"
               data-id="${node.data.id}" data-type="request" draggable="true"
               title="${this.escapeHtml(node.data.url || '')}">
            <span class="tree-icon method-badge ${method}">${method}</span>
            <span class="tree-label">${this.escapeHtml(node.data.name || '(không tên)')}</span>
            <div class="tree-actions">
              <button class="tree-action-btn" data-action="duplicate-request" data-id="${node.data.id}" title="Nhân bản">⧉</button>
              <button class="tree-action-btn" data-action="edit-request" data-id="${node.data.id}" title="Sửa">✏️</button>
              <button class="tree-action-btn" data-action="delete-request" data-id="${node.data.id}" title="Xóa">🗑️</button>
            </div>
          </div>
        </li>`;
    }).join('');
  },

  /**
   * @param {HTMLElement} root  scope for every selector.
   *
   * Scoping matters: the previous code called `document.querySelectorAll('[data-action]')`,
   * which also picked up the Load/Delete buttons inside the Environments modal
   * and attached tree handlers to them on every single re-render.
   */
  attachTreeEvents(root) {
    root.querySelectorAll('.tree-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = toggle.dataset.collectionId;
        if (!id) return;
        if (this.expandedCollections.has(id)) this.expandedCollections.delete(id);
        else this.expandedCollections.add(id);
        this.render();
      });
    });

    root.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('click', (e) => {
        if (e.target.closest('.tree-actions') || e.target.closest('.tree-toggle')) return;
        const { id, type } = node.dataset;
        if (type === 'collection') {
          this.selectedCollection = id;
          this.selectedRequest = null;
          // Clicking the folder is also the natural way to open it.
          if (this.expandedCollections.has(id)) this.expandedCollections.delete(id);
          else this.expandedCollections.add(id);
        } else {
          this.selectedRequest = id;
          this.selectedCollection = null;
          App.loadRequest(id);
        }
        this.render();
      });
    });

    root.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { action, id } = btn.dataset;
        if (action === 'add-request') { this.selectedCollection = id; this.showRequestModal(); }
        else if (action === 'edit-collection') this.showCollectionModal(id);
        else if (action === 'delete-collection') this.confirmDeleteCollection(id);
        else if (action === 'edit-request') this.showRequestModal(id);
        else if (action === 'duplicate-request') this.duplicateRequest(id);
        else if (action === 'delete-request') this.confirmDeleteRequest(id);
      });
    });

    this.setupDragDrop(root);
  },

  duplicateRequest(id) {
    const request = Storage.getRequests().find(r => r.id === id);
    if (!request) return;
    const { id: _id, createdAt, updatedAt, ...rest } = request;
    Storage.addRequest({ ...rest, name: `${request.name || 'Request'} (copy)` });
    this.render();
    Toast.success('Đã nhân bản request');
  },

  // ----------------------------------------------------------------- history
  renderHistory(container) {
    const term = (this.filterTerm || '').toLowerCase();
    const history = Storage.getHistory().filter(item => {
      if (!term) return true;
      return (item.url || '').toLowerCase().includes(term)
        || (item.method || '').toLowerCase().includes(term);
    });

    if (!history.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📜</div>
          <div class="empty-state-text">${term ? 'Không có lịch sử nào khớp' : 'Chưa có request nào trong lịch sử'}</div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="history-toolbar">
        <button class="btn-secondary" id="clearHistoryBtn">🧹 Xóa lịch sử</button>
      </div>
      <ul class="history-list">
        ${history.map(item => {
          const status = item.response && item.response.status;
          const statusTag = status
            ? `<span class="history-status ${this.statusClass(status)}">${status}</span>`
            : '<span class="history-status status-error">ERR</span>';
          return `
            <li class="history-item ${item.success ? 'success' : 'error'}" data-id="${item.id}">
              <div class="history-line">
                <span class="method-badge ${item.method}">${item.method}</span>
                ${statusTag}
                <span class="history-url" title="${this.escapeHtml(item.url || '')}">${this.escapeHtml(this.truncate(item.url || '', 44))}</span>
                <button class="tree-action-btn history-delete" data-history-delete="${item.id}" title="Xóa">🗑️</button>
              </div>
              <div class="history-time">${this.formatDate(item.timestamp)}${item.response && item.response.duration != null ? ' · ' + item.response.duration + 'ms' : ''}</div>
            </li>`;
        }).join('')}
      </ul>`;

    container.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-history-delete]')) return;
        App.loadHistoryItem(el.dataset.id);
      });
    });

    container.querySelectorAll('[data-history-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Storage.deleteHistoryItem(btn.dataset.historyDelete);
        this.render();
      });
    });

    const clearBtn = container.querySelector('#clearHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (await Toast.confirm('Xóa toàn bộ lịch sử? Collections và environments vẫn được giữ.')) {
          Storage.clearHistory();
          this.render();
          Toast.success('Đã xóa lịch sử');
        }
      });
    }
  },

  statusClass(status) {
    const code = parseInt(status, 10);
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 300 && code < 400) return 'status-3xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    if (code >= 500) return 'status-5xx';
    return 'status-error';
  },

  // ------------------------------------------------------------------ modals
  showCollectionModal(collectionId = null) {
    const collection = collectionId
      ? Storage.getCollections().find(c => c.id === collectionId)
      : null;

    document.getElementById('collectionModalTitle').textContent =
      collection ? 'Sửa Collection' : 'Tạo Collection Mới';
    document.getElementById('collectionId').value = collectionId || '';
    document.getElementById('collectionName').value = collection?.name || '';
    document.getElementById('collectionDescription').value = collection?.description || '';

    // A collection cannot become a child of itself or of its own descendants.
    const candidates = Storage.getCollections().filter(c =>
      c.id !== collectionId && !(collectionId && Storage.isDescendant(collectionId, c.id))
    );
    const defaultParent = collection ? (collection.parentId || '') : (this.selectedCollection || '');
    document.getElementById('collectionParent').innerHTML =
      '<option value="">-- Không có (Root) --</option>' +
      candidates.map(c =>
        `<option value="${c.id}" ${c.id === defaultParent ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
      ).join('');

    document.getElementById('collectionModal').classList.add('active');
    document.getElementById('collectionName').focus();
  },

  showRequestModal(requestId = null) {
    const request = requestId
      ? Storage.getRequests().find(r => r.id === requestId)
      : null;

    document.getElementById('requestModalTitle').textContent =
      request ? 'Sửa Request' : 'Tạo Request Mới';
    document.getElementById('requestId').value = requestId || '';
    document.getElementById('requestName').value =
      request?.name || document.getElementById('requestNameInput').value || '';

    const defaultCollection = request ? (request.collectionId || '') : (this.selectedCollection || '');
    document.getElementById('requestCollection').innerHTML =
      '<option value="">-- Không thuộc collection nào --</option>' +
      Storage.getCollections().map(c =>
        `<option value="${c.id}" ${c.id === defaultCollection ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
      ).join('');

    document.getElementById('requestModal').classList.add('active');
    document.getElementById('requestName').focus();
  },

  async confirmDeleteCollection(id) {
    const collection = Storage.getCollections().find(c => c.id === id);
    if (!collection) return;

    const requests = Storage.getRequests().filter(r => r.collectionId === id).length;
    const message = `Xóa collection "${collection.name}"?\n\n`
      + `Tất cả sub-collections và ${requests} request bên trong sẽ bị xóa theo.`;

    if (await Toast.confirm(message, { okLabel: 'Xóa' })) {
      Storage.deleteCollection(id);
      this.selectedCollection = null;
      this.render();
      Toast.success('Đã xóa collection');
    }
  },

  async confirmDeleteRequest(id) {
    const request = Storage.getRequests().find(r => r.id === id);
    if (!request) return;

    if (await Toast.confirm(`Xóa request "${request.name || '(không tên)'}"?`, { okLabel: 'Xóa' })) {
      Storage.deleteRequest(id);
      if (this.selectedRequest === id) {
        this.selectedRequest = null;
        App.clearForm();
      }
      this.render();
      Toast.success('Đã xóa request');
    }
  },

  async confirmClearAll() {
    const ok = await Toast.confirm(
      'Xóa toàn bộ collections, requests, history và environments?\n\nHành động này không thể hoàn tác.',
      { title: 'Xóa toàn bộ dữ liệu', okLabel: 'Xóa tất cả' }
    );
    if (!ok) return;

    // Offer the export instead of a second "are you really sure" prompt: a
    // backup is more useful than one more click.
    const backup = await Toast.confirm(
      'Tải file backup JSON trước khi xóa?',
      { title: 'Sao lưu', okLabel: 'Tải backup', danger: false }
    );
    if (backup) App.downloadExport(Storage.exportData());

    Storage.clearAll();
    this.selectedCollection = null;
    this.selectedRequest = null;
    this.expandedCollections.clear();
    App.clearForm();
    App.refreshEnvironmentSelect();
    this.render();
    Toast.success('Đã xóa toàn bộ dữ liệu');
  },

  // --------------------------------------------------------------- drag&drop
  setupDragDrop(root) {
    root.querySelectorAll('[draggable="true"]').forEach(elem => {
      elem.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
          id: elem.dataset.id,
          type: elem.dataset.type
        }));
        elem.classList.add('dragging');
      });

      elem.addEventListener('dragend', () => elem.classList.remove('dragging'));

      elem.addEventListener('dragover', (e) => {
        if (elem.dataset.type !== 'collection') return;
        e.preventDefault();
        elem.classList.add('drag-over');
      });

      elem.addEventListener('dragleave', () => elem.classList.remove('drag-over'));

      elem.addEventListener('drop', (e) => {
        e.preventDefault();
        elem.classList.remove('drag-over');
        if (elem.dataset.type !== 'collection') return;

        let payload;
        try {
          payload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch {
          return;
        }
        const targetId = elem.dataset.id;

        if (payload.type === 'request') {
          Storage.updateRequest(payload.id, { collectionId: targetId });
          this.expandedCollections.add(targetId);
        } else if (payload.type === 'collection') {
          if (payload.id === targetId) return;
          // Dropping a folder into its own descendant detaches that whole branch
          // from the root: the tree builder then never reaches it and everything
          // inside disappears from the sidebar.
          if (Storage.isDescendant(payload.id, targetId)) {
            Toast.error('Không thể kéo một collection vào chính nó hoặc vào collection con của nó');
            return;
          }
          Storage.updateCollection(payload.id, { parentId: targetId });
          this.expandedCollections.add(targetId);
        }
        this.render();
      });
    });
  },

  // --------------------------------------------------------------- utilities
  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  truncate(str, maxLen) {
    const value = String(str || '');
    return value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
  },

  formatDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    return date.toLocaleDateString('vi-VN') + ' '
      + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
};
