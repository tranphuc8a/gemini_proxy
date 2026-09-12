/**
 * Browser-side persistence.
 *
 * The session token lives here so a page reload stays logged in; the password
 * never does — the backend holds the sealed credential. Everything is wrapped
 * because storage throws in private windows and when site data is blocked.
 */

import type { QueryHistoryEntry } from '../types'

const TOKEN_KEY = 'sqladmin.token'
const PROFILE_KEY = 'sqladmin.lastProfile'
const HISTORY_KEY = 'sqladmin.history'
const THEME_KEY = 'sqladmin.theme'
const HISTORY_LIMIT = 50

export interface RememberedProfile {
  host: string
  port: number
  username: string
  database: string
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the app still works for this session */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = read(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const storage = {
  getToken: () => read(TOKEN_KEY),
  setToken: (token: string) => write(TOKEN_KEY, token),
  clearToken: () => remove(TOKEN_KEY),

  /** Connection form pre-fill. Deliberately excludes the password. */
  getProfile: (): RememberedProfile | null => readJson<RememberedProfile | null>(PROFILE_KEY, null),
  setProfile: (profile: RememberedProfile) => write(PROFILE_KEY, JSON.stringify(profile)),

  getHistory: (): QueryHistoryEntry[] => readJson<QueryHistoryEntry[]>(HISTORY_KEY, []),
  setHistory: (entries: QueryHistoryEntry[]) =>
    write(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT))),
  clearHistory: () => remove(HISTORY_KEY),

  getTheme: (): 'light' | 'dark' | null => {
    const value = read(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  },
  setTheme: (theme: 'light' | 'dark') => write(THEME_KEY, theme),
}

export function pushHistory(entries: QueryHistoryEntry[], entry: QueryHistoryEntry): QueryHistoryEntry[] {
  // Re-running the same statement moves it to the top instead of duplicating.
  const deduped = entries.filter((item) => item.sql !== entry.sql)
  return [entry, ...deduped].slice(0, HISTORY_LIMIT)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}
