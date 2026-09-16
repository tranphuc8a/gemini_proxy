/**
 * The memories: A–F, M, x, y, z, n, and Ans.
 *
 * On the machine these are invisible until you press RCL and pick one. Showing
 * them all, with their current values, is the one place where being on a screen
 * is strictly better than being a calculator.
 */

import { useState } from 'react'

import { formatValue } from '../engine/format'
import { evaluate } from '../engine/evaluate'
import { MathError } from '../engine/value'
import { useStore } from '../store'

const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y', 'z', 'n'] as const

export function MemoryPanel() {
  const context = useStore((state) => state.context)
  const store = useStore((state) => state.store)
  const press = useStore((state) => state.press)
  const clearMemories = useStore((state) => state.clearMemories)
  useStore((state) => state.revision) // the context is mutated in place

  // Which slot is being edited, and what has been typed into it. A browser
  // prompt() would block the whole page and lose the expression on a typo.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function commit(name: string) {
    try {
      store(name, evaluate(draft.trim() || '0', context))
      setEditing(null)
      setError(null)
    } catch (problem) {
      setError(problem instanceof MathError ? problem.message : String(problem))
    }
  }

  const ans = context.variables.Ans

  return (
    <section className="panel panel-memory">
      <header className="panel-head">
        <h2>Biến nhớ</h2>
        <button type="button" className="button is-quiet" onClick={clearMemories}>
          Xoá tất cả
        </button>
      </header>

      <p className="panel-note">
        Gán trực tiếp trên dòng nhập bằng <code>5→A</code>, hoặc bấm vào ô để nhập.
      </p>

      <ul className="memory-list">
        {SLOTS.map((name) => {
          const value = context.variables[name]
          return (
            <li key={name}>
              <button type="button" className="memory-name" onClick={() => press(name)} title={`Chèn ${name}`}>
                {name}
              </button>
              {editing === name ? (
                <input
                  className="memory-input"
                  value={draft}
                  autoFocus
                  aria-label={`Giá trị cho ${name}`}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commit(name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commit(name)
                    if (event.key === 'Escape') {
                      setEditing(null)
                      setError(null)
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="memory-value"
                  title="Bấm để gán giá trị"
                  onClick={() => {
                    setEditing(name)
                    setDraft(value ? formatValue(value).forms[0] : '')
                    setError(null)
                  }}
                >
                  {value ? formatValue(value).forms[0] : '0'}
                </button>
              )}
            </li>
          )
        })}
        <li className="is-ans">
          <button type="button" className="memory-name" onClick={() => press('Ans')}>Ans</button>
          <span className="memory-value is-readonly">{ans ? formatValue(ans).forms[0] : '0'}</span>
        </li>
      </ul>

      {error ? <p className="panel-error">{error}</p> : null}
    </section>
  )
}
