import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { resolveTheme, useEditorStore } from '../store'
import { findNode, getPath } from '../lib/tree'
import { exportHtml, exportImage, exportMarkdown, exportPdf } from '../lib/exporters'
import {
  IconChevron,
  IconCloud,
  IconDownload,
  IconExpand,
  IconEye,
  IconHelp,
  IconLink2,
  IconLock,
  IconMoon,
  IconPrinter,
  IconRedo,
  IconSearch,
  IconSidebar,
  IconSun,
  IconUndo,
  IconUpload
} from './Icons'
import './Header.css'

interface HeaderProps {
  onOpenHelp: () => void
  onOpenPalette: () => void
  onOpenAuth: () => void
}

function Header({ onOpenHelp, onOpenPalette, onOpenAuth }: HeaderProps) {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const theme = useEditorStore((state) => state.theme)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const viewMode = useEditorStore((state) => state.viewMode)
  const files = useEditorStore((state) => state.files)
  const currentFileId = useEditorStore((state) => state.currentFileId)
  const currentContent = useEditorStore((state) => state.currentContent)
  const sidebarCollapsed = useEditorStore((state) => state.sidebarCollapsed)
  const historyIndex = useEditorStore((state) => state.historyIndex)
  const historyLength = useEditorStore((state) => state.history.length)
  const backendStorage = useEditorStore((state) => state.backendStorage)
  const backendStorageType = useEditorStore((state) => state.backendStorageType)

  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const setViewMode = useEditorStore((state) => state.setViewMode)
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar)
  const toggleTheme = useEditorStore((state) => state.toggleTheme)
  const toggleScrollSync = useEditorStore((state) => state.toggleScrollSync)
  const toggleFullscreen = useEditorStore((state) => state.toggleFullscreen)
  const importFile = useEditorStore((state) => state.importFile)
  const logout = useEditorStore((state) => state.logout)
  const pushToast = useEditorStore((state) => state.pushToast)
  const setBackendStorageType = useEditorStore((state) => state.setBackendStorageType)
  const toggleBackendStorage = useEditorStore((state) => state.toggleBackendStorage)
  const loadBackendStorage = useEditorStore((state) => state.loadBackendStorage)
  const saveBackendStorage = useEditorStore((state) => state.saveBackendStorage)

  const [busy, setBusy] = useState<string | null>(null)
  const fileName = findNode(files, currentFileId)?.name ?? 'Untitled'
  const breadcrumb = currentFileId ? getPath(files, currentFileId).map((node) => node.name) : ['Untitled']

  const withPreview = async (label: string, action: (preview: HTMLElement) => Promise<void>) => {
    const preview = document.querySelector<HTMLElement>('.markdown-body')
    if (!preview) {
      pushToast('Open the preview pane before exporting', 'error')
      return
    }
    setBusy(label)
    try {
      await action(preview)
      pushToast(`Exported ${label}`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : `Could not export ${label}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const onImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => importFile(file.name, String(reader.result ?? ''))
    reader.onerror = () => pushToast('Could not read that file', 'error')
    reader.readAsText(file)
  }

  const syncBackend = async (action: 'load' | 'save') => {
    setBusy(action)
    try {
      if (action === 'load') await loadBackendStorage()
      else await saveBackendStorage()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Backend unavailable', 'error')
    } finally {
      setBusy(null)
    }
  }

  const background = resolveTheme(theme) === 'dark' ? '#0d1117' : '#ffffff'

  return (
    <header className="app-header">
      <div className="header-group">
        <button
          className={`btn btn-icon${sidebarCollapsed ? '' : ' is-active'}`}
          onClick={toggleSidebar}
          title="Toggle sidebar (Ctrl+Shift+B)"
          aria-label="Toggle sidebar"
          aria-pressed={!sidebarCollapsed}
        >
          <IconSidebar />
        </button>

        <div className="header-brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <nav className="breadcrumb" aria-label="Current file">
            {breadcrumb.map((part, index) => (
              <span key={`${part}-${index}`} className="breadcrumb-part">
                {index > 0 && <IconChevron size={12} className="breadcrumb-sep" />}
                <span className={index === breadcrumb.length - 1 ? 'breadcrumb-current' : ''}>{part}</span>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="header-group header-center">
        <button className="btn btn-icon" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)" aria-label="Undo">
          <IconUndo />
        </button>
        <button
          className="btn btn-icon"
          onClick={redo}
          disabled={historyIndex >= historyLength - 1}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <IconRedo />
        </button>

        <div className="segmented" role="group" aria-label="View mode">
          {(['editor', 'split', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              className={`btn${viewMode === mode ? ' is-active' : ''}`}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              title={`${mode[0].toUpperCase()}${mode.slice(1)} view (Ctrl+\\)`}
            >
              {mode === 'split' ? 'Both' : mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <button className="btn btn-search" onClick={onOpenPalette} title="Command palette (Ctrl+Shift+P)">
          <IconSearch size={14} />
          <span className="btn-search-label">Search commands</span>
          <kbd>Ctrl ⇧ P</kbd>
        </button>
      </div>

      <div className="header-group header-right">
        <Menu label="File" icon={<IconDownload />}>
          <label className="menu-item">
            <IconUpload size={14} />
            Import Markdown…
            <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onImport} />
          </label>
          <button className="menu-item" onClick={() => exportMarkdown(fileName, currentContent)}>
            <IconDownload size={14} />
            Export Markdown
          </button>
          <button
            className="menu-item"
            onClick={() => void withPreview('HTML', async (preview) => exportHtml(fileName, preview, resolveTheme(theme)))}
          >
            <IconLink2 size={14} />
            Export HTML
          </button>
          <div className="menu-separator" />
          <button className="menu-item" onClick={() => void withPreview('PDF', (preview) => exportPdf(fileName, preview, background))}>
            <IconDownload size={14} />
            Export PDF {busy === 'PDF' && <span className="menu-hint">working…</span>}
          </button>
          <button className="menu-item" onClick={() => void withPreview('PNG', (preview) => exportImage(fileName, preview, 'png', background))}>
            <IconDownload size={14} />
            Export PNG
          </button>
          <button className="menu-item" onClick={() => void withPreview('JPG', (preview) => exportImage(fileName, preview, 'jpeg', background))}>
            <IconDownload size={14} />
            Export JPG
          </button>
          <div className="menu-separator" />
          <button className="menu-item" onClick={() => window.print()}>
            <IconPrinter size={14} />
            Print… <kbd>Ctrl P</kbd>
          </button>
        </Menu>

        <Menu label="Sync" icon={<IconCloud />} badge={backendStorage ? 'on' : undefined}>
          <button className={`menu-item${backendStorage ? ' is-active' : ''}`} onClick={toggleBackendStorage}>
            <IconCloud size={14} />
            Backend sync {backendStorage ? 'enabled' : 'disabled'}
          </button>
          <div className="menu-separator" />
          <div className="menu-row">
            <span>Storage</span>
            <select
              className="menu-select"
              value={backendStorageType}
              onChange={(event) => setBackendStorageType(event.target.value as 'json' | 'mysql')}
            >
              <option value="json">JSON file</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>
          <button className="menu-item" disabled={!backendStorage || busy !== null} onClick={() => void syncBackend('load')}>
            Load from backend {busy === 'load' && <span className="menu-hint">working…</span>}
          </button>
          <button className="menu-item" disabled={!backendStorage || !isAdmin || busy !== null} onClick={() => void syncBackend('save')}>
            Save to backend {busy === 'save' && <span className="menu-hint">working…</span>}
          </button>
          {!isAdmin && <p className="menu-note">Saving to the backend needs admin access.</p>}
        </Menu>

        <button
          className={`btn btn-icon${scrollSync ? ' is-active' : ''}`}
          onClick={toggleScrollSync}
          title="Synchronise scrolling between panes"
          aria-pressed={scrollSync}
          aria-label="Toggle scroll sync"
        >
          <IconLink2 />
        </button>

        <button className="btn btn-icon" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {resolveTheme(theme) === 'dark' ? <IconSun /> : <IconMoon />}
        </button>

        <button className="btn btn-icon" onClick={toggleFullscreen} title="Distraction-free mode (F11)" aria-label="Fullscreen">
          <IconExpand />
        </button>

        <button className="btn btn-icon" onClick={onOpenHelp} title="Keyboard shortcuts and help (Ctrl+/)" aria-label="Help">
          <IconHelp />
        </button>

        {isAdmin ? (
          <button className="btn role-chip is-admin" onClick={logout} title="Leave admin mode">
            <IconLock size={13} />
            Admin
          </button>
        ) : (
          <button className="btn role-chip" onClick={onOpenAuth} title="Unlock editing">
            <IconEye size={13} />
            View only
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {busy ? `${busy} in progress` : ''}
      </span>
    </header>
  )
}

interface MenuProps {
  label: string
  icon: React.ReactNode
  badge?: string
  children: React.ReactNode
}

function Menu({ label, icon, badge, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button className={`btn${open ? ' is-active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        {icon}
        {label}
        {badge && <span className="menu-badge">{badge}</span>}
      </button>
      {open && (
        <div className="menu-popover" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

export default Header
