import { useStore } from '../store'
import { IconClose } from './Icons'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.kind}`} key={toast.id}>
          <span style={{ flex: 1 }}>{toast.text}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => dismiss(toast.id)} aria-label="Đóng thông báo">
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
