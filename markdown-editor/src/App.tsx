import { useEffect, useRef } from 'react'
import { useEditorStore } from './store'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import Preview from './components/Preview'
import AuthModal from './components/AuthModal'
import HelpModal from './components/HelpModal'
import './App.css'

function App() {
  const isDarkMode = useEditorStore((state) => state.isDarkMode)
  const loadFromStorage = useEditorStore((state) => state.loadFromStorage)
  const saveToStorage = useEditorStore((state) => state.saveToStorage)
  const viewMode = useEditorStore((state) => state.viewMode)
  const editorWidth = useEditorStore((state) => state.editorWidth)
  const setEditorWidth = useEditorStore((state) => state.setEditorWidth)
  const draggingRef = useRef(false)
  const sidebarCollapsed = useEditorStore((state) => state.sidebarCollapsed)
  const fullscreen = useEditorStore((state) => state.fullscreen)

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return
      const container = document.querySelector('.editor-preview-container')
      if (!container) return
      const bounds = container.getBoundingClientRect()
      setEditorWidth(((event.clientX - bounds.left) / bounds.width) * 100)
    }
    const stopDragging = () => { draggingRef.current = false }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [setEditorWidth])

  useEffect(() => {
    const timer = setInterval(() => {
      saveToStorage()
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''} ${fullscreen ? 'fullscreen' : ''}`}>
      <AuthModal />
      <HelpModal />
      <Header />
      <div className="app-container">
        {!sidebarCollapsed && <Sidebar />}
        <div className={`editor-preview-container view-${viewMode}`} style={{ '--editor-width': `${editorWidth}%` } as React.CSSProperties}>
          {(viewMode === 'split' || viewMode === 'editor') && <Editor />}
          {viewMode === 'split' && (
            <div
              className="pane-divider"
              role="separator"
              aria-label="Resize editor and preview"
              onPointerDown={() => { draggingRef.current = true }}
            />
          )}
          {(viewMode === 'split' || viewMode === 'preview') && <Preview />}
        </div>
      </div>
    </div>
  )
}

export default App
