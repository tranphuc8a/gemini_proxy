import { useMemo, useState } from 'react'

import { formatBytes, formatNumber } from '../lib/format'
import { useStore } from '../store'
import { useConfirm } from './useConfirm'
import { DatabaseIcon, PlusIcon, RefreshIcon, SearchIcon, TableIcon, TrashIcon, ViewIcon } from './Icons'

export function Sidebar() {
  const databases = useStore((state) => state.databases)
  const tables = useStore((state) => state.tables)
  const currentDatabase = useStore((state) => state.currentDatabase)
  const currentTable = useStore((state) => state.currentTable)
  const loadingTables = useStore((state) => state.loadingTables)
  const selectDatabase = useStore((state) => state.selectDatabase)
  const selectTable = useStore((state) => state.selectTable)
  const loadDatabases = useStore((state) => state.loadDatabases)
  const createDatabase = useStore((state) => state.createDatabase)
  const dropDatabase = useStore((state) => state.dropDatabase)

  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  const visibleTables = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return tables
    return tables.filter((table) => table.name.toLowerCase().includes(needle))
  }, [tables, filter])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    if (await createDatabase(name, 'utf8mb4')) {
      setNewName('')
      setCreating(false)
      await selectDatabase(name)
    }
  }

  async function handleDropDatabase(name: string) {
    const ok = await confirm({
      title: `Drop database ${name}?`,
      message: 'Every table, view and row inside it is deleted permanently. This cannot be undone.',
      confirmLabel: 'Drop database',
      danger: true,
      requireText: name,
    })
    if (ok) await dropDatabase(name)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Databases</span>
          <div className="sidebar-heading-actions">
            <button type="button" className="icon-btn" title="New database" onClick={() => setCreating((v) => !v)}>
              <PlusIcon size={14} />
            </button>
            <button type="button" className="icon-btn" title="Refresh" onClick={() => void loadDatabases()}>
              <RefreshIcon size={14} />
            </button>
          </div>
        </div>

        {creating ? (
          <div className="inline-form">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreate()
                if (event.key === 'Escape') setCreating(false)
              }}
              placeholder="database_name"
              autoFocus
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void handleCreate()}>
              Create
            </button>
          </div>
        ) : null}

        <select
          className="db-select"
          value={currentDatabase ?? ''}
          onChange={(event) => void selectDatabase(event.target.value || null)}
        >
          <option value="">Select a database…</option>
          {databases.map((database) => (
            <option key={database.name} value={database.name}>
              {database.name}
            </option>
          ))}
        </select>

        {currentDatabase ? (
          <button
            type="button"
            className="link-danger"
            onClick={() => void handleDropDatabase(currentDatabase)}
          >
            <TrashIcon size={12} /> Drop {currentDatabase}
          </button>
        ) : null}
      </div>

      <div className="sidebar-section sidebar-tables">
        <div className="sidebar-heading">
          <span>
            Tables {currentDatabase ? <em>{visibleTables.length}</em> : null}
          </span>
        </div>

        <div className="sidebar-search">
          <SearchIcon size={14} />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter tables"
            disabled={!currentDatabase}
          />
        </div>

        <div className="table-list">
          {!currentDatabase ? (
            <p className="sidebar-empty">
              <DatabaseIcon size={18} />
              Pick a database to list its tables.
            </p>
          ) : loadingTables ? (
            <p className="sidebar-empty">Loading…</p>
          ) : visibleTables.length === 0 ? (
            <p className="sidebar-empty">No tables match.</p>
          ) : (
            visibleTables.map((table) => {
              const isView = table.type !== 'BASE TABLE'
              return (
                <button
                  key={table.name}
                  type="button"
                  className={`table-item${currentTable === table.name ? ' is-active' : ''}`}
                  onClick={() => void selectTable(table.name)}
                  title={`${table.name}${table.comment ? ` — ${table.comment}` : ''}`}
                >
                  {isView ? <ViewIcon size={14} /> : <TableIcon size={14} />}
                  <span className="table-item-name">{table.name}</span>
                  <span className="table-item-meta">
                    {isView ? 'view' : `${formatNumber(table.rows)} · ${formatBytes(table.data_length)}`}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {confirmDialog}
    </aside>
  )
}
