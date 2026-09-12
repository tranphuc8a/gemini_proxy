import { create } from 'zustand'

import { ApiError, api, configureApi } from './lib/api'
import { pushHistory, storage } from './lib/storage'
import type {
  BrowsePage,
  BrowseSort,
  CellValue,
  DatabaseInfo,
  ProcessInfo,
  QueryHistoryEntry,
  QueryResult,
  ServerOverview,
  SessionInfo,
  TableInfo,
  TableStructure,
  ViewName,
} from './types'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  message: string
}

interface State {
  // session
  session: SessionInfo | null
  connecting: boolean
  restoring: boolean
  connectError: string | null

  // navigation
  databases: DatabaseInfo[]
  tables: TableInfo[]
  currentDatabase: string | null
  currentTable: string | null
  view: ViewName
  loadingTables: boolean

  // browse
  page: BrowsePage | null
  structure: TableStructure | null
  limit: number
  offset: number
  sort: BrowseSort
  search: string
  loadingRows: boolean
  selectedRows: number[]

  // console
  sql: string
  results: QueryResult[]
  running: boolean
  history: QueryHistoryEntry[]

  // server
  overview: ServerOverview | null
  processes: ProcessInfo[]

  // chrome
  toasts: Toast[]
  theme: 'light' | 'dark'
}

interface Actions {
  connect(input: { host: string; port: number; username: string; password: string; database?: string }): Promise<boolean>
  restoreSession(): Promise<void>
  disconnect(): Promise<void>

  loadDatabases(): Promise<void>
  selectDatabase(database: string | null): Promise<void>
  selectTable(table: string | null, view?: ViewName): Promise<void>
  setView(view: ViewName): void

  refreshRows(): Promise<void>
  setLimit(limit: number): Promise<void>
  setOffset(offset: number): Promise<void>
  toggleSort(column: string): Promise<void>
  setSearch(search: string): Promise<void>
  toggleRowSelection(index: number): void
  clearRowSelection(): void

  insertRow(values: Record<string, unknown>): Promise<boolean>
  updateRow(values: Record<string, unknown>, key: Record<string, CellValue>): Promise<boolean>
  deleteSelectedRows(): Promise<boolean>
  truncateTable(database: string, table: string): Promise<boolean>
  dropTable(database: string, table: string): Promise<boolean>
  createDatabase(name: string, charset: string): Promise<boolean>
  dropDatabase(name: string): Promise<boolean>

  setSql(sql: string): void
  runSql(sqlOverride?: string): Promise<void>
  clearHistory(): void

  loadServer(): Promise<void>

  notify(kind: Toast['kind'], message: string): void
  dismissToast(id: string): void
  toggleTheme(): void
}

export type Store = State & Actions

const DEFAULT_LIMIT = 50

const initialState: State = {
  session: null,
  connecting: false,
  restoring: true,
  connectError: null,

  databases: [],
  tables: [],
  currentDatabase: null,
  currentTable: null,
  view: 'browse',
  loadingTables: false,

  page: null,
  structure: null,
  limit: DEFAULT_LIMIT,
  offset: 0,
  sort: null,
  search: '',
  loadingRows: false,
  selectedRows: [],

  sql: '',
  results: [],
  running: false,
  history: [],

  overview: null,
  processes: [],

  toasts: [],
  theme: storage.getTheme() ?? 'dark',
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useStore = create<Store>((set, get) => ({
  ...initialState,
  history: storage.getHistory(),

  // ------------------------------------------------------------------
  // session
  // ------------------------------------------------------------------
  async connect(input) {
    set({ connecting: true, connectError: null })
    try {
      const session = await api.connect({
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        database: input.database || null,
      })
      storage.setToken(session.token)
      storage.setProfile({
        host: input.host,
        port: input.port,
        username: input.username,
        database: input.database ?? '',
      })
      set({ session, connecting: false, connectError: null })
      await get().loadDatabases()
      if (input.database) await get().selectDatabase(input.database)
      return true
    } catch (error) {
      set({ connecting: false, connectError: describeError(error) })
      return false
    }
  },

  async restoreSession() {
    const token = storage.getToken()
    if (!token) {
      set({ restoring: false })
      return
    }
    try {
      const session = await api.currentSession()
      set({ session, restoring: false })
      await get().loadDatabases()
      if (session.database) await get().selectDatabase(session.database)
    } catch {
      // An expired or unknown token simply returns the user to the login form.
      storage.clearToken()
      set({ session: null, restoring: false })
    }
  },

  async disconnect() {
    try {
      await api.disconnect()
    } catch {
      /* the local session is cleared regardless of what the server says */
    }
    storage.clearToken()
    set({ ...initialState, restoring: false, theme: get().theme, history: get().history })
  },

  // ------------------------------------------------------------------
  // navigation
  // ------------------------------------------------------------------
  async loadDatabases() {
    try {
      set({ databases: await api.listDatabases() })
    } catch (error) {
      get().notify('error', describeError(error))
    }
  },

  async selectDatabase(database) {
    if (!database) {
      set({ currentDatabase: null, tables: [], currentTable: null, page: null, structure: null })
      return
    }
    set({ currentDatabase: database, loadingTables: true, currentTable: null, page: null, structure: null })
    try {
      set({ tables: await api.listTables(database), loadingTables: false })
    } catch (error) {
      set({ tables: [], loadingTables: false })
      get().notify('error', describeError(error))
    }
  },

  async selectTable(table, view = 'browse') {
    const { currentDatabase } = get()
    if (!table || !currentDatabase) {
      set({ currentTable: null, page: null, structure: null })
      return
    }
    set({ currentTable: table, view, offset: 0, sort: null, search: '', selectedRows: [] })
    try {
      const structure = await api.tableStructure(currentDatabase, table)
      set({ structure })
    } catch (error) {
      get().notify('error', describeError(error))
    }
    if (view === 'browse') await get().refreshRows()
  },

  setView(view) {
    set({ view })
    if (view === 'server') void get().loadServer()
  },

  // ------------------------------------------------------------------
  // browse
  // ------------------------------------------------------------------
  async refreshRows() {
    const { currentDatabase, currentTable, limit, offset, sort, search } = get()
    if (!currentDatabase || !currentTable) return
    set({ loadingRows: true })
    try {
      const page = await api.browseRows(currentDatabase, currentTable, {
        limit,
        offset,
        orderBy: sort?.column,
        direction: sort?.direction,
        search: search || undefined,
      })
      set({ page, loadingRows: false, selectedRows: [] })
    } catch (error) {
      set({ loadingRows: false })
      get().notify('error', describeError(error))
    }
  },

  async setLimit(limit) {
    set({ limit, offset: 0 })
    await get().refreshRows()
  },

  async setOffset(offset) {
    set({ offset: Math.max(0, offset) })
    await get().refreshRows()
  },

  async toggleSort(column) {
    const { sort } = get()
    // Click cycles: ascending, descending, unsorted.
    const next: BrowseSort =
      sort?.column !== column
        ? { column, direction: 'asc' }
        : sort.direction === 'asc'
          ? { column, direction: 'desc' }
          : null
    set({ sort: next, offset: 0 })
    await get().refreshRows()
  },

  async setSearch(search) {
    set({ search, offset: 0 })
    await get().refreshRows()
  },

  toggleRowSelection(index) {
    const { selectedRows } = get()
    set({
      selectedRows: selectedRows.includes(index)
        ? selectedRows.filter((item) => item !== index)
        : [...selectedRows, index],
    })
  },

  clearRowSelection() {
    set({ selectedRows: [] })
  },

  // ------------------------------------------------------------------
  // mutations
  // ------------------------------------------------------------------
  async insertRow(values) {
    const { currentDatabase, currentTable } = get()
    if (!currentDatabase || !currentTable) return false
    try {
      const outcome = await api.insertRow(currentDatabase, currentTable, values)
      get().notify('success', `Inserted ${outcome.affected_rows} row`)
      await get().refreshRows()
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  async updateRow(values, key) {
    const { currentDatabase, currentTable } = get()
    if (!currentDatabase || !currentTable) return false
    try {
      const outcome = await api.updateRow(currentDatabase, currentTable, values, key)
      get().notify(
        outcome.affected_rows ? 'success' : 'info',
        outcome.affected_rows ? 'Row updated' : 'No row changed (values were identical)',
      )
      await get().refreshRows()
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  async deleteSelectedRows() {
    const { currentDatabase, currentTable, page, structure, selectedRows } = get()
    if (!currentDatabase || !currentTable || !page || !structure || selectedRows.length === 0) return false
    const keyColumns = structure.primary_key.length
      ? structure.primary_key
      : structure.columns.map((column) => column.name)
    const keys = selectedRows.map((index) => {
      const row = page.rows[index]
      return Object.fromEntries(keyColumns.map((column) => [column, row?.[column] ?? null]))
    })
    try {
      const outcome = await api.deleteRows(currentDatabase, currentTable, keys)
      get().notify('success', `Deleted ${outcome.affected_rows} row(s)`)
      await get().refreshRows()
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  async truncateTable(database, table) {
    try {
      await api.truncateTable(database, table)
      get().notify('success', `Truncated ${table}`)
      if (get().currentTable === table) await get().refreshRows()
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  async dropTable(database, table) {
    try {
      await api.dropTable(database, table)
      get().notify('success', `Dropped ${table}`)
      if (get().currentTable === table) set({ currentTable: null, page: null, structure: null })
      set({ tables: await api.listTables(database) })
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  async createDatabase(name, charset) {
    try {
      await api.createDatabase(name, charset)
      get().notify('success', `Created database ${name}`)
      await get().loadDatabases()
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  async dropDatabase(name) {
    try {
      await api.dropDatabase(name)
      get().notify('success', `Dropped database ${name}`)
      if (get().currentDatabase === name) await get().selectDatabase(null)
      await get().loadDatabases()
      return true
    } catch (error) {
      get().notify('error', describeError(error))
      return false
    }
  },

  // ------------------------------------------------------------------
  // console
  // ------------------------------------------------------------------
  setSql(sql) {
    set({ sql })
  },

  async runSql(sqlOverride) {
    const { sql, currentDatabase } = get()
    const script = (sqlOverride ?? sql).trim()
    if (!script) return
    set({ running: true })
    const startedAt = performance.now()
    try {
      const results = await api.runSql(script, currentDatabase)
      const failed = results.find((result) => result.error)
      const entry: QueryHistoryEntry = {
        id: newId(),
        sql: script,
        database: currentDatabase,
        ranAt: new Date().toISOString(),
        ok: !failed,
        durationMs: Math.round(performance.now() - startedAt),
      }
      const history = pushHistory(get().history, entry)
      storage.setHistory(history)
      set({ results, running: false, history })
      if (failed) get().notify('error', failed.error ?? 'Statement failed')
      // A write may have changed the rows currently on screen.
      if (results.some((result) => result.kind === 'write' && !result.error) && get().currentTable) {
        await get().refreshRows()
      }
    } catch (error) {
      const entry: QueryHistoryEntry = {
        id: newId(),
        sql: script,
        database: currentDatabase,
        ranAt: new Date().toISOString(),
        ok: false,
        durationMs: Math.round(performance.now() - startedAt),
      }
      const history = pushHistory(get().history, entry)
      storage.setHistory(history)
      set({ running: false, history, results: [] })
      get().notify('error', describeError(error))
    }
  },

  clearHistory() {
    storage.clearHistory()
    set({ history: [] })
  },

  // ------------------------------------------------------------------
  // server
  // ------------------------------------------------------------------
  async loadServer() {
    try {
      const [overview, processes] = await Promise.all([api.serverOverview(), api.processList()])
      set({ overview, processes })
    } catch (error) {
      get().notify('error', describeError(error))
    }
  },

  // ------------------------------------------------------------------
  // chrome
  // ------------------------------------------------------------------
  notify(kind, message) {
    const toast: Toast = { id: newId(), kind, message }
    set({ toasts: [...get().toasts, toast] })
    if (kind !== 'error') {
      window.setTimeout(() => get().dismissToast(toast.id), 4000)
    }
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
  },

  toggleTheme() {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
    storage.setTheme(theme)
    set({ theme })
  },
}))

// The API client reads the token from the store so a logout takes effect at once.
configureApi({
  getToken: () => useStore.getState().session?.token ?? storage.getToken(),
  onUnauthorized: () => {
    if (useStore.getState().session) {
      storage.clearToken()
      useStore.setState({ session: null, restoring: false })
    }
  },
})
