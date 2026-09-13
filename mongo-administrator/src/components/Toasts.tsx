import { useStore } from '../store'
import { IconClose } from './Icons'

export function Toasts() {
  const toasts = useStore((state) => state.toasts)
  const dismiss = useStore((state) => state.dismissToast)

  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          <span>{toast.message}</span>
          <button type="button" className="icon-btn" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <IconClose />
          </button>
        </div>
      ))}
    </div>
  )
}
