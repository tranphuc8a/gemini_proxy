import type { StorageBackend } from '../types'

/**
 * Read-only share links, the pure part (md-share V7): the `#share=` address, the link the owner copies, and the checks
 * the share dialog warns with. No DOM, no network.
 *
 * A link is `<app folder>/#share=<token>&backend=<store>`: the token stays after `#`, so the browser never sends it to
 * the server in a URL (the API takes it from the `X-Share-Token` header). Same shape as Code Studio's links.
 */

/** What a token may look like (backend: `share_links.TOKEN_SHAPE`). Anything else is "not found" without asking. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,100}$/

/** A document id the server accepts (backend `markdown_ids.DOC_ID_PATTERN`, shared with the delta sync). */
export const DOC_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/

const BACKENDS: readonly StorageBackend[] = ['json', 'mysql', 'mongo']

export interface ShareAddress {
  /** As found in the address; may be malformed (then the page says "not found" without a request). */
  token: string
  /** null when the link names no store: the server's default is used. */
  backend: StorageBackend | null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** The `#share=<token>&backend=…` of an address, or null when it is not a share link at all (no `share` key, or an empty token). */
export function parseShareHash(hash: string): ShareAddress | null {
  const body = (hash || '').replace(/^#/, '')
  if (!body) return null
  let token: string | null = null
  let backend: StorageBackend | null = null
  for (const part of body.split('&')) {
    const eq = part.indexOf('=')
    const key = safeDecode(eq < 0 ? part : part.slice(0, eq))
    const value = eq < 0 ? '' : safeDecode(part.slice(eq + 1).replace(/\+/g, ' '))
    if (key === 'share' && token === null) token = value.trim()
    else if (key === 'backend' && (BACKENDS as readonly string[]).includes(value)) backend = value as StorageBackend
  }
  // An empty token is not an address: `#share` is the anchor of a heading named "Share" (rehypeEnhance) or a plain
  // `[x](#share)`, and the editor must stay the editor when one is clicked.
  return token ? { token, backend } : null
}

export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

export function shareHashFor(token: string, backend: StorageBackend | null): string {
  return `#share=${encodeURIComponent(token)}${backend ? `&backend=${backend}` : ''}`
}

/**
 * The link to hand out: the app's FOLDER (`…/markdown-editor-pro/`), never `index.html` or the current query/hash. An
 * installed app runs at `…/index.html?source=pwa` (its start_url); a link copied from there must still open for anyone
 * (ke-hoach §1.4).
 */
export function shareLinkFor(pageUrl: string, token: string, backend: StorageBackend | null): string {
  const url = new URL(pageUrl)
  let path = url.pathname.replace(/\/index\.html?$/i, '/')
  if (!path.endsWith('/')) {
    const slash = path.lastIndexOf('/')
    // ".../markdown-editor-pro" (no slash) needs the folder form for its relative assets; ".../page.html" its folder.
    path = path.slice(slash + 1).includes('.') ? path.slice(0, slash + 1) : `${path}/`
  }
  return `${url.protocol}//${url.host}${path}${shareHashFor(token, backend)}`
}

export type HrefKind = 'anchor' | 'external' | 'internal' | 'blocked'

/**
 * How a shared page treats a link target:
 * - `anchor`: `#section`, scrolls the page;
 * - `external`: http(s), mailto, tel, protocol-relative -- opens in a new tab, no referrer;
 * - `internal`: a relative or root path -- another document of the owner's tree that is not part of the share;
 * - `blocked`: empty, `javascript:`, `data:`, `file:` and any other scheme.
 */
export function classifyHref(href: string | null | undefined): HrefKind {
  const value = (href ?? '').trim()
  if (!value) return 'blocked'
  if (value.startsWith('#')) return 'anchor'
  if (value.startsWith('//')) return 'external'
  if (/^(https?:|mailto:|tel:)/i.test(value)) return 'external'
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return 'blocked'
  return 'internal'
}

export interface DocumentRefs {
  /** Links to other documents (relative/root paths): shown as plain text on the shared page. */
  internalLinks: string[]
  /** Images with a relative address: there is no asset store, they cannot be shown. */
  relativeImages: string[]
  /** Images loaded from other sites: the viewer's browser fetches them (no referrer). */
  externalImages: string[]
  /** `data:` images: they travel inside the snapshot and count towards its size. */
  dataImages: number
}

const CODE_TICK = 96 // `
const BACKSLASH = 92
const OPEN_BRACKET = 91
const CLOSE_BRACKET = 93
const OPEN_PAREN = 40
const CLOSE_PAREN = 41
const BANG = 33

/**
 * Inline code spans blanked, CommonMark style: a run of N backticks closes at the next run of exactly N backticks, and
 * with none the opening run is just text. Linear: one pass finds the runs, one pass over them pairs each with the next
 * run of the same length (a regex like /(`+)[^`]*?\1/ backtracks over every prefix of a run: quadratic on backticks).
 */
function withoutCodeSpans(line: string): string {
  if (line.indexOf('`') < 0) return line
  const starts: number[] = []
  const lengths: number[] = []
  for (let index = 0; index < line.length; ) {
    if (line.charCodeAt(index) !== CODE_TICK) {
      index += 1
      continue
    }
    let end = index + 1
    while (end < line.length && line.charCodeAt(end) === CODE_TICK) end += 1
    starts.push(index)
    lengths.push(end - index)
    index = end
  }
  const closer = new Array<number>(starts.length).fill(-1)
  const nextOfLength = new Map<number, number>()
  for (let run = starts.length - 1; run >= 0; run -= 1) {
    closer[run] = nextOfLength.get(lengths[run]) ?? -1
    nextOfLength.set(lengths[run], run)
  }
  const kept: string[] = []
  let cursor = 0
  for (let run = 0; run < starts.length; run += 1) {
    const close = closer[run]
    if (close < 0) continue
    kept.push(line.slice(cursor, starts[run]))
    cursor = starts[close] + lengths[close]
    run = close
  }
  kept.push(line.slice(cursor))
  return kept.join('')
}

/** Fenced code (``` / ~~~) and inline code spans, blanked so their text is not mistaken for links. */
function withoutCode(markdown: string): string {
  const lines = markdown.split('\n')
  let fence: string | null = null
  const kept: string[] = []
  for (const line of lines) {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && line.trim() === open[1]) fence = null
      kept.push('')
      continue
    }
    if (open) {
      fence = open[1]
      kept.push('')
      continue
    }
    kept.push(withoutCodeSpans(line))
  }
  return kept.join('\n')
}

/** Where a markdown link/image target ends: before an optional title, angle brackets removed. */
function cleanTarget(raw: string): string {
  let target = raw.trim()
  if (target.startsWith('<')) {
    const close = target.indexOf('>')
    return close > 0 ? target.slice(1, close) : target.slice(1)
  }
  const space = target.search(/\s/)
  if (space > 0) target = target.slice(0, space)
  return target
}

/** What a regex `.` does not match: a backslash before one of these escapes nothing. */
function isLineTerminator(code: number): boolean {
  return code === 10 || code === 13 || code === 0x2028 || code === 0x2029
}

/**
 * The end (exclusive) of the target whose "(" is at `open`, or -1. A target is text without parentheses with, optionally,
 * balanced `(…)` groups ONE level deep, then ")". Deterministic, so one forward pass that stops at the first character that
 * cannot continue it (a second "(" inside a group, the end of the line).
 */
function targetEnd(line: string, open: number): number {
  const runEnd = (from: number): number => {
    let index = from
    while (index < line.length) {
      const code = line.charCodeAt(index)
      if (code === OPEN_PAREN || code === CLOSE_PAREN) break
      index += 1
    }
    return index
  }
  let index = runEnd(open + 1)
  while (index < line.length && line.charCodeAt(index) === OPEN_PAREN) {
    const inner = runEnd(index + 1)
    if (inner >= line.length || line.charCodeAt(inner) !== CLOSE_PAREN) return -1
    index = runEnd(inner + 1)
  }
  return index < line.length && line.charCodeAt(index) === CLOSE_PAREN ? index + 1 : -1
}

/**
 * `[label](target)` and `![label](target)` of one line, left to right - what the regex
 * `(!?)\[(?:[^\]\\\n]|\\.)*\]\(target\)` found, minus its backtracking. A `[` opens a candidate only when none is open; the
 * candidate ends at the first unescaped `]`; every other `[` before that `]` would end at the same `]` and fail the same
 * way, so none is retried. Each character is read once, a target at most twice.
 */
function inlineLinks(line: string, found: (image: boolean, target: string) => void): void {
  let open = -1
  let from = 0 // where the next match may start: the end of the previous one
  for (let index = 0; index < line.length; index += 1) {
    const code = line.charCodeAt(index)
    if (open < 0) {
      if (code === OPEN_BRACKET) open = index
      continue
    }
    if (code === BACKSLASH) {
      // `\\.` pairs a backslash with the next character; at a line end it pairs with nothing and the label dies.
      if (index + 1 < line.length && !isLineTerminator(line.charCodeAt(index + 1))) index += 1
      else open = -1
      continue
    }
    if (code !== CLOSE_BRACKET) continue
    const begin = open
    open = -1
    if (line.charCodeAt(index + 1) !== OPEN_PAREN) continue
    const end = targetEnd(line, index + 1)
    if (end < 0) continue
    found(begin > from && line.charCodeAt(begin - 1) === BANG, cleanTarget(line.slice(index + 2, end - 1)))
    from = end
    index = end - 1
  }
}

/** `indexOf(char, from)` that remembers its last answer, so a forward-moving caller never rescans (nor re-asks "none left"). */
function charFinder(text: string, char: string): (from: number) => number {
  let at = -2
  let askedFrom = 0
  return (from) => {
    if (at >= from || (at === -1 && from >= askedFrom)) return at
    at = text.indexOf(char, from)
    askedFrom = from
    return at
  }
}

/** The first match of a global regex at or after `from`, remembering it (and "no match") for a forward-moving caller. */
function matchFinder(text: string, pattern: RegExp): (from: number) => RegExpExecArray | null {
  let last: RegExpExecArray | null | undefined
  let askedFrom = 0
  return (from) => {
    if (last === null && from >= askedFrom) return null
    if (last && last.index >= from && from >= askedFrom) return last
    pattern.lastIndex = from
    last = pattern.exec(text)
    askedFrom = from
    return last
  }
}

/** What ends a bare (unquoted) attribute value: whitespace or ">". */
const BARE_END = /[\s>]/

/**
 * The value of every `attribute` of `<tag …>` elements - what the regex
 * `<tag\b[^>]*?\battribute\s*=\s*("…"|'…'|bare)` (flags gi) found - in ONE forward pass. For each `<tag` the first
 * `attribute=` that follows with no ">" in between wins (a value that cannot be read, `href=>`, passes to the next
 * `attribute=` of the same tag), and the search for the next tag resumes after that value. Candidates, the next ">" and the
 * closing quotes are looked up with remembering cursors, so a text of unclosed tags costs one pass, not one per tag.
 */
function tagAttributes(text: string, tag: string, attribute: string, found: (value: string) => void): void {
  const nextTag = matchFinder(text, new RegExp(`<${tag}\\b`, 'gi'))
  const nextAttribute = matchFinder(text, new RegExp(`\\b${attribute}\\s*=\\s*`, 'gi'))
  const nextGt = charFinder(text, '>')
  const closeDouble = charFinder(text, '"')
  const closeSingle = charFinder(text, "'")
  let cursor = 0
  while (cursor < text.length) {
    const tagMatch = nextTag(cursor)
    if (!tagMatch) return
    const bodyFrom = tagMatch.index + tagMatch[0].length
    const gt = nextGt(bodyFrom) // the tag's own end; -1 = unclosed, the text's end is its limit
    let candidateFrom = bodyFrom
    let emitted = false
    for (;;) {
      const candidate = nextAttribute(candidateFrom)
      // No candidate left in the text, or none before this tag's ">": nothing here, and a later tag cannot do better
      // (its window is a part of this one) until the ">" has passed.
      if (!candidate) return
      if (gt >= 0 && candidate.index >= gt) {
        cursor = gt
        break
      }
      const valueFrom = candidate.index + candidate[0].length
      let end = valueFrom
      let value: string | null = null
      if (valueFrom < text.length) {
        const quote = text[valueFrom]
        if (quote === '"' || quote === "'") {
          const close = (quote === '"' ? closeDouble : closeSingle)(valueFrom + 1)
          if (close >= 0) {
            value = text.slice(valueFrom + 1, close)
            end = close + 1
          }
        }
        if (value === null) {
          // Bare value, up to whitespace or ">"; an unterminated quote falls back to it, quote included.
          while (end < text.length && !BARE_END.test(text[end])) end += 1
          if (end > valueFrom) value = text.slice(valueFrom, end)
        }
      }
      if (value === null) {
        candidateFrom = candidate.index + 1 // nothing readable after this `attribute=`: the tag's next one, if any
        continue
      }
      found(value)
      cursor = end
      emitted = true
      break
    }
    if (!emitted && gt < 0) return
  }
}

/**
 * The links and images a document points at, for the share dialog's warnings. A deliberately simple scan (inline
 * `[..](..)`, `![..](..)`, `<a href>`, `<img src>`; code is skipped): it only decides what to warn about. It runs each time the
 * dialog opens, on a document of up to megabytes, so it is LINEAR on any input: the scanners above replace the regexes of
 * M3, which backtracked quadratically on a line of "[" or on repeated "<a " (see the tests, 256 KB each).
 */
export function scanDocumentRefs(markdown: string): DocumentRefs {
  const text = withoutCode(markdown)
  const refs: DocumentRefs = { internalLinks: [], relativeImages: [], externalImages: [], dataImages: 0 }
  const image = (src: string) => {
    if (/^data:image\//i.test(src)) refs.dataImages += 1
    else if (classifyHref(src) === 'external') refs.externalImages.push(src)
    else if (classifyHref(src) === 'internal') refs.relativeImages.push(src)
  }
  const link = (href: string) => {
    if (classifyHref(href) === 'internal') refs.internalLinks.push(href)
  }
  for (const line of text.split('\n')) {
    if (line.includes('](')) inlineLinks(line, (isImage, target) => (isImage ? image(target) : link(target)))
  }
  if (text.includes('<')) {
    tagAttributes(text, 'a', 'href', link)
    tagAttributes(text, 'img', 'src', image)
  }
  return refs
}

/** Byte length of `text` in UTF-8, without allocating the encoded copy (a snapshot can be megabytes). */
export function utf8Bytes(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        index += 1
      } else bytes += 3
    } else bytes += 3
  }
  return bytes
}

/** A file name as a link title: `.md`/`.markdown`/`.txt` dropped, at most 200 characters. */
export function shareTitleFromName(name: string | null | undefined): string {
  const title = (name ?? '').replace(/\.(md|markdown|txt)$/i, '').trim().slice(0, 200).trim()
  return title || 'Untitled'
}

/** "1.2 MB", "340 KB", "12 bytes" (decimal units, like the 2 MB limit). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, '')} MB`
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`
  return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
}

/** Can this document be shared? `root` is the same folder id on every device (ke-hoach §1.2). */
export function isShareableDocId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id !== 'root' && DOC_ID_RE.test(id)
}
