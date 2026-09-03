import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useEditorStore } from '../store'
import './Header.css'

function Header() {
  const [storageMessage, setStorageMessage] = useState('')
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
  const viewMode = useEditorStore((state) => state.viewMode)
  const setViewMode = useEditorStore((state) => state.setViewMode)
  const currentContent = useEditorStore((state) => state.currentContent)
  const setContent = useEditorStore((state) => state.setContent)
  const backendStorage = useEditorStore((state) => state.backendStorage)
  const backendStorageType = useEditorStore((state) => state.backendStorageType)
  const toggleBackendStorage = useEditorStore((state) => state.toggleBackendStorage)
  const setBackendStorageType = useEditorStore((state) => state.setBackendStorageType)
  const loadBackendStorage = useEditorStore((state) => state.loadBackendStorage)
  const saveBackendStorage = useEditorStore((state) => state.saveBackendStorage)

  const exportMarkdown = () => {
    const blob = new Blob([currentContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'document.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importMarkdown = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setContent(String(reader.result ?? ''))
    reader.readAsText(file)
    event.target.value = ''
  }

  const syncBackend = async (action: 'load' | 'save') => {
    try {
      if (action === 'load') await loadBackendStorage()
      else await saveBackendStorage()
      setStorageMessage(action === 'load' ? 'Loaded' : 'Saved')
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : 'Backend unavailable')
    }
  }

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
        <div className="view-mode-control" aria-label="View mode">
          <button className={`header-btn ${viewMode === 'editor' ? 'active' : ''}`} onClick={() => setViewMode('editor')}>Editor</button>
          <button className={`header-btn ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')}>Both</button>
          <button className={`header-btn ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')}>Preview</button>
        </div>
      </div>

      <div className="header-right">
        <label className="header-btn import-btn" title="Import Markdown file">
          Import
          <input type="file" accept=".md,.markdown,text/markdown" onChange={importMarkdown} />
        </label>
        <button className="header-btn" onClick={exportMarkdown} title="Export Markdown file">Export</button>
        <select
          className="storage-select"
          value={backendStorageType}
          onChange={(event) => setBackendStorageType(event.target.value as 'json' | 'mysql')}
          title="Backend storage type"
        >
          <option value="json">BE JSON</option>
          <option value="mysql">BE MySQL</option>
        </select>
        <button className={`header-btn ${backendStorage ? 'active' : ''}`} onClick={toggleBackendStorage} title="Enable backend storage">
          {backendStorage ? 'BE On' : 'BE Off'}
        </button>
        {backendStorage && <button className="header-btn" onClick={() => void syncBackend('load')} title="Load files from backend">Load</button>}
        {backendStorage && <button className="header-btn" onClick={() => void syncBackend('save')} title="Save files to backend">Save</button>}
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
      {storageMessage && <span className="storage-message" role="status">{storageMessage}</span>}
    </header>
  )
}

export default Header
