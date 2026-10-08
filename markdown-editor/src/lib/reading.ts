/**
 * Reading mode: its settings, how they persist, and the arithmetic behind the
 * progress bar, the time left and the current-section highlight.
 *
 * Kept free of React and of the DOM so every rule here is unit-tested.
 */

/** Namespaced like the editor's own keys; independent of the editor settings. */
export const READING_KEY = 'markdown-editor:reading'
/** `?read=1` opens the app straight into reading mode. */
export const READ_PARAM = 'read'
/**
 * Prepended to heading ids in reading mode: the preview stays mounted
 * underneath with its own copies, and ids must be unique on the page.
 */
export const READING_ID_PREFIX = 'reading-'

export type ReadingTheme = 'light' | 'sepia' | 'dark'
export type ReadingWidth = 'narrow' | 'medium' | 'wide'

export interface ReadingSettings {
  /** Body text size in px. */
  fontSize: number
  lineHeight: number
  width: ReadingWidth
  theme: ReadingTheme
}

export const READING_FONT = { min: 14, max: 28, step: 1 } as const
export const READING_LINE_HEIGHT = { min: 1.3, max: 2.2 } as const

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 18,
  lineHeight: 1.75,
  width: 'medium',
  theme: 'light'
}

export const LINE_HEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 1.5, label: 'Compact' },
  { value: 1.75, label: 'Normal' },
  { value: 2, label: 'Loose' }
]

/**
 * Column widths in em, so the measure -- characters per line -- stays the same
 * when the text size changes. Medium sits near the classic 65–75 characters.
 */
export const WIDTH_OPTIONS: { value: ReadingWidth; label: string; measure: string }[] = [
  { value: 'narrow', label: 'Narrow', measure: '30em' },
  { value: 'medium', label: 'Medium', measure: '36em' },
  { value: 'wide', label: 'Wide', measure: '46em' }
]

export const THEME_OPTIONS: { value: ReadingTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Dark' }
]

export function isReadingTheme(value: unknown): value is ReadingTheme {
  return THEME_OPTIONS.some((option) => option.value === value)
}

export function isReadingWidth(value: unknown): value is ReadingWidth {
  return WIDTH_OPTIONS.some((option) => option.value === value)
}

export function measureFor(width: ReadingWidth): string {
  return (WIDTH_OPTIONS.find((option) => option.value === width) ?? WIDTH_OPTIONS[1]).measure
}

/** Whole pixels inside the supported range; anything unusable falls back to the default. */
export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_READING_SETTINGS.fontSize
  return Math.min(READING_FONT.max, Math.max(READING_FONT.min, Math.round(value)))
}

export function clampLineHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_READING_SETTINGS.lineHeight
  const clamped = Math.min(READING_LINE_HEIGHT.max, Math.max(READING_LINE_HEIGHT.min, value))
  return Math.round(clamped * 100) / 100
}

/**
 * Builds valid settings out of whatever storage held. Each field is checked on
 * its own, so one bad value does not throw away the reader's other choices.
 */
export function normalizeReadingSettings(raw: unknown, fallback: ReadingSettings = DEFAULT_READING_SETTINGS): ReadingSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    fontSize: typeof source.fontSize === 'number' ? clampFontSize(source.fontSize) : fallback.fontSize,
    lineHeight: typeof source.lineHeight === 'number' ? clampLineHeight(source.lineHeight) : fallback.lineHeight,
    width: isReadingWidth(source.width) ? source.width : fallback.width,
    theme: isReadingTheme(source.theme) ? source.theme : fallback.theme
  }
}

/**
 * Stored settings, or the defaults. `fallbackTheme` only applies until the
 * reader picks a theme of their own; after that the choice is kept.
 */
export function loadReadingSettings(fallbackTheme: ReadingTheme = DEFAULT_READING_SETTINGS.theme): ReadingSettings {
  const fallback: ReadingSettings = { ...DEFAULT_READING_SETTINGS, theme: fallbackTheme }
  try {
    const raw = localStorage.getItem(READING_KEY)
    return normalizeReadingSettings(raw ? JSON.parse(raw) : null, fallback)
  } catch {
    // Unparsable, or storage is off (private mode): reading still works.
    return fallback
  }
}

export function saveReadingSettings(settings: ReadingSettings): boolean {
  try {
    localStorage.setItem(READING_KEY, JSON.stringify({ version: 1, ...normalizeReadingSettings(settings) }))
    return true
  } catch {
    return false
  }
}

/**
 * How far through the document the reader is, from 0 to 1. A document that
 * fits on one screen has nothing left below it, so it counts as fully read.
 */
export function readingProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  if (!(scrollHeight > 0)) return 0
  const scrollable = scrollHeight - clientHeight
  if (scrollable <= 1) return 1
  return Math.min(1, Math.max(0, scrollTop / scrollable))
}

/** Whole minutes still to read, rounded up; zero only once the end is reached. */
export function minutesLeft(totalMinutes: number, progress: number): number {
  if (progress >= 0.995) return 0
  return Math.max(1, Math.ceil(totalMinutes * (1 - Math.max(0, progress))))
}

export function readingTimeLabel(totalMinutes: number, progress: number, scrollable: boolean): string {
  const total = `${totalMinutes} min read`
  if (!scrollable) return total
  const left = minutesLeft(totalMinutes, progress)
  return left === 0 ? `${total} · finished` : `${total} · ${left} min left`
}

/**
 * The section being read: the last heading whose top has scrolled past
 * `position` (an offset into the scroll container). -1 before the first one.
 * At the very end the last heading wins, even if it never reaches the line.
 */
export function activeHeadingIndex(tops: number[], position: number, atEnd = false): number {
  if (tops.length === 0) return -1
  if (atEnd) return tops.length - 1
  let active = -1
  tops.forEach((top, index) => {
    if (top <= position) active = index
  })
  return active
}

/**
 * Ctrl+Alt+V (⌘⌥V on a Mac) toggles reading mode.
 *
 * Chosen to stay clear of the editor's own bindings and of the browsers':
 * Ctrl+Alt+R is Firefox's Reader View, F9 is Edge's Immersive Reader, and
 * Ctrl+Shift+V pastes as plain text. HackMD uses the same chord for its view
 * mode. The key is matched by character, not position, so an AltGr layout
 * that types a character on AltGr+V (e.g. "@" in Czech) keeps typing it;
 * on a Mac, where Option changes the character, the physical key is used.
 */
export function isReadingShortcut(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): boolean {
  if (!event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) return false
  return event.key.toLowerCase() === 'v' || (event.metaKey && event.code === 'KeyV')
}

const TRUTHY = new Set(['1', 'true', 'yes', ''])

export function hasReadFlag(href: string): boolean {
  try {
    const value = new URL(href).searchParams.get(READ_PARAM)
    return value !== null && TRUTHY.has(value.toLowerCase())
  } catch {
    return false
  }
}

/** The same address with the reading flag set or removed, as a path for history.replaceState. */
export function withReadFlag(href: string, on: boolean): string {
  const url = new URL(href)
  if (on) url.searchParams.set(READ_PARAM, '1')
  else url.searchParams.delete(READ_PARAM)
  return url.pathname + url.search + url.hash
}

/**
 * Keeps the address bar in step with reading mode, so a reload stays in it and
 * a copied link opens in it. Never adds a history entry.
 */
export function syncReadFlag(on: boolean): void {
  if (typeof window === 'undefined') return
  if (hasReadFlag(window.location.href) === on) return
  try {
    window.history.replaceState(window.history.state, '', withReadFlag(window.location.href, on))
  } catch {
    /* a sandboxed frame may refuse; the mode itself still works */
  }
}
