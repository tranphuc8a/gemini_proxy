import { useEffect, useState } from 'react'
import type { StorageBackend } from '../types'
import ReadingSurface from '../components/ReadingSurface'
import { IconDownload, IconPrinter } from '../components/Icons'
import { useReadingStore } from '../readingStore'
import { exportMarkdown } from '../lib/exporters'
import { isValidToken } from '../lib/share'
import { ShareError, readShared, type SharedDocument } from '../services/shareClient'
import './SharePage.css'

/**
 * The page a read-only link opens (md-share V11): `…/markdown-editor-pro/#share=<token>&backend=<store>`.
 *
 * Anyone holding the link sees the snapshot through the reading surface -- the same pipeline as the editor (sanitised,
 * maths, Mermaid drawn in the browser, inline styles guarded), with `links="shared"` -- and nothing else: no editor,
 * no local workspace, no admin session, no service worker (see boot.ts). The request identifies nothing of the viewer.
 */

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; doc: SharedDocument }
  | { phase: 'notFound' }
  | { phase: 'rateLimited'; retryAfter: number | null }
  | { phase: 'offline' }
  | { phase: 'error'; message: string }

export interface SharePageProps {
  token: string
  backend: StorageBackend | null
}

const NOT_FOUND = "This link doesn't exist, has expired, or was revoked by its owner."

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return new Date(ms).toISOString().slice(0, 10)
  }
}

function describe(error: unknown): State {
  if (error instanceof ShareError) {
    if (error.code === 'markdown_share_not_found' || error.status === 404) return { phase: 'notFound' }
    if (error.status === 429) return { phase: 'rateLimited', retryAfter: error.retryAfter }
    if (error.offline) return { phase: 'offline' }
    return { phase: 'error', message: error.message }
  }
  return { phase: 'error', message: 'Something went wrong while opening this link.' }
}

function SharePage({ token, backend }: SharePageProps) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // The reader's own text settings, without opening the editor's reading mode or touching ?read=1.
  useEffect(() => {
    useReadingStore.getState().loadSettings()
  }, [])

  // Messages outside the article follow the system theme (the editor's own setting is not read here).
  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const apply = () => {
      document.documentElement.dataset.theme = media?.matches ? 'dark' : 'light'
    }
    apply()
    media?.addEventListener?.('change', apply)
    return () => media?.removeEventListener?.('change', apply)
  }, [])

  useEffect(() => {
    if (!isValidToken(token)) {
      setState({ phase: 'notFound' })
      return
    }
    let cancelled = false
    setState({ phase: 'loading' })
    readShared(token, backend)
      .then((doc) => {
        if (!cancelled) setState({ phase: 'ready', doc })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState(describe(error))
      })
    return () => {
      cancelled = true
    }
  }, [token, backend, attempt])

  const title = state.phase === 'ready' ? state.doc.title : null
  useEffect(() => {
    document.title = title ? `${title} · Shared (read-only)` : 'Shared document · Markdown Editor'
  }, [title])

  if (state.phase === 'ready') {
    const { doc } = state
    const parts = [`Read-only · shared ${formatDate(doc.sharedAt)}`]
    if (doc.updatedAt !== doc.sharedAt) parts.push(`updated ${formatDate(doc.updatedAt)}`)
    if (doc.expiresAt) parts.push(`expires ${formatDate(doc.expiresAt)}`)
    return (
      <ReadingSurface
        content={doc.content}
        title={doc.title}
        documentKey={token}
        links="shared"
        ariaLabelPrefix="Shared document: "
        prelude={<p className="share-meta">{parts.join(' · ')}</p>}
        barActions={
          <>
            <button
              className="reading-btn"
              onClick={() => exportMarkdown(doc.title, doc.content)}
              aria-label="Download .md"
              title="Download this document as Markdown"
            >
              <IconDownload size={18} />
            </button>
            <button className="reading-btn" onClick={() => window.print()} aria-label="Print" title="Print">
              <IconPrinter size={18} />
            </button>
          </>
        }
      />
    )
  }

  const retry = () => setAttempt((count) => count + 1)
  return (
    <main className="share-status" aria-busy={state.phase === 'loading'}>
      <div className="share-status-card">
        <p className="share-status-eyebrow">Markdown Editor · shared document</p>
        {state.phase === 'loading' && (
          <p className="share-status-text" role="status">
            Opening the shared document…
          </p>
        )}
        {state.phase === 'notFound' && (
          <>
            <h1 className="share-status-title">Link not available</h1>
            <p className="share-status-text" role="alert">
              {NOT_FOUND}
            </p>
          </>
        )}
        {state.phase === 'rateLimited' && (
          <>
            <h1 className="share-status-title">Please wait a moment</h1>
            <p className="share-status-text" role="alert">
              Too many requests from this network. Try again in {state.retryAfter ?? 60} seconds.
            </p>
            <button className="btn btn-primary" onClick={retry}>
              Try again
            </button>
          </>
        )}
        {state.phase === 'offline' && (
          <>
            <h1 className="share-status-title">You&apos;re offline</h1>
            <p className="share-status-text" role="alert">
              A shared document is read from the server each time and is not kept on this device. Reconnect and try again.
            </p>
            <button className="btn btn-primary" onClick={retry}>
              Try again
            </button>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <h1 className="share-status-title">Could not open this link</h1>
            <p className="share-status-text" role="alert">
              {state.message}
            </p>
            <button className="btn btn-primary" onClick={retry}>
              Try again
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default SharePage
