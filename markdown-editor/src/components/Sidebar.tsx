import { useState } from 'react'
import { useEditorStore } from '../store'
import FileTree from './FileTree'
import './Sidebar.css'

function Sidebar() {
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [isFolder, setIsFolder] = useState(false)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const createFile = useEditorStore((state) => state.createFile)
  const createFolder = useEditorStore((state) => state.createFolder)
  const selectedFolderId = useEditorStore((state) => state.selectedFolderId)

  const handleCreate = () => {
    if (newFileName.trim()) {
      if (isFolder) {
        createFolder(selectedFolderId, newFileName)
      } else {
        createFile(selectedFolderId, newFileName)
      }
      setNewFileName('')
      setShowNewFile(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>📁 Files</h2>
        {isAdmin && (
          <button
            className="sidebar-add-btn"
            onClick={() => setShowNewFile(!showNewFile)}
            title="Create new file or folder"
          >
            ➕
          </button>
        )}
      </div>

      {showNewFile && isAdmin && (
        <div className="new-file-form">
          <input
            type="text"
            placeholder="File name..."
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="form-buttons">
            <button
              className={`form-btn ${isFolder ? 'active' : ''}`}
              onClick={() => setIsFolder(!isFolder)}
            >
              {isFolder ? 'Folder ✓' : 'File'}
            </button>
            <button className="form-btn confirm" onClick={handleCreate}>
              Create
            </button>
            <button
              className="form-btn cancel"
              onClick={() => setShowNewFile(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-content">
        <FileTree />
      </div>
    </aside>
  )
}

export default Sidebar
