/**
 * TABLE mode: a function tabulated over a range.
 *
 * The machine allows two functions at once, f(x) and g(x), and so does this.
 * Rows are capped the way the machine caps them — an open-ended range with a
 * tiny step would otherwise lock the page up while it built a million rows.
 */

import { useMemo, useState } from 'react'

import { evaluate, type Context } from '../../engine/evaluate'
import { formatValue } from '../../engine/format'
import { MathError, inexact, type Value } from '../../engine/value'
import { useStore } from '../../store'

const MAX_ROWS = 45

interface Row {
  x: number
  f: string
  g: string | null
}

function tabulate(
  fx: string,
  gx: string,
  start: number,
  end: number,
  step: number,
  context: Context,
): Row[] {
  const rows: Row[] = []
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) {
    return rows
  }
  // Walk by index rather than accumulating x, so 0.1 steps do not drift into
  // 0.30000000000000004 halfway down the table.
  const count = Math.min(MAX_ROWS, Math.floor((end - start) / step) + 1)

  for (let i = 0; i < count; i++) {
    const x = start + i * step
    rows.push({
      x,
      f: attempt(fx, x, context),
      g: gx.trim() ? attempt(gx, x, context) : null,
    })
  }
  return rows
}

function attempt(source: string, x: number, context: Context): string {
  if (!source.trim()) return ''
  const saved = context.variables.x
  context.variables.x = inexact(x)
  try {
    return short(evaluate(source, context))
  } catch (error) {
    return error instanceof MathError ? 'ERROR' : 'ERROR'
  } finally {
    if (saved === undefined) delete context.variables.x
    else context.variables.x = saved
  }
}

/** The decimal form, since a column of fractions does not line up. */
function short(value: Value): string {
  const forms = formatValue(value).forms
  return forms[forms.length - 1]
}

export function TablePanel() {
  const context = useStore((state) => state.context)
  const press = useStore((state) => state.press)

  const [fx, setFx] = useState('x^2')
  const [gx, setGx] = useState('')
  const [start, setStart] = useState('1')
  const [end, setEnd] = useState('10')
  const [step, setStep] = useState('1')

  const rows = useMemo(
    () => tabulate(fx, gx, Number(start), Number(end), Number(step), context),
    [fx, gx, start, end, step, context],
  )

  const truncated = rows.length === MAX_ROWS

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Bảng giá trị</h2>
        <p>Dùng biến <code>x</code> trong công thức. Ví dụ: <code>x^2-3x+2</code>, <code>sin(x)</code>.</p>
      </header>

      <div className="panel-stack">
        <label>
          f(x) =
          <input value={fx} onChange={(event) => setFx(event.target.value)} />
        </label>
        <label>
          g(x) =
          <input
            value={gx}
            placeholder="để trống nếu chỉ cần một hàm"
            onChange={(event) => setGx(event.target.value)}
          />
        </label>
      </div>

      <div className="panel-row">
        <label>Bắt đầu<input value={start} inputMode="decimal" onChange={(event) => setStart(event.target.value)} /></label>
        <label>Kết thúc<input value={end} inputMode="decimal" onChange={(event) => setEnd(event.target.value)} /></label>
        <label>Bước<input value={step} inputMode="decimal" onChange={(event) => setStep(event.target.value)} /></label>
      </div>

      <div className="panel-actions">
        <button type="button" className="button is-quiet" onClick={() => press(fx)}>
          Đưa f(x) lên dòng nhập
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="panel-note">Kiểm tra lại khoảng và bước — bước phải khác 0.</p>
      ) : (
        <>
          {truncated ? (
            <p className="panel-note">Hiển thị {MAX_ROWS} dòng đầu tiên.</p>
          ) : null}
          <div className="stat-table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>x</th>
                  <th>f(x)</th>
                  {gx.trim() ? <th>g(x)</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{Number(row.x.toPrecision(10))}</td>
                    <td>{row.f}</td>
                    {gx.trim() ? <td>{row.g}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
