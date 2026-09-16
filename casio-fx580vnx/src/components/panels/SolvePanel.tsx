/**
 * CALC and SOLVE.
 *
 * Two keys, one screen, because they are the same idea from opposite ends: CALC
 * substitutes values into a formula, SOLVE searches for the value that makes it
 * balance. Both read the formula off the entry line, as the machine does.
 */

import { useEffect, useMemo, useState } from 'react'

import { evaluate } from '../../engine/evaluate'
import { formatValue } from '../../engine/format'
import { calculate, variablesUsed } from '../../engine/program'
import { solveEquation } from '../../engine/solve'
import { MathError, type Value } from '../../engine/value'
import { useStore } from '../../store'

interface Props {
  /** Which key opened it. */
  intent: 'calc' | 'solve'
  onClose: () => void
}

export function SolvePanel({ intent, onClose }: Props) {
  const entry = useStore((state) => state.entry)
  const context = useStore((state) => state.context)

  const [formula, setFormula] = useState(entry)
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [unknown, setUnknown] = useState('x')
  const [guess, setGuess] = useState('0')
  const [result, setResult] = useState<{ value: Value; note?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const used = useMemo(() => variablesUsed(formula), [formula])

  // Pick a sensible unknown: whatever the formula actually mentions.
  useEffect(() => {
    if (used.length > 0 && !used.includes(unknown)) setUnknown(used[0])
  }, [used, unknown])

  function runCalc() {
    try {
      const values: Record<string, Value> = {}
      for (const name of used) {
        values[name] = evaluate(bindings[name]?.trim() || '0', context)
      }
      setResult({ value: calculate(formula, values, context) })
      setError(null)
    } catch (problem) {
      setResult(null)
      setError(problem instanceof MathError ? problem.message : String(problem))
    }
  }

  function runSolve() {
    try {
      const { root, residual } = solveEquation(formula, context, unknown, Number(guess) || 0)
      setResult({
        value: root,
        note: `L−R = ${formatValue(residual).forms[0]}`,
      })
      setError(null)
    } catch (problem) {
      setResult(null)
      setError(problem instanceof MathError ? problem.message : String(problem))
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={intent === 'calc' ? 'CALC' : 'SOLVE'}>
      <section className="panel panel-dialog">
        <header className="panel-head">
          <h2>{intent === 'calc' ? 'CALC — thay giá trị vào công thức' : 'SOLVE — tìm nghiệm'}</h2>
          <button type="button" className="button is-quiet" onClick={onClose}>Đóng</button>
        </header>

        <label className="panel-stack">
          Công thức
          <input
            value={formula}
            onChange={(event) => setFormula(event.target.value)}
            placeholder={intent === 'calc' ? 'A^2+B' : 'x^2=4'}
          />
        </label>

        {intent === 'calc' ? (
          <>
            {used.length === 0 ? (
              <p className="panel-note">Công thức chưa có biến nào. Dùng A–F, x, y hoặc M.</p>
            ) : (
              <div className="panel-stack">
                {used.map((name) => (
                  <label key={name}>
                    {name} =
                    <input
                      value={bindings[name] ?? ''}
                      placeholder="0"
                      onChange={(event) =>
                        setBindings({ ...bindings, [name]: event.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="panel-actions">
              <button type="button" className="button is-primary" onClick={runCalc}>Tính</button>
            </div>
          </>
        ) : (
          <>
            <div className="panel-row">
              <label>
                Ẩn số
                <select value={unknown} onChange={(event) => setUnknown(event.target.value)}>
                  {(used.length ? used : ['x']).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Giá trị khởi đầu
                <input value={guess} inputMode="decimal" onChange={(event) => setGuess(event.target.value)} />
              </label>
            </div>
            <p className="panel-note">
              Nhập cả hai vế, ví dụ <code>x^2=4</code>. Không có dấu <code>=</code> thì hiểu là <code>… = 0</code>.
            </p>
            <div className="panel-actions">
              <button type="button" className="button is-primary" onClick={runSolve}>Giải</button>
            </div>
          </>
        )}

        {error ? <p className="panel-error">{error}</p> : null}

        {result ? (
          <div className="panel-result">
            <h3>Kết quả</h3>
            <p className="big-result">{formatValue(result.value).forms[0]}</p>
            {result.note ? <p className="panel-note">{result.note}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
