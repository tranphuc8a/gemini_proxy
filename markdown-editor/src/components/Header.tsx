import { useState } from 'react'
import type { ChangeEvent } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
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
  const sidebarCollapsed = useEditorStore((state) => state.sidebarCollapsed)
  const fullscreen = useEditorStore((state) => state.fullscreen)
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar)
  const toggleFullscreen = useEditorStore((state) => state.toggleFullscreen)

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

  const exportPreviewImage = async (format: 'png' | 'jpeg') => {
    const preview = document.querySelector('.markdown-body') as HTMLElement | null
    if (!preview) return
    const canvas = await html2canvas(preview, { backgroundColor: isDarkMode ? '#0d1117' : '#ffffff', scale: 2 })
    const link = document.createElement('a')
    link.download = `document.${format === 'jpeg' ? 'jpg' : 'png'}`
    link.href = canvas.toDataURL(`image/${format}`, 0.95)
    link.click()
  }

  const exportPreviewPdf = async () => {
    const preview = document.querySelector('.markdown-body') as HTMLElement | null
    if (!preview) return
    const canvas = await html2canvas(preview, { backgroundColor: isDarkMode ? '#0d1117' : '#ffffff', scale: 2 })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const width = 190
    const height = (canvas.height * width) / canvas.width
    let offset = 0
    while (offset < height) {
      if (offset) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, -offset + 10, width, height)
      offset += 277
    }
    pdf.save('document.pdf')
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
        <button className="header-btn" onClick={toggleSidebar} title="Collapse or expand file sidebar">{sidebarCollapsed ? 'Show files' : 'Hide files'}</button>
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
        <button className="header-btn" onClick={() => void exportPreviewPdf()} title="Export rendered preview as PDF">PDF</button>
        <button className="header-btn" onClick={() => void exportPreviewImage('png')} title="Export rendered preview as PNG">PNG</button>
        <button className="header-btn" onClick={() => void exportPreviewImage('jpeg')} title="Export rendered preview as JPG">JPG</button>
        <button className="header-btn" onClick={toggleFullscreen} title="Toggle fullscreen">{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
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
