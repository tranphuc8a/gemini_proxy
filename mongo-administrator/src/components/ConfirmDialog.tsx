import { useEffect, useRef } from 'react'

export interface ConfirmRequest {
  title: string
  body?: string
  /** The user must type this exactly before the action is enabled. */
  confirmWord?: string
  confirmLabel?: string
  danger?: boolean
}

interface Props extends ConfirmRequest {
  typed: string
  onTyped: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmWord,
  confirmLabel = 'Confirm',
  danger = true,
  typed,
  onTyped,
  onConfirm,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ready = !confirmWord || typed === confirmWord

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal modal-sm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 className="modal-title">{title}</h3>
        {body ? <p className="modal-body">{body}</p> : null}
        {confirmWord ? (
          <label className="field">
            <span>
              Type <code>{confirmWord}</code> to confirm
            </span>
            <input
              ref={inputRef}
              value={typed}
              onChange={(event) => onTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && ready) onConfirm()
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={!ready}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
