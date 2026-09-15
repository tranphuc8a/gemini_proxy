import { useStore } from '../store'
import type { Tab } from '../types'
import { IconLeaf, IconLogout, IconTheme } from './Icons'

const TABS: { id: Tab; label: string; needsCollection: boolean }[] = [
  { id: 'documents', label: 'Documents', needsCollection: true },
  { id: 'indexes', label: 'Indexes', needsCollection: true },
  { id: 'aggregate', label: 'Aggregate', needsCollection: true },
  { id: 'stats', label: 'Stats', needsCollection: false },
  { id: 'backup', label: 'Backup', needsCollection: false },
  { id: 'server', label: 'Server', needsCollection: false },
]

export function Topbar() {
  const session = useStore((state) => state.session)
  const tab = useStore((state) => state.tab)
  const setTab = useStore((state) => state.setTab)
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const theme = useStore((state) => state.theme)
  const setTheme = useStore((state) => state.setTheme)
  const disconnect = useStore((state) => state.disconnect)
  const busy = useStore((state) => state.busy)

  const target = session
    ? `${session.username ? `${session.username}@` : ''}${session.host}${session.port ? `:${session.port}` : ''}`
    : ''

  return (
    <header className="topbar">
      <div className="topbar-identity">
        <IconLeaf size={18} />
        <div className="topbar-target">
          <strong>{session?.label || target}</strong>
          <span>
            {session?.server_flavor ?? 'MongoDB'} {session?.server_version ?? ''}
            {session?.topology ? ` · ${session.topology}` : ''}
          </span>
        </div>
      </div>

      <div className="breadcrumb">
        {activeDb ? <span>{activeDb}</span> : <span className="is-muted">no database selected</span>}
        {activeCollection ? (
          <>
            <span className="breadcrumb-sep">/</span>
            <strong>{activeCollection}</strong>
          </>
        ) : null}
      </div>

      <nav className="topbar-tabs" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`tab${tab === entry.id ? ' is-active' : ''}`}
            disabled={entry.needsCollection && !activeCollection}
            title={entry.needsCollection && !activeCollection ? 'Select a collection first' : undefined}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        {busy ? <span className="spinner" aria-label="Working" /> : null}
        <button
          type="button"
          className="icon-btn"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <IconTheme />
        </button>
        <button type="button" className="btn btn-sm" onClick={() => disconnect()}>
          <IconLogout />
          Log out
        </button>
      </div>
    </header>
  )
}
