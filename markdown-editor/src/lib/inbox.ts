/**
 * The hand-off other apps use to open a document here.
 *
 * Gemini Chat and the course notebooks write `markdown-editor:inbox` =
 * `{name, content, at, from}` and open this app with `?import=1`. The document
 * is taken once and the key deleted on the spot, so a reload or React's
 * doubled effects never import it twice.
 */

export const INBOX_KEY = 'markdown-editor:inbox'
/** An inbox left behind (a blocked pop-up, a closed tab) is not opened hours later. */
export const INBOX_MAX_AGE_MS = 10 * 60 * 1000
export const MAX_NAME_LENGTH = 120

export interface InboxDocument {
  name: string
  content: string
  /** Which app sent it, for the toast. */
  from: string
}

/** Read and delete the inbox; null when it is empty, stale or not a document. */
export function takeInbox(now = Date.now()): InboxDocument | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(INBOX_KEY)
    localStorage.removeItem(INBOX_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const { name, content, at, from } = data as Record<string, unknown>
  const sentAt = Number(at)
  // A clock a minute ahead is a skewed clock; further than that is not this hand-off.
  if (typeof content !== 'string' || !sentAt || now - sentAt > INBOX_MAX_AGE_MS || sentAt - now > 60_000) return null
  return { name: fileName(name), content, from: typeof from === 'string' ? from.trim().slice(0, 80) : '' }
}

function fileName(name: unknown): string {
  const base = String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  const named = base || 'imported'
  return /\.(md|markdown)$/i.test(named) ? named : `${named}.md`
}

/** True when the page was opened to take the inbox; the flag leaves the address bar either way. */
export function consumeImportFlag(): boolean {
  const url = new URL(window.location.href)
  if (url.searchParams.get('import') !== '1') return false
  url.searchParams.delete('import')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  return true
}
