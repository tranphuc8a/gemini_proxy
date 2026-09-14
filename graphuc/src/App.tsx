/**
 * Shell: toolbar on top, canvas in the middle, inspector on the right, panels
 * layered over it.
 *
 * Also the one place keyboard shortcuts are bound. They live here rather than
 * on the canvas because they must work whatever has focus — except a text
 * field, where every key belongs to the field.
 */

import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import Library from './components/Library'
import AlgorithmPanel from './components/AlgorithmPanel'
import AuthModal from './components/AuthModal'
import HelpModal from './components/HelpModal'
import { useEditor } from './store'
import './App.css'

function App() {
  const hydrate = useEditor((state) => state.hydrate)
  const settings = useEditor((state) => state.settings)
  const toasts = useEditor((state) => state.toasts)
  const dismissToast = useEditor((state) => state.dismissToast)

  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const deleteSelection = useEditor((state) => state.deleteSelection)
  const setTool = useEditor((state) => state.setTool)
  const select = useEditor((state) => state.select)
  const saveLocalNow = useEditor((state) => state.saveLocal)

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [algorithmsOpen, setAlgorithmsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.matches('input, textarea, select, [contenteditable="true"]')) return

      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (meta && event.key.toLowerCase() === 's') {
        // Ctrl+S in a drawing tool means "save my drawing", not "save this page".
        event.preventDefault()
        saveLocalNow()
        return
      }
      if (meta && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        setLibraryOpen(true)
        return
      }
      if (meta) return

      switch (event.key.toLowerCase()) {
        case 'v': setTool('select'); break
        case 'n': setTool('node'); break
        case 'e': setTool('edge'); break
        case 't': setTool('annotation'); break
        case 'h': setTool('pan'); break
        case 'x': setTool('erase'); break
        case 'delete':
        case 'backspace':
          event.preventDefault()
          deleteSelection()
          break
        case 'escape':
          select({ type: 'none' })
          setTool('select')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, deleteSelection, setTool, select, saveLocalNow])

  return (
    <div className="app">
      <Toolbar
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenAlgorithms={() => setAlgorithmsOpen((value) => !value)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <main className="workspace">
        <div className="canvas-column">
          <Canvas />
          <AlgorithmPanel open={algorithmsOpen} onClose={() => setAlgorithmsOpen(false)} />
        </div>
        <Inspector />
      </main>

      <Library open={libraryOpen} onClose={() => setLibraryOpen(false)} onOpenAuth={() => { setLibraryOpen(false); setAuthOpen(true) }} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="toast-stack">
        {toasts.map((toast) => (
          <button key={toast.id} className={`toast is-${toast.tone}`} onClick={() => dismissToast(toast.id)}>
            {toast.message}
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
