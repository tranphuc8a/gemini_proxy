import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { IconClose, IconLock } from './Icons'
import './AuthModal.css'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

function AuthModal({ open, onClose }: AuthModalProps) {
  const loginAdmin = useEditorStore((state) => state.loginAdmin)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setKey('')
      setError('')
      setChecking(false)
      return
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (checking) return

    setChecking(true)
    setError('')
    try {
      // The backend verifies the key; this component never sees the real one.
      if (await loginAdmin(key)) {
        onClose()
        return
      }
      setError('That key was not accepted.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the backend')
    } finally {
      setChecking(false)
      setKey('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="panel auth-panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <div className="auth-head">
          <span className="auth-icon">
            <IconLock size={18} />
          </span>
          <div>
            <h2 id="auth-title">Unlock editing</h2>
            <p>Anyone can read and export. Editing files needs the admin key.</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="auth-body">
          <label className="auth-label" htmlFor="admin-key">
            Admin key
          </label>
          <input
            ref={inputRef}
            id="admin-key"
            type="password"
            className={error ? 'has-error' : ''}
            value={key}
            onChange={(event) => {
              setKey(event.target.value)
              setError('')
            }}
            placeholder="Enter the admin key"
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'auth-error' : undefined}
          />
          {error && (
            <p id="auth-error" className="auth-error" role="alert">
              {error}
            </p>
          )}
          <p className="auth-note">
            The backend checks the key against <code>MARKDOWN_ADMIN_KEY</code>. The key itself is never stored or built into
            this page — it is exchanged for a signed session token, so this browser stays unlocked across reloads until the
            token expires or you sign out.
          </p>
        </div>

        <div className="auth-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!key || checking}>
            {checking ? 'Checking...' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AuthModal
