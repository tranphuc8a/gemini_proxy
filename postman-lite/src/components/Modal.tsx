import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './Icons'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** A dialog that closes on Escape and on a backdrop click, and traps focus. */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    // Focus the dialog so Escape and Tab land inside it rather than on whatever
    // was focused in the page behind.
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal${wide ? ' modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Đóng">
            <IconClose />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
