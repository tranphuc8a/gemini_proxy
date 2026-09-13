import { useEffect, useRef, useState } from 'react'

import { parseRelaxed } from '../lib/ejson'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  label?: string
  /** Called on every keystroke with the parse error, or null while valid. */
  onValidity?: (error: string | null) => void
  onSubmit?: () => void
  autoFocus?: boolean
}

/**
 * A plain textarea for relaxed JSON, with live validation and bracket-aware
 * conveniences (Tab indents, Ctrl/Cmd+Enter submits).
 *
 * Deliberately not CodeMirror or Monaco: this app ships as a pure front-end,
 * and a 400 KB editor for what is mostly a one-line filter is a poor trade.
 */
export function JsonEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  label,
  onValidity,
  onSubmit,
  autoFocus = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError(null)
      onValidity?.(null)
      return
    }
    try {
      parseRelaxed(trimmed)
      setError(null)
      onValidity?.(null)
    } catch (cause) {
      const message = (cause as Error).message
      setError(message)
      onValidity?.(message)
    }
    // onValidity is a callback prop; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  return (
    <div className="json-editor">
      {label ? <span className="json-editor-label">{label}</span> : null}
      <textarea
        ref={ref}
        className={`code-input${error ? ' is-invalid' : ''}`}
        rows={rows}
        value={value}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            onSubmit?.()
            return
          }
          if (event.key === 'Tab') {
            event.preventDefault()
            const target = event.currentTarget
            const { selectionStart, selectionEnd } = target
            const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
            onChange(next)
            requestAnimationFrame(() => {
              target.selectionStart = target.selectionEnd = selectionStart + 2
            })
          }
        }}
      />
      {error ? <p className="json-editor-error">{error}</p> : null}
    </div>
  )
}
