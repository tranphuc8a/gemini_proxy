import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    configureApi: vi.fn(),
    api: {
      connect: vi.fn(),
      currentSession: vi.fn(),
      disconnect: vi.fn(),
      listDatabases: vi.fn(),
      listTables: vi.fn(),
      tableStructure: vi.fn(),
      browseRows: vi.fn(),
      insertRow: vi.fn(),
      updateRow: vi.fn(),
      deleteRows: vi.fn(),
      truncateTable: vi.fn(),
      dropTable: vi.fn(),
      createDatabase: vi.fn(),
      dropDatabase: vi.fn(),
      runSql: vi.fn(),
      serverOverview: vi.fn(),
      processList: vi.fn(),
      exportTable: vi.fn(),
    },
  }
})

import { ApiError, api } from '../lib/api'
import { useStore } from '../store'
import type { BrowsePage, SessionInfo, TableStructure } from '../types'

const mocked = api as unknown as Record<keyof typeof api, ReturnType<typeof vi.fn>>

const session: SessionInfo = {
  token: 'tok-123',
  host: 'localhost',
  port: 3306,
  username: 'root',
  database: null,
  label: 'root@localhost',
  server_version: '8.0.36',
  server_flavor: 'MySQL',
  connected_at: '2026-09-12T00:00:00+00:00',
  last_used_at: '2026-09-12T00:00:00+00:00',
}

const structure: TableStructure = {
  database: 'shop',
  table: 'users',
  columns: [
    {
      name: 'id',
      data_type: 'int',
      column_type: 'int(11)',
      nullable: false,
      key: 'PRI',
      default: null,
      extra: 'auto_increment',
      comment: '',
      position: 1,
    },
  ],
  indexes: [],
  foreign_keys: [],
  primary_key: ['id'],
  ddl: null,
}

const page: BrowsePage = {
  database: 'shop',
  table: 'users',
  columns: structure.columns,
  primary_key: ['id'],
  rows: [{ id: 1 }, { id: 2 }],
  total: 2,
  limit: 50,
  offset: 0,
  duration_ms: 1,
}

function reset() {
  window.localStorage.clear()
  useStore.setState({
    session: null,
    connecting: false,
    restoring: true,
    connectError: null,
    databases: [],
    tables: [],
    currentDatabase: null,
    currentTable: null,
    view: 'browse',
    page: null,
    structure: null,
    limit: 50,
    offset: 0,
    sort: null,
    search: '',
    selectedRows: [],
    sql: '',
    results: [],
    running: false,
    history: [],
    toasts: [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  reset()
  mocked.listDatabases.mockResolvedValue([{ name: 'shop', charset: 'utf8mb4', collation: null }])
  mocked.listTables.mockResolvedValue([{ name: 'users', type: 'BASE TABLE', engine: 'InnoDB', rows: 2, data_length: 16384, collation: null, comment: null }])
  mocked.tableStructure.mockResolvedValue(structure)
  mocked.browseRows.mockResolvedValue(page)
})

describe('connect', () => {
  it('stores the session and the token, then loads databases', async () => {
    mocked.connect.mockResolvedValue(session)
    const ok = await useStore.getState().connect({ host: 'localhost', port: 3306, username: 'root', password: 'pw' })

    expect(ok).toBe(true)
    expect(useStore.getState().session?.token).toBe('tok-123')
    expect(window.localStorage.getItem('sqladmin.token')).toBe('tok-123')
    expect(useStore.getState().databases).toHaveLength(1)
  })

  it('remembers the profile without the password', async () => {
    mocked.connect.mockResolvedValue(session)
    await useStore.getState().connect({ host: 'db', port: 3307, username: 'app', password: 'secret' })

    const remembered = window.localStorage.getItem('sqladmin.lastProfile') ?? ''
    expect(remembered).toContain('app')
    expect(remembered).not.toContain('secret')
  })

  it('surfaces the failure message and keeps the user signed out', async () => {
    mocked.connect.mockRejectedValue(new ApiError('Access denied for user', 401))
    const ok = await useStore.getState().connect({ host: 'x', port: 3306, username: 'root', password: 'bad' })

    expect(ok).toBe(false)
    expect(useStore.getState().session).toBeNull()
    expect(useStore.getState().connectError).toBe('Access denied for user')
    expect(useStore.getState().connecting).toBe(false)
  })

  it('opens the database supplied on the login form', async () => {
    mocked.connect.mockResolvedValue({ ...session, database: 'shop' })
    await useStore.getState().connect({ host: 'x', port: 3306, username: 'root', password: '', database: 'shop' })

    expect(useStore.getState().currentDatabase).toBe('shop')
    expect(mocked.listTables).toHaveBeenCalledWith('shop')
  })
})

describe('restoreSession', () => {
  it('does nothing without a stored token', async () => {
    await useStore.getState().restoreSession()
    expect(mocked.currentSession).not.toHaveBeenCalled()
    expect(useStore.getState().restoring).toBe(false)
  })

  it('restores a valid session', async () => {
    window.localStorage.setItem('sqladmin.token', 'tok-123')
    mocked.currentSession.mockResolvedValue(session)

    await useStore.getState().restoreSession()
    expect(useStore.getState().session?.token).toBe('tok-123')
  })

  it('drops a token the server no longer knows', async () => {
    window.localStorage.setItem('sqladmin.token', 'stale')
    mocked.currentSession.mockRejectedValue(new ApiError('Session expired', 401))

    await useStore.getState().restoreSession()
    expect(useStore.getState().session).toBeNull()
    expect(window.localStorage.getItem('sqladmin.token')).toBeNull()
    expect(useStore.getState().restoring).toBe(false)
  })
})

describe('disconnect', () => {
  it('clears the token and the browsing state', async () => {
    useStore.setState({ session, currentDatabase: 'shop', currentTable: 'users', page })
    window.localStorage.setItem('sqladmin.token', 'tok-123')
    mocked.disconnect.mockResolvedValue({ disconnected: true })

    await useStore.getState().disconnect()

    expect(useStore.getState().session).toBeNull()
    expect(useStore.getState().currentTable).toBeNull()
    expect(window.localStorage.getItem('sqladmin.token')).toBeNull()
  })

  it('signs out locally even when the server call fails', async () => {
    useStore.setState({ session })
    mocked.disconnect.mockRejectedValue(new ApiError('gone', 502))

    await useStore.getState().disconnect()
    expect(useStore.getState().session).toBeNull()
  })

  it('keeps the chosen theme', async () => {
    useStore.setState({ session, theme: 'light' })
    mocked.disconnect.mockResolvedValue({ disconnected: true })

    await useStore.getState().disconnect()
    expect(useStore.getState().theme).toBe('light')
  })
})

describe('navigation', () => {
  it('loads tables and clears the previous table when the database changes', async () => {
    useStore.setState({ currentTable: 'old', page })
    await useStore.getState().selectDatabase('shop')

    expect(useStore.getState().tables).toHaveLength(1)
    expect(useStore.getState().currentTable).toBeNull()
    expect(useStore.getState().page).toBeNull()
  })

  it('clearing the database empties the table list', async () => {
    useStore.setState({ currentDatabase: 'shop', tables: [{ name: 'users', type: 'BASE TABLE', engine: null, rows: null, data_length: null, collation: null, comment: null }] })
    await useStore.getState().selectDatabase(null)

    expect(useStore.getState().tables).toEqual([])
  })

  it('selecting a table loads structure and rows', async () => {
    useStore.setState({ currentDatabase: 'shop' })
    await useStore.getState().selectTable('users')

    expect(useStore.getState().structure?.table).toBe('users')
    expect(useStore.getState().page?.rows).toHaveLength(2)
  })

  it('selecting a table resets paging and sorting', async () => {
    useStore.setState({ currentDatabase: 'shop', offset: 100, sort: { column: 'id', direction: 'desc' }, search: 'x' })
    await useStore.getState().selectTable('users')

    expect(useStore.getState().offset).toBe(0)
    expect(useStore.getState().sort).toBeNull()
    expect(useStore.getState().search).toBe('')
  })

  it('reports a failure to list tables as a toast', async () => {
    mocked.listTables.mockRejectedValue(new ApiError('Access denied', 401))
    await useStore.getState().selectDatabase('shop')

    expect(useStore.getState().toasts.at(-1)?.kind).toBe('error')
    expect(useStore.getState().loadingTables).toBe(false)
  })
})

describe('browsing', () => {
  beforeEach(() => useStore.setState({ currentDatabase: 'shop', currentTable: 'users', structure, page }))

  it('cycles sort ascending, descending, off', async () => {
    await useStore.getState().toggleSort('id')
    expect(useStore.getState().sort).toEqual({ column: 'id', direction: 'asc' })

    await useStore.getState().toggleSort('id')
    expect(useStore.getState().sort).toEqual({ column: 'id', direction: 'desc' })

    await useStore.getState().toggleSort('id')
    expect(useStore.getState().sort).toBeNull()
  })

  it('starts a different column at ascending', async () => {
    useStore.setState({ sort: { column: 'id', direction: 'desc' } })
    await useStore.getState().toggleSort('name')
    expect(useStore.getState().sort).toEqual({ column: 'name', direction: 'asc' })
  })

  it('returns to the first page when the page size changes', async () => {
    useStore.setState({ offset: 200 })
    await useStore.getState().setLimit(25)

    expect(useStore.getState().limit).toBe(25)
    expect(useStore.getState().offset).toBe(0)
  })

  it('never pages before the first row', async () => {
    await useStore.getState().setOffset(-50)
    expect(useStore.getState().offset).toBe(0)
  })

  it('searching resets to the first page and passes the term through', async () => {
    useStore.setState({ offset: 100 })
    await useStore.getState().setSearch('ann')

    expect(useStore.getState().offset).toBe(0)
    expect(mocked.browseRows).toHaveBeenLastCalledWith('shop', 'users', expect.objectContaining({ search: 'ann' }))
  })

  it('toggles row selection', () => {
    useStore.getState().toggleRowSelection(1)
    expect(useStore.getState().selectedRows).toEqual([1])

    useStore.getState().toggleRowSelection(1)
    expect(useStore.getState().selectedRows).toEqual([])
  })
})

describe('mutations', () => {
  beforeEach(() => useStore.setState({ currentDatabase: 'shop', currentTable: 'users', structure, page }))

  it('deletes the selected rows by primary key', async () => {
    useStore.setState({ selectedRows: [0, 1] })
    mocked.deleteRows.mockResolvedValue({ affected_rows: 2, last_insert_id: null, statement: null, duration_ms: 1 })

    await useStore.getState().deleteSelectedRows()
    expect(mocked.deleteRows).toHaveBeenCalledWith('shop', 'users', [{ id: 1 }, { id: 2 }])
  })

  it('does nothing when no row is selected', async () => {
    expect(await useStore.getState().deleteSelectedRows()).toBe(false)
    expect(mocked.deleteRows).not.toHaveBeenCalled()
  })

  it('reports an unchanged update as information rather than success', async () => {
    mocked.updateRow.mockResolvedValue({ affected_rows: 0, last_insert_id: null, statement: null, duration_ms: 1 })

    await useStore.getState().updateRow({ name: 'same' }, { id: 1 })
    expect(useStore.getState().toasts.at(-1)?.kind).toBe('info')
  })

  it('surfaces an insert failure as an error toast', async () => {
    mocked.insertRow.mockRejectedValue(new ApiError('Duplicate entry', 400))

    expect(await useStore.getState().insertRow({ id: 1 })).toBe(false)
    expect(useStore.getState().toasts.at(-1)).toMatchObject({ kind: 'error', message: 'Duplicate entry' })
  })
})

describe('sql console', () => {
  it('records a successful run in history', async () => {
    mocked.runSql.mockResolvedValue([
      { statement: 'SELECT 1', kind: 'read', columns: ['n'], column_types: [], rows: [[1]], row_count: 1, affected_rows: 0, last_insert_id: null, duration_ms: 1, truncated: false, error: null },
    ])

    useStore.getState().setSql('SELECT 1')
    await useStore.getState().runSql()

    expect(useStore.getState().results).toHaveLength(1)
    expect(useStore.getState().history[0]).toMatchObject({ sql: 'SELECT 1', ok: true })
    expect(useStore.getState().running).toBe(false)
  })

  it('flags an in-band statement error', async () => {
    mocked.runSql.mockResolvedValue([
      { statement: 'BOOM', kind: 'write', columns: [], column_types: [], rows: [], row_count: 0, affected_rows: 0, last_insert_id: null, duration_ms: 1, truncated: false, error: 'syntax error' },
    ])

    await useStore.getState().runSql('BOOM')
    expect(useStore.getState().history[0].ok).toBe(false)
    expect(useStore.getState().toasts.at(-1)?.kind).toBe('error')
  })

  it('records a transport failure too', async () => {
    mocked.runSql.mockRejectedValue(new ApiError('Cannot reach the API bridge.', 0))

    await useStore.getState().runSql('SELECT 1')
    expect(useStore.getState().history[0].ok).toBe(false)
    expect(useStore.getState().results).toEqual([])
  })

  it('ignores an empty script', async () => {
    await useStore.getState().runSql('   ')
    expect(mocked.runSql).not.toHaveBeenCalled()
  })

  it('refreshes the open table after a successful write', async () => {
    useStore.setState({ currentDatabase: 'shop', currentTable: 'users', structure, page })
    mocked.runSql.mockResolvedValue([
      { statement: 'UPDATE users SET a=1', kind: 'write', columns: [], column_types: [], rows: [], row_count: 0, affected_rows: 1, last_insert_id: null, duration_ms: 1, truncated: false, error: null },
    ])

    await useStore.getState().runSql('UPDATE users SET a=1')
    expect(mocked.browseRows).toHaveBeenCalled()
  })

  it('clears history', async () => {
    mocked.runSql.mockResolvedValue([])
    await useStore.getState().runSql('SELECT 1')
    useStore.getState().clearHistory()

    expect(useStore.getState().history).toEqual([])
  })
})

describe('chrome', () => {
  it('adds and dismisses a toast', () => {
    useStore.getState().notify('success', 'done')
    const toast = useStore.getState().toasts.at(-1)!
    expect(toast.message).toBe('done')

    useStore.getState().dismissToast(toast.id)
    expect(useStore.getState().toasts).toHaveLength(0)
  })

  it('keeps error toasts until they are dismissed', () => {
    vi.useFakeTimers()
    useStore.getState().notify('error', 'boom')
    vi.advanceTimersByTime(10000)

    expect(useStore.getState().toasts).toHaveLength(1)
    vi.useRealTimers()
  })

  it('persists the theme toggle', () => {
    const initial = useStore.getState().theme
    useStore.getState().toggleTheme()

    expect(useStore.getState().theme).not.toBe(initial)
    expect(window.localStorage.getItem('sqladmin.theme')).toBe(useStore.getState().theme)
  })
})
