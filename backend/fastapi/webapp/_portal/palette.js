/**
 * Ctrl+K — find anything: apps, courses, lessons, labs; or ask a question.
 *
 * The portal's own search box narrows the app grid. This palette answers the
 * other question — "where was that thing?" — across everything the site holds:
 *
 * * **Apps** — the list portal.js already loaded, ranked by the same `score`.
 * * **Courses** — `GET /courses` (published ones), matched on title and subtitle.
 * * **Lessons** — `GET /courses/search`: every published course's own server
 *   index at once, so a lesson is found by its words, not just its title.
 * * **Labs** — `courses/lab-visual/danh-sach.json`, the lab index the lab
 *   page's check keeps in step with its `demo({...})` declarations.
 * * **Ask AI** — `POST /ai/ask`: the best lessons from every course, answered
 *   with numbered citations. Offered only when the server says this visitor
 *   may use AI (engine/ai-khach.js holds the access rules and tokens).
 *
 * Loaded after portal.js and uses its helpers (score, normalise, escapeHtml,
 * appUrl, recordOpen, state). The API base comes from /webapp/_api/config — the
 * portal page is a file, so the server injects no config into it.
 */

const palette = {
  open: false,
  items: [],
  index: 0,
  apiBase: null,
  courses: null,
  labs: null,
  ai: null,
  aiStatus: null,
  lessons: { query: '', hits: [] },
  seq: 0,
  timer: null,
}

const pal = (id) => document.getElementById(id)

async function paletteSetup() {
  if (palette.apiBase !== null) return
  palette.apiBase = ''
  try {
    const config = await (await fetch(`${API_BASE}/_api/config`)).json()
    palette.apiBase = String(config.apiBase || '').replace(/\/+$/, '')
  } catch {
    /* same origin */
  }
  palette.ai = window.AiKhach ? window.AiKhach.tao(palette.apiBase) : null
  if (palette.ai) {
    palette.ai.trangThai().then(
      (status) => {
        palette.aiStatus = status
        renderPalette()
      },
      () => {},
    )
  }
  fetch(`${palette.apiBase}/courses`)
    .then((r) => (r.ok ? r.json() : { courses: [] }))
    .then((data) => {
      palette.courses = data.courses || []
      renderPalette()
    })
    .catch(() => {
      palette.courses = []
    })
  fetch(`${API_BASE}/courses/lab-visual/danh-sach.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((labs) => {
      palette.labs = Array.isArray(labs) ? labs : []
      renderPalette()
    })
    .catch(() => {
      palette.labs = []
    })
}

/** A course's own page if it has one in the portal, else the shared reader. */
function courseHref(slug, webapp) {
  const own = webapp && state.apps.some((app) => app.path === webapp)
  return own ? `${API_BASE}/${webapp}/` : `${API_BASE}/courses/khoa-hoc/?khoa=${encodeURIComponent(slug)}`
}

function canAsk() {
  const s = palette.aiStatus
  return !!(palette.ai && palette.ai.dungDuoc(s))
}

function textScore(fields, terms) {
  if (!terms.length) return 1
  let total = 0
  for (const term of terms) {
    let best = 0
    for (const [text, weight] of fields) {
      const at = normalise(text).indexOf(term)
      if (at >= 0) best = Math.max(best, at === 0 ? weight * 1.6 : weight)
    }
    if (!best) return 0
    total += best
  }
  return total
}

function searchLessons(query) {
  clearTimeout(palette.timer)
  if (normalise(query).trim().length < 2) {
    palette.lessons = { query: '', hits: [] }
    return
  }
  palette.timer = setTimeout(async () => {
    const seq = ++palette.seq
    try {
      const r = await fetch(`${palette.apiBase}/courses/search?limit=8&q=${encodeURIComponent(query)}`)
      const data = r.ok ? await r.json() : { hits: [] }
      if (seq !== palette.seq) return // a newer query is on its way
      palette.lessons = { query, hits: data.hits || [] }
      renderPalette()
    } catch {
      /* offline: the other groups still work */
    }
  }, 180)
}

function buildItems(query) {
  const terms = normalise(query).split(/\s+/).filter(Boolean)
  const groups = []

  const apps = state.apps
    .map((app) => ({ app, points: score(app, terms) }))
    .filter((e) => e.points > 0)
    .sort((a, b) => b.points - a.points || (state.usage[b.app.path]?.last || 0) - (state.usage[a.app.path]?.last || 0))
    .slice(0, terms.length ? 6 : 5)
    .map(({ app }) => ({
      kind: 'Ứng dụng', icon: app.icon || '📦', title: app.title, sub: app.description || app.path,
      href: appUrl(app), path: app.path,
    }))
  groups.push(apps)

  const courses = (palette.courses || [])
    .map((c) => ({ c, points: textScore([[c.title, 100], [c.subtitle, 40], [c.description, 15]], terms) }))
    .filter((e) => e.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map(({ c }) => ({
      kind: 'Khoá học', icon: c.icon || '📘', title: c.title, sub: c.subtitle || `${c.docCount || 0} bài`,
      href: courseHref(c.slug, (c.config || {}).webapp),
    }))
  groups.push(courses)

  if (terms.length && palette.lessons.query === query) {
    groups.push(
      palette.lessons.hits.map((h) => ({
        kind: 'Bài học', icon: h.courseIcon || '📄', title: h.title,
        sub: `${h.courseTitle} · ${h.snippet || h.group || ''}`,
        href: `${courseHref(h.course, h.webapp)}#/${h.slug}`,
      })),
    )
  }

  if (terms.length) {
    groups.push(
      (palette.labs || [])
        .map((l) => ({ l, points: textScore([[l.ten, 100], [l.id, 60], [l.nhom, 30]], terms) }))
        .filter((e) => e.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 5)
        .map(({ l }) => ({
          kind: 'Lab', icon: '🧪', title: l.ten, sub: l.nhom,
          href: `${API_BASE}/courses/lab-visual/#/${encodeURIComponent(l.id)}`,
        })),
    )
  }

  const items = groups.flat()
  if (canAsk() && query.trim().split(/\s+/).length >= 2) {
    items.push({ kind: 'AI', icon: '✨', title: `Hỏi AI: “${query.trim()}”`, sub: 'Trả lời từ các bài học, kèm nguồn', ask: true })
  }
  return items
}

function renderPalette() {
  if (!palette.open || pal('paletteAnswer').hidden === false) return
  const query = pal('paletteInput').value
  palette.items = buildItems(query)
  palette.index = Math.min(palette.index, Math.max(0, palette.items.length - 1))
  const terms = normalise(query).split(/\s+/).filter(Boolean)
  let lastKind = ''
  pal('paletteList').innerHTML = palette.items.length
    ? palette.items
        .map((item, i) => {
          const head = item.kind !== lastKind ? `<div class="palette-group">${escapeHtml(item.kind)}</div>` : ''
          lastKind = item.kind
          return (
            head +
            `<a class="palette-item${i === palette.index ? ' is-active' : ''}" role="option" data-i="${i}"` +
            (item.href ? ` href="${escapeHtml(item.href)}"` : ' href="#"') +
            `><span class="palette-icon">${escapeHtml(item.icon)}</span><span class="palette-text">` +
            `<b>${highlight(item.title, terms)}</b><span>${escapeHtml(item.sub || '')}</span></span></a>`
          )
        })
        .join('')
    : `<p class="palette-empty hint">${query.trim() ? 'Không tìm thấy gì khớp.' : 'Gõ để tìm…'}</p>`
  const active = pal('paletteList').querySelector('.is-active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

function miniMarkdown(md) {
  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[(\d+)\]/g, '<sup class="palette-cite">[$1]</sup>')
  let html = ''
  let list = false
  for (const raw of escapeHtml(md).split('\n')) {
    const item = /^\s*[-*]\s+(.*)$/.exec(raw)
    if (item) {
      if (!list) html += '<ul>'
      list = true
      html += `<li>${inline(item[1])}</li>`
      continue
    }
    if (list) html += '</ul>'
    list = false
    if (raw.trim()) html += `<p>${inline(raw.trim())}</p>`
  }
  return html + (list ? '</ul>' : '')
}

async function askAi(question) {
  const box = pal('paletteAnswer')
  pal('paletteList').hidden = true
  box.hidden = false
  box.innerHTML = '<p class="hint">AI đang đọc các bài liên quan…</p>'
  try {
    const out = await palette.ai.goi('ask', { q: question })
    if (!out.found) {
      box.innerHTML = '<p>Không có bài nào trong các khoá học nói về điều này.</p>'
    } else {
      box.innerHTML =
        `<div class="palette-answer-body">${miniMarkdown(out.answer)}</div>` +
        (out.sources.length
          ? '<div class="palette-sources"><b>Nguồn</b>' +
            out.sources
              .map(
                (s, i) =>
                  `<a href="${escapeHtml(courseHref(s.course, s.webapp))}#/${escapeHtml(s.slug)}">[${i + 1}] ${escapeHtml(s.title)}` +
                  ` <span>· ${escapeHtml(s.courseTitle)}</span></a>`,
              )
              .join('') +
            '</div>'
          : '') +
        (out.cached ? '<p class="hint">Câu trả lời có sẵn từ lần hỏi trước — không tốn lượt.</p>' : '')
    }
  } catch (error) {
    box.innerHTML = `<p class="palette-error">${escapeHtml(error.message || error)}</p>`
    if (error.ma === 'ai_code_required') box.appendChild(palette.ai.oMa(() => askAi(question), 'btn'))
  }
  box.insertAdjacentHTML('afterbegin', '<button type="button" class="btn btn-ghost palette-back" id="paletteBack">← Kết quả tìm</button>')
  pal('paletteBack').addEventListener('click', () => {
    box.hidden = true
    pal('paletteList').hidden = false
    pal('paletteInput').focus()
    renderPalette()
  })
}

function activate(item) {
  if (!item) return
  if (item.ask) {
    askAi(pal('paletteInput').value.trim())
    return
  }
  if (item.path) recordOpen(item.path)
  window.location.href = item.href
}

function openPalette() {
  palette.open = true
  palette.index = 0
  pal('palette').hidden = false
  pal('paletteAnswer').hidden = true
  pal('paletteList').hidden = false
  const input = pal('paletteInput')
  input.value = ''
  input.focus()
  paletteSetup()
  renderPalette()
}

function closePalette() {
  palette.open = false
  pal('palette').hidden = true
}

function bindPalette() {
  pal('openPalette').addEventListener('click', openPalette)
  pal('palette').addEventListener('click', (event) => {
    if (event.target === pal('palette')) closePalette()
    const link = event.target.closest('.palette-item')
    if (link) {
      event.preventDefault()
      activate(palette.items[Number(link.dataset.i)])
    }
  })
  pal('paletteInput').addEventListener('input', (event) => {
    palette.index = 0
    pal('paletteAnswer').hidden = true
    pal('paletteList').hidden = false
    searchLessons(event.target.value.trim())
    renderPalette()
  })
  pal('paletteInput').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const n = palette.items.length
      if (!n) return
      palette.index = (palette.index + (event.key === 'ArrowDown' ? 1 : n - 1)) % n
      renderPalette()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      activate(palette.items[palette.index])
    }
  })
  document.addEventListener(
    'keydown',
    (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        event.stopPropagation()
        palette.open ? closePalette() : openPalette()
      } else if (event.key === 'Escape' && palette.open) {
        event.stopPropagation()
        closePalette()
      }
    },
    true, // before portal.js's own Escape (which resets the filters)
  )
}

bindPalette()
