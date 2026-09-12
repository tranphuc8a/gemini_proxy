import { useState } from 'react'
import { useEditorStore } from '../store'
import { countNodes } from '../lib/tree'
import FileTree from './FileTree'
import Outline from './Outline'
import { IconClose, IconFile, IconFolder, IconOutline, IconPlus, IconSearch } from './Icons'
import './Sidebar.css'

interface SidebarProps {
  width: number
}

function Sidebar({ width }: SidebarProps) {
  const tab = useEditorStore((state) => state.sidebarTab)
  const setTab = useEditorStore((state) => state.setSidebarTab)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const files = useEditorStore((state) => state.files)
  const selectedFolderId = useEditorStore((state) => state.selectedFolderId)
  const createFile = useEditorStore((state) => state.createFile)
  const createFolder = useEditorStore((state) => state.createFolder)

  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<{ kind: 'file' | 'folder'; name: string } | null>(null)

  const counts = countNodes(files)

  const submitDraft = () => {
    if (!draft) return
    const parentId = selectedFolderId ?? files[0]?.id ?? null
    if (draft.kind === 'folder') createFolder(parentId, draft.name)
    else createFile(parentId, draft.name)
    setDraft(null)
  }

  return (
    <aside className="sidebar" style={{ width }} aria-label="Sidebar">
      <div className="sidebar-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'files'}
          className={`sidebar-tab${tab === 'files' ? ' is-active' : ''}`}
          onClick={() => setTab('files')}
        >
          <IconFile size={14} />
          Files
        </button>
        <button
          role="tab"
          aria-selected={tab === 'outline'}
          className={`sidebar-tab${tab === 'outline' ? ' is-active' : ''}`}
          onClick={() => setTab('outline')}
        >
          <IconOutline size={14} />
          Outline
        </button>
      </div>

      {tab === 'files' ? (
        <>
          <div className="sidebar-toolbar">
            <div className="sidebar-search">
              <IconSearch size={13} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter files"
                aria-label="Filter files"
              />
              {query && (
                <button className="sidebar-search-clear" onClick={() => setQuery('')} aria-label="Clear filter">
                  <IconClose size={12} />
                </button>
              )}
            </div>
            {isAdmin && (
              <>
                <button
                  className="btn btn-icon"
                  onClick={() => setDraft({ kind: 'file', name: '' })}
                  title="New file in the selected folder"
                  aria-label="New file"
                >
                  <IconPlus size={15} />
                </button>
                <button
                  className="btn btn-icon"
                  onClick={() => setDraft({ kind: 'folder', name: '' })}
                  title="New folder in the selected folder"
                  aria-label="New folder"
                >
                  <IconFolder size={15} />
                </button>
              </>
            )}
          </div>

          {draft && (
            <div className="sidebar-draft">
              {draft.kind === 'folder' ? <IconFolder size={14} /> : <IconFile size={14} />}
              <input
                autoFocus
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitDraft()
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    setDraft(null)
                  }
                }}
                onBlur={submitDraft}
                placeholder={draft.kind === 'folder' ? 'Folder name' : 'file-name.md'}
                aria-label={draft.kind === 'folder' ? 'New folder name' : 'New file name'}
              />
            </div>
          )}

          <div className="sidebar-content">
            <FileTree query={query} />
          </div>

          <footer className="sidebar-footer">
            {counts.files} {counts.files === 1 ? 'file' : 'files'} · {counts.folders}{' '}
            {counts.folders === 1 ? 'folder' : 'folders'}
            {!isAdmin && <span className="sidebar-readonly">read-only</span>}
          </footer>
        </>
      ) : (
        <div className="sidebar-content">
          <Outline />
        </div>
      )}
    </aside>
  )
}

export default Sidebar
