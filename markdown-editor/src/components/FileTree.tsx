import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import type { FileNode } from '../types'
import { canMove, filterTree, sortTree } from '../lib/tree'
import { IconChevron, IconCopy, IconFile, IconFolder, IconFolderOpen, IconPencil, IconTrash } from './Icons'
import './FileTree.css'

interface FileTreeProps {
  query: string
}

function FileTree({ query }: FileTreeProps) {
  const files = useEditorStore((state) => state.files)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const moveNode = useEditorStore((state) => state.moveNode)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const visible = useMemo(() => sortTree(filterTree(files, query)), [files, query])
  // A filtered tree is always fully expanded; matches would otherwise hide.
  const forceExpanded = query.trim().length > 0

  const onDropAtRoot = (event: React.DragEvent) => {
    event.preventDefault()
    if (dragId && isAdmin && canMove(files, dragId, null)) moveNode(dragId, null)
    setDragId(null)
    setDropTarget(null)
  }

  if (visible.length === 0) {
    return <p className="file-tree-empty">{query ? `Nothing matches “${query}”.` : 'No files yet.'}</p>
  }

  return (
    <div
      className={`file-tree${dropTarget === '__root__' ? ' is-root-target' : ''}`}
      role="tree"
      aria-label="Files"
      onDragOver={(event) => {
        if (!dragId || !isAdmin) return
        event.preventDefault()
        setDropTarget('__root__')
      }}
      onDragLeave={() => setDropTarget((current) => (current === '__root__' ? null : current))}
      onDrop={onDropAtRoot}
    >
      {visible.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          forceExpanded={forceExpanded}
          dragId={dragId}
          setDragId={setDragId}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
        />
      ))}
    </div>
  )
}

interface TreeNodeProps {
  node: FileNode
  depth: number
  forceExpanded: boolean
  dragId: string | null
  setDragId: (id: string | null) => void
  dropTarget: string | null
  setDropTarget: (id: string | null) => void
}

function TreeNode({ node, depth, forceExpanded, dragId, setDragId, dropTarget, setDropTarget }: TreeNodeProps) {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const files = useEditorStore((state) => state.files)
  const currentFileId = useEditorStore((state) => state.currentFileId)
  const selectedFolderId = useEditorStore((state) => state.selectedFolderId)
  const expandedFolders = useEditorStore((state) => state.expandedFolders)
  const setCurrentFile = useEditorStore((state) => state.setCurrentFile)
  const setSelectedFolder = useEditorStore((state) => state.setSelectedFolder)
  const toggleFolder = useEditorStore((state) => state.toggleFolder)
  const renameNode = useEditorStore((state) => state.renameNode)
  const deleteNode = useEditorStore((state) => state.deleteNode)
  const copyNode = useEditorStore((state) => state.copyNode)
  const moveNode = useEditorStore((state) => state.moveNode)

  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(node.name)
  const rowRef = useRef<HTMLDivElement>(null)

  const isFolder = node.type === 'folder'
  const expanded = forceExpanded || expandedFolders.includes(node.id)
  const isCurrent = currentFileId === node.id
  const isSelectedFolder = isFolder && selectedFolderId === node.id
  const isDropTarget = dropTarget === node.id

  useEffect(() => {
    setDraftName(node.name)
  }, [node.name])

  const commitRename = () => {
    renameNode(node.id, draftName)
    setRenaming(false)
  }

  const activate = () => {
    if (isFolder) {
      setSelectedFolder(node.id)
      toggleFolder(node.id)
    } else {
      setCurrentFile(node.id)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
    if (event.key === 'F2' && isAdmin) {
      event.preventDefault()
      setRenaming(true)
    }
    if (event.key === 'Delete' && isAdmin) {
      event.preventDefault()
      confirmDelete()
    }
    if (event.key === 'ArrowRight' && isFolder && !expanded) toggleFolder(node.id)
    if (event.key === 'ArrowLeft' && isFolder && expanded) toggleFolder(node.id)
  }

  const confirmDelete = () => {
    const label = isFolder ? `folder “${node.name}” and everything inside it` : `“${node.name}”`
    if (window.confirm(`Delete ${label}?`)) deleteNode(node.id)
  }

  /** Folders accept drops; files hand the drop to their parent folder. */
  const acceptsDrop = isFolder && dragId !== null && isAdmin && canMove(files, dragId, node.id)

  return (
    <div className="tree-node" role="none">
      <div
        ref={rowRef}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? expanded : undefined}
        aria-selected={isCurrent}
        aria-level={depth + 1}
        className={[
          'tree-row',
          isCurrent ? 'is-current' : '',
          isSelectedFolder ? 'is-selected-folder' : '',
          isDropTarget && acceptsDrop ? 'is-drop-target' : '',
          dragId === node.id ? 'is-dragging' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 6 + depth * 13 }}
        onClick={activate}
        onKeyDown={onKeyDown}
        draggable={isAdmin && !renaming}
        onDragStart={(event) => {
          event.stopPropagation()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', node.id)
          setDragId(node.id)
        }}
        onDragEnd={() => {
          setDragId(null)
          setDropTarget(null)
        }}
        onDragOver={(event) => {
          if (!acceptsDrop) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'move'
          setDropTarget(node.id)
        }}
        onDragLeave={(event) => {
          event.stopPropagation()
          setDropTarget(null)
        }}
        onDrop={(event) => {
          if (!acceptsDrop || !dragId) return
          event.preventDefault()
          event.stopPropagation()
          moveNode(dragId, node.id)
          setDragId(null)
          setDropTarget(null)
        }}
      >
        {isFolder ? (
          <button
            className={`tree-twisty${expanded ? ' is-open' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              toggleFolder(node.id)
            }}
            tabIndex={-1}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <IconChevron size={12} />
          </button>
        ) : (
          <span className="tree-twisty-spacer" />
        )}

        <span className={`tree-icon${isFolder ? ' is-folder' : ''}`}>
          {isFolder ? expanded ? <IconFolderOpen size={14} /> : <IconFolder size={14} /> : <IconFile size={14} />}
        </span>

        {renaming ? (
          <input
            className="tree-rename"
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') {
                setDraftName(node.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <span className="tree-name" title={node.name}>
            {node.name}
          </span>
        )}

        {isAdmin && !renaming && (
          <span className="tree-actions">
            <button
              className="tree-action"
              onClick={(event) => {
                event.stopPropagation()
                setRenaming(true)
              }}
              title="Rename (F2)"
              aria-label={`Rename ${node.name}`}
            >
              <IconPencil size={13} />
            </button>
            <button
              className="tree-action"
              onClick={(event) => {
                event.stopPropagation()
                copyNode(node.id, selectedFolderId)
              }}
              title="Duplicate into the selected folder"
              aria-label={`Duplicate ${node.name}`}
            >
              <IconCopy size={13} />
            </button>
            <button
              className="tree-action is-danger"
              onClick={(event) => {
                event.stopPropagation()
                confirmDelete()
              }}
              title="Delete (Del)"
              aria-label={`Delete ${node.name}`}
            >
              <IconTrash size={13} />
            </button>
          </span>
        )}
      </div>

      {isFolder && expanded && node.children && node.children.length > 0 && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              forceExpanded={forceExpanded}
              dragId={dragId}
              setDragId={setDragId}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
            />
          ))}
        </div>
      )}

      {isFolder && expanded && (!node.children || node.children.length === 0) && (
        <p className="tree-empty" style={{ paddingLeft: 6 + (depth + 1) * 13 + 18 }}>
          empty
        </p>
      )}
    </div>
  )
}

export default FileTree
