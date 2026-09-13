import { useState } from 'react'

import { useStore } from '../store'
import { preview } from '../lib/ejson'
import { formatBytes, formatNumber } from '../lib/format'
import { IconPencil, IconRefresh } from './Icons'
import { useConfirm } from './useConfirm'

/** Keys that deserve a headline tile; everything else lands in the table. */
const HEADLINE: { key: string; label: string; format: 'bytes' | 'number' }[] = [
  { key: 'count', label: 'Documents', format: 'number' },
  { key: 'objects', label: 'Documents', format: 'number' },
  { key: 'size', label: 'Data size', format: 'bytes' },
  { key: 'dataSize', label: 'Data size', format: 'bytes' },
  { key: 'storageSize', label: 'Storage size', format: 'bytes' },
  { key: 'totalIndexSize', label: 'Index size', format: 'bytes' },
  { key: 'avgObjSize', label: 'Average document', format: 'bytes' },
  { key: 'nindexes', label: 'Indexes', format: 'number' },
  { key: 'indexes', label: 'Indexes', format: 'number' },
  { key: 'collections', label: 'Collections', format: 'number' },
]

export function StatsView() {
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const stats = useStore((state) => state.stats)
  const loadStats = useStore((state) => state.loadStats)
  const renameCollection = useStore((state) => state.renameCollection)

  const { confirm, dialog } = useConfirm()
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')

  if (!activeDb) return <div className="placeholder">Select a database to see its statistics.</div>

  const values = stats?.stats ?? {}
  const seen = new Set<string>()
  const tiles = HEADLINE.filter((entry) => {
    if (!(entry.key in values) || seen.has(entry.label)) return false
    seen.add(entry.label)
    return true
  })
  const rest = Object.entries(values).filter(([key]) => !tiles.some((tile) => tile.key === key))

  async function onRename() {
    const target = newName.trim()
    if (!target || !activeDb || !activeCollection) return
    const ok = await confirm({
      title: `Rename "${activeCollection}" to "${target}"?`,
      body: 'Anything referring to the old name — application code, views, scripts — has to be updated.',
      confirmLabel: 'Rename',
      danger: false,
    })
    if (ok && (await renameCollection(activeDb, activeCollection, target))) {
      setRenaming(false)
      setNewName('')
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="toolbar-left">
          <strong className="panel-title">
            {activeCollection ? `${activeDb}.${activeCollection}` : activeDb}
          </strong>
          <button type="button" className="icon-btn" title="Refresh" onClick={() => loadStats()}>
            <IconRefresh />
          </button>
        </div>
        {activeCollection ? (
          <div className="toolbar-right">
            {renaming ? (
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  onRename()
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New collection name"
                  aria-label="New collection name"
                />
                <button type="submit" className="btn btn-sm" disabled={!newName.trim()}>
                  Rename
                </button>
                <button type="button" className="link-btn" onClick={() => setRenaming(false)}>
                  cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setNewName(activeCollection)
                  setRenaming(true)
                }}
              >
                <IconPencil />
                Rename collection
              </button>
            )}
          </div>
        ) : null}
      </div>

      {!stats ? (
        <div className="placeholder">Loading statistics…</div>
      ) : (
        <>
          <div className="tiles">
            {tiles.map((tile) => (
              <div key={tile.label} className="tile">
                <span className="tile-label">{tile.label}</span>
                <strong className="tile-value">
                  {tile.format === 'bytes'
                    ? formatBytes(Number(values[tile.key]))
                    : formatNumber(Number(values[tile.key]))}
                </strong>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table className="grid grid-kv">
              <tbody>
                {rest.map(([key, value]) => (
                  <tr key={key}>
                    <th>{key}</th>
                    <td className="cell-code">{preview(value, 200)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {dialog}
    </div>
  )
}
