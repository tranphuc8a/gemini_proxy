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
}
