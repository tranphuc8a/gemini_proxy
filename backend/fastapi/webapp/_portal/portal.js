/**
 * The portal: find one app among a couple of hundred, and open it.
 *
 * Everything here follows from that one job. The previous version listed every
 * app under its collection heading and offered a substring search, which is
 * fine for twenty apps and useless for two hundred and forty: you cannot scan
 * that list, and a substring match ranks "todo-list" and "list-of-todos" the
 * same as a demo that merely mentions lists in its description.
 *
 * So:
 *
 * * **Scored search**, not filtering. A hit on the name beats a hit on a tag
 *   beats a hit on the description, and a prefix beats a match in the middle.
 *   Ranking is what makes a search box usable at this size.
 * * **Usage is remembered.** Which apps you open, and when. "Hay mở nhất" and
 *   "Mở gần đây" are the two orderings that actually shorten the search, and
 *   neither can exist without keeping a count.
 * * **Filters compose.** Collection and tags narrow the set; search ranks what
 *   is left. They are independent, so any combination behaves predictably.
 *
 * State lives in the URL query string, so a filtered view can be bookmarked and
 * shared, and the back button undoes a filter rather than leaving the page.
 */

const API_BASE = window.location.origin + '/webapp'

const STORAGE = {
  usage: 'portal:usage',
  settings: 'portal:settings',
}

/** How much a field is worth when the query matches it. */
const FIELD_WEIGHTS = {
  title: 100,
  name: 80,
  tag: 45,
  collection: 30,
  description: 12,
}

const state = {
  apps: [],
  collections: [],
  tags: [],
  query: '',
  activeCollections: new Set(),
  activeTags: new Set(),
  tagMatchAll: false,
  sort: 'relevance',
  view: 'grid',
  tagFilter: '',
  usage: {},
}

const $ = (id) => document.getElementById(id)

// --------------------------------------------------------------- persistence

/** localStorage throws in private mode; a portal that works is worth more. */
function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or private mode */
  }
}

/**
 * Record that an app was opened.
 *
 * Kept as `{ count, last }` per path: the count drives "hay mở nhất", the
 * timestamp drives "mở gần đây", and neither can be derived from the other.
 */
function recordOpen(path) {
  const entry = state.usage[path] || { count: 0, last: 0 }
  entry.count += 1
  entry.last = Date.now()
  state.usage[path] = entry
  writeStore(STORAGE.usage, state.usage)
}

// -------------------------------------------------------------------- search

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    // Fold Vietnamese diacritics, so "do thi" finds "Đồ thị". Typing the
    // accents on a keyboard set to English is exactly the friction to remove.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
}

/**
 * Score one app against the query.
 *
 * Returns 0 for no match, so the caller can filter and sort on the same number.
 * A term must be found *somewhere* for the app to score at all: with several
 * terms this behaves as AND, which is what a person typing two words expects.
 */
function score(app, terms) {
  if (!terms.length) return 1

  const haystacks = [
    [normalise(app.title), FIELD_WEIGHTS.title],
    [normalise(app.name), FIELD_WEIGHTS.name],
    [normalise((app.tags || []).join(' ')), FIELD_WEIGHTS.tag],
    [normalise(app.collection), FIELD_WEIGHTS.collection],
    [normalise(app.description), FIELD_WEIGHTS.description],
  ]

  let total = 0
  for (const term of terms) {
    let best = 0
    for (const [text, weight] of haystacks) {
      if (!text) continue
      const at = text.indexOf(term)
      if (at === -1) continue
      // A prefix is a stronger signal than a match buried mid-word, and an
      // exact whole-field match stronger still.
      let points = weight
      if (at === 0) points *= 1.6
      if (text === term) points *= 2.2
      best = Math.max(best, points)
    }
    if (!best) return 0 // every term has to land somewhere
    total += best
  }
  return total
}

// -------------------------------------------------------------------- filter

function visibleApps() {
  const terms = normalise(state.query).split(/\s+/).filter(Boolean)

  const matched = state.apps
    .filter((app) => {
      if (state.activeCollections.size && !state.activeCollections.has(app.collection || '')) return false
      if (state.activeTags.size) {
        const tags = new Set(app.tags || [])
        const chosen = [...state.activeTags]
        const ok = state.tagMatchAll ? chosen.every((t) => tags.has(t)) : chosen.some((t) => tags.has(t))
        if (!ok) return false
      }
      return true
    })
    .map((app) => ({ app, points: score(app, terms) }))
    .filter((entry) => entry.points > 0)

  const usage = (app) => state.usage[app.path] || { count: 0, last: 0 }
  const byName = (a, b) => a.app.title.localeCompare(b.app.title, 'vi')

  switch (state.sort) {
    case 'popular':
      matched.sort((a, b) => usage(b.app).count - usage(a.app).count || byName(a, b))
      break
    case 'recent':
      matched.sort((a, b) => usage(b.app).last - usage(a.app).last || byName(a, b))
      break
    case 'name':
      matched.sort(byName)
      break
    case 'name-desc':
      matched.sort((a, b) => byName(b, a))
      break
    case 'collection':
      matched.sort(
        (a, b) =>
          (a.app.collection || '').localeCompare(b.app.collection || '', 'vi') || byName(a, b),
      )
      break
    case 'relevance':
    default:
      // With no query every score is 1, so relevance alone would be arbitrary.
      // Falling back to usage makes the default view the useful one: the apps
      // this person actually opens, first.
      matched.sort(
        (a, b) =>
          b.points - a.points ||
          usage(b.app).count - usage(a.app).count ||
          usage(b.app).last - usage(a.app).last ||
          byName(a, b),
      )
  }

  return matched.map((entry) => entry.app)
}

// --------------------------------------------------------------------- render

function appUrl(app) {
  return `${API_BASE}/${app.path}/`
}

function highlight(text, terms) {
  const value = String(text || '')
  if (!terms.length) return escapeHtml(value)

  const flat = normalise(value)
  const ranges = []
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = flat.indexOf(term, from)
      if (at === -1) break
      ranges.push([at, at + term.length])
      from = at + term.length
    }
  }
  if (!ranges.length) return escapeHtml(value)

  // Merge overlaps so two terms hitting the same span do not nest <mark>s.
  ranges.sort((a, b) => a[0] - b[0])
  const merged = [ranges[0]]
  for (const [start, end] of ranges.slice(1)) {
    const last = merged[merged.length - 1]
    if (start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }

  let html = ''
  let cursor = 0
  for (const [start, end] of merged) {
    html += escapeHtml(value.slice(cursor, start)) + '<mark>' + escapeHtml(value.slice(start, end)) + '</mark>'
    cursor = end
  }
  return html + escapeHtml(value.slice(cursor))
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function relativeTime(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'vừa xong'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} ngày trước`
  return new Date(timestamp).toLocaleDateString('vi-VN')
}

function appCard(app, terms) {
  const usage = state.usage[app.path]
  const card = document.createElement('a')
  card.className = 'app-card'
  card.href = appUrl(app)
  card.dataset.path = app.path

  const badges = []
  if (app.collection) badges.push(`<span class="badge badge-collection">${escapeHtml(app.collection)}</span>`)
  if (usage?.count) badges.push(`<span class="badge" title="Đã mở ${usage.count} lần">↻ ${usage.count}</span>`)

  card.innerHTML = `
    <div class="app-icon" aria-hidden="true">${escapeHtml(app.icon || '📦')}</div>
    <div class="app-body">
      <h3 class="app-title">${highlight(app.title || app.name, terms)}</h3>
      <p class="app-desc">${highlight(app.description || '', terms)}</p>
      <div class="app-meta">${badges.join('')}</div>
      <div class="app-tags">${(app.tags || [])
        .slice(0, 5)
        .map(
          (tag) =>
            `<button class="tag${state.activeTags.has(tag) ? ' is-active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`,
        )
        .join('')}</div>
    </div>
    ${usage?.last ? `<div class="app-when hint">${relativeTime(usage.last)}</div>` : ''}
  `

  card.addEventListener('click', (event) => {
    // A tag inside the card filters instead of opening: clicking "game" on a
    // card is a request to see the other games, not to launch this one.
    const tag = event.target.closest('.tag')
    if (tag) {
      event.preventDefault()
      toggleTag(tag.dataset.tag)
      return
    }
    recordOpen(app.path)
  })

  return card
}

function render() {
  const terms = normalise(state.query).split(/\s+/).filter(Boolean)
  const apps = visibleApps()

  const list = $('appList')
  list.className = `apps apps-${state.view}`
  list.textContent = ''
  for (const app of apps) list.appendChild(appCard(app, terms))

  $('emptyState').hidden = apps.length > 0
  $('resultSummary').textContent = apps.length
    ? `${apps.length} ứng dụng${state.query ? ` khớp “${state.query}”` : ''}`
    : ''

  renderActiveFilters()
  renderRecent()
  renderChips()

  const filtering = Boolean(state.query || state.activeCollections.size || state.activeTags.size)
  $('resetFilters').hidden = !filtering
  $('clearSearch').hidden = !state.query

  writeStore(STORAGE.settings, {
    sort: state.sort,
    view: state.view,
    tagMatchAll: state.tagMatchAll,
  })
  syncUrl()
}

function renderActiveFilters() {
  const host = $('activeFilters')
  const chips = [
    ...[...state.activeCollections].map((name) => ({ kind: 'collection', value: name })),
    ...[...state.activeTags].map((name) => ({ kind: 'tag', value: name })),
  ]
  host.hidden = chips.length === 0
  host.textContent = ''
  for (const chip of chips) {
    const button = document.createElement('button')
    button.className = 'chip is-active'
    button.textContent = `${chip.kind === 'collection' ? '📁 ' : '#'}${chip.value} ✕`
    button.addEventListener('click', () =>
      chip.kind === 'collection' ? toggleCollection(chip.value) : toggleTag(chip.value),
    )
    host.appendChild(button)
  }
}

/**
 * The "recently opened" strip.
 *
 * Hidden while searching: it is a shortcut for "the thing I was just using",
 * and repeating it above a set of search results is noise.
 */
function renderRecent() {
  const recent = Object.entries(state.usage)
    .filter(([, usage]) => usage.last)
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, 8)
    .map(([path]) => state.apps.find((app) => app.path === path))
    .filter(Boolean)

  const show = recent.length > 0 && !state.query && !state.activeTags.size && !state.activeCollections.size
  $('recentStrip').hidden = !show
  if (!show) return

  const host = $('recentItems')
  host.textContent = ''
  for (const app of recent) {
    const link = document.createElement('a')
    link.className = 'strip-item'
    link.href = appUrl(app)
    link.innerHTML = `<span aria-hidden="true">${escapeHtml(app.icon || '📦')}</span> ${escapeHtml(app.title || app.name)}`
    link.addEventListener('click', () => recordOpen(app.path))
    host.appendChild(link)
  }
}

function renderChips() {
  const collectionHost = $('collectionFilters')
  collectionHost.textContent = ''
  for (const entry of state.collections) {
    const button = document.createElement('button')
    button.className = `chip${state.activeCollections.has(entry.name) ? ' is-active' : ''}`
    button.innerHTML = `${escapeHtml(entry.name)} <span class="count">${entry.count}</span>`
    button.addEventListener('click', () => toggleCollection(entry.name))
    collectionHost.appendChild(button)
  }
  $('collectionCount').textContent = state.collections.length

  const needle = normalise(state.tagFilter)
  const tags = needle ? state.tags.filter((t) => normalise(t.name).includes(needle)) : state.tags
  const tagHost = $('tagFilters')
  tagHost.textContent = ''
  for (const entry of tags.slice(0, 200)) {
    const button = document.createElement('button')
    button.className = `chip${state.activeTags.has(entry.name) ? ' is-active' : ''}`
    button.innerHTML = `#${escapeHtml(entry.name)} <span class="count">${entry.count}</span>`
    button.addEventListener('click', () => toggleTag(entry.name))
    tagHost.appendChild(button)
  }
  $('tagCount').textContent = state.tags.length
  $('tagMatchMode').hidden = state.activeTags.size < 2
}

// ------------------------------------------------------------------- actions

function toggleTag(tag) {
  if (state.activeTags.has(tag)) state.activeTags.delete(tag)
  else state.activeTags.add(tag)
  render()
}

function toggleCollection(name) {
  if (state.activeCollections.has(name)) state.activeCollections.delete(name)
  else state.activeCollections.add(name)
  render()
}

function resetFilters() {
  state.query = ''
  state.activeTags.clear()
  state.activeCollections.clear()
  $('searchInput').value = ''
  render()
}

/** Filters live in the URL, so a view can be shared and Back undoes a filter. */
function syncUrl() {
  const params = new URLSearchParams()
  if (state.query) params.set('q', state.query)
  if (state.activeTags.size) params.set('tags', [...state.activeTags].join(','))
  if (state.activeCollections.size) params.set('in', [...state.activeCollections].join(','))
  if (state.sort !== 'relevance') params.set('sort', state.sort)

  const query = params.toString()
  const url = query ? `?${query}` : location.pathname
  if (url !== location.search + (location.search ? '' : location.pathname)) {
    history.replaceState(null, '', url)
  }
}

function readUrl() {
  const params = new URLSearchParams(location.search)
  state.query = params.get('q') || ''
  for (const tag of (params.get('tags') || '').split(',').filter(Boolean)) state.activeTags.add(tag)
  for (const name of (params.get('in') || '').split(',').filter(Boolean)) state.activeCollections.add(name)
  const sort = params.get('sort')
  if (sort) state.sort = sort
}

// ---------------------------------------------------------------------- data

function indexFacets() {
  const collections = new Map()
  const tags = new Map()
  for (const app of state.apps) {
    if (app.collection) collections.set(app.collection, (collections.get(app.collection) || 0) + 1)
    for (const tag of app.tags || []) tags.set(tag, (tags.get(tag) || 0) + 1)
  }
  const byCountThenName = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')
  state.collections = [...collections.entries()].sort(byCountThenName).map(([name, count]) => ({ name, count }))
  state.tags = [...tags.entries()].sort(byCountThenName).map(([name, count]) => ({ name, count }))
}

async function load() {
  $('loading').hidden = false
  $('errorState').hidden = true
  try {
    const response = await fetch(`${API_BASE}/_api/list`)
    if (!response.ok) throw new Error(`Máy chủ trả về ${response.status}`)
    const data = await response.json()

    // The API separates standalone apps from collections; the portal treats
    // them the same and uses `collection` as a facet instead.
    state.apps = [
      ...(data.apps || []),
      ...(data.collections || []).flatMap((entry) => entry.apps || []),
    ].map((app) => ({ ...app, title: app.title || app.name }))

    indexFacets()
    $('brandStats').textContent =
      `${state.apps.length} ứng dụng · ${state.collections.length} thư mục · ${state.tags.length} tag`
    $('loading').hidden = true
    render()
  } catch (error) {
    $('loading').hidden = true
    $('errorState').hidden = false
    $('errorMessage').textContent = String(error.message || error)
  }
}

// ---------------------------------------------------------------------- init

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  $('themeToggle').textContent = theme === 'dark' ? '🌙' : '☀️'
  writeStore(STORAGE.settings, { ...readStore(STORAGE.settings, {}), theme })
}

function bind() {
  let searchTimer = null
  $('searchInput').addEventListener('input', (event) => {
    const value = event.target.value
    // Debounced: re-ranking and re-rendering 240 cards on every keystroke is
    // what makes a search box feel heavy.
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.query = value
      render()
    }, 120)
  })

  $('clearSearch').addEventListener('click', () => {
    $('searchInput').value = ''
    state.query = ''
    render()
    $('searchInput').focus()
  })

  $('tagSearch').addEventListener('input', (event) => {
    state.tagFilter = event.target.value
    renderChips()
  })

  $('sortSelect').addEventListener('change', (event) => {
    state.sort = event.target.value
    render()
  })

  $('tagMatchAll').addEventListener('change', (event) => {
    state.tagMatchAll = event.target.checked
    render()
  })

  for (const button of document.querySelectorAll('.view-btn')) {
    button.addEventListener('click', () => {
      state.view = button.dataset.view
      for (const other of document.querySelectorAll('.view-btn')) {
        other.classList.toggle('is-active', other === button)
      }
      render()
    })
  }

  $('resetFilters').addEventListener('click', resetFilters)
  $('emptyReset').addEventListener('click', resetFilters)
  $('retryLoad').addEventListener('click', load)

  $('themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
  })

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea')) {
      if (event.key === 'Escape') event.target.blur()
      return
    }
    // "/" to search is the convention every list-heavy page has taught people.
    if (event.key === '/') {
      event.preventDefault()
      $('searchInput').focus()
    } else if (event.key === 'Escape') {
      resetFilters()
    }
  })
}

function start() {
  const settings = readStore(STORAGE.settings, {})
  state.usage = readStore(STORAGE.usage, {})
  state.sort = settings.sort || 'relevance'
  state.view = settings.view || 'grid'
  state.tagMatchAll = Boolean(settings.tagMatchAll)

  readUrl() // the URL wins over the remembered settings

  applyTheme(settings.theme || 'dark')
  $('searchInput').value = state.query
  $('sortSelect').value = state.sort
  $('tagMatchAll').checked = state.tagMatchAll
  for (const button of document.querySelectorAll('.view-btn')) {
    button.classList.toggle('is-active', button.dataset.view === state.view)
  }

  bind()
  load()
}

start()
