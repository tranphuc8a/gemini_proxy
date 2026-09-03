import { useState } from 'react'
import { useEditorStore } from '../store'
import './AuthModal.css'

function AuthModal() {
  const [showModal, setShowModal] = useState(false)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const loginAdmin = useEditorStore((state) => state.loginAdmin)

  const handleLogin = () => {
    if (loginAdmin(key)) {
      setKey('')
      setError('')
      setShowModal(false)
    } else {
      setError('Invalid admin key')
      setKey('')
    }
  }

  if (isAdmin) return null

  return (
    <>
      <button
        className="auth-trigger"
        onClick={() => setShowModal(true)}
        title="Login as admin"
      >
        🔐
      </button>

      {showModal && (
        <div className="auth-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Admin Login</h2>
            <p className="auth-desc">
              Enter admin key to unlock editing features
            </p>

            <input
              type="password"
              placeholder="Admin key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setError('')
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleLogin()
              }}
              autoFocus
              className={error ? 'error' : ''}
            />

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-buttons">
              <button className="auth-btn confirm" onClick={handleLogin}>
                Login
              </button>
              <button
                className="auth-btn cancel"
                onClick={() => {
                  setShowModal(false)
                  setKey('')
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>

            <p className="auth-hint">
              💡 Hint: Key is defined in store.ts
            </p>
          </div>
        </div>
      )}
    </>
  )
}

export default AuthModal
