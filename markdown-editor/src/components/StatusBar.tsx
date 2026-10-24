import { useMemo } from 'react'
import { useEditorStore } from '../store'
import { getDocumentStats } from '../lib/markdown'
import { findNode } from '../lib/tree'
import { useIdleValue } from '../hooks/useIdleValue'
import { IconCheck, IconCollapse, IconHelp, IconLock, IconEye } from './Icons'
import SyncStatus from './SyncStatus'
import './StatusBar.css'

interface StatusBarProps {
  onOpenHelp: () => void
  /** The sync indicator's click: the sync panel. */
  onOpenSync?: () => void
}

function StatusBar({ onOpenHelp, onOpenSync }: StatusBarProps) {
  const content = useEditorStore((state) => state.currentContent)
  // A name, not the tree: the tree is replaced on every keystroke.
  const fileName = useEditorStore((state) => findNode(state.files, state.currentFileId)?.name ?? 'No file open')
  const saveState = useEditorStore((state) => state.saveState)
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const fontSize = useEditorStore((state) => state.fontSize)
  const setFontSize = useEditorStore((state) => state.setFontSize)
  const fullscreen = useEditorStore((state) => state.fullscreen)
  const toggleFullscreen = useEditorStore((state) => state.toggleFullscreen)

  // Counting scans the whole document, so it follows the text once typing pauses.
  const fileId = useEditorStore((state) => state.currentFileId)
  // Another file: its own counts at once, never the previous file's.
  const settled = useIdleValue(content, 400, fileId)
  const stats = useMemo(() => getDocumentStats(settled), [settled])

  return (
    <footer className="app-statusbar">
      <div className="status-group">
        <span className="status-item status-file" title={fileName}>
          {fileName}
        </span>
        <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
        <SyncStatus onOpen={onOpenSync ?? (() => undefined)} />
      </div>

      <div className="status-group status-right">
        <span className="status-item" title={`${stats.characters} characters`}>
          {stats.words.toLocaleString()} words
        </span>
        <span className="status-item">{stats.lines.toLocaleString()} lines</span>
        <span className="status-item" title="Estimated at 200 words per minute">
          {stats.readingMinutes} min read
        </span>

        <span className="status-separator" />

        <div className="status-zoom" role="group" aria-label="Editor font size">
          <button className="status-btn" onClick={() => setFontSize(fontSize - 1)} title="Smaller text" aria-label="Decrease font size">
            −
          </button>
          <button className="status-btn status-zoom-value" onClick={() => setFontSize(14)} title="Reset to 14px">
            {fontSize}px
          </button>
          <button className="status-btn" onClick={() => setFontSize(fontSize + 1)} title="Larger text" aria-label="Increase font size">
            +
          </button>
        </div>

        {fullscreen && (
          <button className="status-btn status-exit" onClick={toggleFullscreen} title="Exit distraction-free mode (Esc)">
            <IconCollapse size={12} />
            Exit full screen
          </button>
        )}

        <span className={`status-item status-role${isAdmin ? ' is-admin' : ''}`}>
          {isAdmin ? <IconLock size={12} /> : <IconEye size={12} />}
          {isAdmin ? 'Admin' : 'View only'}
        </span>

        <button className="status-btn" onClick={onOpenHelp} title="Help and shortcuts (Ctrl+/)" aria-label="Help">
          <IconHelp size={12} />
        </button>
      </div>
    </footer>
  )
}

function SaveIndicator({ state, lastSavedAt }: { state: string; lastSavedAt: number | null }) {
  if (state === 'error') {
    return (
      <span className="status-item status-save is-error" title="Browser storage is full or unavailable">
        Not saved
      </span>
    )
  }
  if (state === 'saving') {
    return <span className="status-item status-save is-saving">Saving…</span>
  }
  if (state === 'saved' && lastSavedAt) {
    return (
      <span className="status-item status-save is-saved" title={new Date(lastSavedAt).toLocaleTimeString()}>
        <IconCheck size={12} />
        Saved
      </span>
    )
  }
  return null
}

export default StatusBar
