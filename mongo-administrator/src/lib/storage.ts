/**
 * Browser-side persistence.
 *
 * The session token lives here so a page reload stays logged in; the password
 * never does — the backend holds the sealed connection string. Everything is
 * wrapped because storage throws in private windows and when site data is
 * blocked.
 */

import type { QueryHistoryEntry, Theme } from '../types'

const TOKEN_KEY = 'mongoadmin.token'
const PROFILE_KEY = 'mongoadmin.lastProfile'
const HISTORY_KEY = 'mongoadmin.history'
const THEME_KEY = 'mongoadmin.theme'
const HISTORY_LIMIT = 50

export interface RememberedProfile {
  mode: 'fields' | 'uri'
  host: string
  port: number
  username: string
  database: string
  authSource: string
  tls: boolean
  srv: boolean
  /** A pasted connection string, with the password stripped out. */
  uri: string
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

/** Strip the password out of a connection string before remembering it. */
export function stripPassword(uri: string): string {
  if (!uri || !uri.includes('@')) return uri || ''
  const [scheme, separator, remainder] = splitScheme(uri)
  if (!separator) return uri
  const at = remainder.lastIndexOf('@')
  if (at === -1) return uri
  const userinfo = remainder.slice(0, at)
  const rest = remainder.slice(at + 1)
  const colon = userinfo.indexOf(':')
  const masked = colon === -1 ? userinfo : userinfo.slice(0, colon)
  return `${scheme}://${masked}@${rest}`
}

function splitScheme(uri: string): [string, boolean, string] {
  const index = uri.indexOf('://')
  if (index === -1) return [uri, false, '']
  return [uri.slice(0, index), true, uri.slice(index + 3)]
}

export const storage = {
  getToken: () => read(TOKEN_KEY),
  setToken: (token: string) => write(TOKEN_KEY, token),
  clearToken: () => remove(TOKEN_KEY),

  /** Connection form pre-fill. Deliberately excludes the password. */
  getProfile: (): RememberedProfile | null => readJson<RememberedProfile | null>(PROFILE_KEY, null),
  setProfile: (profile: RememberedProfile) =>
    write(PROFILE_KEY, JSON.stringify({ ...profile, uri: stripPassword(profile.uri) })),

  getHistory: (): QueryHistoryEntry[] => readJson<QueryHistoryEntry[]>(HISTORY_KEY, []),
  setHistory: (entries: QueryHistoryEntry[]) =>
    write(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT))),
  clearHistory: () => remove(HISTORY_KEY),

  getTheme: (): Theme | null => {
    const value = read(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  },
  setTheme: (theme: Theme) => write(THEME_KEY, theme),
}

export function pushHistory(entries: QueryHistoryEntry[], entry: QueryHistoryEntry): QueryHistoryEntry[] {
  // Re-running the same query moves it to the top instead of duplicating.
  const deduped = entries.filter((item) => !(item.text === entry.text && item.namespace === entry.namespace))
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
