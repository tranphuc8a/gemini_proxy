import type { Layout, Pane } from './lib/responsive'
import type { StorageFailure } from './lib/persistence'
import type { SyncState } from './sync/engine'

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  content?: string
  children?: FileNode[]
  parentId?: string
}

export type ViewMode = 'split' | 'editor' | 'preview'
export type ThemePreference = 'light' | 'dark' | 'system'
export type SidebarTab = 'files' | 'outline'
export type StorageBackend = 'json' | 'mysql' | 'mongo'
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'success' | 'error'
}

/** Everything that survives a reload, minus the auth flag. */
export interface Settings {
  theme: ThemePreference
  scrollSync: boolean
  viewMode: ViewMode
  editorWidth: number
  sidebarWidth: number
  sidebarCollapsed: boolean
  sidebarTab: SidebarTab
  showLineNumbers: boolean
  wordWrap: boolean
  fontSize: number
  backendStorage: boolean
  backendStorageType: StorageBackend
}

export interface EditorState extends Settings {
  currentContent: string
  currentFileId: string | null
  selectedFolderId: string | null
  expandedFolders: string[]
  files: FileNode[]
  history: string[]
  historyIndex: number
  isAdmin: boolean
  fullscreen: boolean
  saveState: SaveState
  lastSavedAt: number | null
  toasts: Toast[]
  /**
   * Responsive state. Deliberately not part of Settings: it describes this
   * screen right now, not a preference worth carrying to the next visit.
   */
  layout: Layout
  /** The sidebar as an off-canvas drawer, below desktop width. */
  drawerOpen: boolean
  /** Which pane a phone shows in the split view; null until the reader picks one. */
  phonePane: Pane | null
  /** The AI "smart format" dialog: null when closed, else the selection it was opened with. */
  smartFormat: { start: number; end: number } | null
  /** Why the last local save failed, or null once one succeeds; 'quota' raises the red banner. */
  storageFailure: StorageFailure | null
  /** What that failed save was: the documents, or only the settings (the documents were written). */
  storageFailureScope: 'documents' | 'settings' | null
  /**
   * False from start-up until the documents have been read from the device store (IndexedDB): the open document is on
   * screen already (from the boot snapshot), the rest is not, and nothing may be edited meanwhile.
   */
  docsReady: boolean
  /** The sync engine's state (idle until Backend sync is switched on). */
  sync: SyncState
}
