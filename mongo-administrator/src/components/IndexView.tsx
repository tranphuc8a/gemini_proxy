import { useState } from 'react'

import { useStore } from '../store'
import { preview } from '../lib/ejson'
import { IconKey, IconPlus, IconRefresh, IconTrash } from './Icons'
import { useConfirm } from './useConfirm'

export function IndexView() {
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const indexes = useStore((state) => state.indexes)
  const loadIndexes = useStore((state) => state.loadIndexes)
  const createIndex = useStore((state) => state.createIndex)
  const dropIndex = useStore((state) => state.dropIndex)

  const { confirm, dialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [keysText, setKeysText] = useState('{ field: 1 }')
  const [name, setName] = useState('')
  const [unique, setUnique] = useState(false)
  const [sparse, setSparse] = useState(false)
  const [ttl, setTtl] = useState('')

  async function onDrop(indexName: string) {
    const ok = await confirm({
      title: `Drop index "${indexName}"?`,
      body: `Queries on ${activeDb}.${activeCollection} that relied on it will fall back to a collection scan.`,
      confirmLabel: 'Drop index',
    })
    if (ok) await dropIndex(indexName)
  }

  async function onCreate() {
    if (await createIndex({ keysText, name, unique, sparse, ttl })) {
      setOpen(false)
      setKeysText('{ field: 1 }')
      setName('')
      setUnique(false)
      setSparse(false)
      setTtl('')
    }
  }

  if (!activeCollection) return <div className="placeholder">Select a collection to see its indexes.</div>

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="toolbar-left">
          <button type="button" className="btn btn-sm" onClick={() => setOpen((current) => !current)}>
            <IconPlus />
            New index
          </button>
          <button type="button" className="icon-btn" title="Refresh" onClick={() => loadIndexes()}>
            <IconRefresh />
          </button>
        </div>
        <div className="toolbar-right">
          <span className="is-muted">{indexes.length} index{indexes.length === 1 ? '' : 'es'}</span>
        </div>
      </div>

      {open ? (
        <form
          className="index-form"
          onSubmit={(event) => {
            event.preventDefault()
            onCreate()
          }}
        >
          <label className="field field-grow">
            <span>Keys</span>
            <input
              className="code-input"
              value={keysText}
              onChange={(event) => setKeysText(event.target.value)}
              placeholder='{ email: 1 } · { location: "2dsphere" }'
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>
              Name <em>optional</em>
            </span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="auto" />
          </label>
          <label className="field field-narrow">
            <span>
              TTL <em>seconds</em>
            </span>
            <input
              type="number"
              min={0}
              value={ttl}
              onChange={(event) => setTtl(event.target.value)}
              placeholder="—"
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={unique} onChange={(event) => setUnique(event.target.checked)} />
            <span>Unique</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={sparse} onChange={(event) => setSparse(event.target.checked)} />
            <span>Sparse</span>
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            Create
          </button>
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>Keys</th>
              <th>Properties</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {indexes.length === 0 ? (
              <tr>
                <td colSpan={4} className="placeholder-cell">
                  No indexes loaded yet.
                </td>
              </tr>
            ) : null}
            {indexes.map((index) => (
              <tr key={index.name}>
                <td className="cell-strong">
                  {index.name === '_id_' ? <IconKey size={12} /> : null} {index.name}
                </td>
                <td className="cell-code">
                  {index.keys.map(([field, direction]) => `${field}: ${preview(direction)}`).join(', ')}
                </td>
                <td>
                  {index.unique ? <span className="badge">unique</span> : null}
                  {index.sparse ? <span className="badge">sparse</span> : null}
                  {index.ttl_seconds !== null ? <span className="badge">ttl {index.ttl_seconds}s</span> : null}
                  {index.partial_filter ? <span className="badge">partial</span> : null}
                  {index.name === '_id_' ? <span className="badge badge-muted">default</span> : null}
                </td>
                <td className="col-actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    disabled={index.name === '_id_'}
                    title={index.name === '_id_' ? 'The _id index cannot be dropped' : 'Drop index'}
                    onClick={() => onDrop(index.name)}
                  >
                    <IconTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  )
}
