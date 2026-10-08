import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { resolveTheme, useEditorStore } from './store'
import { useReadingStore } from './readingStore'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Drawer from './components/Drawer'
import EditorPane from './components/EditorPane'
import Preview from './components/Preview'
import PaneSwitch from './components/PaneSwitch'
import ReadingView from './components/ReadingView'
import StatusBar from './components/StatusBar'
import AuthModal from './components/AuthModal'
import HelpModal from './components/HelpModal'
import CommandPalette from './components/CommandPalette'
import Toasts from './components/Toasts'
import { useViewport } from './hooks/useViewport'
import { useMediaQuery } from './hooks/useMediaQuery'
import { emitJump } from './lib/paneSync'
import { consumeImportFlag, takeInbox } from './lib/inbox'
import { hasReadFlag, isReadingShortcut } from './lib/reading'
import { STACKED_QUERY, isSinglePane, resolvePhonePane } from './lib/responsive'
import './App.css'

type Drag = 'pane' | 'sidebar' | null

const INBOX_SESSION_WAIT_MS = 4000

function App() {
  const theme = useEditorStore((state) => state.theme)
  const viewMode = useEditorStore((state) => state.viewMode)
  const editorWidth = useEditorStore((state) => state.editorWidth)
  const setEditorWidth = useEditorStore((state) => state.setEditorWidth)
  const sidebarWidth = useEditorStore((state) => state.sidebarWidth)
  const setSidebarWidth = useEditorStore((state) => state.setSidebarWidth)
  const sidebarCollapsed = useEditorStore((state) => state.sidebarCollapsed)
  const fullscreen = useEditorStore((state) => state.fullscreen)
  const fontSize = useEditorStore((state) => state.fontSize)
  const hydrate = useEditorStore((state) => state.hydrate)
  const flushPersist = useEditorStore((state) => state.flushPersist)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const drawerOpen = useEditorStore((state) => state.drawerOpen)
  const setDrawerOpen = useEditorStore((state) => state.setDrawerOpen)
  const setLayout = useEditorStore((state) => state.setLayout)
  const phonePane = useEditorStore((state) => state.phonePane)
  const setPhonePane = useEditorStore((state) => state.setPhonePane)
  const readingOpen = useReadingStore((state) => state.open)

  const { layout, headerTier } = useViewport()
  const stacked = useMediaQuery(STACKED_QUERY)

  const [helpOpen, setHelpOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const dragRef = useRef<Drag>(null)
  /** Whether the split is stacked (tablets) while a divider drag is under way. */
  const stackedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Before paint, so the first frame is already the stored document, in the
  // right layout -- and, for ?read=1, already in reading mode.
  useLayoutEffect(() => {
    setLayout(layout)
  }, [layout, setLayout])

  useLayoutEffect(() => {
    const sessionChecked = hydrate()
    // ?read=1 opens straight into reading mode, e.g. from a shared link.
    if (hasReadFlag(window.location.href)) useReadingStore.getState().openReading()
    // Opened by another app with a document waiting (?import=1). Imported once
    // the admin session is known -- that decides whether the file is kept --
    // but not held hostage by a slow backend.
    if (!consumeImportFlag()) return
    const doc = takeInbox()
    if (!doc) return
    const settled = new Promise<void>((resolve) => setTimeout(resolve, INBOX_SESSION_WAIT_MS))
    void Promise.race([sessionChecked.catch(() => undefined), settled]).then(() =>
      useEditorStore.getState().importInbox(doc)
    )
  }, [hydrate])

  // Apply the resolved theme to <html> so tokens, form controls and the
  // browser's own scrollbars all follow it.
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme)
    }
    apply()
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`)
  }, [fontSize])

  // Nothing is lost if the tab closes mid-debounce.
  useEffect(() => {
    const flush = () => flushPersist()
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [flushPersist])

  const startDrag = useCallback((kind: Exclude<Drag, null>) => {
    dragRef.current = kind
    // Below 900px the split stacks, and the divider then moves vertically.
    const container = containerRef.current
    stackedRef.current = kind === 'pane' && !!container && getComputedStyle(container).flexDirection === 'column'
    document.body.style.cursor = kind === 'sidebar' ? 'ew-resize' : stackedRef.current ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return
      if (dragRef.current === 'sidebar') {
        setSidebarWidth(event.clientX)
        return
      }
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return
      if (stackedRef.current) {
        if (bounds.height > 0) setEditorWidth(((event.clientY - bounds.top) / bounds.height) * 100)
        return
      }
      if (bounds.width > 0) setEditorWidth(((event.clientX - bounds.left) / bounds.width) * 100)
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [setEditorWidth, setSidebarWidth])

  useGlobalShortcuts({ setPaletteOpen, setHelpOpen, setAuthOpen, helpOpen, paletteOpen, authOpen })

  const docked = layout === 'desktop'
  const singlePane = isSinglePane(layout, viewMode)
  const activePane = resolvePhonePane(phonePane, isAdmin)
  const showEditor = viewMode === 'split' || viewMode === 'editor'
  const showPreview = viewMode === 'split' || viewMode === 'preview'
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <>
      {/* While reading, the app stays mounted underneath -- hidden, so leaving
          brings back every scroll position and the caret as they were. */}
      <div
        className={`app${fullscreen ? ' is-fullscreen' : ''}${readingOpen ? ' is-covered' : ''}`}
        data-layout={layout}
        aria-hidden={readingOpen || undefined}
      >
        {!fullscreen && (
          <Header
            tier={headerTier}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        <div className="app-body">
          {docked && !sidebarCollapsed && (
            <>
              <Sidebar width={sidebarWidth} />
              <div
                className="sidebar-resizer"
                role="separator"
                aria-label="Resize sidebar"
                aria-orientation="vertical"
                onPointerDown={() => startDrag('sidebar')}
                onDoubleClick={() => setSidebarWidth(260)}
              />
            </>
          )}

          <div className="workspace">
            {singlePane && <PaneSwitch active={activePane} onChange={setPhonePane} />}
            <div
              ref={containerRef}
              className={`panes view-${viewMode}${singlePane ? ' is-single' : ''}`}
              data-active-pane={singlePane ? activePane : undefined}
              style={{ ['--editor-width' as string]: `${editorWidth}%` }}
            >
              {showEditor && <EditorPane />}
              {viewMode === 'split' && !singlePane && (
                <div
                  className="pane-divider"
                  role="separator"
                  aria-label="Resize editor and preview"
                  aria-orientation={stacked ? 'horizontal' : 'vertical'}
                  onPointerDown={() => startDrag('pane')}
                  onDoubleClick={() => setEditorWidth(50)}
                />
              )}
              {showPreview && <Preview />}
            </div>
          </div>
        </div>

        <StatusBar onOpenHelp={() => setHelpOpen(true)} />

        {!docked && (
          <Drawer open={drawerOpen} onClose={closeDrawer} label="Files and outline" id="sidebar-drawer">
            <Sidebar variant="drawer" onClose={closeDrawer} />
          </Drawer>
        )}

        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onOpenHelp={() => setHelpOpen(true)} />
      </div>

      {readingOpen && <ReadingView />}
      <Toasts />
    </>
  )
}

interface ShortcutOptions {
  setPaletteOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setAuthOpen: (open: boolean) => void
  helpOpen: boolean
  paletteOpen: boolean
  authOpen: boolean
}

/**
 * Application-level shortcuts. Editing shortcuts stay on the textarea itself so
 * they cannot fire while the user is typing in the rename or search boxes.
 */
function useGlobalShortcuts({ setPaletteOpen, setHelpOpen, setAuthOpen, helpOpen, paletteOpen, authOpen }: ShortcutOptions) {
  const store = useEditorStore

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      const state = store.getState()
      const reading = useReadingStore.getState()

      if (isReadingShortcut(event)) {
        event.preventDefault()
        if (!reading.open) {
          setPaletteOpen(false)
          setHelpOpen(false)
          setAuthOpen(false)
          state.setDrawerOpen(false)
        }
        reading.toggleReading()
        return
      }

      // Reading mode owns the keyboard (Escape included); the editor's
      // commands would act on a view that is not on screen.
      if (reading.open) {
        if (mod && event.key.toLowerCase() === 's') {
          event.preventDefault()
          state.flushPersist()
        }
        return
      }

      if (event.key === 'Escape') {
        if (paletteOpen) return setPaletteOpen(false)
        if (helpOpen) return setHelpOpen(false)
        if (authOpen) return setAuthOpen(false)
        if (state.drawerOpen) return state.setDrawerOpen(false)
        if (state.fullscreen) return state.toggleFullscreen()
        return
      }

      // Ctrl+K reaches here only outside the editor: the textarea claims it
      // for "insert link". Ctrl+Shift+P always works, wherever focus is.
      if (mod && event.key.toLowerCase() === 'k' && !event.shiftKey) {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (mod && event.key === '/') {
        event.preventDefault()
        setHelpOpen(true)
        return
      }

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        state.flushPersist()
        state.pushToast('Saved locally', 'success')
        return
      }

      if (mod && event.key.toLowerCase() === 'b' && event.shiftKey) {
        event.preventDefault()
        state.toggleSidebar()
        return
      }

      if (mod && event.key === '\\') {
        event.preventDefault()
        const order = ['editor', 'split', 'preview'] as const
        state.setViewMode(order[(order.indexOf(state.viewMode) + 1) % order.length])
        return
      }

      if (event.key === 'F11') {
        event.preventDefault()
        state.toggleFullscreen()
        return
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        state.setSidebarTab('outline')
        return
      }

      // Ctrl+G jumps to a line, mirroring most editors.
      if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        const answer = window.prompt('Go to line')
        const line = Number(answer)
        if (Number.isFinite(line) && line > 0) emitJump({ line, source: 'preview' })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, setPaletteOpen, setHelpOpen, setAuthOpen, helpOpen, paletteOpen, authOpen])
}

export default App
