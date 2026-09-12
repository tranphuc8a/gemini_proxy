import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import { formatDuration, pageRange } from '../lib/format'
import { buildSelect, canEditRows, rowKey } from '../lib/sql'
import { downloadBlob } from '../lib/storage'
import { useStore } from '../store'
import { useConfirm } from './useConfirm'
import { DataGrid } from './DataGrid'
import { DownloadIcon, PlusIcon, RefreshIcon, SearchIcon, TerminalIcon, TrashIcon } from './Icons'
import { RowEditor } from './RowEditor'
import type { CellValue } from '../types'

const PAGE_SIZES = [25, 50, 100, 250, 500]

export function TableBrowser() {
  const page = useStore((state) => state.page)
  const structure = useStore((state) => state.structure)
  const loading = useStore((state) => state.loadingRows)
  const limit = useStore((state) => state.limit)
  const offset = useStore((state) => state.offset)
  const sort = useStore((state) => state.sort)
  const search = useStore((state) => state.search)
  const selected = useStore((state) => state.selectedRows)
  const database = useStore((state) => state.currentDatabase)
  const table = useStore((state) => state.currentTable)

  const refreshRows = useStore((state) => state.refreshRows)
  const setLimit = useStore((state) => state.setLimit)
  const setOffset = useStore((state) => state.setOffset)
  const toggleSort = useStore((state) => state.toggleSort)
  const setSearch = useStore((state) => state.setSearch)
  const toggleRowSelection = useStore((state) => state.toggleRowSelection)
  const clearRowSelection = useStore((state) => state.clearRowSelection)
  const insertRow = useStore((state) => state.insertRow)
  const updateRow = useStore((state) => state.updateRow)
  const deleteSelectedRows = useStore((state) => state.deleteSelectedRows)
  const setSql = useStore((state) => state.setSql)
  const setView = useStore((state) => state.setView)
  const notify = useStore((state) => state.notify)

  const [searchDraft, setSearchDraft] = useState(search)
  const [editor, setEditor] = useState<{ mode: 'insert' | 'edit'; index?: number } | null>(null)
  const [confirm, confirmDialog] = useConfirm()

  useEffect(() => setSearchDraft(search), [search])

  if (!database || !table) return <p className="panel-empty">Select a table to browse its rows.</p>
  if (!page || !structure) return <p className="panel-empty">{loading ? 'Loading rows…' : 'No data yet.'}</p>

  const columns = page.columns.map((column) => column.name)
  const rows: CellValue[][] = page.rows.map((row) => columns.map((column) => row[column] ?? null))
  const editable = canEditRows(structure)
  const lastPageOffset = Math.max(0, Math.floor((page.total - 1) / limit) * limit)

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete ${selected.length} row(s)?`,
      message: 'The rows are removed from the table permanently.',
      confirmLabel: 'Delete rows',
      danger: true,
    })
    if (ok) await deleteSelectedRows()
  }

  async function handleExport(format: 'csv' | 'json' | 'sql') {
    try {
      const { blob, filename } = await api.exportTable(database!, table!, format, 10000)
      downloadBlob(blob, filename)
      notify('success', `Exported ${filename}`)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : String(error))
    }
  }

  function sendToConsole() {
    setSql(buildSelect(database!, table!, limit))
    setView('console')
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm" onClick={() => void refreshRows()} disabled={loading}>
            <RefreshIcon size={14} /> Refresh
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setEditor({ mode: 'insert' })} disabled={!editable}>
            <PlusIcon size={14} /> Insert
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger-ghost"
            onClick={() => void handleDelete()}
            disabled={selected.length === 0}
          >
            <TrashIcon size={14} /> Delete{selected.length ? ` (${selected.length})` : ''}
          </button>
          <button type="button" className="btn btn-sm" onClick={sendToConsole}>
            <TerminalIcon size={14} /> Open in SQL
          </button>
        </div>

        <form
          className="toolbar-search"
          onSubmit={(event) => {
            event.preventDefault()
            void setSearch(searchDraft)
          }}
        >
          <SearchIcon size={14} />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search all columns"
            aria-label="Search rows"
          />
          {search ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setSearchDraft('')
                void setSearch('')
              }}
            >
              clear
            </button>
          ) : null}
        </form>

        <div className="toolbar-group">
          <div className="export-group">
            <DownloadIcon size={14} />
            {(['csv', 'json', 'sql'] as const).map((format) => (
              <button key={format} type="button" className="link-btn" onClick={() => void handleExport(format)}>
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={rows}
        meta={page.columns}
        sort={sort}
        onSort={(column) => void toggleSort(column)}
        selectable={editable}
        selected={selected}
        onToggleRow={toggleRowSelection}
        onToggleAll={() => {
          if (selected.length === rows.length) clearRowSelection()
          else rows.forEach((_, index) => !selected.includes(index) && toggleRowSelection(index))
        }}
        onEditRow={editable ? (index) => setEditor({ mode: 'edit', index }) : undefined}
        emptyMessage={search ? 'No rows match the search.' : 'This table is empty.'}
      />

      <div className="pager">
        <div className="pager-info">
          {pageRange(offset, limit, page.total)}
          <span className="pager-timing">· {formatDuration(page.duration_ms)}</span>
          {!editable ? <span className="pager-warning">· read-only: no primary key</span> : null}
        </div>
        <div className="pager-controls">
          <label className="pager-size">
            Rows
            <select value={limit} onChange={(event) => void setLimit(Number(event.target.value))}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-sm" onClick={() => void setOffset(0)} disabled={offset === 0}>
            « First
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void setOffset(offset - limit)}
            disabled={offset === 0}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void setOffset(offset + limit)}
            disabled={offset + limit >= page.total}
          >
            Next ›
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void setOffset(lastPageOffset)}
            disabled={offset >= lastPageOffset}
          >
            Last »
          </button>
        </div>
      </div>

      {editor ? (
        <RowEditor
          mode={editor.mode}
          columns={page.columns}
          row={editor.mode === 'edit' && editor.index !== undefined ? page.rows[editor.index] : undefined}
          onCancel={() => setEditor(null)}
          onSave={async (values) => {
            const ok =
              editor.mode === 'insert'
                ? await insertRow(values)
                : await updateRow(values, rowKey(page.rows[editor.index!], structure))
            if (ok) setEditor(null)
          }}
        />
      ) : null}

      {confirmDialog}
    </div>
  )
}
