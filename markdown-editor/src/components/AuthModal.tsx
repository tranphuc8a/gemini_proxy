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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setKey('')
      setError('')
      return
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (loginAdmin(key)) {
      onClose()
    } else {
      setError('That key was not accepted.')
      setKey('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="panel auth-panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
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
            The key is set with <code>VITE_MARKDOWN_ADMIN_KEY</code> at build time. It only gates this browser session and is
            never written to storage.
          </p>
        </div>

        <div className="auth-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!key}>
            Unlock
          </button>
        </div>
      </form>
    </div>
  )
}

export default AuthModal
