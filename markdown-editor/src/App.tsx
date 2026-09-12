import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveTheme, useEditorStore } from './store'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import EditorPane from './components/EditorPane'
import Preview from './components/Preview'
import StatusBar from './components/StatusBar'
import AuthModal from './components/AuthModal'
import HelpModal from './components/HelpModal'
import CommandPalette from './components/CommandPalette'
import Toasts from './components/Toasts'
import { emitJump } from './lib/paneSync'
import './App.css'

type Drag = 'pane' | 'sidebar' | null

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

  const [helpOpen, setHelpOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const dragRef = useRef<Drag>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hydrate()
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
    document.body.style.cursor = kind === 'pane' ? 'col-resize' : 'ew-resize'
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
      if (!bounds || bounds.width === 0) return
      setEditorWidth(((event.clientX - bounds.left) / bounds.width) * 100)
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

  const showEditor = viewMode === 'split' || viewMode === 'editor'
  const showPreview = viewMode === 'split' || viewMode === 'preview'

  return (
    <div className={`app${fullscreen ? ' is-fullscreen' : ''}`}>
      {!fullscreen && <Header onOpenHelp={() => setHelpOpen(true)} onOpenPalette={() => setPaletteOpen(true)} onOpenAuth={() => setAuthOpen(true)} />}

      <div className="app-body">
        {!sidebarCollapsed && (
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
          <div
            ref={containerRef}
            className={`panes view-${viewMode}`}
            style={{ ['--editor-width' as string]: `${editorWidth}%` }}
          >
            {showEditor && <EditorPane />}
            {viewMode === 'split' && (
              <div
                className="pane-divider"
                role="separator"
                aria-label="Resize editor and preview"
                aria-orientation="vertical"
                onPointerDown={() => startDrag('pane')}
                onDoubleClick={() => setEditorWidth(50)}
              />
            )}
            {showPreview && <Preview />}
          </div>
        </div>
      </div>

      <StatusBar onOpenHelp={() => setHelpOpen(true)} />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onOpenHelp={() => setHelpOpen(true)} />
      <Toasts />
    </div>
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

      if (event.key === 'Escape') {
        if (paletteOpen) return setPaletteOpen(false)
        if (helpOpen) return setHelpOpen(false)
        if (authOpen) return setAuthOpen(false)
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
