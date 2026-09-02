import { useEditorStore } from '../store'
import './Header.css'

function Header() {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const isDarkMode = useEditorStore((state) => state.isDarkMode)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const toggleDarkMode = useEditorStore((state) => state.toggleDarkMode)
  const toggleScrollSync = useEditorStore((state) => state.toggleScrollSync)
  const logout = useEditorStore((state) => state.logout)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const history = useEditorStore((state) => state.history)
  const historyIndex = useEditorStore((state) => state.historyIndex)

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">📝 Markdown Editor</h1>
      </div>

      <div className="header-center">
        <button
          className="header-btn"
          onClick={undo}
          disabled={historyIndex === 0}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          className="header-btn"
          onClick={redo}
          disabled={historyIndex === history.length - 1}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
      </div>

      <div className="header-right">
        <button
          className={`header-btn ${scrollSync ? 'active' : ''}`}
          onClick={toggleScrollSync}
          title="Toggle scroll sync"
        >
          🔗 {scrollSync ? 'Sync On' : 'Sync Off'}
        </button>
        <button
          className={`header-btn ${isDarkMode ? 'active' : ''}`}
          onClick={toggleDarkMode}
          title="Toggle dark mode"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        {isAdmin && (
          <button
            className="header-btn danger"
            onClick={logout}
            title="Logout"
          >
            Logout
          </button>
        )}
        <span className="header-user-status">
          {isAdmin ? '👤 Admin' : '👁️ View Only'}
        </span>
      </div>
    </header>
  )
}

export default Header
