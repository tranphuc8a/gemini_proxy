/* Git Diff Viewer - performance-oriented lazy renderer */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const fileInput = $('#diffFile');
const viewMode = $('#viewMode');
const toggleHighlight = $('#toggleHighlight');
const toggleTheme = $('#toggleTheme');
const hljsThemeLight = document.getElementById('hljs-theme-light');
const hljsThemeDark = document.getElementById('hljs-theme-dark');
const renderAllBtn = $('#renderAll');
const clearBtn = $('#clear');
const fileListEl = $('#fileList');
const diffHost = $('#diffHost');
const fileSearch = $('#fileSearch');

let diffText = '';
let files = []; // [{name, chunk, stats}]
let observer; // IntersectionObserver
let renderingQueue = [];
let isRendering = false;
let highlightEnabled = true;

// Keyboard shortcut focus search: Ctrl+K
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    fileSearch?.focus();
  }
});

function setTheme(dark){
  const isDark = !!dark;
  document.body.classList.toggle('dark', isDark);
  // Toggle highlight theme
  if (hljsThemeLight && hljsThemeDark){
    hljsThemeLight.disabled = isDark;
    hljsThemeDark.disabled = !isDark;
  }
}

function clearAll(){
  diffText=''; files=[]; renderingQueue=[]; isRendering=false;
  fileListEl.innerHTML='';
  diffHost.innerHTML='';
}

function parseFilesFromDiff(text){
  // Split by file headers: lines that start with 'diff --git'
  const parts = text.split(/^diff --git .*$/m).filter(Boolean);
  const headers = text.match(/^diff --git .*$/mg) || [];
  return headers.map((h, i) => {
    const chunk = `${h}\n${parts[i] || ''}`;
    const nameMatch = h.match(/a\/(\S+)\s+b\/(\S+)/);
    const name = nameMatch ? nameMatch[2] : `file_${i+1}`;
    // quick stats (approximate)
    const lines = chunk.split(/\r?\n/);
    let added=0, removed=0;
    for (const line of lines){
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) added++;
      else if (line.startsWith('-')) removed++;
    }
    return { name, chunk, stats: {added, removed} };
  });
}

function renderFileList(list){
  const frag = document.createDocumentFragment();
  list.forEach((f, idx) => {
    const li = document.createElement('li');
    li.dataset.index = String(idx);
    li.innerHTML = `
      <span class="name">${f.name}</span>
      <span>
        <span class="tag added" title="added">+${f.stats.added}</span>
        <span class="tag removed" title="removed">-${f.stats.removed}</span>
      </span>
    `;
    li.addEventListener('click', () => scrollToFile(idx));
    frag.appendChild(li);
  });
  fileListEl.innerHTML='';
  fileListEl.appendChild(frag);
}

function createPlaceholders(list){
  diffHost.innerHTML='';
  const frag = document.createDocumentFragment();
  list.forEach((f, idx) => {
    const host = document.createElement('div');
    host.id = `f-${idx}`;
    host.className = 'file-diff';
    host.style.marginBottom = '16px';
    host.innerHTML = `
      <div class="status-bar">
        <div>
          <strong>${f.name}</strong>
        </div>
        <div>+${f.stats.added} / -${f.stats.removed}</div>
      </div>
    `;
    frag.appendChild(host);
  });
  diffHost.appendChild(frag);
}

function ensureObserver(){
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        const id = entry.target.id; // f-idx
        const idx = parseInt(id.slice(2), 10);
        queueRender(idx);
      }
    });
  }, {root: diffHost, rootMargin: '200px 0px', threshold: 0});
  $$('.file-diff', diffHost).forEach(el => observer.observe(el));
}

function queueRender(idx){
  if (!renderingQueue.includes(idx)) renderingQueue.push(idx);
  pumpQueue();
}

function pumpQueue(){
  if (isRendering) return;
  const idx = renderingQueue.shift();
  if (idx == null) return;
  isRendering = true;
  setTimeout(() => renderOne(idx).finally(() => { isRendering=false; pumpQueue(); }), 0);
}

async function renderOne(idx){
  const host = document.getElementById(`f-${idx}`);
  if (!host) return;
  if (host.dataset.rendered === '1') return; // idempotent
  const f = files[idx];

  const config = {
    drawFileList: false,
    matching: 'lines',
    fileContentToggle: true,
    outputFormat: viewMode.value,
    synchronisedScroll: true,
    highlight: highlightEnabled,
    renderNothingWhenEmpty: false,
  };

  // Create a container for diff2html
  const container = document.createElement('div');
  container.className = 'd2h-wrapper';
  host.appendChild(container);

  // Render diff for this single file chunk
  const ui = new Diff2HtmlUI(container, f.chunk, config);
  ui.draw();
  if (highlightEnabled) {
    try { ui.highlightCode(); } catch {}
  }

  host.dataset.rendered = '1';
}

function renderVisible(){
  // initial kick to render items in view
  $$('.file-diff', diffHost).slice(0, 3).forEach(el => {
    const idx = parseInt(el.id.slice(2), 10);
    queueRender(idx);
  });
}

function scrollToFile(idx){
  const el = document.getElementById(`f-${idx}`);
  if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

function filterFiles(q){
  const query = (q||'').toLowerCase();
  $$('#fileList li').forEach(li => {
    const name = $('.name', li)?.textContent?.toLowerCase() || '';
    li.classList.toggle('hidden', !name.includes(query));
  });
}

fileInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  diffText = text;

  // Pre-split into per-file chunks to enable lazy rendering
  files = parseFilesFromDiff(diffText);
  renderFileList(files);
  createPlaceholders(files);
  ensureObserver();
  renderVisible();
  // Ensure current theme applies post-render
  setTheme(toggleTheme?.checked);
});

viewMode?.addEventListener('change', () => {
  if (!files.length) return;
  // Re-render: clear rendered state but keep placeholders
  $$('.file-diff').forEach(el => { el.dataset.rendered=''; const inner = el.querySelector('.d2h-wrapper'); if(inner) inner.remove(); });
  renderingQueue = [];
  renderVisible();
});

toggleHighlight?.addEventListener('change', (e) => {
  highlightEnabled = !!e.target.checked;
  // Only re-highlight already rendered ones if toggled on; otherwise no-op
  if (highlightEnabled){
    $$('.file-diff .d2h-wrapper').forEach(w => {
      try { (new Diff2HtmlUI(w)).highlightCode(); } catch {}
    });
  }
});

toggleTheme?.addEventListener('change', (e) => {
  setTheme(!!e.target.checked);
});

renderAllBtn?.addEventListener('click', () => {
  if (!files.length) return;
  $$('.file-diff').forEach(el => queueRender(parseInt(el.id.slice(2),10)));
});

clearBtn?.addEventListener('click', () => {
  clearAll();
  fileInput.value = '';
});

fileSearch?.addEventListener('input', (e) => filterFiles(e.target.value));

// Initialize controls state
if (toggleHighlight) toggleHighlight.checked = true;
setTheme(!!toggleTheme?.checked);
