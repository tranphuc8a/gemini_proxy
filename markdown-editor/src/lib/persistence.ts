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
  /**
   * True for a boot snapshot (v3): the tree has no file texts but the open document's, which the first frame needs. The
   * rest comes from IndexedDB (a file whose `content` is undefined is "not loaded yet").
   */
  partial?: boolean
  /** v3 only: counts the saves; IndexedDB holds the same counter, so a snapshot ahead of it says IndexedDB lost its last writes. */
  seq?: number
  /** v3 only: the open document as the snapshot saw it (text kept when it fits `SNAPSHOT_TEXT_MAX`). */
  snapshotCurrent?: { id: string; content: string | null } | null
}

/** The open document's text rides in the boot snapshot up to this size; a bigger one waits for IndexedDB. */
export const SNAPSHOT_TEXT_MAX = 512 * 1024

interface SnapshotNode {
  id: string
  name: string
  type: 'file' | 'folder'
  children?: SnapshotNode[]
}

interface SnapshotPayload {
  version: 3
  seq: number
  tree: SnapshotNode[]
  currentFileId: string | null
  expandedFolders: string[]
  current: { id: string; content: string | null } | null
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

/**
 * Why a write did not land: the origin's storage quota is used up, or storage
 * is not usable at all (blocked, private mode). The difference matters: a full
 * quota leaves the *previous* copy in place, which a reload then brings back.
 */
export type StorageFailure = 'quota' | 'unavailable'

/** QuotaExceededError in Chromium/WebKit (code 22), NS_ERROR_DOM_QUOTA_REACHED in Firefox (code 1014). */
export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, code } = error as { name?: unknown; code?: unknown }
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014
}

/** null when the value was stored. */
function writeRaw(key: string, value: unknown): StorageFailure | null {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return null
  } catch (error) {
    return isQuotaError(error) ? 'quota' : 'unavailable'
  }
}

function isFileNodeArray(value: unknown): value is FileNode[] {
  return (
    Array.isArray(value) &&
    value.every((node) => typeof node === 'object' && node !== null && 'id' in node && 'name' in node && 'type' in node)
  )
}

function isSnapshotNodeArray(value: unknown): value is SnapshotNode[] {
  return (
    Array.isArray(value) &&
    value.every((node) => typeof node === 'object' && node !== null && typeof (node as SnapshotNode).id === 'string' && typeof (node as SnapshotNode).name === 'string')
  )
}

/** A snapshot's tree as `FileNode`s: folders with children, files WITHOUT `content` (not loaded), the open file with its text. */
function treeFromSnapshot(nodes: SnapshotNode[], current: SnapshotPayload['current'], parentId?: string): FileNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      return { id: node.id, name: node.name, type: 'folder', parentId, children: treeFromSnapshot(node.children ?? [], current, node.id) }
    }
    const file: FileNode = { id: node.id, name: node.name, type: 'file', parentId }
    if (current && current.id === node.id && current.content !== null) file.content = current.content
    return file
  })
}

export function loadFiles(): FilesPayload | null {
  const stored = readRaw(FILES_KEY) as (Partial<FilesPayload> & Partial<SnapshotPayload>) | null
  if (stored && stored.version === 3 && isSnapshotNodeArray(stored.tree)) {
    const current = stored.current && typeof stored.current.id === 'string' ? stored.current : null
    return {
      version: 2,
      files: treeFromSnapshot(stored.tree, current),
      currentFileId: typeof stored.currentFileId === 'string' ? stored.currentFileId : null,
      expandedFolders: Array.isArray(stored.expandedFolders) ? stored.expandedFolders.filter((id) => typeof id === 'string') : [],
      partial: true,
      seq: typeof stored.seq === 'number' ? stored.seq : 0,
      snapshotCurrent: current
    }
  }
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

/** Stores the whole tree. Returns null on success, otherwise why it failed. */
export function saveFiles(payload: Pick<FilesPayload, 'files' | 'currentFileId' | 'expandedFolders'>): StorageFailure | null {
  return writeRaw(FILES_KEY, { version: 2, ...payload })
}

function stripTree(nodes: FileNode[]): SnapshotNode[] {
  return nodes.map((node) =>
    node.type === 'folder'
      ? { id: node.id, name: node.name, type: 'folder' as const, children: stripTree(node.children ?? []) }
      : { id: node.id, name: node.name, type: 'file' as const }
  )
}

/**
 * The boot snapshot (v3), written instead of the whole tree once the documents live in IndexedDB: the tree without texts,
 * which folder is open, and the open document's text so the first frame is the document and not the welcome page. It
 * replaces the v2 payload under the same key, which frees the localStorage quota the documents used to eat.
 */
export function saveSnapshot(payload: { files: FileNode[]; currentFileId: string | null; expandedFolders: string[]; seq: number; currentContent: string | null }): StorageFailure | null {
  const keep = payload.currentFileId !== null && payload.currentContent !== null && payload.currentContent.length <= SNAPSHOT_TEXT_MAX
  const snapshot: SnapshotPayload = {
    version: 3,
    seq: payload.seq,
    tree: stripTree(payload.files),
    currentFileId: payload.currentFileId,
    expandedFolders: payload.expandedFolders,
    current: payload.currentFileId ? { id: payload.currentFileId, content: keep ? payload.currentContent : null } : null
  }
  return writeRaw(FILES_KEY, snapshot)
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

/** Returns null on success, otherwise why it failed. */
export function saveSettings(settings: Settings): StorageFailure | null {
  return writeRaw(SETTINGS_KEY, settings)
}

export function clearLegacyStorage(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* nothing to clean up */
  }
}
