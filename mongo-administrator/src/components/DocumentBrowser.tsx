import { useMemo, useState } from 'react'

import { useStore } from '../store'
import { documentKey, kindOf, preview, toShell, valueAtPath } from '../lib/ejson'
import { formatDuration, formatNumber, formatRange } from '../lib/format'
import type { EjsonDocument } from '../types'
import { DocumentEditor } from './DocumentEditor'
import { IconCopy, IconDownload, IconPencil, IconPlay, IconPlus, IconRefresh, IconTrash } from './Icons'
import { JsonEditor } from './JsonEditor'
import { useConfirm } from './useConfirm'

const PAGE_SIZES = [10, 25, 50, 100, 200]

export function DocumentBrowser() {
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const page = useStore((state) => state.page)
  const filterText = useStore((state) => state.filterText)
  const projectionText = useStore((state) => state.projectionText)
  const sortText = useStore((state) => state.sortText)
  const setFilterText = useStore((state) => state.setFilterText)
  const setProjectionText = useStore((state) => state.setProjectionText)
  const setSortText = useStore((state) => state.setSortText)
  const queryError = useStore((state) => state.queryError)
  const limit = useStore((state) => state.limit)
  const setLimit = useStore((state) => state.setLimit)
  const skip = useStore((state) => state.skip)
  const runFind = useStore((state) => state.runFind)
  const goToPage = useStore((state) => state.goToPage)
  const viewMode = useStore((state) => state.viewMode)
  const setViewMode = useStore((state) => state.setViewMode)
  const selected = useStore((state) => state.selected)
  const toggleSelected = useStore((state) => state.toggleSelected)
  const clearSelection = useStore((state) => state.clearSelection)
  const insertDocument = useStore((state) => state.insertDocument)
  const replaceDocument = useStore((state) => state.replaceDocument)
  const deleteDocument = useStore((state) => state.deleteDocument)
  const deleteSelected = useStore((state) => state.deleteSelected)
  const truncateCollection = useStore((state) => state.truncateCollection)
  const exportCollection = useStore((state) => state.exportCollection)
  const toast = useStore((state) => state.toast)

  const { confirm, dialog } = useConfirm()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState<{ mode: 'insert' | 'edit'; document: EjsonDocument | null } | null>(null)

  const namespace = activeDb && activeCollection ? `${activeDb}.${activeCollection}` : ''
  const documents = page?.documents ?? []

  const columns = useMemo(() => {
    if (!page) return []
    // `fields` is the server's union of top-level keys; keep at most a dozen so
    // a document with 200 fields does not produce an unreadable table.
    return page.fields.slice(0, 12)
  }, [page])

  async function onDelete(document: EjsonDocument) {
    const ok = await confirm({
      title: 'Delete this document?',
      body: `It is removed from ${namespace}. This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (ok) await deleteDocument(document)
  }

  async function onDeleteSelected() {
    const ok = await confirm({
      title: `Delete ${selected.length} selected document${selected.length === 1 ? '' : 's'}?`,
      body: `They are removed from ${namespace}. This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (ok) await deleteSelected()
  }

  async function onTruncate() {
    if (!activeDb || !activeCollection) return
    const ok = await confirm({
      title: `Empty "${activeCollection}"?`,
      body: 'Every document is deleted. The collection, its options and its indexes stay.',
      confirmWord: activeCollection,
      confirmLabel: 'Delete all documents',
    })
    if (ok) await truncateCollection(activeDb, activeCollection)
  }

  async function copyDocument(document: EjsonDocument) {
    try {
      await navigator.clipboard.writeText(toShell(document))
      toast('success', 'Document copied')
    } catch {
      toast('error', 'The browser refused clipboard access')
    }
  }

  if (!activeDb || !activeCollection) {
    return <div className="placeholder">Select a collection to browse its documents.</div>
  }

  const hasPrevious = skip > 0
  const hasNext = page ? (page.total ? skip + documents.length < page.total : page.truncated) : false

  return (
    <div className="browser">
      <div className="query-bar">
        <div className="query-main">
          <JsonEditor
            value={filterText}
            onChange={setFilterText}
            onSubmit={() => runFind({ skip: 0 })}
            rows={2}
            label="Filter"
            placeholder='{ status: "active" }  ·  { _id: ObjectId("…") }'
          />
          <div className="query-actions">
            <button type="button" className="btn btn-primary" onClick={() => runFind({ skip: 0 })}>
              <IconPlay />
              Find
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? 'Fewer options' : 'Sort & project'}
            </button>
          </div>
        </div>

        {showAdvanced ? (
          <div className="query-advanced">
            <JsonEditor
              value={sortText}
              onChange={setSortText}
              onSubmit={() => runFind({ skip: 0 })}
              rows={2}
              label="Sort"
              placeholder="{ createdAt: -1 }"
            />
            <JsonEditor
              value={projectionText}
              onChange={setProjectionText}
              onSubmit={() => runFind({ skip: 0 })}
              rows={2}
              label="Projection"
              placeholder="{ name: 1, email: 1 }"
            />
          </div>
        ) : null}

        {queryError ? <div className="query-error">{queryError}</div> : null}
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button type="button" className="btn btn-sm" onClick={() => setEditing({ mode: 'insert', document: null })}>
            <IconPlus />
            Insert
          </button>
          <button type="button" className="icon-btn" title="Re-run the query" onClick={() => runFind({ skip })}>
            <IconRefresh />
          </button>
          <div className="segmented segmented-sm" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'table' ? 'is-active' : ''}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={viewMode === 'json' ? 'is-active' : ''}
              onClick={() => setViewMode('json')}
            >
              JSON
            </button>
          </div>
          {selected.length > 0 ? (
            <>
              <span className="selection-count">{selected.length} selected</span>
              <button type="button" className="btn btn-sm btn-danger-ghost" onClick={onDeleteSelected}>
                <IconTrash />
                Delete
              </button>
              <button type="button" className="link-btn" onClick={clearSelection}>
                clear
              </button>
            </>
          ) : null}
        </div>

        <div className="toolbar-right">
          <label className="inline-select">
            <span>Rows</span>
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value))
                runFind({ skip: 0 })
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="export-menu">
            <button type="button" className="icon-btn" title="Export as JSON" onClick={() => exportCollection('json', 1000)}>
              <IconDownload />
            </button>
            <button type="button" className="link-btn" onClick={() => exportCollection('csv', 1000)}>
              csv
            </button>
          </div>

          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={onTruncate}>
            Empty collection
          </button>
        </div>
      </div>

      <div className="result-area">
        {!page ? (
          <div className="placeholder">Run a query to see documents.</div>
        ) : documents.length === 0 ? (
          <div className="placeholder">No documents match this filter.</div>
        ) : viewMode === 'json' ? (
          <div className="json-list">
            {documents.map((document, index) => {
              const key = documentKey(document, index)
              return (
                <article key={key} className="json-card">
                  <header>
                    <span className="json-card-index">#{skip + index + 1}</span>
                    <div className="json-card-actions">
                      <button type="button" className="icon-btn" title="Copy" onClick={() => copyDocument(document)}>
                        <IconCopy />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit"
                        onClick={() => setEditing({ mode: 'edit', document })}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        title="Delete"
                        onClick={() => onDelete(document)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </header>
                  <pre>{toShell(document)}</pre>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="col-select" />
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {documents.map((document, index) => {
                  const key = documentKey(document, index)
                  const isSelected = selected.includes(key)
                  return (
                    <tr key={key} className={isSelected ? 'is-selected' : undefined}>
                      <td className="col-select">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(key)}
                          aria-label={`Select document ${index + 1}`}
                        />
                      </td>
                      {columns.map((column) => {
                        const value = valueAtPath(document, column)
                        return (
                          <td key={column} className={`cell cell-${kindOf(value)}`} title={preview(value, 400)}>
                            {value === undefined ? <span className="cell-absent">—</span> : preview(value)}
                          </td>
                        )
                      })}
                      <td className="col-actions">
                        <button type="button" className="icon-btn" title="Copy" onClick={() => copyDocument(document)}>
                          <IconCopy />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit"
                          onClick={() => setEditing({ mode: 'edit', document })}
                        >
                          <IconPencil />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          title="Delete"
                          onClick={() => onDelete(document)}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {page.fields.length > columns.length ? (
              <p className="table-note">
                Showing the first {columns.length} of {page.fields.length} fields. Switch to JSON to see everything.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <footer className="pager">
        <span className="pager-range">
          {page ? formatRange(skip, documents.length, page.total) : '—'}
          {page ? <em> · {formatDuration(page.duration_ms)}</em> : null}
        </span>
        <div className="pager-buttons">
          <button type="button" className="btn btn-sm" disabled={!hasPrevious} onClick={() => goToPage(0)}>
            First
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!hasPrevious}
            onClick={() => goToPage(Math.max(0, skip - limit))}
          >
            Previous
          </button>
          <button type="button" className="btn btn-sm" disabled={!hasNext} onClick={() => goToPage(skip + limit)}>
            Next
          </button>
        </div>
        {page?.total ? <span className="pager-total">{formatNumber(page.total)} total</span> : null}
      </footer>

      {editing ? (
        <DocumentEditor
          mode={editing.mode}
          document={editing.document}
          namespace={namespace}
          onClose={() => setEditing(null)}
          onSave={(text) =>
            editing.mode === 'insert'
              ? insertDocument(text)
              : replaceDocument(editing.document as EjsonDocument, text)
          }
        />
      ) : null}
      {dialog}
    </div>
  )
}
