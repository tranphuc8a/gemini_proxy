import { useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { describeSync } from '../sync/describe'
import { IconClose, IconCloud } from './Icons'
import './Sync.css'

interface SyncPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * The sync panel (md-sync F8; a click on the status bar's indicator): the state in words, the documents waiting for a choice
 * (a conflict: the same lines changed on two devices) and the ones the server refused. A conflict is answered here with one of
 * three choices; the side-by-side diff and the manual merge are batch M8's (F9).
 */
function SyncPanel({ open, onClose }: SyncPanelProps) {
  const sync = useEditorStore((state) => state.sync)
  const backendStorage = useEditorStore((state) => state.backendStorage)
  const resolveConflict = useEditorStore((state) => state.resolveConflict)
  const retryBlocked = useEditorStore((state) => state.retryBlocked)
  const syncNow = useEditorStore((state) => state.syncNow)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  if (!open) return null

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work')
    } finally {
      setBusy(null)
    }
  }

  const status = describeSync(sync, Date.now())

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="panel sync-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="sync-head">
          <span className="sync-icon">
            <IconCloud size={18} />
          </span>
          <div>
            <h2 id="sync-title">Sync</h2>
            <p className={`sync-state is-${status.tone}`}>{backendStorage ? status.label : 'Backend sync is off'}</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="sync-body">
          {sync.error && backendStorage && <p className="sync-error" role="alert">{sync.error}</p>}
          {error && <p className="sync-error" role="alert">{error}</p>}

          {sync.conflicts.length > 0 && (
            <section aria-label="Conflicts">
              <h3>Choose which text to keep</h3>
              <p className="sync-note">
                These documents were changed in the same place here and on another device, so they were not merged. Nothing is
                sent for them until you choose.
              </p>
              <ul className="sync-list">
                {sync.conflicts.map((conflict) => (
                  <li key={conflict.id} className="sync-row">
                    <span className="sync-name" title={conflict.name}>{conflict.name}</span>
                    <span className="sync-actions">
                      <button type="button" className="btn btn-outline" disabled={busy !== null} onClick={() => void run(conflict.id, () => resolveConflict(conflict.id, 'mine'))}>
                        Keep mine
                      </button>
                      <button type="button" className="btn btn-outline" disabled={busy !== null} onClick={() => void run(conflict.id, () => resolveConflict(conflict.id, 'server'))}>
                        Use the server&apos;s
                      </button>
                      <button type="button" className="btn btn-outline" disabled={busy !== null} onClick={() => void run(conflict.id, () => resolveConflict(conflict.id, 'both'))}>
                        Keep both
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="sync-note">
                <strong>Keep mine</strong> sends this device&apos;s text (the server keeps the earlier one in its history).{' '}
                <strong>Use the server&apos;s</strong> replaces this device&apos;s text with theirs — yours is discarded.{' '}
                <strong>Keep both</strong> turns this device&apos;s text into a new document beside the server&apos;s.
              </p>
            </section>
          )}

          {sync.blocked.length > 0 && (
            <section aria-label="Refused by the server">
              <h3>Refused by the server</h3>
              <ul className="sync-list">
                {sync.blocked.map((item) => (
                  <li key={item.id} className="sync-row">
                    <span className="sync-name" title={item.name}>{item.name}</span>
                    <span className="sync-why">{item.message}</span>
                    <button type="button" className="btn btn-outline" disabled={busy !== null} onClick={() => void run(item.id, () => retryBlocked(item.id))}>
                      Try again
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sync.conflicts.length === 0 && sync.blocked.length === 0 && backendStorage && (
            <p className="sync-note">
              {sync.pending
                ? `${sync.pending} ${sync.pending === 1 ? 'change is' : 'changes are'} waiting to be sent.`
                : 'Everything on this device has been sent, and everything the server has was received.'}
            </p>
          )}
        </div>

        <div className="sync-footer">
          {backendStorage && (
            <button type="button" className="btn btn-outline" disabled={busy !== null || sync.phase === 'syncing'} onClick={() => void run('sync', syncNow)}>
              Sync now
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SyncPanel
