import { create } from 'zustand'
import type { EditorState, FileNode, Settings, SidebarTab, StorageBackend, ThemePreference, ViewMode } from './types'
import {
  adminSessionHeaders,
  clearAdminCredentials,
  recheckAdminSession,
  restoreAdminSession as restoreStoredSession,
  verifyAdminKey
} from './services/markdownStorage'
import { createHttpSyncApi } from './services/markdownSync'
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
import {
  DEFAULT_SETTINGS,
  clearLegacyStorage,
  loadFiles,
  loadSettings,
  saveSettings,
  saveSnapshot,
  type StorageFailure
} from './lib/persistence'
import { LocalStorageDocStore, openIdbDocStore, type DocStore } from './sync/docStore'
import { SyncEngine, type ConflictInfo, type ReconcileChoice, type ReplaceInfo, type SyncState } from './sync/engine'
import { buildTree, treeToDocs, type LocalDoc, type OutboxEntry } from './sync/records'
import { Workspace, reconcileBoot, type WorkspaceHost } from './sync/workspace'
import type { InboxDocument } from './lib/inbox'
import type { Layout, Pane } from './lib/responsive'
import { readEditorSelection } from './lib/editorSelection'
import { WELCOME } from './lib/welcome'

/** Keystrokes inside this window collapse into a single undo step. */
export const HISTORY_DEBOUNCE_MS = 600
/** Undo depth. Previously unbounded, which grew localStorage without limit. */
export const HISTORY_LIMIT = 200
const AUTOSAVE_DEBOUNCE_MS = 800

interface StoreState extends EditorState {
  setContent: (content: string) => void
  commitHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  /** Opens the AI smart-format dialog on the editor's current selection (admins only: it edits the document). */
  openSmartFormat: () => void
  closeSmartFormat: () => void

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
  /** A document handed over by another app (see lib/inbox). */
  importInbox: (doc: InboxDocument) => void

  loginAdmin: (key: string) => Promise<boolean>
  restoreAdminSession: () => Promise<void>
  logout: () => void

  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
  toggleScrollSync: () => void
  setViewMode: (viewMode: ViewMode) => void
  setEditorWidth: (editorWidth: number) => void
  setSidebarWidth: (sidebarWidth: number) => void
  setSidebarTab: (tab: SidebarTab) => void
  /** Collapses the docked sidebar on desktop; opens or closes the drawer below it. */
  toggleSidebar: () => void
  setLayout: (layout: Layout) => void
  setDrawerOpen: (open: boolean) => void
  setPhonePane: (pane: Pane) => void
  toggleFullscreen: () => void
  toggleLineNumbers: () => void
  toggleWordWrap: () => void
  setFontSize: (fontSize: number) => void
  toggleBackendStorage: () => void
  setBackendStorageType: (storageType: StorageBackend) => void

  /** Backend sync (md-sync): starts or stops the engine to match the Backend sync setting, and the actions of its menu. */
  startSync: () => Promise<void>
  stopSync: () => void
  syncNow: () => Promise<void>
  resolveConflict: (id: string, choice: 'mine' | 'server' | 'both') => Promise<void>
  resolveReconcile: (choice: ReconcileChoice) => void
  retryBlocked: (id?: string) => Promise<void>
  /** "Replace this device's copy with the server's": the server's documents become the workspace (unsent edits are lost). */
  replaceFromServer: (confirm?: (info: ReplaceInfo) => boolean | Promise<boolean>) => Promise<boolean>

  /** Settles once the stored admin session has been re-checked. */
  hydrate: () => Promise<void>
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
  toasts: [],
  layout: 'desktop',
  drawerOpen: false,
  phonePane: null,
  smartFormat: null,
  storageFailure: null,
  storageFailureScope: null,
  docsReady: true,
  sync: { phase: 'off', pending: 0, lastSync: null, error: null, conflicts: [], blocked: [], reconcile: null, readOnly: false }
}

/** Timers live outside the store so they never end up serialised. */
let historyTimer: ReturnType<typeof setTimeout> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

let watchingConnection = false

/**
 * An installed copy can start with no network and trust the stored admin token (see
 * `restoreAdminSession` in the storage service). When the connection comes back, settle it: a
 * token the server now rejects ends admin mode, anything else -- including a server that still
 * does not answer -- leaves the owner where they were.
 */
function watchConnection() {
  if (watchingConnection || typeof window === 'undefined') return
  watchingConnection = true
  window.addEventListener('online', () => {
    if (!useEditorStore.getState().isAdmin) return
    void recheckAdminSession().then((result) => {
      if (result !== 'rejected') return
      useEditorStore.setState({ isAdmin: false })
      useEditorStore.getState().pushToast('Admin session expired — switched to view-only mode', 'info')
    })
  })
}

/** How the documents are kept on this device: IndexedDB, the localStorage fallback, still opening, or unusable (blocked). */
type DocsMode = 'none' | 'pending' | 'idb' | 'local' | 'blocked'

let workspace: Workspace | null = null
let docsMode: DocsMode = 'none'
let engine: SyncEngine | null = null
/** Inside `flushPersist`'s synchronous section: a write's outcome is read there, not announced. */
let flushing = false
/** Outcome of the last document write seen by the host: undefined = none yet, null = stored, else why not. */
let docsFailure: StorageFailure | null | undefined
let lastSettingsFailure: StorageFailure | null = null
/** The same for the boot snapshot: a later IndexedDB write that succeeds (the sync engine's) must not clear a quota banner it knows nothing about. */
let lastSnapshotFailure: StorageFailure | null = null
/** A file picked before the documents had loaded: opened as soon as they have. */
let pendingOpen: string | null = null

/** Tests: the way the device store is opened (IndexedDB when null and the browser has it). */
let storeOpener: (() => Promise<DocStore>) | null = null

/** Test hook: replaces how the device store is opened, so the IndexedDB path can run without IndexedDB. */
export function setDocStoreOpener(open: (() => Promise<DocStore>) | null): void {
  storeOpener = open
}

const DEVICE_KEY = 'markdown-editor:device'
let sessionDevice: string | null = null

function randomToken(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? crypto.getRandomValues(new Uint8Array(length)) : null
  let out = ''
  for (let index = 0; index < length; index += 1) out += alphabet[(bytes ? bytes[index] : Math.floor(Math.random() * 256)) % alphabet.length]
  return out
}

/** This browser's name for the server (`md-` + 10 characters), kept in localStorage; a blocked storage gives one per page load. */
function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY)
    if (stored && /^md-[a-z0-9]{6,32}$/.test(stored)) return stored
    const id = `md-${randomToken(10)}`
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    sessionDevice ??= `md-${randomToken(10)}`
    return sessionDevice
  }
}

function sameDocs(a: LocalDoc[], b: LocalDoc[]): boolean {
  if (a.length !== b.length) return false
  const byId = new Map(b.map((doc) => [doc.id, doc]))
  return a.every((doc) => {
    const other = byId.get(doc.id)
    return !!other && other.kind === doc.kind && other.parentId === doc.parentId && other.name === doc.name && other.content === doc.content
  })
}

const SYNC_OFF: SyncState = { phase: 'off', pending: 0, lastSync: null, error: null, conflicts: [], blocked: [], reconcile: null, readOnly: false }

export type { ConflictInfo }

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
    // Only when it changes: a second store update on every keystroke re-ran every subscriber for nothing.
    if (get().saveState !== 'saving') set({ saveState: 'saving' })
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => get().flushPersist(), AUTOSAVE_DEBOUNCE_MS)
  }

  const scheduleHistory = () => {
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(() => get().commitHistory(), HISTORY_DEBOUNCE_MS)
  }

  // ---- the documents on this device (md-sync F4) ---------------------------------------------------------------------

  /** The editor side of the workspace bridge: what the tree is, and what to do when a write finishes or a remote change lands. */
  const host: WorkspaceHost = {
    files: () => get().files,
    view: () => ({ currentFileId: get().currentFileId, expandedFolders: get().expandedFolders }),
    applyRemote: (docs, changed) => applyRemoteDocs(docs, changed),
    onWrite: (failure) => {
      docsFailure = failure
      if (!flushing) settleWrite(failure)
    },
    now: () => Date.now()
  }

  /** A write finished outside `flushPersist` (an IndexedDB commit, or one the sync engine made): settle the save indicator. */
  const settleWrite = (failure: StorageFailure | null) => {
    if (!get().docsReady || persistTimer) return
    if (failure) {
      set({ saveState: 'error', storageFailure: failure, storageFailureScope: 'documents' })
      return
    }
    const rest = lastSettingsFailure ?? lastSnapshotFailure
    set({ saveState: rest ? 'error' : 'saved', lastSavedAt: Date.now(), storageFailure: rest, storageFailureScope: rest ? 'settings' : null })
  }

  /** Shows what the sync engine just wrote: the tree from the records, and the open document if another device changed it. */
  const applyRemoteDocs = (docs: ReadonlyMap<string, LocalDoc>, changed: ReadonlySet<string>) => {
    const state = get()
    const files = buildTree(docs.values())
    const patch: Partial<StoreState> = { files }
    const id = state.currentFileId
    if (id) {
      const node = findNode(files, id)
      if (!node || node.type !== 'file') {
        patch.currentFileId = null
        patch.currentContent = ''
        patch.history = ['']
        patch.historyIndex = 0
        get().pushToast('The open document was deleted on another device', 'info')
      } else if (changed.has(id) && (node.content ?? '') !== state.currentContent) {
        const content = node.content ?? ''
        patch.currentContent = content
        patch.history = [content]
        patch.historyIndex = 0
        get().pushToast('Updated from another device', 'info')
      }
    }
    if (state.selectedFolderId && !findNode(files, state.selectedFolderId)) patch.selectedFolderId = null
    set(patch)
    schedulePersist()
  }

  /** The documents are in hand (from IndexedDB, or the fallback): bring the editor up to date and start syncing if it was on. */
  const adopt = (store: DocStore, mode: 'idb' | 'local', docs: LocalDoc[], outbox: OutboxEntry[], seq: number, keepLiveTree: boolean) => {
    workspace = new Workspace(store, host, docs, outbox, seq)
    docsMode = mode
    if (!keepLiveTree) {
      const state = get()
      const files = buildTree(docs)
      const id = state.currentFileId
      const node = id ? findNode(files, id) : null
      const patch: Partial<StoreState> = { files, docsReady: true }
      if (id && node?.type === 'file') {
        patch.currentContent = node.content ?? ''
        patch.history = [node.content ?? '']
        patch.historyIndex = 0
      } else if (id) {
        patch.currentFileId = null
        patch.currentContent = ''
        patch.history = ['']
        patch.historyIndex = 0
      }
      if (state.selectedFolderId && !findNode(files, state.selectedFolderId)) patch.selectedFolderId = files[0]?.type === 'folder' ? files[0].id : null
      set(patch)
    } else {
      set({ docsReady: true })
    }
    // Replaces the v2 payload by the boot snapshot (only now that the documents are known to be safe in the store).
    get().flushPersist()
    if (pendingOpen !== null) {
      const open = pendingOpen
      pendingOpen = null
      get().setCurrentFile(open)
    }
    if (get().backendStorage) void get().startSync()
  }

  const startLocal = (stored: ReturnType<typeof loadFiles>) => {
    const store = new LocalStorageDocStore(stored && !stored.partial ? stored : null)
    const loaded = store.loadSync()
    adopt(store, 'local', loaded.docs, loaded.outbox, Number(loaded.meta.seq ?? 0), true)
  }

  /** IndexedDB would not open (or gave back something else): keep working on the older storage -- unless the snapshot says the documents are in IndexedDB. */
  const fallBack = (stored: ReturnType<typeof loadFiles>) => {
    if (stored?.partial) {
      docsMode = 'blocked'
      set({ docsReady: false, saveState: 'error', storageFailure: 'unavailable', storageFailureScope: 'documents' })
      get().pushToast("Your documents are kept in this browser's database, which cannot be opened right now (a private window?). Reload to try again.", 'error')
      return
    }
    startLocal(stored)
  }

  const bootFromIdb = async (store: DocStore, stored: ReturnType<typeof loadFiles>) => {
    const loaded = await store.load()
    const storedSeq = Number(loaded.meta.seq ?? 0)
    let docs = loaded.docs
    let seq = storedSeq
    if (!docs.length && loaded.meta.seq === undefined && stored && !stored.partial && stored.files.length) {
      // First run on IndexedDB: copy the v2 workspace over and read it back before anything is replaced.
      const fromLocal = treeToDocs(stored.files, Date.now())
      await store.commit({ docs: { put: fromLocal }, meta: { seq: 1, migratedFromLocalStorage: { at: Date.now(), count: fromLocal.length } } })
      const back = await store.load()
      if (!sameDocs(fromLocal, back.docs)) throw new Error('IndexedDB did not give back what was written')
      docs = back.docs
      seq = 1
    } else if (stored?.partial) {
      const result = reconcileBoot(docs, storedSeq, { files: stored.files, seq: stored.seq ?? 0, current: stored.snapshotCurrent ?? null }, Date.now())
      if (result.rewrite) {
        const keep = new Set(result.docs.map((doc) => doc.id))
        await store.commit({ docs: { put: result.docs, delete: docs.filter((doc) => !keep.has(doc.id)).map((doc) => doc.id) }, meta: { seq: stored.seq ?? 0 } })
        docs = result.docs
        seq = stored.seq ?? 0
      }
    }
    adopt(store, 'idb', docs, loaded.outbox, seq, docs.length === 0)
  }

  const openWorkspace = (stored: ReturnType<typeof loadFiles>) => {
    engine?.stop()
    engine = null
    workspace = null
    const open = storeOpener ?? (typeof indexedDB === 'undefined' ? null : openIdbDocStore)
    if (!open) {
      // No IndexedDB here: the older storage -- unless the snapshot says the documents were kept in IndexedDB before.
      fallBack(stored)
      return
    }
    docsMode = 'pending'
    set({ docsReady: false })
    open()
      .then(async (store) => {
        try {
          await bootFromIdb(store, stored)
        } catch (error) {
          store.close()
          throw error
        }
      })
      .catch(() => fallBack(stored))
  }

  /** A workspace for a store that was never hydrated (a flush before `hydrate`): the localStorage fallback, starting empty. */
  const ensureWorkspace = (): Workspace | null => {
    if (workspace) return workspace
    if (docsMode === 'pending' || docsMode === 'blocked') return null
    const store = new LocalStorageDocStore(null)
    const loaded = store.loadSync()
    workspace = new Workspace(store, host, loaded.docs, loaded.outbox, Number(loaded.meta.seq ?? 0))
    docsMode = 'local'
    return workspace
  }

  const startSync = async () => {
    if (engine || (docsMode !== 'idb' && docsMode !== 'local') || !workspace) return
    const type = get().backendStorageType
    const created: SyncEngine = new SyncEngine({
      api: createHttpSyncApi({ backend: type, headers: () => adminSessionHeaders() }),
      ws: workspace,
      backend: type,
      deviceId: getDeviceId(),
      canWrite: () => get().isAdmin,
      onState: (sync) => {
        if (engine === created) set({ sync })
      },
      notify: (message, tone) => get().pushToast(message, tone),
      onCancel: () => {
        engine = null
        set({ backendStorage: false, sync: SYNC_OFF })
        schedulePersist()
      },
      onAuthProblem: () => {
        void recheckAdminSession().then((result) => {
          if (result !== 'rejected') return
          set({ isAdmin: false })
          get().pushToast('Admin session expired — switched to view-only mode', 'info')
        })
      }
    })
    engine = created
    created.start()
  }

  const stopSync = () => {
    engine?.stop()
    engine = null
    set({ sync: SYNC_OFF })
  }

  /** The cursor and the shadows belong to one storage: a different one starts again from the first meeting. */
  const switchBackend = async (type: StorageBackend) => {
    const running = engine !== null
    stopSync()
    set({ backendStorageType: type })
    schedulePersist()
    if (workspace) await workspace.wipeSync()
    if (running) await startSync()
  }

  return {
    ...initialState,

    setContent: (content: string) => {
      const state = get()
      if (content === state.currentContent) return
      // Until the documents have loaded the tree is a skeleton: an edit now would be written over the real text.
      if (!state.docsReady) return

      set({
        currentContent: content,
        files: state.currentFileId ? setNodeContent(state.files, state.currentFileId, content) : state.files
      })
      scheduleHistory()
      schedulePersist()
    },

    openSmartFormat: () => {
      if (!get().isAdmin) return
      const selection = readEditorSelection()
      set({ smartFormat: selection ?? { start: 0, end: 0 } })
    },

    closeSmartFormat: () => set({ smartFormat: null }),

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
      if (!get().docsReady) {
        pendingOpen = fileId
        return
      }
      get().commitHistory()
      // Picking a file from the drawer is the end of the errand: show the file.
      if (get().drawerOpen) set({ drawerOpen: false })
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
      if (!get().isAdmin || !get().docsReady) return null
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
      if (!get().isAdmin || !get().docsReady) return null
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
      if (!state.isAdmin || !state.docsReady) return
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
      if (!state.isAdmin || !state.docsReady) return
      const trimmed = newName.trim()
      const node = findNode(state.files, nodeId)
      if (!trimmed || !node || trimmed === node.name) return

      const siblings = getSiblings(state.files, findParent(state.files, nodeId)?.id ?? null).filter((item) => item.id !== nodeId)
      set({ files: renameNode(state.files, nodeId, uniqueName(siblings, trimmed)) })
      schedulePersist()
    },

    moveNode: (nodeId, parentId) => {
      const state = get()
      if (!state.isAdmin || !state.docsReady) return
      if (!canMove(state.files, nodeId, parentId)) return
      set({ files: moveNodeInTree(state.files, nodeId, parentId) })
      if (parentId) get().setFolderExpanded(parentId, true)
      schedulePersist()
    },

    copyNode: (nodeId, parentId) => {
      const state = get()
      if (!state.isAdmin || !state.docsReady) return
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

    importInbox: (doc) => {
      get().importFile(doc.name, doc.content)
      if (!get().isAdmin) {
        const from = doc.from ? ` from ${doc.from}` : ''
        get().pushToast(`Opened ${doc.name}${from} — sign in as admin to keep it`, 'info')
      }
    },

    loginAdmin: async (key: string) => {
      // The backend decides. Comparing against a key held in the browser proved
      // nothing, and required shipping that key to every visitor. On success it
      // hands back a session token, which is what survives the next reload.
      const accepted = await verifyAdminKey(key)
      if (!accepted) return false
      set({ isAdmin: true })
      get().pushToast('Admin mode enabled', 'success')
      engine?.refresh()
      return true
    },

    restoreAdminSession: async () => {
      // Silent on failure: arriving without a valid session is the normal case,
      // not something to interrupt the user about.
      if (await restoreStoredSession()) {
        set({ isAdmin: true })
        engine?.refresh()
      }
    },

    logout: () => {
      clearAdminCredentials()
      set({ isAdmin: false })
      get().pushToast('Switched to view-only mode', 'info')
      engine?.refresh()
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
      // Below desktop the sidebar is a drawer, and the docked preference is left
      // alone so the desktop layout comes back exactly as it was.
      if (get().layout !== 'desktop') set({ sidebarTab, drawerOpen: true })
      else set({ sidebarTab, sidebarCollapsed: false })
      schedulePersist()
    },

    toggleSidebar: () => {
      if (get().layout !== 'desktop') {
        set((state) => ({ drawerOpen: !state.drawerOpen }))
        return
      }
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      schedulePersist()
    },

    setLayout: (layout) => {
      if (layout === get().layout) return
      // The drawer is a small-screen affordance; it never survives into desktop,
      // and a phone always starts with it closed.
      set({ layout, drawerOpen: false })
    },

    setDrawerOpen: (drawerOpen) => {
      if (drawerOpen === get().drawerOpen) return
      set({ drawerOpen: drawerOpen && get().layout !== 'desktop' })
    },

    setPhonePane: (phonePane) => set({ phonePane }),

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
      const next = !get().backendStorage
      set({ backendStorage: next })
      schedulePersist()
      if (next) void startSync()
      else stopSync()
    },

    setBackendStorageType: (backendStorageType) => {
      if (backendStorageType === get().backendStorageType) return
      void switchBackend(backendStorageType)
    },

    startSync,
    stopSync,

    syncNow: async () => {
      if (!engine) return
      // What was typed a moment ago is part of this sync.
      get().flushPersist()
      await engine.syncNow()
    },

    resolveConflict: async (id, choice) => {
      if (!engine) return
      await engine.resolveConflict(id, choice)
    },

    resolveReconcile: (choice) => engine?.resolveReconcile(choice),

    retryBlocked: async (id) => {
      if (!engine) return
      await engine.retryBlocked(id)
    },

    replaceFromServer: async (confirm) => {
      if (!engine) throw new Error('Switch Backend sync on first')
      const replaced = await engine.replaceFromServer(confirm)
      if (replaced) get().pushToast("This device now holds the server's documents", 'success')
      return replaced
    },

    hydrate: () => {
      const settings = loadSettings()
      const stored = loadFiles()
      // isAdmin is deliberately absent: it is never restored from storage.
      set({ ...settings })
      // Admin mode is not read from storage -- it is re-proved against the
      // backend, which is what makes an expired or revoked session take effect.
      const sessionChecked = get().restoreAdminSession()
      watchConnection()

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
      // The documents live in IndexedDB when the browser has one: the first frame is the boot snapshot, the rest follows.
      openWorkspace(stored)
      return sessionChecked
    },

    persist: schedulePersist,

    flushPersist: () => {
      if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      const state = get()
      const settingsFailure = saveSettings(settingsOf(state))
      lastSettingsFailure = settingsFailure
      lastSnapshotFailure = null
      let filesFailure: StorageFailure | null = null
      let snapshotFailure: StorageFailure | null = null
      let pending = false
      let changed = false
      if (state.docsReady) {
        const ws = ensureWorkspace()
        if (ws) {
          flushing = true
          docsFailure = undefined
          try {
            changed = ws.persistNow(true)
          } finally {
            flushing = false
          }
          filesFailure = docsFailure === undefined ? null : docsFailure
          pending = docsFailure === undefined && ws.dirty
          if (docsMode === 'idb') {
            // The documents are in IndexedDB; what localStorage holds is the small snapshot the first frame is drawn from.
            snapshotFailure = lastSnapshotFailure = saveSnapshot({
              files: state.files,
              currentFileId: state.currentFileId,
              expandedFolders: state.expandedFolders,
              seq: ws.seq,
              currentContent: state.currentFileId ? state.currentContent : null
            })
          }
        }
      }
      // A full quota is worse than "not saved": the copy on disk is the one from before the limit was
      // hit, and a reload brings that one back. The banner (StorageBanner) says so until a save succeeds.
      const rest = settingsFailure ?? snapshotFailure
      const failure = filesFailure ?? rest
      set({
        saveState: failure ? 'error' : pending ? 'saving' : 'saved',
        lastSavedAt: Date.now(),
        storageFailure: failure,
        storageFailureScope: filesFailure ? 'documents' : rest ? 'settings' : null
      })
      // Typing has settled and was written: let the other devices know soon.
      if (changed) engine?.poke()
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
