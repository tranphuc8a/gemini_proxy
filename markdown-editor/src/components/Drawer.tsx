import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import './Drawer.css'

interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Accessible name of the dialog. */
  label: string
  side?: 'left' | 'right'
  id?: string
  className?: string
  children: React.ReactNode
}

/**
 * An off-canvas panel over a dimmed backdrop: modal while open, so focus is
 * trapped inside and handed back to the opener when it closes. Escape, a tap
 * on the backdrop or the panel's own close button dismiss it.
 */
function Drawer({ open, onClose, label, side = 'left', id, className, children }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)

  if (!open) return null

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        id={id}
        className={`drawer drawer-${side}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
        }}
      >
        {children}
      </div>
    </>
  )
}

export default Drawer
