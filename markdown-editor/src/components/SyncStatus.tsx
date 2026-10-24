import { useEffect, useState } from 'react'
import { useEditorStore } from '../store'
import { describeSync } from '../sync/describe'
import { IconCloud } from './Icons'
import './Sync.css'

interface SyncStatusProps {
  onOpen: () => void
}

/** The status bar's sync indicator: replaces the old "Backend" badge; a click opens the sync panel. */
function SyncStatus({ onOpen }: SyncStatusProps) {
  const backendStorage = useEditorStore((state) => state.backendStorage)
  const sync = useEditorStore((state) => state.sync)
  const [now, setNow] = useState(() => Date.now())

  // "2 min ago" ages while nothing else changes.
  useEffect(() => {
    if (!backendStorage) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [backendStorage])
  useEffect(() => setNow(Date.now()), [sync])

  if (!backendStorage) return null
  const { label, tone, title } = describeSync(sync, now)
  return (
    <button type="button" className={`status-btn status-sync is-${tone}`} onClick={onOpen} title={title} aria-label={`Backend status: ${label}`}>
      <IconCloud size={12} />
      {label}
    </button>
  )
}

export default SyncStatus
