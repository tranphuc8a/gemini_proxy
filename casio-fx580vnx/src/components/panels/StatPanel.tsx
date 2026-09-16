/**
 * STAT mode.
 *
 * Both standard deviations are shown together and named in full, because the
 * machine's own `σx` / `sx` labelling is the single most misread thing on it.
 */

import { useMemo, useState } from 'react'

import { oneVariable, regression, type DataPoint, type RegressionKind } from '../../engine/stats'
import { useStore } from '../../store'

const REGRESSIONS: { id: RegressionKind; label: string; formula: string }[] = [
  { id: 'linear', label: 'Tuyến tính', formula: 'y = A + Bx' },
  { id: 'quadratic', label: 'Bậc hai', formula: 'y = A + Bx + Cx²' },
  { id: 'log', label: 'Logarit', formula: 'y = A + B·ln x' },
  { id: 'exp', label: 'Mũ', formula: 'y = A·e^(Bx)' },
  { id: 'power', label: 'Luỹ thừa', formula: 'y = A·x^B' },
  { id: 'inverse', label: 'Nghịch đảo', formula: 'y = A + B/x' },
]

/** Ten significant digits, matching the display, with NaN shown as a dash. */
function show(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(Number(value.toPrecision(10)))
}

export function StatPanel() {
  const rows = useStore((state) => state.statRows)
  const setRows = useStore((state) => state.setStatRows)
  const columns = useStore((state) => state.statColumns)
  const setColumns = useStore((state) => state.setStatColumns)

  const [kind, setKind] = useState<RegressionKind>('linear')
  const [predictAt, setPredictAt] = useState('')

  const data = useMemo<DataPoint[]>(
    () =>
      rows
        // A blank x is a blank row, not a zero — `Number('')` is 0, which would
        // quietly drag the mean towards the origin as you type.
        .filter((row) => row.x.trim() !== '')
        .map((row) => ({
          x: Number(row.x),
          y: Number(row.y || 0),
          freq: columns.freq ? Number(row.freq || 0) : 1,
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.freq > 0),
    [rows, columns.freq],
  )

  const stats = useMemo(() => oneVariable(data), [data])
  const fit = useMemo(() => {
    if (!columns.y || data.length < 2) return null
    try {
      return regression(data, kind)
    } catch {
      return null
    }
  }, [columns.y, data, kind])

  function update(index: number, field: 'x' | 'y' | 'freq', value: string) {
    const next = rows.map((row, at) => (at === index ? { ...row, [field]: value } : row))
    // Always keep one blank row at the bottom so typing never needs a button.
    const last = next[next.length - 1]
    if (last.x.trim() !== '' || last.y.trim() !== '') {
      next.push({ x: '', y: '', freq: '1' })
    }
    setRows(next)
  }

  const prediction = (() => {
    if (!fit || !predictAt.trim()) return null
    const x = Number(predictAt)
    if (!Number.isFinite(x)) return null
    return fit.predictY(x)
  })()

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Thống kê</h2>
        <p>Nhập dữ liệu vào bảng. Hàng trống tự thêm khi cần.</p>
      </header>

      <div className="chip-row">
        <button
          type="button"
          className={`chip${columns.y ? ' is-active' : ''}`}
          onClick={() => setColumns({ ...columns, y: !columns.y })}
        >
          Cột y (hai biến)
        </button>
        <button
          type="button"
          className={`chip${columns.freq ? ' is-active' : ''}`}
          onClick={() => setColumns({ ...columns, freq: !columns.freq })}
        >
          Cột tần số
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => setRows([{ x: '', y: '', freq: '1' }])}
        >
          Xoá dữ liệu
        </button>
      </div>

      <div className="stat-table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th>#</th>
              <th>x</th>
              {columns.y ? <th>y</th> : null}
              {columns.freq ? <th>Tần số</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                <td>
                  <input
                    value={row.x}
                    inputMode="decimal"
                    aria-label={`x hàng ${index + 1}`}
                    onChange={(event) => update(index, 'x', event.target.value)}
                  />
                </td>
                {columns.y ? (
                  <td>
                    <input
                      value={row.y}
                      inputMode="decimal"
                      aria-label={`y hàng ${index + 1}`}
                      onChange={(event) => update(index, 'y', event.target.value)}
                    />
                  </td>
                ) : null}
                {columns.freq ? (
                  <td>
                    <input
                      value={row.freq}
                      inputMode="numeric"
                      aria-label={`Tần số hàng ${index + 1}`}
                      onChange={(event) => update(index, 'freq', event.target.value)}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-result">
        <h3>Một biến</h3>
        <dl className="stat-list">
          <div><dt>n</dt><dd>{show(stats.n)}</dd></div>
          <div><dt>Σx</dt><dd>{show(stats.sumX)}</dd></div>
          <div><dt>Σx²</dt><dd>{show(stats.sumX2)}</dd></div>
          <div><dt>x̄ (trung bình)</dt><dd>{show(stats.mean)}</dd></div>
          <div><dt>σx (chia cho n)</dt><dd>{show(stats.sigma)}</dd></div>
          <div><dt>sx (chia cho n−1)</dt><dd>{show(stats.s)}</dd></div>
          <div><dt>min</dt><dd>{show(stats.min)}</dd></div>
          <div><dt>Q1</dt><dd>{show(stats.q1)}</dd></div>
          <div><dt>Trung vị</dt><dd>{show(stats.median)}</dd></div>
          <div><dt>Q3</dt><dd>{show(stats.q3)}</dd></div>
          <div><dt>max</dt><dd>{show(stats.max)}</dd></div>
        </dl>
      </div>

      {columns.y ? (
        <div className="panel-result">
          <h3>Hồi quy</h3>
          <div className="chip-row">
            {REGRESSIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip${kind === item.id ? ' is-active' : ''}`}
                onClick={() => setKind(item.id)}
                title={item.formula}
              >
                {item.label}
              </button>
            ))}
          </div>

          {fit ? (
            <>
              <p className="panel-note">{REGRESSIONS.find((item) => item.id === kind)?.formula}</p>
              <dl className="stat-list">
                <div><dt>A</dt><dd>{show(fit.coefficients[0])}</dd></div>
                <div><dt>B</dt><dd>{show(fit.coefficients[1])}</dd></div>
                {fit.coefficients[2] !== undefined ? (
                  <div><dt>C</dt><dd>{show(fit.coefficients[2])}</dd></div>
                ) : null}
                <div><dt>{kind === 'quadratic' ? 'r²' : 'r'}</dt><dd>{show(fit.r)}</dd></div>
              </dl>

              <div className="panel-row">
                <label>
                  Dự đoán ŷ tại x =
                  <input
                    value={predictAt}
                    inputMode="decimal"
                    onChange={(event) => setPredictAt(event.target.value)}
                  />
                </label>
                <output>{prediction === null ? '—' : show(prediction)}</output>
              </div>
            </>
          ) : (
            <p className="panel-note">Cần ít nhất hai điểm dữ liệu hợp lệ.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

