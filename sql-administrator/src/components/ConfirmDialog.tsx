import { useEffect, useRef, useState } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  /** When set, the user must type this exact text before confirming. */
  requireText?: string
}

interface Props extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  requireText,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    ;(requireText ? inputRef.current : confirmRef.current)?.focus()
  }, [requireText])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const blocked = Boolean(requireText) && typed !== requireText

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal modal-sm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>

        {requireText ? (
          <label className="field">
            <span>
              Type <code>{requireText}</code> to continue
            </span>
            <input ref={inputRef} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </label>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={blocked}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
