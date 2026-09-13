/**
 * The whole application state, in one zustand store.
 *
 * Components stay presentational: they read slices and call actions. Every
 * action that talks to the bridge funnels through `guard`, which turns an
 * ApiError into a toast and a 401 into a logout, so no component has to think
 * about either.
 */

import { create } from 'zustand'

import { ApiError, api, configureApi } from './lib/api'
import { EjsonParseError, documentKey, idFilter, parseFilter, parsePipeline, parseRelaxed, withoutId } from './lib/ejson'
import { describeMutation } from './lib/format'
import { downloadBlob, pushHistory, storage, stripPassword, type RememberedProfile } from './lib/storage'
import type {
  CollectionInfo,
  CommandResult,
  ConnectRequest,
  DatabaseInfo,
  DocumentPage,
  EjsonDocument,
  IndexInfo,
  OperationInfo,
  QueryHistoryEntry,
  ServerOverview,
  SessionInfo,
  StatsResult,
  Tab,
  Theme,
  Toast,
  ViewMode,
} from './types'

export const DEFAULT_LIMIT = 25

export type Status = 'idle' | 'restoring' | 'connecting' | 'connected'

export interface AppState {
  // session
  status: Status
  session: SessionInfo | null
  connectError: string | null

  // navigation
  databases: DatabaseInfo[]
  collections: Record<string, CollectionInfo[]>
  expanded: string[]
  activeDb: string | null
  activeCollection: string | null
  tab: Tab

  // documents
  filterText: string
  projectionText: string
  sortText: string
  skip: number
  limit: number
  page: DocumentPage | null
  queryError: string | null
  viewMode: ViewMode
  selected: string[]

  // other tabs
  indexes: IndexInfo[]
  stats: StatsResult | null
  pipelineText: string
  aggregateResult: CommandResult | null
  aggregateError: string | null
  overview: ServerOverview | null
  operations: OperationInfo[]
  history: QueryHistoryEntry[]

  // chrome
  theme: Theme
  toasts: Toast[]
  busy: boolean

  // --- actions ---
  bootstrap: () => Promise<void>
  connect: (request: ConnectRequest, remember: RememberedProfile) => Promise<boolean>
  disconnect: () => Promise<void>

  loadDatabases: () => Promise<void>
  toggleDatabase: (database: string) => Promise<void>
  loadCollections: (database: string, withStats?: boolean) => Promise<void>
  selectCollection: (database: string, collection: string) => Promise<void>
  setTab: (tab: Tab) => Promise<void>

  createDatabase: (name: string, collection: string) => Promise<boolean>
  dropDatabase: (database: string) => Promise<boolean>
  createCollection: (database: string, name: string) => Promise<boolean>
  dropCollection: (database: string, collection: string) => Promise<boolean>
  renameCollection: (database: string, collection: string, name: string) => Promise<boolean>
  truncateCollection: (database: string, collection: string) => Promise<boolean>

  setFilterText: (value: string) => void
  setProjectionText: (value: string) => void
  setSortText: (value: string) => void
  setLimit: (value: number) => void
  setViewMode: (mode: ViewMode) => void
  runFind: (options?: { skip?: number; resetSelection?: boolean }) => Promise<void>
  goToPage: (skip: number) => Promise<void>
  toggleSelected: (key: string) => void
  clearSelection: () => void

  insertDocument: (text: string) => Promise<boolean>
  replaceDocument: (original: EjsonDocument, text: string) => Promise<boolean>
  deleteDocument: (document: EjsonDocument) => Promise<boolean>
  deleteSelected: () => Promise<boolean>
  exportCollection: (format: 'json' | 'jsonl' | 'csv', limit: number) => Promise<void>

  loadIndexes: () => Promise<void>
  createIndex: (payload: { keysText: string; name: string; unique: boolean; sparse: boolean; ttl: string }) => Promise<boolean>
  dropIndex: (name: string) => Promise<boolean>

  loadStats: () => Promise<void>
  setPipelineText: (value: string) => void
  runAggregate: () => Promise<void>
  loadServer: () => Promise<void>

  applyHistory: (entry: QueryHistoryEntry) => void
  clearHistory: () => void
  setTheme: (theme: Theme) => void
  toast: (kind: Toast['kind'], message: string) => void
  dismissToast: (id: number) => void
}

let toastId = 0

function initialTheme(): Theme {
  const stored = storage.getTheme()
  if (stored) return stored
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: Theme): void {
  try {
    document.documentElement.setAttribute('data-theme', theme)
  } catch {
    /* not in a browser (tests) */
  }
}

export const useStore = create<AppState>((set, get) => {
  /**
   * Run an API call, reporting failures as toasts.
   * Returns `null` on failure so callers can branch without try/catch.
   */
  async function guard<T>(operation: () => Promise<T>, options: { silent?: boolean } = {}): Promise<T | null> {
    set({ busy: true })
    try {
      return await operation()
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null
      if (apiError?.isAuthError) {
        // The session is gone: drop straight back to the login screen rather
        // than leaving a shell full of stale data behind.
        storage.clearToken()
        set({ status: 'idle', session: null, databases: [], collections: {}, activeDb: null, activeCollection: null })
      }
      if (!options.silent) {
        get().toast('error', apiError?.message ?? (error as Error).message ?? 'Something went wrong')
      }
      return null
    } finally {
      set({ busy: false })
    }
  }

  function rememberQuery(kind: QueryHistoryEntry['kind'], text: string): void {
    const { activeDb, activeCollection, history } = get()
    const trimmed = text.trim()
    if (!trimmed || trimmed === '{}' || trimmed === '[]' || !activeDb || !activeCollection) return
    const next = pushHistory(history, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      kind,
      namespace: `${activeDb}.${activeCollection}`,
      at: new Date().toISOString(),
    })
    storage.setHistory(next)
    set({ history: next })
  }

  return {
    status: 'idle',
    session: null,
    connectError: null,

    databases: [],
    collections: {},
    expanded: [],
    activeDb: null,
    activeCollection: null,
    tab: 'documents',

    filterText: '{}',
    projectionText: '',
    sortText: '',
    skip: 0,
    limit: DEFAULT_LIMIT,
    page: null,
    queryError: null,
    viewMode: 'table',
    selected: [],

    indexes: [],
    stats: null,
    pipelineText: '[\n  { $match: {} }\n]',
    aggregateResult: null,
    aggregateError: null,
    overview: null,
    operations: [],
    history: storage.getHistory(),

    theme: initialTheme(),
    toasts: [],
    busy: false,

    // ----------------------------------------------------------------- session
    async bootstrap() {
      applyTheme(get().theme)
      configureApi({
        getToken: () => storage.getToken(),
        onUnauthorized: () => storage.clearToken(),
      })
      if (!storage.getToken()) {
        set({ status: 'idle' })
        return
      }
      set({ status: 'restoring' })
      const session = await guard(() => api.currentSession(), { silent: true })
      if (!session) {
        storage.clearToken()
        set({ status: 'idle', session: null })
        return
      }
      set({ status: 'connected', session })
      await get().loadDatabases()
    },

    async connect(request, remember) {
      set({ status: 'connecting', connectError: null })
      try {
        const session = await api.connect(request)
        storage.setToken(session.token)
        storage.setProfile({ ...remember, uri: stripPassword(remember.uri) })
        set({ status: 'connected', session, connectError: null })
        await get().loadDatabases()
        return true
      } catch (error) {
        const message = error instanceof ApiError ? error.message : (error as Error).message
        set({ status: 'idle', connectError: message, session: null })
        return false
      }
    },

    async disconnect() {
      await guard(() => api.disconnect(), { silent: true })
      storage.clearToken()
      set({
        status: 'idle',
        session: null,
        databases: [],
        collections: {},
        expanded: [],
        activeDb: null,
        activeCollection: null,
        page: null,
        indexes: [],
        stats: null,
        overview: null,
        operations: [],
        selected: [],
        tab: 'documents',
      })
    },

    // -------------------------------------------------------------- navigation
    async loadDatabases() {
      const databases = await guard(() => api.listDatabases())
      if (databases) set({ databases })
    },

    async toggleDatabase(database) {
      const { expanded } = get()
      if (expanded.includes(database)) {
        set({ expanded: expanded.filter((name) => name !== database) })
        return
      }
      set({ expanded: [...expanded, database] })
      if (!get().collections[database]) await get().loadCollections(database)
    },

    async loadCollections(database, withStats = false) {
      const collections = await guard(() => api.listCollections(database, withStats))
      if (collections) set({ collections: { ...get().collections, [database]: collections } })
    },

    async selectCollection(database, collection) {
      set({
        activeDb: database,
        activeCollection: collection,
        skip: 0,
        selected: [],
        page: null,
        indexes: [],
        stats: null,
        aggregateResult: null,
        aggregateError: null,
        queryError: null,
      })
      if (!get().expanded.includes(database)) set({ expanded: [...get().expanded, database] })
      await get().setTab(get().tab === 'server' ? 'documents' : get().tab)
    },

    async setTab(tab) {
      set({ tab })
      const { activeDb, activeCollection } = get()
      if (tab === 'server') return get().loadServer()
      if (!activeDb || !activeCollection) return
      if (tab === 'documents') return get().runFind({ skip: get().skip })
      if (tab === 'indexes') return get().loadIndexes()
      if (tab === 'stats') return get().loadStats()
    },

    // ---------------------------------------------------- databases/collections
    async createDatabase(name, collection) {
      const result = await guard(() => api.createDatabase(name, collection))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().loadDatabases()
      await get().loadCollections(name)
      return true
    },

    async dropDatabase(database) {
      const result = await guard(() => api.dropDatabase(database))
      if (!result) return false
      get().toast('success', describeMutation(result))
      const collections = { ...get().collections }
      delete collections[database]
      set({
        collections,
        expanded: get().expanded.filter((name) => name !== database),
        ...(get().activeDb === database ? { activeDb: null, activeCollection: null, page: null } : {}),
      })
      await get().loadDatabases()
      return true
    },

    async createCollection(database, name) {
      const result = await guard(() => api.createCollection(database, { name }))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().loadCollections(database)
      return true
    },

    async dropCollection(database, collection) {
      const result = await guard(() => api.dropCollection(database, collection))
      if (!result) return false
      get().toast('success', describeMutation(result))
      if (get().activeDb === database && get().activeCollection === collection) {
        set({ activeCollection: null, page: null, indexes: [], stats: null })
      }
      await get().loadCollections(database)
      return true
    },

    async renameCollection(database, collection, name) {
      const result = await guard(() => api.renameCollection(database, collection, name))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().loadCollections(database)
      if (get().activeDb === database && get().activeCollection === collection) {
        await get().selectCollection(database, name)
      }
      return true
    },

    async truncateCollection(database, collection) {
      const result = await guard(() => api.truncateCollection(database, collection))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().loadCollections(database)
      if (get().activeDb === database && get().activeCollection === collection) {
        await get().runFind({ skip: 0, resetSelection: true })
      }
      return true
    },

    // ------------------------------------------------------------- documents
    setFilterText: (filterText) => set({ filterText }),
    setProjectionText: (projectionText) => set({ projectionText }),
    setSortText: (sortText) => set({ sortText }),
    setLimit: (limit) => set({ limit }),
    setViewMode: (viewMode) => set({ viewMode }),

    async runFind(options = {}) {
      const { activeDb, activeCollection, filterText, projectionText, sortText, limit } = get()
      if (!activeDb || !activeCollection) return
      const skip = options.skip ?? 0

      let filter: unknown
      let projection: unknown
      let sort: unknown
      try {
        filter = parseFilter(filterText)
        projection = projectionText.trim() ? parseFilter(projectionText) : undefined
        sort = sortText.trim() ? parseRelaxed(sortText) : undefined
      } catch (error) {
        const message = error instanceof EjsonParseError ? error.message : (error as Error).message
        set({ queryError: message })
        return
      }

      set({ queryError: null, skip })
      const page = await guard(() =>
        api.findDocuments(activeDb, activeCollection, { filter, projection, sort, skip, limit }),
      )
      if (!page) return
      rememberQuery('find', filterText)
      set({ page, ...(options.resetSelection === false ? {} : { selected: [] }) })
    },

    async goToPage(skip) {
      await get().runFind({ skip: Math.max(0, skip) })
    },

    toggleSelected: (key) => {
      const { selected } = get()
      set({ selected: selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key] })
    },

    clearSelection: () => set({ selected: [] }),

    async insertDocument(text) {
      const { activeDb, activeCollection } = get()
      if (!activeDb || !activeCollection) return false
      let documents: unknown
      try {
        documents = parseRelaxed(text)
      } catch (error) {
        get().toast('error', (error as Error).message)
        return false
      }
      const result = await guard(() => api.insertDocuments(activeDb, activeCollection, documents))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().runFind({ skip: get().skip })
      return true
    },

    async replaceDocument(original, text) {
      const { activeDb, activeCollection } = get()
      if (!activeDb || !activeCollection) return false
      const filter = idFilter(original)
      if (!filter) {
        get().toast('error', 'This document has no _id, so it cannot be edited safely')
        return false
      }
      let update: unknown
      try {
        // _id is immutable in MongoDB; sending it back unchanged is fine for a
        // replacement, but dropping it avoids an error when the user edits it.
        update = withoutId(parseRelaxed<Record<string, unknown>>(text))
      } catch (error) {
        get().toast('error', (error as Error).message)
        return false
      }
      const result = await guard(() => api.updateDocuments(activeDb, activeCollection, { filter, update }))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().runFind({ skip: get().skip, resetSelection: false })
      return true
    },

    async deleteDocument(document) {
      const { activeDb, activeCollection } = get()
      if (!activeDb || !activeCollection) return false
      const filter = idFilter(document)
      if (!filter) {
        get().toast('error', 'This document has no _id, so it cannot be deleted safely')
        return false
      }
      const result = await guard(() => api.deleteDocuments(activeDb, activeCollection, filter))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().runFind({ skip: get().skip })
      return true
    },

    async deleteSelected() {
      const { activeDb, activeCollection, page, selected } = get()
      if (!activeDb || !activeCollection || !page || selected.length === 0) return false
      const targets = page.documents.filter((doc, index) => selected.includes(documentKey(doc, index)))
      const ids = targets.map((doc) => doc._id).filter((id) => id !== undefined)
      if (ids.length !== targets.length) {
        get().toast('error', 'Some selected documents have no _id and cannot be deleted safely')
        return false
      }
      const result = await guard(() =>
        api.deleteDocuments(activeDb, activeCollection, { _id: { $in: ids } }, true),
      )
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().runFind({ skip: get().skip })
      return true
    },

    async exportCollection(format, limit) {
      const { activeDb, activeCollection, filterText } = get()
      if (!activeDb || !activeCollection) return
      let filter: string | undefined
      try {
        filter = JSON.stringify(parseFilter(filterText))
      } catch {
        filter = undefined
      }
      const payload = await guard(() =>
        api.exportCollection(activeDb, activeCollection, format, limit, filter),
      )
      if (!payload) return
      downloadBlob(payload.blob, payload.filename)
      get().toast('success', `Exported ${payload.filename}`)
    },

    // --------------------------------------------------------------- indexes
    async loadIndexes() {
      const { activeDb, activeCollection } = get()
      if (!activeDb || !activeCollection) return
      const indexes = await guard(() => api.listIndexes(activeDb, activeCollection))
      if (indexes) set({ indexes })
    },

    async createIndex({ keysText, name, unique, sparse, ttl }) {
      const { activeDb, activeCollection } = get()
      if (!activeDb || !activeCollection) return false
      let keys: unknown
      try {
        keys = parseFilter(keysText)
      } catch (error) {
        get().toast('error', (error as Error).message)
        return false
      }
      const result = await guard(() =>
        api.createIndex(activeDb, activeCollection, {
          keys,
          name: name.trim() || null,
          unique,
          sparse,
          ttl_seconds: ttl.trim() ? Number(ttl) : null,
        }),
      )
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().loadIndexes()
      return true
    },

    async dropIndex(name) {
      const { activeDb, activeCollection } = get()
      if (!activeDb || !activeCollection) return false
      const result = await guard(() => api.dropIndex(activeDb, activeCollection, name))
      if (!result) return false
      get().toast('success', describeMutation(result))
      await get().loadIndexes()
      return true
    },

    // --------------------------------------------------- stats, console, server
    async loadStats() {
      const { activeDb, activeCollection } = get()
      if (!activeDb) return
      const stats = activeCollection
        ? await guard(() => api.collectionStats(activeDb, activeCollection))
        : await guard(() => api.databaseStats(activeDb))
      if (stats) set({ stats })
    },

    setPipelineText: (pipelineText) => set({ pipelineText }),

    async runAggregate() {
      const { activeDb, activeCollection, pipelineText } = get()
      if (!activeDb || !activeCollection) return
      let pipeline: unknown[]
      try {
        pipeline = parsePipeline(pipelineText)
      } catch (error) {
        set({ aggregateError: (error as Error).message, aggregateResult: null })
        return
      }
      set({ aggregateError: null })
      const result = await guard(() => api.aggregate(activeDb, activeCollection, pipeline))
      if (!result) return
      rememberQuery('aggregate', pipelineText)
      set({ aggregateResult: result })
    },

    async loadServer() {
      const overview = await guard(() => api.serverOverview())
      if (overview) set({ overview })
      const operations = await guard(() => api.currentOperations(), { silent: true })
      set({ operations: operations ?? [] })
    },

    // ---------------------------------------------------------------- chrome
    applyHistory: (entry) => {
      if (entry.kind === 'aggregate') set({ pipelineText: entry.text, tab: 'aggregate' })
      else set({ filterText: entry.text, tab: 'documents' })
    },

    clearHistory: () => {
      storage.clearHistory()
      set({ history: [] })
    },

    setTheme: (theme) => {
      storage.setTheme(theme)
      applyTheme(theme)
      set({ theme })
    },

    toast: (kind, message) => {
      toastId += 1
      const entry: Toast = { id: toastId, kind, message }
      set({ toasts: [...get().toasts, entry] })
      const ttl = kind === 'error' ? 7000 : 3500
      setTimeout(() => get().dismissToast(entry.id), ttl)
    },

    dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
  }
})
