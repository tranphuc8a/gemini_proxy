import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { findNode } from '../lib/tree'
import { sha256Hex } from '../lib/hash'
import { formatBytes, isShareableDocId, scanDocumentRefs, shareLinkFor, shareTitleFromName, utf8Bytes } from '../lib/share'
import { ShareError, createShare, listShares, revokeShare, type ShareListing, type ShareSummary } from '../services/shareClient'
import type { FileNode } from '../types'
import { IconClose, IconCopy, IconLink2 } from './Icons'
import './ShareDialog.css'

/**
 * "Share read-only link…" (md-share V12). An administrator freezes the open document into a snapshot that anyone
 * holding the link can read -- and nothing else: not edit it, not see the other documents (the store itself is private,
 * MARKDOWN_PUBLIC_READ=false). One link per document; sharing again refreshes the snapshot and keeps the link.
 */

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  /** Opens the admin unlock dialog (for a guest). */
  onOpenAuth: () => void
}

type Expiry = 'never' | '1' | '7' | '30'
const EXPIRY_OPTIONS: { value: Expiry; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' }
]
const DAY_MS = 86_400_000
const DEFAULT_MAX_BYTES = 2_000_000

function expiryDays(expiry: Expiry): 1 | 7 | 30 | null {
  return expiry === 'never' ? null : (Number(expiry) as 1 | 7 | 30)
}

/** The choice that produced an existing link's expiry (the API has no "keep": a refresh sends one again). */
function expiryOf(share: ShareSummary | null): Expiry {
  if (!share?.expiresAt) return 'never'
  const days = Math.round((share.expiresAt - share.updatedAt) / DAY_MS)
  return days <= 1 ? '1' : days <= 7 ? '7' : '30'
}

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return new Date(ms).toISOString()
  }
}

function collectIds(nodes: FileNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    into.add(node.id)
    if (node.children) collectIds(node.children, into)
  }
  return into
}

async function copyText(text: string, fallbackInput: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall back to selecting the text */
  }
  if (fallbackInput) {
    fallbackInput.focus()
    fallbackInput.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    }
  }
  return false
}

function ShareDialog({ open, onClose, onOpenAuth }: ShareDialogProps) {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const fileId = useEditorStore((state) => state.currentFileId)
  const node = useEditorStore((state) => (state.currentFileId ? findNode(state.files, state.currentFileId) : null))
  const backend = useEditorStore((state) => state.backendStorageType)
  const pushToast = useEditorStore((state) => state.pushToast)

  const panelRef = useRef<HTMLElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  useFocusTrap(panelRef, open)

  const [listing, setListing] = useState<ShareListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [expiry, setExpiry] = useState<Expiry>('never')
  const [changed, setChanged] = useState(false)

  const isFile = node?.type === 'file'
  const shareable = isFile && isShareableDocId(fileId)
  const mine = useMemo(() => listing?.shares.find((share) => share.docId === fileId) ?? null, [listing, fileId])
  const others = useMemo(() => listing?.shares.filter((share) => share.docId !== fileId) ?? [], [listing, fileId])
  const maxBytes = listing?.limits.maxBytes ?? DEFAULT_MAX_BYTES
  // Sharing a document whose link expired makes a NEW link on the server (new token): the old address must not come back.
  const expired = Boolean(mine?.expired)

  // Read when the dialog opens (and after each action): never on a keystroke.
  const [content, setContent] = useState('')
  useEffect(() => {
    if (open) setContent(useEditorStore.getState().currentContent)
  }, [open, fileId])
  const bytes = useMemo(() => (open ? utf8Bytes(content) : 0), [open, content])
  const refs = useMemo(() => (open ? scanDocumentRefs(content) : null), [open, content])
  const tooLarge = bytes > maxBytes

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setListing(await listShares(backend))
    } catch (cause) {
      setListing(null)
      setError(cause instanceof Error ? cause.message : 'Could not load the links.')
    } finally {
      setLoading(false)
    }
  }, [backend])

  useEffect(() => {
    if (!open || !isAdmin) return
    void refresh()
  }, [open, isAdmin, refresh])

  // Seed the form when the dialog opens or the document changes, then follow what the server holds -- but never over what
  // the owner is typing: `refresh()` hands back a NEW `mine` object every time, even when nothing in it changed, so an effect
  // keyed on it alone wiped a half-typed title whenever any action re-read the list (M3V, góp ý 7).
  const titleTouched = useRef(false)
  const expiryTouched = useRef(false)
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      seededFor.current = null
      return
    }
    const key = fileId ?? ''
    if (seededFor.current !== key) {
      seededFor.current = key
      titleTouched.current = false
      expiryTouched.current = false
    }
    if (!titleTouched.current) setTitle(mine?.title ?? shareTitleFromName(node?.name))
    if (!expiryTouched.current) setExpiry(expiryOf(mine))
  }, [open, fileId, mine, node?.name])

  // "Changed since this snapshot": the same SHA-256 the server stored (pure JS where crypto.subtle is missing).
  useEffect(() => {
    if (!open || !mine) {
      setChanged(false)
      return
    }
    let cancelled = false
    void sha256Hex(content).then((hash) => {
      if (!cancelled) setChanged(hash !== mine.contentHash)
    })
    return () => {
      cancelled = true
    }
  }, [open, mine, content])

  useEffect(() => {
    if (!open) {
      setError('')
      setBusy(null)
    }
  }, [open])

  // Escape closes the dialog wherever focus went (a re-render can drop it on <body>). Captured on window, so the app's
  // own Escape handling (drawer, fullscreen) does not also run.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!open) return null

  const ids = collectIds(useEditorStore.getState().files)
  const linkOf = (share: ShareSummary) => shareLinkFor(window.location.href, share.token, backend)

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof ShareError || cause instanceof Error ? cause.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const publish = () =>
    run(mine ? 'update' : 'create', async () => {
      const text = useEditorStore.getState().currentContent
      setContent(text)
      const cleanTitle = title.trim() || shareTitleFromName(node?.name)
      const { created } = await createShare({ docId: fileId!, title: cleanTitle, content: text, expiresInDays: expiryDays(expiry) }, backend)
      pushToast(created ? 'Read-only link created' : 'Snapshot updated', 'success')
      // What the owner typed is now what the server holds: show it from the next listing on.
      titleTouched.current = false
      expiryTouched.current = false
      await refresh()
    })

  const revoke = (share: ShareSummary) => {
    const confirmed = window.confirm(
      `Revoke the link to “${share.title}”?\n\nAnyone holding the link will lose access. Sharing again creates a different link.`
    )
    if (!confirmed) return
    void run(`revoke:${share.docId}`, async () => {
      await revokeShare(share.docId, backend)
      pushToast('Link revoked', 'success')
      await refresh()
    })
  }

  const copy = async (share: ShareSummary, input: HTMLInputElement | null) => {
    const ok = await copyText(linkOf(share), input)
    pushToast(ok ? 'Link copied' : 'Select the link and copy it', ok ? 'success' : 'info')
  }

  let body: JSX.Element
  if (!isAdmin) {
    body = (
      <div className="share-section">
        <p className="share-text">Creating read-only links needs admin access. Unlock admin mode with the server&apos;s key first.</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            onClose()
            onOpenAuth()
          }}
        >
          Unlock admin mode…
        </button>
      </div>
    )
  } else if (!isFile) {
    body = <p className="share-text">Open a document first. A link shares one document.</p>
  } else if (!shareable) {
    body = (
      <p className="share-text" role="note">
        This document can&apos;t be shared: its id is not in the form the server accepts. Copy its text into a new document and share that.
      </p>
    )
  } else {
    const warnings: string[] = []
    if (refs && refs.internalLinks.length) {
      const n = refs.internalLinks.length
      warnings.push(`${n} ${n === 1 ? 'link points' : 'links point'} to other documents. Viewers will see ${n === 1 ? 'it' : 'them'} as plain text.`)
    }
    if (refs && refs.relativeImages.length) {
      const n = refs.relativeImages.length
      warnings.push(`${n} ${n === 1 ? 'image has' : 'images have'} a relative address and cannot be shown.`)
    }
    if (refs && refs.externalImages.length) {
      const n = refs.externalImages.length
      warnings.push(`${n} ${n === 1 ? 'image loads' : 'images load'} from other sites; those sites will see the viewer's address.`)
    }
    body = (
      <>
        {mine && (
          <div className="share-section share-current">
            <label className="share-label" htmlFor="share-url">
              Read-only link
            </label>
            <div className="share-url-row">
              <input id="share-url" ref={urlRef} className="share-url" readOnly value={linkOf(mine)} onFocus={(event) => event.currentTarget.select()} />
              <button className="btn" onClick={() => void copy(mine, urlRef.current)}>
                <IconCopy size={14} /> Copy
              </button>
              <a className="btn" href={linkOf(mine)} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            </div>
            <p className="share-hint">
              Snapshot from {formatDate(mine.updatedAt)}
              {mine.expiresAt ? ` · expires ${formatDate(mine.expiresAt)}` : ''}
              {mine.expired ? ' · expired' : ''}
            </p>
            {expired && (
              <p className="share-warning" role="status">
                This link has expired and no longer opens. Creating a new link gives a new address; the old address stays dead.
              </p>
            )}
            {changed && !expired && (
              <p className="share-warning" role="status">
                The document changed since this snapshot. Update it to share the current text.
              </p>
            )}
          </div>
        )}

        <div className="share-section">
          <label className="share-label" htmlFor="share-title">
            Title
          </label>
          <input
            id="share-title"
            className="share-input"
            value={title}
            maxLength={200}
            onChange={(event) => {
              titleTouched.current = true
              setTitle(event.target.value)
            }}
          />
          <label className="share-label" htmlFor="share-expiry">
            Expires
          </label>
          <select
            id="share-expiry"
            className="share-input"
            value={expiry}
            onChange={(event) => {
              expiryTouched.current = true
              setExpiry(event.target.value as Expiry)
            }}
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className={`share-size${tooLarge ? ' is-over' : ''}`} data-testid="share-size">
            {formatBytes(bytes)} of {formatBytes(maxBytes)}
            {tooLarge ? ' — too large to share' : ''}
          </p>
          {warnings.map((warning) => (
            <p key={warning} className="share-warning">
              {warning}
            </p>
          ))}
          <div className="share-actions">
            <button className="btn btn-primary" disabled={tooLarge || busy !== null || loading} onClick={() => void publish()}>
              {expired ? 'Create new link' : mine ? 'Update snapshot' : 'Create link'}
              {(busy === 'create' || busy === 'update') && <span className="menu-hint"> working…</span>}
            </button>
            {mine && (
              <button className="btn btn-danger-text" disabled={busy !== null} onClick={() => revoke(mine)}>
                Revoke link…
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="overlay" onClick={onClose}>
      <section
        ref={panelRef}
        tabIndex={-1}
        className="panel share-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title-heading"
      >
        <header className="share-head">
          <div>
            <p className="share-eyebrow">
              <IconLink2 size={12} /> Read-only link
            </p>
            <h2 id="share-title-heading">{isFile && node ? `Share “${shareTitleFromName(node.name)}”` : 'Share a document'}</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="share-body">
          {loading && !listing && (
            <p className="share-hint" role="status">
              Loading links…
            </p>
          )}
          {error && (
            <p className="share-error" role="alert">
              {error}
            </p>
          )}
          {listing && !listing.persistent && (
            <p className="share-warning" role="note">
              This server keeps links in a temporary file. They stop working when it restarts. Choose MySQL or MongoDB under Sync → Storage.
            </p>
          )}
          {body}

          {isAdmin && others.length > 0 && (
            <details className="share-others">
              <summary>Other shared documents ({others.length})</summary>
              <ul>
                {others.map((share) => (
                  <li key={share.token} className="share-other">
                    <span className="share-other-title">
                      {share.title}
                      {!ids.has(share.docId) && <span className="share-badge">not in this editor</span>}
                      {share.expired && <span className="share-badge">expired</span>}
                    </span>
                    <span className="share-hint">{formatDate(share.updatedAt)}</span>
                    <span className="share-other-actions">
                      <button className="btn btn-small" onClick={() => void copy(share, null)} aria-label={`Copy the link to ${share.title}`}>
                        Copy
                      </button>
                      <button
                        className="btn btn-small btn-danger-text"
                        disabled={busy !== null}
                        onClick={() => revoke(share)}
                        aria-label={`Revoke the link to ${share.title}`}
                      >
                        Revoke
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="share-note">
            Anyone with the link can read this snapshot, but cannot edit it or see your other documents. Don&apos;t share secrets.
          </p>
        </div>
      </section>
    </div>
  )
}

export default ShareDialog
