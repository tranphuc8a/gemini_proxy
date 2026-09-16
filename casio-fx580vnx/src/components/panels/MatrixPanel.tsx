/**
 * MATRIX and VECTOR mode.
 *
 * The real machine walks you through "dimension?" then one cell at a time on a
 * two-line screen, which is the worst part of owning one. A grid of inputs does
 * the same job without the walk, and the calculations are then driven from the
 * ordinary entry line — `det(MatA)`, `MatA×MatB`, `MatA⁻¹`.
 */

import { useState } from 'react'

import { formatValue } from '../../engine/format'
import { MathError, matrix, type Matrix } from '../../engine/value'
import { evaluate } from '../../engine/evaluate'
import { useStore } from '../../store'

const NAMES = ['MatA', 'MatB', 'MatC', 'MatD'] as const

export function MatrixPanel() {
  const context = useStore((state) => state.context)
  const setMatrix = useStore((state) => state.setMatrix)
  const press = useStore((state) => state.press)
  useStore((state) => state.revision) // redraw when the engine writes a matrix

  const [name, setName] = useState<(typeof NAMES)[number]>('MatA')
  const [rows, setRows] = useState(2)
  const [cols, setCols] = useState(2)
  // Cells are held as text so a half-typed "−" or "1/" does not blow up.
  const [cells, setCells] = useState<string[]>(() => Array(4).fill('0'))
  const [error, setError] = useState<string | null>(null)

  function resize(nextRows: number, nextCols: number) {
    const next: string[] = []
    for (let row = 0; row < nextRows; row++) {
      for (let col = 0; col < nextCols; col++) {
        next.push(row < rows && col < cols ? cells[row * cols + col] : '0')
      }
    }
    setRows(nextRows)
    setCols(nextCols)
    setCells(next)
  }

  function save() {
    try {
      const values = cells.map((text) => {
        const value = evaluate(text.trim() || '0', context)
        if (value.kind !== 'real') throw new MathError('Chỉ nhận số thực trong ma trận')
        return value
      })
      setMatrix(name, matrix(rows, cols, values))
      setError(null)
    } catch (problem) {
      setError(problem instanceof MathError ? problem.message : String(problem))
    }
  }

  function load() {
    const stored = context.matrices[name]
    if (!stored) {
      setError(`${name} chưa có giá trị`)
      return
    }
    setRows(stored.rows)
    setCols(stored.cols)
    setCells(stored.cells.map((cell) => formatValue(cell).forms[0]))
    setError(null)
  }

  const stored = context.matrices[name]

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Ma trận</h2>
        <p>Nhập ma trận rồi dùng trên dòng nhập: <code>det(MatA)</code>, <code>MatA×MatB</code>, <code>MatA⁻¹</code>.</p>
      </header>

      <div className="panel-row">
        <label>
          Tên
          <select value={name} onChange={(event) => setName(event.target.value as typeof name)}>
            {NAMES.map((item) => (
              <option key={item} value={item}>
                {item}
                {context.matrices[item] ? ` (${context.matrices[item].rows}×${context.matrices[item].cols})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hàng
          <select value={rows} onChange={(event) => resize(Number(event.target.value), cols)}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Cột
          <select value={cols} onChange={(event) => resize(rows, Number(event.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cells.map((cell, index) => (
          <input
            key={index}
            value={cell}
            inputMode="text"
            aria-label={`Ô hàng ${Math.floor(index / cols) + 1} cột ${(index % cols) + 1}`}
            onChange={(event) => {
              const next = [...cells]
              next[index] = event.target.value
              setCells(next)
            }}
          />
        ))}
      </div>

      <div className="panel-actions">
        <button type="button" className="button is-primary" onClick={save}>Lưu vào {name}</button>
        <button type="button" className="button" onClick={load}>Đọc {name}</button>
        <button type="button" className="button" onClick={() => setCells(cells.map(() => '0'))}>Xoá ô</button>
        <button
          type="button"
          className="button"
          onClick={() => {
            const size = Math.min(rows, cols)
            resize(size, size)
            setCells(
              Array.from({ length: size * size }, (_, index) =>
                Math.floor(index / size) === index % size ? '1' : '0',
              ),
            )
          }}
        >
          Đơn vị
        </button>
      </div>

      {error ? <p className="panel-error">{error}</p> : null}

      {stored ? (
        <div className="panel-result">
          <h3>{name} đang lưu</h3>
          <MatrixView value={stored} />
          <div className="panel-actions">
            {['det(', 'Trn(', ''].map((wrap, index) => (
              <button
                key={index}
                type="button"
                className="button is-quiet"
                onClick={() => press(wrap ? `${wrap}${name})` : `${name}⁻¹`)}
              >
                {wrap ? `${wrap}${name})` : `${name}⁻¹`}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function MatrixView({ value }: { value: Matrix }) {
  return (
    <div className="matrix-view" style={{ gridTemplateColumns: `repeat(${value.cols}, minmax(0, auto))` }}>
      {value.cells.map((cell, index) => (
        <span key={index}>{formatValue(cell).forms[0]}</span>
      ))}
    </div>
  )
}

