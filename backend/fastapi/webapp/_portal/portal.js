// API Base URL
const API_BASE = window.location.origin + '/webapp';

// State
let allApps = [];
let allCollections = [];
let allTags = new Set();
let currentFilter = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const searchResults = document.getElementById('searchResults');
const standaloneSection = document.getElementById('standaloneSection');
const standaloneApps = document.getElementById('standaloneApps');
const collectionsContainer = document.getElementById('collectionsContainer');
const emptyState = document.getElementById('emptyState');
const statsText = document.getElementById('statsText');
const filterTags = document.getElementById('filterTags');

// Initialize
async function init() {
    try {
        const response = await fetch(`${API_BASE}/_api/list`);
        const data = await response.json();
        
        allApps = data.apps || [];
        allCollections = data.collections || [];
        
        // Extract all unique tags
        [...allApps, ...(data.collections || []).flatMap(c => c.apps)].forEach(app => {
            if (app.tags && Array.isArray(app.tags)) {
                app.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        renderStats(data.total || 0);
        renderFilterTags();
        renderApps();
    } catch (error) {
        console.error('Failed to load apps:', error);
        showEmptyState();
    }
}

// Render stats
function renderStats(total) {
    if (total === 0) {
        statsText.textContent = 'No apps found';
    } else if (total === 1) {
        statsText.textContent = '1 app available';
    } else {
        const collectionCount = allCollections.length;
        const collectionText = collectionCount > 0 ? ` in ${collectionCount} collections` : '';
        statsText.textContent = `${total} apps available${collectionText}`;
    }
}

// Render filter tags
function renderFilterTags() {
    if (allTags.size === 0) {
        filterTags.style.display = 'none';
        return;
    }
    
    filterTags.innerHTML = '';
    Array.from(allTags).sort().forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'tag-filter';
        btn.textContent = tag;
        btn.onclick = () => toggleTagFilter(tag, btn);
        filterTags.appendChild(btn);
    });
}

// Toggle tag filter
function toggleTagFilter(tag, btn) {
    if (currentFilter === tag) {
        currentFilter = null;
        btn.classList.remove('active');
        renderApps();
    } else {
        currentFilter = tag;
        document.querySelectorAll('.tag-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderApps();
    }
}

// Render apps
function renderApps() {
    const hasApps = allApps.length > 0;
    const hasCollections = allCollections.length > 0;
    
    if (!hasApps && !hasCollections) {
        showEmptyState();
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Filter apps by current tag filter
    const filteredApps = currentFilter 
        ? allApps.filter(app => app.tags && app.tags.includes(currentFilter))
        : allApps;
    
    const filteredCollections = currentFilter
        ? allCollections.map(col => ({
            ...col,
            apps: col.apps.filter(app => app.tags && app.tags.includes(currentFilter))
        })).filter(col => col.apps.length > 0)
        : allCollections;
    
    // Render standalone apps
    if (filteredApps.length > 0) {
        standaloneSection.style.display = 'block';
        standaloneApps.innerHTML = filteredApps.map(app => createAppCard(app)).join('');
    } else {
        standaloneSection.style.display = 'none';
    }
    
    // Render collections
    collectionsContainer.innerHTML = filteredCollections.map(collection => 
        createCollectionSection(collection)
    ).join('');
    
    // Add event listeners
    document.querySelectorAll('.app-card').forEach(card => {
        card.addEventListener('click', () => {
            const path = card.dataset.path;
            window.location.href = `${API_BASE}/${path}/`;
        });
    });
    
    document.querySelectorAll('.collection-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const collectionId = btn.dataset.collection;
            const grid = document.getElementById(collectionId);
            const isExpanded = grid.style.display !== 'none';
            grid.style.display = isExpanded ? 'none' : 'grid';
            btn.textContent = isExpanded ? '▶' : '▼';
        });
    });
}

// Create app card HTML
function createAppCard(app) {
    const icon = app.icon || getDefaultIcon(app.name, app.tags);
    const description = app.description || 'No description available';
    const collectionBadge = app.collection 
        ? `<span class="collection-badge">📁 ${app.collection}</span>` 
        : '';
    const tags = app.tags && app.tags.length > 0
        ? `<div class="app-tags">${app.tags.map(tag => `<span class="app-tag">${tag}</span>`).join('')}</div>`
        : '';
    
    return `
        <div class="app-card" data-path="${app.path}">
            ${collectionBadge}
            <div class="app-icon">${icon}</div>
            <div class="app-title">${app.title || app.name}</div>
            <div class="app-description">${description}</div>
            <div class="app-path">${app.path}</div>
            ${tags}
        </div>
    `;
}

// Create collection section HTML
function createCollectionSection(collection) {
    const collectionId = `collection-${collection.name.replace(/[^a-z0-9]/gi, '-')}`;
    return `
        <section class="apps-section">
            <h2 class="section-title">
                <button class="collection-toggle" data-collection="${collectionId}">▼</button>
                📂 ${collection.name}
                <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: normal;">
                    (${collection.apps.length} ${collection.apps.length === 1 ? 'app' : 'apps'})
                </span>
            </h2>
            <div class="apps-grid" id="${collectionId}">
                ${collection.apps.map(app => createAppCard(app)).join('')}
            </div>
        </section>
    `;
}

// Get default icon based on app name/tags
function getDefaultIcon(name, tags = []) {
    const nameLower = name.toLowerCase();
    const allText = (nameLower + ' ' + tags.join(' ')).toLowerCase();
    
    if (allText.includes('game') || allText.includes('chess') || allText.includes('2048') || 
        allText.includes('gomoku') || allText.includes('caro') || allText.includes('xiangqi')) {
        return '🎮';
    }
    if (allText.includes('calculator') || allText.includes('calc')) {
        return '🔢';
    }
    if (allText.includes('chat') || allText.includes('gemini')) {
        return '💬';
    }
    if (allText.includes('editor') || allText.includes('markdown')) {
        return '📝';
    }
    if (allText.includes('git') || allText.includes('diff')) {
        return '🔀';
    }
    if (allText.includes('translate') || allText.includes('language')) {
        return '🌐';
    }
    if (allText.includes('postman') || allText.includes('api')) {
        return '📡';
    }
    if (allText.includes('radar') || allText.includes('undead')) {
        return '📡';
    }
    if (allText.includes('random') || allText.includes('generator')) {
        return '🎲';
    }
    if (allText.includes('tool')) {
        return '🛠️';
    }
    return '🌐';
}

// Show empty state
function showEmptyState() {
    standaloneSection.style.display = 'none';
    collectionsContainer.innerHTML = '';
    emptyState.style.display = 'block';
    statsText.textContent = 'No apps found';
}

// Search functionality
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearBtn.style.display = query ? 'block' : 'none';
    
    clearTimeout(searchTimeout);
    
    if (!query) {
        searchResults.style.display = 'none';
        standaloneSection.style.display = allApps.length > 0 ? 'block' : 'none';
        collectionsContainer.style.display = 'block';
        renderApps();
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        await performSearch(query);
    }, 300);
});

// Clear search
clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchResults.style.display = 'none';
    standaloneSection.style.display = allApps.length > 0 ? 'block' : 'none';
    collectionsContainer.style.display = 'block';
    renderApps();
});

// Perform search
async function performSearch(query) {
    try {
        const response = await fetch(`${API_BASE}/_api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            searchResults.style.display = 'block';
            standaloneSection.style.display = 'none';
            collectionsContainer.style.display = 'none';
            
            searchResults.innerHTML = `
                <h3>🔍 Search Results for "${query}" (${data.count} found)</h3>
                <div class="apps-grid">
                    ${data.results.map(app => createAppCard(app)).join('')}
                </div>
            `;
            
            // Add click handlers
            searchResults.querySelectorAll('.app-card').forEach(card => {
                card.addEventListener('click', () => {
                    const path = card.dataset.path;
                    window.location.href = `${API_BASE}/${path}/`;
                });
            });
        } else {
            searchResults.style.display = 'block';
            standaloneSection.style.display = 'none';
            collectionsContainer.style.display = 'none';
            searchResults.innerHTML = `
                <h3>🔍 Search Results for "${query}"</h3>
                <p style="color: var(--text-secondary); margin-top: 12px;">No apps found matching your search.</p>
            `;
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}

// Initialize on page load
init();
