/**
 * The LCD.
 *
 * Two lines, like the machine: what you are typing on top, the answer
 * underneath, with the indicator strip above both. The entry line is rendered
 * character by character rather than as an `<input>` so the caret can sit
 * between the calculator's own symbols and a click can put it there — an input
 * would fight the keypad over focus on every press.
 */

import { useEffect, useRef } from 'react'

import { formatValue } from '../engine/format'
import { displayOptions, useStore } from '../store'

export function Display() {
  const entry = useStore((state) => state.entry)
  const cursor = useStore((state) => state.cursor)
  const history = useStore((state) => state.history)
  const error = useStore((state) => state.error)
  const settled = useStore((state) => state.settled)
  const shift = useStore((state) => state.shift)
  const alpha = useStore((state) => state.alpha)
  const angle = useStore((state) => state.angle)
  const mode = useStore((state) => state.mode)
  const setCursor = useStore((state) => state.setCursor)
  const cycleForm = useStore((state) => state.cycleForm)
  const options = useStore(displayOptions)

  const last = history[history.length - 1]
  const answer = last?.value ? formatValue(last.value, options) : null
  const lineRef = useRef<HTMLDivElement>(null)

  // Keep the caret in view on a long entry, the way the machine scrolls.
  useEffect(() => {
    lineRef.current?.querySelector('.lcd-caret')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [cursor, entry])

  const characters = [...entry]

  return (
    <div className="lcd">
      <div className="lcd-status">
        <span className={shift ? 'is-on' : ''}>SHIFT</span>
        <span className={alpha ? 'is-on' : ''}>ALPHA</span>
        <span className="is-on">{angle === 'deg' ? 'D' : angle === 'rad' ? 'R' : 'G'}</span>
        <span className="is-on">{MODE_TAG[mode]}</span>
        <span className="lcd-status-spacer" />
        <span className={settled ? 'is-on' : ''}>Ans</span>
      </div>

      <div className="lcd-entry" ref={lineRef} onClick={() => lineRef.current?.focus()}>
        {characters.length === 0 && cursor === 0 ? <i className="lcd-caret" /> : null}
        {characters.map((character, index) => (
          <span key={index}>
            {index === cursor && characters.length > 0 ? <i className="lcd-caret" /> : null}
            <button
              type="button"
              className="lcd-char"
              tabIndex={-1}
              aria-label={`Đặt con trỏ trước ${character}`}
              onClick={() => setCursor(index)}
            >
              {character}
            </button>
          </span>
        ))}
        {cursor >= characters.length && characters.length > 0 ? <i className="lcd-caret" /> : null}
      </div>

      <div className="lcd-answer">
        {error ? (
          <span className="lcd-error">{error}</span>
        ) : answer ? (
          <button
            type="button"
            className="lcd-result"
            onClick={() => cycleForm(last.id)}
            title={answer.hasAlternative ? 'Bấm để đổi dạng hiển thị (S⇔D)' : undefined}
          >
            {answer.forms[last.form % answer.forms.length]}
            {answer.hasAlternative ? <span className="lcd-sd">S⇔D</span> : null}
          </button>
        ) : (
          <span className="lcd-placeholder">0</span>
        )}
      </div>
    </div>
  )
}

const MODE_TAG: Record<string, string> = {
  comp: 'COMP',
  complex: 'CMPLX',
  base: 'BASE',
  matrix: 'MAT',
  vector: 'VCT',
  stat: 'STAT',
  table: 'TABLE',
  equation: 'EQN',
  ratio: 'RATIO',
}
