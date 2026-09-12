import { useStore } from '../store'
import { CloseIcon } from './Icons'

export function Toasts() {
  const toasts = useStore((state) => state.toasts)
  const dismiss = useStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          <span className="toast-message">{toast.message}</span>
          <button type="button" className="icon-btn" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
