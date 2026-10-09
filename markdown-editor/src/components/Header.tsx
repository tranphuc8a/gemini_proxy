import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { resolveTheme, useEditorStore } from '../store'
import { useReadingStore } from '../readingStore'
import { findNode, getPath } from '../lib/tree'
import { exportHtml, exportImage, exportMarkdown, exportPdf } from '../lib/exporters'
import { listBackends, type BackendInfo } from '../services/markdownStorage'
import { TOUCH_TEXT_QUERY, showsInline, type HeaderTier } from '../lib/responsive'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { StorageBackend, ViewMode } from '../types'
import {
  IconBook,
  IconChevron,
  IconCloud,
  IconDownload,
  IconExpand,
  IconEye,
  IconHelp,
  IconLink2,
  IconLock,
  IconMoon,
  IconMore,
  IconPrinter,
  IconRedo,
  IconSearch,
  IconSidebar,
  IconSparkles,
  IconSun,
  IconUndo,
  IconUpload,
  IconWrap
} from './Icons'
import './Header.css'

/**
 * What the picker offers, independent of what this deployment can serve.
 *
 * The list is fixed so the menu renders the same before and after the server
 * answers; `/markdown/backends` only decides which entries are selectable.
 */
const STORAGE_OPTIONS: { id: StorageBackend; label: string; hint: string }[] = [
  { id: 'json', label: 'JSON file', hint: 'No database needed' },
  { id: 'mysql', label: 'MySQL / MariaDB', hint: "The server's SQL database" },
  { id: 'mongo', label: 'MongoDB', hint: 'Document storage' }
]

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'split', label: 'Both' },
  { id: 'preview', label: 'Preview' }
]

/** Mirrors the store's clamp on the editor font size. */
const EDITOR_FONT_MAX = 24
const EDITOR_FONT_MIN = 11
/** Touch screens never render the editor below this (see EditorPane.css). */
const TOUCH_EDITOR_FONT_MIN = 16

/**
 * A one-press header control, declared once and placed by the tier: inline
 * where the header has room, as an entry of the "⋯" menu where it does not.
 * Adding a header command is adding an entry to the list built below.
 */
interface HeaderAction {
  id: string
  /** Accessible name of the inline icon button. */
  label: string
  /** Text of the entry in the "⋯" menu. */
  menuLabel: string
  title: string
  icon: ReactNode
  run: () => void
  /** Set for toggles. */
  pressed?: boolean
  /** The narrowest tier that still shows it inline. */
  inlineFrom: HeaderTier
}

interface HeaderProps {
  onOpenHelp: () => void
  onOpenPalette: () => void
  onOpenAuth: () => void
  /** How much of the header fits inline; desktop (`full`) shows everything. */
  tier?: HeaderTier
}

function Header({ onOpenHelp, onOpenPalette, onOpenAuth, tier = 'full' }: HeaderProps) {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const theme = useEditorStore((state) => state.theme)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const viewMode = useEditorStore((state) => state.viewMode)
  const files = useEditorStore((state) => state.files)
  const currentFileId = useEditorStore((state) => state.currentFileId)
  const currentContent = useEditorStore((state) => state.currentContent)
  const sidebarCollapsed = useEditorStore((state) => state.sidebarCollapsed)
  const layout = useEditorStore((state) => state.layout)
  const drawerOpen = useEditorStore((state) => state.drawerOpen)
  const historyIndex = useEditorStore((state) => state.historyIndex)
  const historyLength = useEditorStore((state) => state.history.length)
  const backendStorage = useEditorStore((state) => state.backendStorage)
  const backendStorageType = useEditorStore((state) => state.backendStorageType)
  const wordWrap = useEditorStore((state) => state.wordWrap)
  const fontSize = useEditorStore((state) => state.fontSize)

  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const setViewMode = useEditorStore((state) => state.setViewMode)
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar)
  const toggleTheme = useEditorStore((state) => state.toggleTheme)
  const toggleScrollSync = useEditorStore((state) => state.toggleScrollSync)
  const toggleFullscreen = useEditorStore((state) => state.toggleFullscreen)
  const toggleWordWrap = useEditorStore((state) => state.toggleWordWrap)
  const setFontSize = useEditorStore((state) => state.setFontSize)
  const importFile = useEditorStore((state) => state.importFile)
  const logout = useEditorStore((state) => state.logout)
  const pushToast = useEditorStore((state) => state.pushToast)
  const setBackendStorageType = useEditorStore((state) => state.setBackendStorageType)
  const toggleBackendStorage = useEditorStore((state) => state.toggleBackendStorage)
  const loadBackendStorage = useEditorStore((state) => state.loadBackendStorage)
  const saveBackendStorage = useEditorStore((state) => state.saveBackendStorage)
  const openReading = useReadingStore((state) => state.openReading)
  const openSmartFormat = useEditorStore((state) => state.openSmartFormat)

  const touchText = useMediaQuery(TOUCH_TEXT_QUERY)
  const [busy, setBusy] = useState<string | null>(null)
  const [backends, setBackends] = useState<BackendInfo[]>([])

  // Asked for once: which backends this server can actually serve. Failing to
  // find out is not worth a toast -- the picker just offers everything, and a
  // save against a missing backend reports the real reason.
  useEffect(() => {
    let cancelled = false
    listBackends()
      .then((available) => {
        if (!cancelled) setBackends(available)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  const fileName = findNode(files, currentFileId)?.name ?? 'Untitled'
  const breadcrumb = currentFileId ? getPath(files, currentFileId).map((node) => node.name) : ['Untitled']
  const docked = layout === 'desktop'
  const sidebarShown = docked ? !sidebarCollapsed : drawerOpen
  const dark = resolveTheme(theme) === 'dark'

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

  const background = dark ? '#0d1117' : '#ffffff'

  const actions: HeaderAction[] = [
    ...(isAdmin
      ? [
          {
            id: 'smart-format',
            label: 'Smart format with AI',
            menuLabel: 'Smart format with AI…',
            title: 'Smart format with AI — turn raw text into readable Markdown',
            icon: <IconSparkles />,
            run: openSmartFormat,
            inlineFrom: 'medium'
          } satisfies HeaderAction
        ]
      : []),
    {
      id: 'scroll-sync',
      label: 'Toggle scroll sync',
      menuLabel: 'Scroll sync',
      title: 'Synchronise scrolling between panes',
      icon: <IconLink2 />,
      run: toggleScrollSync,
      pressed: scrollSync,
      inlineFrom: 'full'
    },
    {
      id: 'theme',
      label: 'Toggle theme',
      menuLabel: dark ? 'Light theme' : 'Dark theme',
      title: 'Toggle theme',
      icon: dark ? <IconSun /> : <IconMoon />,
      run: toggleTheme,
      inlineFrom: 'medium'
    },
    {
      id: 'reading',
      label: 'Reading mode',
      menuLabel: 'Reading mode',
      title: 'Reading mode (Ctrl+Alt+V)',
      icon: <IconBook />,
      run: openReading,
      inlineFrom: 'compact'
    },
    {
      id: 'fullscreen',
      label: 'Fullscreen',
      menuLabel: 'Distraction-free mode',
      title: 'Distraction-free mode (F11)',
      icon: <IconExpand />,
      run: toggleFullscreen,
      inlineFrom: 'full'
    },
    {
      id: 'help',
      label: 'Help',
      menuLabel: 'Help and shortcuts',
      title: 'Keyboard shortcuts and help (Ctrl+/)',
      icon: <IconHelp />,
      run: onOpenHelp,
      inlineFrom: 'full'
    }
  ]
  const inlineActions = actions.filter((action) => showsInline(tier, action.inlineFrom))
  const menuActions = actions.filter((action) => !showsInline(tier, action.inlineFrom))
  const compact = tier === 'compact'

  const fileItems = (
    <>
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
    </>
  )

  const syncItems = (
    <>
      <button className={`menu-item${backendStorage ? ' is-active' : ''}`} onClick={toggleBackendStorage}>
        <IconCloud size={14} />
        Backend sync {backendStorage ? 'enabled' : 'disabled'}
      </button>
      <div className="menu-separator" />
      <div className="menu-group" data-menu-keep-open role="radiogroup" aria-label="Storage backend">
        <span className="menu-group-label">Storage</span>
        {STORAGE_OPTIONS.map((option) => {
          const info = backends.find((entry) => entry.id === option.id)
          const unavailable = info ? !info.available : false
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={backendStorageType === option.id}
              className={`menu-choice${backendStorageType === option.id ? ' is-active' : ''}`}
              disabled={unavailable}
              title={unavailable ? info?.reason ?? 'Not available on this server' : option.hint}
              onClick={() => setBackendStorageType(option.id)}
            >
              <span className="menu-choice-dot" aria-hidden="true" />
              <span className="menu-choice-text">
                {option.label}
                <small>{unavailable ? info?.reason ?? 'Not configured on the server' : option.hint}</small>
              </span>
            </button>
          )
        })}
      </div>
      <button className="menu-item" disabled={!backendStorage || busy !== null} onClick={() => void syncBackend('load')}>
        Load from backend {busy === 'load' && <span className="menu-hint">working…</span>}
      </button>
      <button className="menu-item" disabled={!backendStorage || !isAdmin || busy !== null} onClick={() => void syncBackend('save')}>
        Save to backend {busy === 'save' && <span className="menu-hint">working…</span>}
      </button>
      {!isAdmin && <p className="menu-note">Saving to the backend needs admin access.</p>}
    </>
  )

  const viewModeControl = (
    <div className="segmented" role="group" aria-label="View mode">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.id}
          className={`btn${viewMode === mode.id ? ' is-active' : ''}`}
          onClick={() => setViewMode(mode.id)}
          aria-pressed={viewMode === mode.id}
          title={`${mode.id[0].toUpperCase()}${mode.id.slice(1)} view (Ctrl+\\)`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )

  // The smallest size the editor really renders at here, so the stepper never
  // shows a value the screen ignores.
  const minFont = touchText ? TOUCH_EDITOR_FONT_MIN : EDITOR_FONT_MIN
  const shownFont = Math.max(minFont, fontSize)

  return (
    <header className="app-header" data-tier={tier}>
      <div className="header-group">
        <button
          className={`btn btn-icon${sidebarShown ? ' is-active' : ''}`}
          onClick={toggleSidebar}
          title="Toggle sidebar (Ctrl+Shift+B)"
          aria-label="Toggle sidebar"
          {...(docked ? { 'aria-pressed': sidebarShown } : { 'aria-expanded': drawerOpen, 'aria-controls': 'sidebar-drawer' })}
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
        {!compact && (
          <>
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
          </>
        )}

        {/* On a phone the workspace's own Editor | Preview switch takes over. */}
        {layout !== 'phone' && viewModeControl}

        {!compact && (
          <button className="btn btn-search" onClick={onOpenPalette} title="Command palette (Ctrl+Shift+P)" aria-label="Search commands">
            <IconSearch size={14} />
            <span className="btn-search-label">Search commands</span>
            <kbd>Ctrl ⇧ P</kbd>
          </button>
        )}
      </div>

      <div className="header-group header-right">
        {!compact && (
          <Menu label="File" icon={<IconDownload />}>
            {fileItems}
          </Menu>
        )}

        {!compact && (
          <Menu label="Sync" icon={<IconCloud />} badge={backendStorage ? 'on' : undefined}>
            {syncItems}
          </Menu>
        )}

        {inlineActions.map((action) => (
          <button
            key={action.id}
            className={`btn btn-icon${action.pressed ? ' is-active' : ''}`}
            onClick={action.run}
            title={action.title}
            aria-label={action.label}
            aria-pressed={action.pressed}
            data-reading-trigger={action.id === 'reading' ? '' : undefined}
          >
            {action.icon}
          </button>
        ))}

        {compact && (
          <button className="btn btn-icon" onClick={onOpenPalette} title="Command palette" aria-label="Search commands">
            <IconSearch />
          </button>
        )}

        {tier !== 'full' && (
          <Menu label="More actions" icon={<IconMore />} iconOnly popoverClassName="is-more">
            {layout === 'phone' && (
              <div className="menu-group" role="radiogroup" aria-label="View mode">
                <span className="menu-group-label">View</span>
                {VIEW_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={viewMode === mode.id}
                    className={`menu-choice${viewMode === mode.id ? ' is-active' : ''}`}
                    data-menu-close
                    onClick={() => setViewMode(mode.id)}
                  >
                    <span className="menu-choice-dot" aria-hidden="true" />
                    <span className="menu-choice-text">{mode.label}</span>
                  </button>
                ))}
                <div className="menu-separator" />
              </div>
            )}

            {compact && (
              <div className="menu-row menu-row-buttons" data-menu-keep-open>
                <button className="btn btn-outline" onClick={undo} disabled={historyIndex <= 0} aria-label="Undo">
                  <IconUndo size={15} />
                  Undo
                </button>
                <button className="btn btn-outline" onClick={redo} disabled={historyIndex >= historyLength - 1} aria-label="Redo">
                  <IconRedo size={15} />
                  Redo
                </button>
              </div>
            )}

            {menuActions.map((action) => (
              <button
                key={action.id}
                className={`menu-item${action.pressed ? ' is-active' : ''}`}
                onClick={action.run}
                aria-pressed={action.pressed}
                title={action.title}
              >
                {action.icon}
                {action.menuLabel}
              </button>
            ))}

            {layout === 'phone' && (
              <button className={`menu-item${wordWrap ? ' is-active' : ''}`} onClick={toggleWordWrap} aria-pressed={wordWrap}>
                <IconWrap size={14} />
                Word wrap
              </button>
            )}

            <div className="menu-row" data-menu-keep-open role="group" aria-label="Editor text size">
              <span>Editor text</span>
              <span className="menu-stepper">
                <button
                  type="button"
                  className="btn btn-icon btn-outline"
                  onClick={() => setFontSize(shownFont - 1)}
                  disabled={shownFont <= minFont}
                  aria-label="Smaller editor text"
                >
                  −
                </button>
                <span className="menu-stepper-value" aria-live="polite">
                  {shownFont}px
                </span>
                <button
                  type="button"
                  className="btn btn-icon btn-outline"
                  onClick={() => setFontSize(shownFont + 1)}
                  disabled={shownFont >= EDITOR_FONT_MAX}
                  aria-label="Larger editor text"
                >
                  +
                </button>
              </span>
            </div>

            {compact && (
              <>
                <div className="menu-separator" />
                <span className="menu-group-label">File</span>
                {fileItems}
                <div className="menu-separator" />
                <span className="menu-group-label">Sync {backendStorage && <span className="menu-badge">on</span>}</span>
                {syncItems}
                <div className="menu-separator" />
                {isAdmin ? (
                  <button className="menu-item" onClick={logout}>
                    <IconLock size={14} />
                    Leave admin mode
                  </button>
                ) : (
                  <button className="menu-item" onClick={onOpenAuth}>
                    <IconEye size={14} />
                    Unlock editing…
                  </button>
                )}
              </>
            )}
          </Menu>
        )}

        {!compact &&
          (isAdmin ? (
            <button className="btn role-chip is-admin" onClick={logout} title="Leave admin mode">
              <IconLock size={13} />
              Admin
            </button>
          ) : (
            <button className="btn role-chip" onClick={onOpenAuth} title="Unlock editing">
              <IconEye size={13} />
              View only
            </button>
          ))}
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
  /** An icon button; `label` becomes its accessible name and tooltip. */
  iconOnly?: boolean
  popoverClassName?: string
  children: React.ReactNode
}

function Menu({ label, icon, badge, iconOnly = false, popoverClassName, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  /**
   * Close on a command, stay open on a control.
   *
   * This used to close on *any* click inside the popover, which made the storage
   * picker impossible to use: pressing it counted as a click, the menu unmounted,
   * and the choice went with it. A menu item is a command and should dismiss the
   * menu; a radio, checkbox or field is a setting the user is still adjusting.
   * `data-menu-close` marks a control that is also the end of the errand.
   */
  const closeIfCommand = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-menu-keep-open]')) return
    if (target.closest('.menu-item, [data-menu-close]')) setOpen(false)
  }

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
      <button
        className={`btn${iconOnly ? ' btn-icon' : ''}${open ? ' is-active' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        {icon}
        {!iconOnly && label}
        {badge && <span className="menu-badge">{badge}</span>}
      </button>
      {open && (
        <div className={`menu-popover${popoverClassName ? ` ${popoverClassName}` : ''}`} role="menu" onClick={closeIfCommand}>
          {children}
        </div>
      )}
    </div>
  )
}

export default Header
