/**
 * Unlock server-side saving with the admin token.
 *
 * The key is checked by the backend and exchanged for a session token; this
 * component never compares anything itself, and the key is not kept anywhere
 * after the exchange. See `services/graphStorage`.
 */

import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../store'
import './AuthModal.css'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

function AuthModal({ open, onClose }: AuthModalProps) {
  const unlockAdmin = useEditor((state) => state.unlockAdmin)
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
      if (await unlockAdmin(key)) {
        onClose()
        return
      }
      setError('Máy chủ không chấp nhận token này.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không kết nối được tới máy chủ')
    } finally {
      setChecking(false)
      setKey('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="auth panel-card"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <h2 id="auth-title">Mở khoá quyền admin</h2>
        <p className="hint">Ai cũng vẽ và lưu cục bộ được. Lưu hoặc xoá trên máy chủ thì cần admin token.</p>

        <div className="field">
          <label htmlFor="admin-key">Admin token</label>
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
            placeholder="Nhập admin token"
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
          />
          {error && <p className="error" role="alert">{error}</p>}
          <p className="hint">
            Máy chủ đối chiếu với <code>GRAPHUC_ADMIN_KEY</code>. Token không bao giờ được lưu lại — nó được đổi lấy một
            session có chữ ký và có hạn, nên tải lại trang vẫn giữ nguyên quyền.
          </p>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn btn-primary" disabled={!key || checking}>
            {checking ? 'Đang kiểm tra…' : 'Mở khoá'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AuthModal
