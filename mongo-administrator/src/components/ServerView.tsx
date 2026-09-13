import { useStore } from '../store'
import { preview } from '../lib/ejson'
import { formatBytes, formatNumber, formatUptime } from '../lib/format'
import { IconRefresh } from './Icons'

export function ServerView() {
  const overview = useStore((state) => state.overview)
  const operations = useStore((state) => state.operations)
  const loadServer = useStore((state) => state.loadServer)
  const session = useStore((state) => state.session)

  if (!overview) {
    return (
      <div className="panel">
        <div className="placeholder">
          Loading server information…
          <button type="button" className="link-btn" onClick={() => loadServer()}>
            retry
          </button>
        </div>
      </div>
    )
  }

  const connections = overview.connections as Record<string, unknown>
  const opcounters = overview.opcounters as Record<string, unknown>
  const memory = overview.memory as Record<string, unknown>

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="toolbar-left">
          <strong className="panel-title">{overview.host ?? session?.host}</strong>
          <span className="badge">{overview.flavor ?? 'MongoDB'} {overview.version}</span>
          {overview.topology ? <span className="badge badge-muted">{overview.topology}</span> : null}
          {overview.storage_engine ? <span className="badge badge-muted">{overview.storage_engine}</span> : null}
        </div>
        <div className="toolbar-right">
          <button type="button" className="icon-btn" title="Refresh" onClick={() => loadServer()}>
            <IconRefresh />
          </button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="tile-label">Uptime</span>
          <strong className="tile-value">{formatUptime(overview.uptime_seconds)}</strong>
        </div>
        <div className="tile">
          <span className="tile-label">Connections</span>
          <strong className="tile-value">{formatNumber(Number(connections.current ?? 0))}</strong>
          <span className="tile-note">{formatNumber(Number(connections.available ?? 0))} available</span>
        </div>
        <div className="tile">
          <span className="tile-label">Resident memory</span>
          <strong className="tile-value">{formatBytes(Number(memory.resident ?? 0) * 1024 * 1024)}</strong>
        </div>
        <div className="tile">
          <span className="tile-label">Authenticated as</span>
          <strong className="tile-value tile-value-sm">{overview.current_user ?? '—'}</strong>
        </div>
      </div>

      <section className="panel-section">
        <h3>Operation counters</h3>
        <div className="tiles tiles-compact">
          {Object.entries(opcounters).map(([key, value]) => (
            <div key={key} className="tile tile-sm">
              <span className="tile-label">{key}</span>
              <strong className="tile-value">{formatNumber(Number(value))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Operations in progress</h3>
        {operations.length === 0 ? (
          <p className="is-muted">Nothing running, or the account lacks the privilege to look.</p>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>opid</th>
                  <th>op</th>
                  <th>namespace</th>
                  <th>secs</th>
                  <th>client</th>
                  <th>active</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((operation, index) => (
                  <tr key={`${preview(operation.opid)}-${index}`}>
                    <td className="cell-code">{preview(operation.opid)}</td>
                    <td>{operation.op ?? '—'}</td>
                    <td className="cell-code">{operation.ns ?? '—'}</td>
                    <td>{operation.secs_running ?? 0}</td>
                    <td className="cell-code">{operation.client ?? '—'}</td>
                    <td>{operation.active ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel-section">
        <h3>Build</h3>
        <div className="table-wrap">
          <table className="grid grid-kv">
            <tbody>
              {Object.entries(overview.build as Record<string, unknown>).map(([key, value]) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td className="cell-code">{preview(value, 200)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
