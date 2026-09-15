import { useStore } from '../store'
import {
  ArchiveIcon,
  ColumnsIcon,
  DatabaseIcon,
  LayersIcon,
  LogoutIcon,
  MoonIcon,
  ServerIcon,
  SunIcon,
  TableIcon,
  TerminalIcon,
} from './Icons'
import type { ViewName } from '../types'

// `needsDatabase` separates the tabs that work on a schema from the two that
// work on one table: Objects and Backup are about the database as a whole, so
// requiring a table selection would hide them exactly when they are wanted.
const TABS: {
  id: ViewName
  label: string
  icon: typeof TableIcon
  needsTable?: boolean
  needsDatabase?: boolean
}[] = [
  { id: 'browse', label: 'Browse', icon: TableIcon, needsTable: true },
  { id: 'structure', label: 'Structure', icon: ColumnsIcon, needsTable: true },
  { id: 'objects', label: 'Objects', icon: LayersIcon, needsDatabase: true },
  { id: 'backup', label: 'Backup', icon: ArchiveIcon, needsDatabase: true },
  { id: 'console', label: 'SQL', icon: TerminalIcon },
  { id: 'server', label: 'Server', icon: ServerIcon },
]

export function Topbar() {
  const session = useStore((state) => state.session)
  const view = useStore((state) => state.view)
  const setView = useStore((state) => state.setView)
  const disconnect = useStore((state) => state.disconnect)
  const currentDatabase = useStore((state) => state.currentDatabase)
  const currentTable = useStore((state) => state.currentTable)
  const theme = useStore((state) => state.theme)
  const toggleTheme = useStore((state) => state.toggleTheme)

  return (
    <header className="topbar">
      <div className="topbar-identity">
        <DatabaseIcon size={18} />
        <div className="topbar-target">
          <strong>
            {session?.username}@{session?.host}:{session?.port}
          </strong>
          <span>
            {session?.server_flavor ?? 'MySQL'} {session?.server_version ?? ''}
          </span>
        </div>
      </div>

      <nav className="topbar-tabs" aria-label="Views">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const disabled = Boolean(
            (tab.needsTable && !currentTable) || (tab.needsDatabase && !currentDatabase),
          )
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab${view === tab.id ? ' is-active' : ''}`}
              onClick={() => setView(tab.id)}
              disabled={disabled}
              title={disabled ? (tab.needsTable ? 'Chọn một bảng trước' : 'Chọn một database trước') : tab.label}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="topbar-right">
        <span className="breadcrumb">
          {currentDatabase ?? 'no database'}
          {currentTable ? ` / ${currentTable}` : ''}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => void disconnect()}>
          <LogoutIcon size={14} /> Log out
        </button>
      </div>
    </header>
  )
}
