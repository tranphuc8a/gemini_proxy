import { useEffect } from 'react'
import { useEditorStore } from './store'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import Preview from './components/Preview'
import AuthModal from './components/AuthModal'
import './App.css'

function App() {
  const isDarkMode = useEditorStore((state) => state.isDarkMode)
  const loadFromStorage = useEditorStore((state) => state.loadFromStorage)
  const saveToStorage = useEditorStore((state) => state.saveToStorage)

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      saveToStorage()
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''}`}>
      <AuthModal />
      <Header />
      <div className="app-container">
        <Sidebar />
        <div className="editor-preview-container">
          <Editor />
          <Preview />
        </div>
      </div>
    </div>
  )
}

export default App
