import { buildDeleteTemplate, buildInsertTemplate, buildUpdateTemplate } from '../lib/sql'
import { useStore } from '../store'
import { useConfirm } from './useConfirm'
import { TerminalIcon, TrashIcon } from './Icons'

export function StructureView() {
  const structure = useStore((state) => state.structure)
  const setSql = useStore((state) => state.setSql)
  const setView = useStore((state) => state.setView)
  const truncateTable = useStore((state) => state.truncateTable)
  const dropTable = useStore((state) => state.dropTable)
  const notify = useStore((state) => state.notify)
  const [confirm, confirmDialog] = useConfirm()

  if (!structure) return <p className="panel-empty">Select a table to inspect its structure.</p>

  function toConsole(sql: string) {
    setSql(sql)
    setView('console')
  }

  async function handleTruncate() {
    const ok = await confirm({
      title: `Truncate ${structure!.table}?`,
      message: 'Every row is deleted and AUTO_INCREMENT resets. The table definition is kept.',
      confirmLabel: 'Truncate',
      danger: true,
      requireText: structure!.table,
    })
    if (ok) await truncateTable(structure!.database, structure!.table)
  }

  async function handleDrop() {
    const ok = await confirm({
      title: `Drop ${structure!.table}?`,
      message: 'The table and all of its data are deleted permanently.',
      confirmLabel: 'Drop table',
      danger: true,
      requireText: structure!.table,
    })
    if (ok) await dropTable(structure!.database, structure!.table)
  }

  return (
    <div className="panel panel-scroll">
      <div className="toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm" onClick={() => toConsole(buildInsertTemplate(structure))}>
            <TerminalIcon size={14} /> INSERT template
          </button>
          <button type="button" className="btn btn-sm" onClick={() => toConsole(buildUpdateTemplate(structure))}>
            UPDATE template
          </button>
          <button type="button" className="btn btn-sm" onClick={() => toConsole(buildDeleteTemplate(structure))}>
            DELETE template
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => void handleTruncate()}>
            Truncate
          </button>
          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => void handleDrop()}>
            <TrashIcon size={14} /> Drop table
          </button>
        </div>
      </div>

      <section className="structure-section">
        <h3>Columns</h3>
        <div className="grid-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Type</th>
                <th>Null</th>
                <th>Key</th>
                <th>Default</th>
                <th>Extra</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {structure.columns.map((column) => (
                <tr key={column.name}>
                  <td className="is-numeric">{column.position}</td>
                  <td>
                    <strong>{column.name}</strong>
                  </td>
                  <td>
                    <code>{column.column_type}</code>
                  </td>
                  <td className={column.nullable ? '' : 'is-null'}>{column.nullable ? 'YES' : 'NO'}</td>
                  <td>{column.key ? <span className="badge badge-pk">{column.key}</span> : ''}</td>
                  <td className={column.default === null ? 'is-null' : ''}>
                    {column.default === null || column.default === undefined ? 'NULL' : String(column.default)}
                  </td>
                  <td>{column.extra ?? ''}</td>
                  <td>{column.comment ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="structure-section">
        <h3>Indexes</h3>
        {structure.indexes.length === 0 ? (
          <p className="panel-note">No indexes.</p>
        ) : (
          <div className="grid-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Unique</th>
                  <th>Type</th>
                  <th>Columns</th>
                </tr>
              </thead>
              <tbody>
                {structure.indexes.map((index) => (
                  <tr key={index.name}>
                    <td>
                      <strong>{index.name}</strong>
                    </td>
                    <td>{index.unique ? 'YES' : 'NO'}</td>
                    <td>{index.index_type ?? ''}</td>
                    <td>{index.columns.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {structure.foreign_keys.length > 0 ? (
        <section className="structure-section">
          <h3>Foreign keys</h3>
          <div className="grid-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>Constraint</th>
                  <th>Column</th>
                  <th>References</th>
                </tr>
              </thead>
              <tbody>
                {structure.foreign_keys.map((key) => (
                  <tr key={`${key.name}-${key.column}`}>
                    <td>{key.name}</td>
                    <td>{key.column}</td>
                    <td>
                      {key.referenced_schema ? `${key.referenced_schema}.` : ''}
                      {key.referenced_table}.{key.referenced_column}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {structure.ddl ? (
        <section className="structure-section">
          <div className="structure-heading">
            <h3>CREATE statement</h3>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                void navigator.clipboard?.writeText(structure.ddl ?? '')
                notify('success', 'DDL copied to the clipboard')
              }}
            >
              copy
            </button>
          </div>
          <pre className="ddl-block">{structure.ddl}</pre>
        </section>
      ) : null}

      {confirmDialog}
    </div>
  )
}
