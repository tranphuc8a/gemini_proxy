import { useState } from 'react'
import { useEditorStore } from '../store'
import { FileNode } from '../types'
import './FileTree.css'

interface FileTreeItemProps {
  file: FileNode
}

function FileTreeItem({ file }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const currentFileId = useEditorStore((state) => state.currentFileId)
  const setCurrentFile = useEditorStore((state) => state.setCurrentFile)
  const deleteFile = useEditorStore((state) => state.deleteFile)
  const renameFile = useEditorStore((state) => state.renameFile)

  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(file.name)

  const handleRename = () => {
    if (newName.trim() && newName !== file.name) {
      renameFile(file.id, newName)
    }
    setIsRenaming(false)
    setNewName(file.name)
  }

  const isSelected = currentFileId === file.id

  return (
    <div className="file-tree-item">
      <div
        className={`file-tree-row ${isSelected ? 'selected' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault()
        }}
      >
        {file.type === 'folder' && (
          <button
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {file.type === 'file' && <span className="file-icon">📄</span>}
        {file.type === 'folder' && <span className="folder-icon">📁</span>}

        {isRenaming ? (
          <input
            type="text"
            className="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyPress={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
        ) : (
          <span
            className="file-name"
            onClick={() => {
              if (file.type === 'file') {
                setCurrentFile(file.id, file.content)
              } else {
                setExpanded(!expanded)
              }
            }}
          >
            {file.name}
          </span>
        )}

        {isAdmin && (
          <div className="file-actions">
            <button
              className="action-btn"
              onClick={() => setIsRenaming(true)}
              title="Rename"
            >
              ✏️
            </button>
            <button
              className="action-btn delete"
              onClick={() => {
                if (window.confirm(`Delete "${file.name}"?`)) {
                  deleteFile(file.id)
                }
              }}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {file.type === 'folder' && expanded && file.children && (
        <div className="file-tree-children">
          {file.children.map((child) => (
            <FileTreeItem key={child.id} file={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileTree() {
  const files = useEditorStore((state) => state.files)

  return (
    <div className="file-tree">
      {files.map((file) => (
        <FileTreeItem key={file.id} file={file} />
      ))}
    </div>
  )
}

export default FileTree
