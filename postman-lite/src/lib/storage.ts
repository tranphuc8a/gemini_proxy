/**
 * Local persistence.
 *
 * Everything the app knows lives in localStorage first, so it works offline and
 * without a workspace; the backend is a sync target on top of that, not a
 * requirement. Reads never throw - a private window, cleared site data or a
 * corrupt value all degrade to defaults rather than a blank screen.
 */

import type { Collection, Environment, RequestSpec, SendMode, WorkspaceLink } from '../types'

const KEYS = {
  STATE: 'postman_pro_state',
  SETTINGS: 'postman_pro_settings',
  WORKSPACE: 'postman_pro_workspace',
}

export interface PersistedState {
  collections: Collection[]
  requests: RequestSpec[]
  environments: Environment[]
  activeEnvironmentId: string | null
  expandedCollections: string[]
}

export interface Settings {
  sendMode: SendMode
  timeoutSeconds: number
  followRedirects: boolean
  withCredentials: boolean
  theme: 'dark' | 'light'
  autoSync: boolean
  historyLimit: number
}

export const DEFAULT_SETTINGS: Settings = {
  sendMode: 'auto',
  timeoutSeconds: 60,
  followRedirects: true,
  withCredentials: false,
  theme: 'dark',
  autoSync: false,
  historyLimit: 100,
}

export const EMPTY_STATE: PersistedState = {
  collections: [],
  requests: [],
  environments: [],
  activeEnvironmentId: null,
  expandedCollections: [],
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Out of quota, or a private window that refuses writes. Losing persistence
    // is survivable; throwing from a keystroke handler is not.
    return false
  }
}

export function loadState(): PersistedState {
  const state = read<Partial<PersistedState>>(KEYS.STATE, {})
  return {
    collections: Array.isArray(state.collections) ? state.collections : [],
    requests: Array.isArray(state.requests) ? state.requests : [],
    environments: Array.isArray(state.environments) ? state.environments : [],
    activeEnvironmentId: typeof state.activeEnvironmentId === 'string' ? state.activeEnvironmentId : null,
    expandedCollections: Array.isArray(state.expandedCollections) ? state.expandedCollections : [],
  }
}

export function saveState(state: PersistedState): boolean {
  return write(KEYS.STATE, state)
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.SETTINGS, {}) }
}

export function saveSettings(settings: Settings): boolean {
  return write(KEYS.SETTINGS, settings)
}

export function loadWorkspace(): WorkspaceLink | null {
  const link = read<WorkspaceLink | null>(KEYS.WORKSPACE, null)
  return link && typeof link.id === 'string' && typeof link.accessKey === 'string' ? link : null
}

export function saveWorkspace(link: WorkspaceLink | null): boolean {
  if (!link) {
    try {
      localStorage.removeItem(KEYS.WORKSPACE)
      return true
    } catch {
      return false
    }
  }
  return write(KEYS.WORKSPACE, link)
}

export function clearAll(): void {
  for (const key of Object.values(KEYS)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* nothing useful to do */
    }
  }
}

export const STORAGE_KEYS = KEYS
