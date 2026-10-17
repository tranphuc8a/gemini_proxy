import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  installState,
  offlineStatus,
  promptInstall,
  subscribeInstall,
  type InstallState,
  type OfflineStatus
} from '../lib/pwa'
import { IconClose } from './Icons'
import './InstallModal.css'

interface InstallModalProps {
  open: boolean
  onClose: () => void
}

/** How often to look again while the worker is still saving the app. */
const POLL_MS = 1500

const HOW_TO_INSTALL: Record<Exclude<InstallState, 'ready'>, string> = {
  installed: 'You are running the installed app.',
  ios: 'On iPhone or iPad: tap Share, then Add to Home Screen.',
  insecure: 'Installing needs a secure address — HTTPS, or the server running on this computer.',
  menu: 'Use your browser’s install option: the install icon in the address bar, or its menu → Install app.'
}

function describeOffline(status: OfflineStatus): string {
  switch (status.phase) {
    case 'ready':
      return `Ready offline — ${status.files} files are saved on this device.`
    case 'partial':
      return `Saved, but ${status.failed} of ${status.files} files could not be downloaded. Reconnect and reload this page to finish.`
    case 'unsupported':
      return 'This browser or address cannot keep an offline copy. It needs HTTPS (or localhost).'
    default:
      return 'Saving a copy for offline use…'
  }
}

function InstallModal({ open, onClose }: InstallModalProps) {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const [install, setInstall] = useState<InstallState>(() => installState())
  const [offline, setOffline] = useState<OfflineStatus>({ phase: 'preparing', files: 0, failed: 0 })
  const panelRef = useRef<HTMLElement>(null)

  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    setInstall(installState())
    return subscribeInstall(() => setInstall(installState()))
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const look = async () => {
      const status = await offlineStatus()
      if (cancelled) return
      setOffline(status)
      if (status.phase === 'preparing') timer = setTimeout(() => void look(), POLL_MS)
    }
    void look()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <section
        ref={panelRef}
        tabIndex={-1}
        className="panel install-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
      >
        <header className="install-head">
          <div>
            <p className="install-eyebrow">Markdown Editor</p>
            <h2 id="install-title">Use offline</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="install-body">
          <p className="install-status" data-phase={offline.phase} role="status" aria-live="polite">
            {describeOffline(offline)}
          </p>

          {install === 'ready' ? (
            <button className="btn btn-primary" onClick={() => void promptInstall()}>
              Install app
            </button>
          ) : (
            <p className="install-text">{HOW_TO_INSTALL[install]}</p>
          )}

          <h3>Offline you can</h3>
          <ul className="install-list">
            <li>Open, read and export the documents stored in this browser — preview, maths and diagrams included.</li>
            <li>
              Keep editing them{isAdmin ? '.' : ' once you have unlocked editing on this device while online.'} Changes
              are saved in this browser.
            </li>
          </ul>
          <h3>Needs a connection</h3>
          <ul className="install-list">
            <li>Syncing with the backend, and Smart format with AI.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}

export default InstallModal
