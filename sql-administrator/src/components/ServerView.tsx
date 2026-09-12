import { useEffect } from 'react'

import { formatNumber, formatUptime } from '../lib/format'
import { useStore } from '../store'
import { RefreshIcon } from './Icons'

export function ServerView() {
  const overview = useStore((state) => state.overview)
  const processes = useStore((state) => state.processes)
  const loadServer = useStore((state) => state.loadServer)
  const session = useStore((state) => state.session)

  useEffect(() => {
    void loadServer()
  }, [loadServer])

  if (!overview) return <p className="panel-empty">Loading server information…</p>

  const stats = [
    { label: 'Version', value: `${overview.flavor ?? ''} ${overview.version ?? '—'}`.trim() },
    { label: 'Uptime', value: formatUptime(overview.uptime_seconds) },
    { label: 'Connected as', value: overview.current_user ?? session?.username ?? '—' },
    { label: 'Threads running', value: formatNumber(Number(overview.status.Threads_running ?? 0)) },
    { label: 'Threads connected', value: formatNumber(Number(overview.status.Threads_connected ?? 0)) },
    { label: 'Queries', value: formatNumber(Number(overview.status.Queries ?? 0)) },
    { label: 'Slow queries', value: formatNumber(Number(overview.status.Slow_queries ?? 0)) },
    { label: 'Server charset', value: overview.charset ?? overview.variables.character_set_server ?? '—' },
  ]

  return (
    <div className="panel panel-scroll">
      <div className="toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm" onClick={() => void loadServer()}>
            <RefreshIcon size={14} /> Refresh
          </button>
        </div>
      </div>

      <section className="structure-section">
        <div className="stat-grid">
          {stats.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <span className="stat-label">{stat.label}</span>
              <strong className="stat-value">{stat.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="structure-section">
        <h3>Processes ({processes.length})</h3>
        <div className="grid-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Id</th>
                <th>User</th>
                <th>Host</th>
                <th>DB</th>
                <th>Command</th>
                <th>Time</th>
                <th>State</th>
                <th>Info</th>
              </tr>
            </thead>
            <tbody>
              {processes.length === 0 ? (
                <tr>
                  <td className="grid-empty" colSpan={8}>
                    No active processes.
                  </td>
                </tr>
              ) : (
                processes.map((process) => (
                  <tr key={process.id}>
                    <td className="is-numeric">{process.id}</td>
                    <td>{process.user ?? ''}</td>
                    <td>{process.host ?? ''}</td>
                    <td className={process.db ? '' : 'is-null'}>{process.db ?? 'NULL'}</td>
                    <td>{process.command ?? ''}</td>
                    <td className="is-numeric">{process.time ?? ''}</td>
                    <td>{process.state ?? ''}</td>
                    <td>
                      <code>{process.info ?? ''}</code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="structure-section">
        <h3>Variables</h3>
        <div className="grid-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(overview.variables).map(([name, value]) => (
                <tr key={name}>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td>
                    <code>{String(value)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
