// Sidebar Manager - Collections & History UI
const Sidebar = {
  currentTab: 'collections',
  selectedRequest: null,
  selectedCollection: null,
  expandedCollections: new Set(),
  filterTerm: '',

  init() {
    this.setupTabs();
    this.render();
    this.setupEventListeners();
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
    // New Collection
    document.getElementById('newCollectionBtn').addEventListener('click', () => {
      this.showCollectionModal();
    });

    // New Request
    document.getElementById('newRequestBtn').addEventListener('click', () => {
      this.showRequestModal();
    });

    // Clear All
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.confirmClearAll();
    });
  },

  render() {
    const container = document.getElementById('sidebarContent');
    if (this.currentTab === 'collections') {
      this.renderCollections(container);
    } else if (this.currentTab === 'history') {
      this.renderHistory(container);
    }
  },

  renderCollections(container) {
    const collections = Storage.getCollections();
    const requests = Storage.getRequests();

    if (collections.length === 0 && requests.filter(r => !r.collectionId).length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-text">Chưa có collection nào<br>Nhấn "+" để tạo mới</div>
        </div>
      `;
      return;
    }

    const tree = this.buildTree(collections, requests);
    const filtered = this.applyFilter(tree);
    container.innerHTML = `<ul class="collection-tree">${this.renderTree(filtered)}</ul>`;
    this.attachTreeEvents();
  },

  buildTree(collections, requests) {
    // Build hierarchical structure
    const rootCollections = collections.filter(c => !c.parentId);
    const orphanRequests = requests.filter(r => !r.collectionId);

    const buildNode = (collection) => {
      const children = collections.filter(c => c.parentId === collection.id);
      const collectionRequests = requests.filter(r => r.collectionId === collection.id);
      
      return {
        type: 'collection',
        data: collection,
        children: [
          ...children.map(buildNode),
          ...collectionRequests.map(r => ({ type: 'request', data: r }))
        ]
      };
    };

    return [
      ...rootCollections.map(buildNode),
      ...orphanRequests.map(r => ({ type: 'request', data: r }))
    ];
  },

  applyFilter(nodes){
    if(!this.filterTerm) return nodes;
    const term = this.filterTerm.toLowerCase();
    function matchNode(node){
      if(node.type==='collection'){
        const nameMatch = (node.data.name||'').toLowerCase().includes(term);
        const childMatches = node.children.map(matchNode).filter(Boolean);
        if(nameMatch || childMatches.length){
          return { ...node, children: childMatches.length?childMatches:node.children.filter(()=>false) };
        }
        return null;
      } else {
        return (node.data.name||'').toLowerCase().includes(term) ? node : null;
      }
    }
    return nodes.map(matchNode).filter(Boolean);
  },

  filter(term){
    this.filterTerm = term;
    this.render();
  },

  renderTree(nodes, level = 0) {
    return nodes.map(node => {
      if (node.type === 'collection') {
        const isExpanded = this.expandedCollections.has(node.data.id);
        const hasChildren = node.children && node.children.length > 0;
        const isSelected = this.selectedCollection === node.data.id;

        return `
          <li class="tree-item">
            <div class="tree-node collection ${isSelected ? 'active' : ''}" 
                 data-id="${node.data.id}" 
                 data-type="collection"
                 draggable="true">
              ${hasChildren ? `
                <span class="tree-toggle" data-collection-id="${node.data.id}">
                  ${isExpanded ? '▼' : '▶'}
                </span>
              ` : '<span class="tree-toggle" style="width:16px"></span>'}
              <span class="tree-icon">📁</span>
              <span class="tree-label">${this.escapeHtml(node.data.name)}</span>
              <div class="tree-actions">
                <button class="tree-action-btn" data-action="edit-collection" data-id="${node.data.id}" title="Edit">✏️</button>
                <button class="tree-action-btn" data-action="delete-collection" data-id="${node.data.id}" title="Delete">🗑️</button>
              </div>
            </div>
            ${hasChildren ? `
              <ul class="tree-children ${isExpanded ? '' : 'collapsed'}">
                ${this.renderTree(node.children, level + 1)}
              </ul>
            ` : ''}
          </li>
        `;
      } else {
        const isSelected = this.selectedRequest === node.data.id;
        const methodClass = node.data.method || 'GET';
        
        return `
          <li class="tree-item">
            <div class="tree-node request ${isSelected ? 'active' : ''}" 
                 data-id="${node.data.id}" 
                 data-type="request"
                 draggable="true">
              <span class="tree-icon history-method ${methodClass}">${methodClass}</span>
              <span class="tree-label">${this.escapeHtml(node.data.name)}</span>
              <div class="tree-actions">
                <button class="tree-action-btn" data-action="edit-request" data-id="${node.data.id}" title="Edit">✏️</button>
                <button class="tree-action-btn" data-action="delete-request" data-id="${node.data.id}" title="Delete">🗑️</button>
              </div>
            </div>
          </li>
        `;
      }
    }).join('');
  },

  attachTreeEvents() {
    // Toggle expand/collapse
    document.querySelectorAll('.tree-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const collectionId = toggle.dataset.collectionId;
        if (this.expandedCollections.has(collectionId)) {
          this.expandedCollections.delete(collectionId);
        } else {
          this.expandedCollections.add(collectionId);
        }
        this.render();
      });
    });

    // Select collection/request
    document.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('click', (e) => {
        if (e.target.closest('.tree-actions') || e.target.closest('.tree-toggle')) {
          return;
        }

        const id = node.dataset.id;
        const type = node.dataset.type;

        if (type === 'collection') {
          this.selectedCollection = id;
          this.selectedRequest = null;
          App.loadCollection(id);
        } else if (type === 'request') {
          this.selectedRequest = id;
          this.selectedCollection = null;
          App.loadRequest(id);
        }

        this.render();
      });
    });

    // Tree actions
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        switch (action) {
          case 'edit-collection':
            this.showCollectionModal(id);
            break;
          case 'delete-collection':
            this.confirmDeleteCollection(id);
            break;
          case 'edit-request':
            this.showRequestModal(id);
            break;
          case 'delete-request':
            this.confirmDeleteRequest(id);
            break;
        }
      });
    });

    // Drag & Drop
    this.setupDragDrop();
  },

  renderHistory(container) {
    const history = Storage.getHistory();

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📜</div>
          <div class="empty-state-text">Chưa có request nào trong lịch sử</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <ul class="history-list">
        ${history.map(item => `
          <li class="history-item ${item.success ? 'success' : 'error'}" data-id="${item.id}">
            <div>
              <span class="history-method ${item.method}">${item.method}</span>
              <span class="history-url">${this.escapeHtml(this.truncate(item.url, 40))}</span>
            </div>
            <div class="history-time">${this.formatDate(item.timestamp)}</div>
          </li>
        `).join('')}
      </ul>
    `;

    // History click event
    document.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        App.loadHistoryItem(id);
      });
    });
  },

  // Modals
  showCollectionModal(collectionId = null) {
    const collection = collectionId ? Storage.getCollections().find(c => c.id === collectionId) : null;
    const isEdit = !!collection;

    const modal = document.getElementById('collectionModal');
    document.getElementById('collectionModalTitle').textContent = isEdit ? 'Sửa Collection' : 'Tạo Collection Mới';
    document.getElementById('collectionId').value = collectionId || '';
    document.getElementById('collectionName').value = collection?.name || '';
    document.getElementById('collectionDescription').value = collection?.description || '';

    // Parent collection dropdown
    const collections = Storage.getCollections().filter(c => c.id !== collectionId);
    const parentSelect = document.getElementById('collectionParent');
    const defaultParent = isEdit ? (collection?.parentId || '') : (this.selectedCollection || '');
    parentSelect.innerHTML = '<option value="">-- Không có (Root) --</option>' +
      collections.map(c => `<option value="${c.id}" ${c.id === defaultParent ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');

    modal.classList.add('active');
  },

  showRequestModal(requestId = null) {
    const request = requestId ? Storage.getRequests().find(r => r.id === requestId) : null;
    const isEdit = !!request;

    const modal = document.getElementById('requestModal');
    document.getElementById('requestModalTitle').textContent = isEdit ? 'Sửa Request' : 'Tạo Request Mới';
    document.getElementById('requestId').value = requestId || '';
    document.getElementById('requestName').value = request?.name || '';

    // Collection dropdown
    const collections = Storage.getCollections();
    const collectionSelect = document.getElementById('requestCollection');
    const defaultCollection = isEdit ? (request?.collectionId || '') : (this.selectedCollection || '');
    collectionSelect.innerHTML = '<option value="">-- Không thuộc collection nào --</option>' +
      collections.map(c => `<option value="${c.id}" ${c.id === defaultCollection ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');

    modal.classList.add('active');
  },

  confirmDeleteCollection(id) {
    const collection = Storage.getCollections().find(c => c.id === id);
    if (!collection) return;

    if (confirm(`Xóa collection "${collection.name}"?\n\nTất cả requests và sub-collections sẽ bị xóa theo.`)) {
      Storage.deleteCollection(id);
      this.selectedCollection = null;
      this.render();
      App.clearForm();
    }
  },

  confirmDeleteRequest(id) {
    const request = Storage.getRequests().find(r => r.id === id);
    if (!request) return;

    if (confirm(`Xóa request "${request.name}"?`)) {
      Storage.deleteRequest(id);
      this.selectedRequest = null;
      this.render();
      App.clearForm();
    }
  },

  confirmClearAll() {
    if (confirm('Xóa toàn bộ collections, requests và history?\n\nHành động này không thể hoàn tác!')) {
      if (confirm('Bạn có chắc chắn không? Tất cả dữ liệu sẽ mất vĩnh viễn!')) {
        Storage.clearAll();
        this.selectedCollection = null;
        this.selectedRequest = null;
        this.render();
        App.clearForm();
        alert('✅ Đã xóa toàn bộ dữ liệu!');
      }
    }
  },

  // Drag & Drop
  setupDragDrop() {
    document.querySelectorAll('[draggable="true"]').forEach(elem => {
      elem.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
          id: elem.dataset.id,
          type: elem.dataset.type
        }));
        elem.classList.add('dragging');
      });

      elem.addEventListener('dragend', (e) => {
        elem.classList.remove('dragging');
      });

      elem.addEventListener('dragover', (e) => {
        if (elem.dataset.type === 'collection') {
          e.preventDefault();
          elem.classList.add('drag-over');
        }
      });

      elem.addEventListener('dragleave', (e) => {
        elem.classList.remove('drag-over');
      });

      elem.addEventListener('drop', (e) => {
        e.preventDefault();
        elem.classList.remove('drag-over');

        if (elem.dataset.type !== 'collection') return;

        try {
          const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
          const targetCollectionId = elem.dataset.id;

          if (dragData.type === 'request') {
            Storage.updateRequest(dragData.id, { collectionId: targetCollectionId });
            this.render();
          } else if (dragData.type === 'collection' && dragData.id !== targetCollectionId) {
            Storage.updateCollection(dragData.id, { parentId: targetCollectionId });
            this.expandedCollections.add(targetCollectionId);
            this.render();
          }
        } catch (err) {
          console.error('Drop error:', err);
        }
      });
    });
  },

  // Utilities
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  truncate(str, maxLen) {
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  },

  formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
};
