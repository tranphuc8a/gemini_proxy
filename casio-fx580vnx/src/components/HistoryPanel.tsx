/**
 * What has been calculated.
 *
 * The machine keeps a replay buffer you scroll with ▲; this shows the same
 * thing all at once. Every row is clickable, which puts the expression back on
 * the entry line — the fastest way to fix a typo in a long formula.
 */

import { useEffect, useRef } from 'react'

import { formatValue } from '../engine/format'
import { displayOptions, useStore } from '../store'

export function HistoryPanel() {
  const history = useStore((state) => state.history)
  const reuseEntry = useStore((state) => state.reuseEntry)
  const cycleForm = useStore((state) => state.cycleForm)
  const clearHistory = useStore((state) => state.clearHistory)
  const options = useStore(displayOptions)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [history.length])

  return (
    <section className="panel panel-history">
      <header className="panel-head">
        <h2>Lịch sử</h2>
        {history.length > 0 ? (
          <button type="button" className="button is-quiet" onClick={clearHistory}>
            Xoá lịch sử
          </button>
        ) : null}
      </header>

      {history.length === 0 ? (
        <p className="panel-note">Chưa có phép tính nào. Bấm <kbd>=</kbd> hoặc <kbd>Enter</kbd>.</p>
      ) : (
        <ol className="history-list">
          {history.map((item) => {
            const answer = item.value ? formatValue(item.value, options) : null
            return (
            <li key={item.id}>
              <button
                type="button"
                className="history-input"
                onClick={() => reuseEntry(item.id)}
                title="Đưa lại lên dòng nhập"
              >
                {item.input}
              </button>
              {item.error ? (
                <span className="history-error">{item.error}</span>
              ) : answer ? (
                <button
                  type="button"
                  className="history-output"
                  onClick={() => cycleForm(item.id)}
                  title={answer.hasAlternative ? 'Đổi dạng hiển thị' : undefined}
                >
                  = {answer.forms[item.form % answer.forms.length]}
                </button>
              ) : null}
            </li>
            )
          })}
        </ol>
      )}
      <div ref={endRef} />
    </section>
  )
}
