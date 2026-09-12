import type { FileNode, Settings } from '../types'
import { normalizeTree } from './tree'

export const FILES_KEY = 'markdown-editor:files'
export const SETTINGS_KEY = 'markdown-editor:settings'
/** Pre-1.1 builds stored the whole store, admin flag included, under one key. */
export const LEGACY_KEY = 'markdown-editor-data'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  scrollSync: true,
  viewMode: 'split',
  editorWidth: 50,
  sidebarWidth: 260,
  sidebarCollapsed: false,
  sidebarTab: 'files',
  showLineNumbers: true,
  wordWrap: true,
  fontSize: 14,
  backendStorage: false,
  backendStorageType: 'json'
}

interface FilesPayload {
  version: 2
  files: FileNode[]
  currentFileId: string | null
  expandedFolders: string[]
}

/** localStorage throws in private mode and when the quota is exhausted. */
function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeRaw(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function isFileNodeArray(value: unknown): value is FileNode[] {
  return (
    Array.isArray(value) &&
    value.every((node) => typeof node === 'object' && node !== null && 'id' in node && 'name' in node && 'type' in node)
  )
}

export function loadFiles(): FilesPayload | null {
  const stored = readRaw(FILES_KEY) as Partial<FilesPayload> | null
  if (stored && isFileNodeArray(stored.files)) {
    return {
      version: 2,
      files: normalizeTree(stored.files),
      currentFileId: typeof stored.currentFileId === 'string' ? stored.currentFileId : null,
      expandedFolders: Array.isArray(stored.expandedFolders) ? stored.expandedFolders.filter((id) => typeof id === 'string') : []
    }
  }

  const legacy = readRaw(LEGACY_KEY) as Record<string, unknown> | null
  if (legacy && isFileNodeArray(legacy.files)) {
    return {
      version: 2,
      files: normalizeTree(legacy.files),
      currentFileId: typeof legacy.currentFileId === 'string' ? legacy.currentFileId : null,
      expandedFolders: []
    }
  }

  return null
}

export function saveFiles(payload: Omit<FilesPayload, 'version'>): boolean {
  return writeRaw(FILES_KEY, { version: 2, ...payload })
}

export function loadSettings(): Settings {
  const stored = (readRaw(SETTINGS_KEY) ?? readRaw(LEGACY_KEY)) as Partial<Settings> | null
  if (!stored) return { ...DEFAULT_SETTINGS }

  // Older builds had `isDarkMode` instead of a three-way theme preference.
  const legacyDark = (stored as { isDarkMode?: boolean }).isDarkMode
  const theme = stored.theme ?? (legacyDark === undefined ? undefined : legacyDark ? 'dark' : 'light')

  return {
    ...DEFAULT_SETTINGS,
    ...pickKnown(stored),
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_SETTINGS.theme
  }
}

/** Drops unknown keys so a tampered payload cannot inject state such as isAdmin. */
function pickKnown(stored: Partial<Settings>): Partial<Settings> {
  const result: Partial<Settings> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = stored[key]
    if (value !== undefined && typeof value === typeof DEFAULT_SETTINGS[key]) {
      Object.assign(result, { [key]: value })
    }
  }
  return result
}

export function saveSettings(settings: Settings): boolean {
  return writeRaw(SETTINGS_KEY, settings)
}

export function clearLegacyStorage(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* nothing to clean up */
  }
}
