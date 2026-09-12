import { create } from 'zustand'
import type { EditorState, FileNode, Settings, SidebarTab, StorageBackend, ThemePreference, ViewMode } from './types'
import { loadMarkdownFiles, saveMarkdownFiles } from './services/markdownStorage'
import { createId } from './lib/id'
import {
  addNode,
  ancestorIds,
  canMove,
  copyNode as copyNodeInTree,
  findNode,
  findParent,
  getSiblings,
  moveNode as moveNodeInTree,
  removeNode,
  renameNode,
  setNodeContent,
  uniqueName
} from './lib/tree'
import { DEFAULT_SETTINGS, clearLegacyStorage, loadFiles, loadSettings, saveFiles, saveSettings } from './lib/persistence'

const ADMIN_KEY = import.meta.env.VITE_MARKDOWN_ADMIN_KEY || 'markdown-editor-admin-2024'

/** Keystrokes inside this window collapse into a single undo step. */
export const HISTORY_DEBOUNCE_MS = 600
/** Undo depth. Previously unbounded, which grew localStorage without limit. */
export const HISTORY_LIMIT = 200
const AUTOSAVE_DEBOUNCE_MS = 800

const WELCOME = `# Welcome to Markdown Editor

A fast, offline-first editor with live GitHub-flavoured preview.

## Try it out

- **Bold**, *italic*, ~~strikethrough~~ and \`inline code\`
- [ ] Click a checkbox in the preview to tick it off
- [x] Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the command palette

> Drag the divider to resize the panes, or press <kbd>Ctrl</kbd>+<kbd>/</kbd> for shortcuts.

| Feature   | Shortcut       |
| --------- | -------------- |
| Bold      | Ctrl+B         |
| Italic    | Ctrl+I         |
| Link      | Ctrl+K then L  |
| Find      | Ctrl+F         |

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

\`\`\`mermaid
flowchart LR
  Write[Write Markdown] --> Preview[Live preview]
  Preview --> Export[Export PDF / HTML]
\`\`\`

Math works too: $e^{i\\pi} + 1 = 0$
`

interface StoreState extends EditorState {
  setContent: (content: string) => void
  commitHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  setCurrentFile: (fileId: string | null) => void
  setSelectedFolder: (folderId: string | null) => void
  toggleFolder: (folderId: string) => void
  setFolderExpanded: (folderId: string, expanded: boolean) => void
  revealNode: (nodeId: string) => void
  createFile: (parentId: string | null, name: string) => string | null
  createFolder: (parentId: string | null, name: string) => string | null
  deleteNode: (nodeId: string) => void
  renameNode: (nodeId: string, newName: string) => void
  moveNode: (nodeId: string, parentId: string | null) => void
  copyNode: (nodeId: string, parentId: string | null) => void
  importFile: (name: string, content: string) => void

  loginAdmin: (key: string) => boolean
  logout: () => void

  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
  toggleScrollSync: () => void
  setViewMode: (viewMode: ViewMode) => void
  setEditorWidth: (editorWidth: number) => void
  setSidebarWidth: (sidebarWidth: number) => void
  setSidebarTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  toggleFullscreen: () => void
  toggleLineNumbers: () => void
  toggleWordWrap: () => void
  setFontSize: (fontSize: number) => void
  toggleBackendStorage: () => void
  setBackendStorageType: (storageType: StorageBackend) => void

  loadBackendStorage: () => Promise<void>
  saveBackendStorage: () => Promise<void>

  hydrate: () => void
  persist: () => void
  flushPersist: () => void

  pushToast: (message: string, tone?: 'info' | 'success' | 'error') => void
  dismissToast: (id: string) => void
}

const welcomeFile: FileNode = {
  id: 'welcome',
  name: 'welcome.md',
  type: 'file',
  parentId: 'root',
  content: WELCOME
}

const initialState: EditorState = {
  ...DEFAULT_SETTINGS,
  currentContent: WELCOME,
  currentFileId: 'welcome',
  selectedFolderId: 'root',
  expandedFolders: ['root'],
  files: [{ id: 'root', name: 'My Documents', type: 'folder', children: [welcomeFile] }],
  history: [WELCOME],
  historyIndex: 0,
  isAdmin: false,
  fullscreen: false,
  saveState: 'idle',
  lastSavedAt: null,
  toasts: []
}

/** Timers live outside the store so they never end up serialised. */
let historyTimer: ReturnType<typeof setTimeout> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

function settingsOf(state: EditorState): Settings {
  return {
    theme: state.theme,
    scrollSync: state.scrollSync,
    viewMode: state.viewMode,
    editorWidth: state.editorWidth,
    sidebarWidth: state.sidebarWidth,
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarTab: state.sidebarTab,
    showLineNumbers: state.showLineNumbers,
    wordWrap: state.wordWrap,
    fontSize: state.fontSize,
    backendStorage: state.backendStorage,
    backendStorageType: state.backendStorageType
  }
}

export const useEditorStore = create<StoreState>((set, get) => {
  /** Persist on a debounce, then settle the save indicator. */
  const schedulePersist = () => {
    set({ saveState: 'saving' })
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => get().flushPersist(), AUTOSAVE_DEBOUNCE_MS)
  }

  const scheduleHistory = () => {
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(() => get().commitHistory(), HISTORY_DEBOUNCE_MS)
  }

  return {
    ...initialState,

    setContent: (content: string) => {
      const state = get()
      if (content === state.currentContent) return

      set({
        currentContent: content,
        files: state.currentFileId ? setNodeContent(state.files, state.currentFileId, content) : state.files
      })
      scheduleHistory()
      schedulePersist()
    },

    /**
     * Collapses a burst of typing into one undo step. Called on a debounce and
     * flushed eagerly before undo/redo and file switches.
     */
    commitHistory: () => {
      if (historyTimer) {
        clearTimeout(historyTimer)
        historyTimer = null
      }
      const { currentContent, history, historyIndex } = get()
      if (history[historyIndex] === currentContent) return

      const next = [...history.slice(0, historyIndex + 1), currentContent]
      const trimmed = next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
      set({ history: trimmed, historyIndex: trimmed.length - 1 })
    },

    undo: () => {
      get().commitHistory()
      const { history, historyIndex, files, currentFileId } = get()
      if (historyIndex <= 0) return
      const index = historyIndex - 1
      const content = history[index]
      set({
        historyIndex: index,
        currentContent: content,
        files: currentFileId ? setNodeContent(files, currentFileId, content) : files
      })
      schedulePersist()
    },

    redo: () => {
      const { history, historyIndex, files, currentFileId } = get()
      if (historyIndex >= history.length - 1) return
      const index = historyIndex + 1
      const content = history[index]
      set({
        historyIndex: index,
        currentContent: content,
        files: currentFileId ? setNodeContent(files, currentFileId, content) : files
      })
      schedulePersist()
    },

    canUndo: () => {
      const { history, historyIndex, currentContent } = get()
      return historyIndex > 0 || history[historyIndex] !== currentContent
    },

    canRedo: () => get().historyIndex < get().history.length - 1,

    setCurrentFile: (fileId: string | null) => {
      get().commitHistory()
      if (fileId === null) {
        set({ currentFileId: null, currentContent: '', history: [''], historyIndex: 0 })
        return
      }
      const file = findNode(get().files, fileId)
      if (!file || file.type !== 'file') return
      const content = file.content ?? ''
      set({ currentFileId: fileId, currentContent: content, history: [content], historyIndex: 0 })
      get().revealNode(fileId)
      schedulePersist()
    },

    setSelectedFolder: (selectedFolderId) => set({ selectedFolderId }),

    toggleFolder: (folderId) => {
      const expanded = get().expandedFolders
      set({
        expandedFolders: expanded.includes(folderId) ? expanded.filter((id) => id !== folderId) : [...expanded, folderId]
      })
      schedulePersist()
    },

    setFolderExpanded: (folderId, expanded) => {
      const current = get().expandedFolders
      const has = current.includes(folderId)
      if (has === expanded) return
      set({ expandedFolders: expanded ? [...current, folderId] : current.filter((id) => id !== folderId) })
      schedulePersist()
    },

    /** Opens every ancestor folder so a node becomes visible in the tree. */
    revealNode: (nodeId) => {
      const { files, expandedFolders } = get()
      const missing = ancestorIds(files, nodeId).filter((id) => !expandedFolders.includes(id))
      if (missing.length) set({ expandedFolders: [...expandedFolders, ...missing] })
    },

    createFile: (parentId, name) => {
      if (!get().isAdmin) return null
      const trimmed = name.trim()
      if (!trimmed) return null

      const fileName = /\.(md|markdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`
      const node: FileNode = {
        id: createId('file'),
        name: uniqueName(getSiblings(get().files, parentId), fileName),
        type: 'file',
        content: '',
        parentId: parentId ?? undefined
      }

      set({ files: addNode(get().files, node, parentId) })
      if (parentId) get().setFolderExpanded(parentId, true)
      get().setCurrentFile(node.id)
      get().pushToast(`Created ${node.name}`, 'success')
      schedulePersist()
      return node.id
    },

    createFolder: (parentId, name) => {
      if (!get().isAdmin) return null
      const trimmed = name.trim()
      if (!trimmed) return null

      const node: FileNode = {
        id: createId('folder'),
        name: uniqueName(getSiblings(get().files, parentId), trimmed),
        type: 'folder',
        children: [],
        parentId: parentId ?? undefined
      }

      set({ files: addNode(get().files, node, parentId), selectedFolderId: node.id })
      if (parentId) get().setFolderExpanded(parentId, true)
      get().pushToast(`Created ${node.name}`, 'success')
      schedulePersist()
      return node.id
    },

    deleteNode: (nodeId) => {
      const state = get()
      if (!state.isAdmin) return
      const node = findNode(state.files, nodeId)
      if (!node) return

      const files = removeNode(state.files, nodeId)
      set({ files })

      // Dropping the open file, or a folder containing it, clears the editor.
      if (state.currentFileId && !findNode(files, state.currentFileId)) {
        set({ currentFileId: null, currentContent: '', history: [''], historyIndex: 0 })
      }
      if (state.selectedFolderId && !findNode(files, state.selectedFolderId)) {
        set({ selectedFolderId: null })
      }
      get().pushToast(`Deleted ${node.name}`, 'info')
      schedulePersist()
    },

    renameNode: (nodeId, newName) => {
      const state = get()
      if (!state.isAdmin) return
      const trimmed = newName.trim()
      const node = findNode(state.files, nodeId)
      if (!trimmed || !node || trimmed === node.name) return

      const siblings = getSiblings(state.files, findParent(state.files, nodeId)?.id ?? null).filter((item) => item.id !== nodeId)
      set({ files: renameNode(state.files, nodeId, uniqueName(siblings, trimmed)) })
      schedulePersist()
    },

    moveNode: (nodeId, parentId) => {
      const state = get()
      if (!state.isAdmin) return
      if (!canMove(state.files, nodeId, parentId)) return
      set({ files: moveNodeInTree(state.files, nodeId, parentId) })
      if (parentId) get().setFolderExpanded(parentId, true)
      schedulePersist()
    },

    copyNode: (nodeId, parentId) => {
      const state = get()
      if (!state.isAdmin) return
      const files = copyNodeInTree(state.files, nodeId, parentId)
      if (files === state.files) {
        get().pushToast('Cannot copy a folder into itself', 'error')
        return
      }
      set({ files })
      if (parentId) get().setFolderExpanded(parentId, true)
      schedulePersist()
    },

    importFile: (name, content) => {
      const state = get()
      if (!state.isAdmin) {
        // Anonymous visitors can still read an imported file, just not keep it.
        set({ currentContent: content, history: [content], historyIndex: 0, currentFileId: null })
        return
      }
      const parentId = state.selectedFolderId ?? state.files[0]?.id ?? null
      const node: FileNode = {
        id: createId('file'),
        name: uniqueName(getSiblings(state.files, parentId), name),
        type: 'file',
        content,
        parentId: parentId ?? undefined
      }
      set({ files: addNode(state.files, node, parentId) })
      if (parentId) get().setFolderExpanded(parentId, true)
      get().setCurrentFile(node.id)
      get().pushToast(`Imported ${node.name}`, 'success')
      schedulePersist()
    },

    loginAdmin: (key: string) => {
      if (key !== ADMIN_KEY) return false
      set({ isAdmin: true })
      get().pushToast('Admin mode enabled', 'success')
      return true
    },

    logout: () => {
      set({ isAdmin: false })
      get().pushToast('Switched to view-only mode', 'info')
    },

    setTheme: (theme) => {
      set({ theme })
      schedulePersist()
    },

    toggleTheme: () => {
      const { theme } = get()
      const resolved = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
      get().setTheme(resolved === 'dark' ? 'light' : 'dark')
    },

    toggleScrollSync: () => {
      set((state) => ({ scrollSync: !state.scrollSync }))
      schedulePersist()
    },

    setViewMode: (viewMode) => {
      set({ viewMode })
      schedulePersist()
    },

    setEditorWidth: (editorWidth) => {
      set({ editorWidth: clamp(editorWidth, 20, 80) })
      schedulePersist()
    },

    setSidebarWidth: (sidebarWidth) => {
      set({ sidebarWidth: clamp(sidebarWidth, 180, 480) })
      schedulePersist()
    },

    setSidebarTab: (sidebarTab) => {
      set({ sidebarTab, sidebarCollapsed: false })
      schedulePersist()
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      schedulePersist()
    },

    toggleFullscreen: () => set((state) => ({ fullscreen: !state.fullscreen })),

    toggleLineNumbers: () => {
      set((state) => ({ showLineNumbers: !state.showLineNumbers }))
      schedulePersist()
    },

    toggleWordWrap: () => {
      set((state) => ({ wordWrap: !state.wordWrap }))
      schedulePersist()
    },

    setFontSize: (fontSize) => {
      set({ fontSize: clamp(fontSize, 11, 24) })
      schedulePersist()
    },

    toggleBackendStorage: () => {
      set((state) => ({ backendStorage: !state.backendStorage }))
      schedulePersist()
    },

    setBackendStorageType: (backendStorageType) => {
      set({ backendStorageType })
      schedulePersist()
    },

    loadBackendStorage: async () => {
      const files = await loadMarkdownFiles(get().backendStorageType)
      if (!files.length) {
        get().pushToast('Backend returned no files', 'info')
        return
      }
      set({ files, currentFileId: null, currentContent: '', history: [''], historyIndex: 0 })
      get().pushToast('Loaded files from backend', 'success')
      schedulePersist()
    },

    saveBackendStorage: async () => {
      await saveMarkdownFiles(get().files, get().backendStorageType)
      get().pushToast('Saved files to backend', 'success')
    },

    hydrate: () => {
      const settings = loadSettings()
      const stored = loadFiles()
      // isAdmin is deliberately absent: it is never restored from storage.
      set({ ...settings })

      if (stored?.files.length) {
        const current = findNode(stored.files, stored.currentFileId)
        const content = current?.type === 'file' ? current.content ?? '' : ''
        set({
          files: stored.files,
          currentFileId: current?.type === 'file' ? current.id : null,
          currentContent: content,
          history: [content],
          historyIndex: 0,
          expandedFolders: stored.expandedFolders.length ? stored.expandedFolders : [stored.files[0].id],
          selectedFolderId: stored.files[0]?.type === 'folder' ? stored.files[0].id : null
        })
      }
      clearLegacyStorage()
    },

    persist: schedulePersist,

    flushPersist: () => {
      if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      const state = get()
      const okFiles = saveFiles({
        files: state.files,
        currentFileId: state.currentFileId,
        expandedFolders: state.expandedFolders
      })
      const okSettings = saveSettings(settingsOf(state))
      set({ saveState: okFiles && okSettings ? 'saved' : 'error', lastSavedAt: Date.now() })
    },

    pushToast: (message, tone = 'info') => {
      const id = createId('toast')
      set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone }] }))
      setTimeout(() => get().dismissToast(id), 3200)
    },

    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  }
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
}
