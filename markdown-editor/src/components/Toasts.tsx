import { useEditorStore } from '../store'
import { IconCheck, IconClose } from './Icons'
import './Toasts.css'

function Toasts() {
  const toasts = useEditorStore((state) => state.toasts)
  const dismiss = useEditorStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast is-${toast.tone}`}>
          {toast.tone === 'success' && <IconCheck size={14} />}
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default Toasts
