/**
 * EQN mode: polynomials and simultaneous equations.
 *
 * Coefficients are typed as expressions, not just numbers, because on the
 * machine they are too — you can put `√2` or `1÷3` in a coefficient cell and it
 * stays exact all the way to the root.
 */

import { useState } from 'react'

import { formatValue } from '../../engine/format'
import { coefficient, solveCubic, solveQuadratic, solveSimultaneous } from '../../engine/solve'
import { MathError, type Value } from '../../engine/value'
import { useStore } from '../../store'

type Shape = 'poly2' | 'poly3' | 'sim2' | 'sim3' | 'sim4'

const SHAPES: { id: Shape; label: string; hint: string }[] = [
  { id: 'poly2', label: 'ax² + bx + c = 0', hint: 'Phương trình bậc hai' },
  { id: 'poly3', label: 'ax³ + bx² + cx + d = 0', hint: 'Phương trình bậc ba' },
  { id: 'sim2', label: 'Hệ 2 ẩn', hint: 'a₁x + b₁y = c₁' },
  { id: 'sim3', label: 'Hệ 3 ẩn', hint: 'a₁x + b₁y + c₁z = d₁' },
  { id: 'sim4', label: 'Hệ 4 ẩn', hint: 'a₁w + b₁x + c₁y + d₁z = e₁' },
]

function sizeOf(shape: Shape): { rows: number; cols: number; headers: string[] } {
  switch (shape) {
    case 'poly2':
      return { rows: 1, cols: 3, headers: ['a', 'b', 'c'] }
    case 'poly3':
      return { rows: 1, cols: 4, headers: ['a', 'b', 'c', 'd'] }
    case 'sim2':
      return { rows: 2, cols: 3, headers: ['x', 'y', '='] }
    case 'sim3':
      return { rows: 3, cols: 4, headers: ['x', 'y', 'z', '='] }
    case 'sim4':
      return { rows: 4, cols: 5, headers: ['w', 'x', 'y', 'z', '='] }
  }
}

const UNKNOWNS: Record<Shape, string[]> = {
  poly2: ['x₁', 'x₂'],
  poly3: ['x₁', 'x₂', 'x₃'],
  sim2: ['x', 'y'],
  sim3: ['x', 'y', 'z'],
  sim4: ['w', 'x', 'y', 'z'],
}

export function EquationPanel() {
  const context = useStore((state) => state.context)
  const [shape, setShape] = useState<Shape>('poly2')
  const [cells, setCells] = useState<string[]>(() => Array(3).fill(''))
  const [roots, setRoots] = useState<Value[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { rows, cols, headers } = sizeOf(shape)

  function choose(next: Shape) {
    const size = sizeOf(next)
    setShape(next)
    setCells(Array(size.rows * size.cols).fill(''))
    setRoots(null)
    setError(null)
  }

  function solve() {
    try {
      const numbers = cells.map((text) => coefficient(text, context))
      if (shape === 'poly2') setRoots(solveQuadratic(numbers[0], numbers[1], numbers[2]))
      else if (shape === 'poly3') setRoots(solveCubic(numbers[0], numbers[1], numbers[2], numbers[3]))
      else {
        const augmented = []
        for (let row = 0; row < rows; row++) {
          augmented.push(numbers.slice(row * cols, row * cols + cols))
        }
        setRoots(solveSimultaneous(augmented))
      }
      setError(null)
    } catch (problem) {
      setRoots(null)
      setError(problem instanceof MathError ? problem.message : String(problem))
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Giải phương trình</h2>
        <p>Hệ số nhận cả biểu thức: gõ <code>1÷3</code> hoặc <code>√(2)</code> và nghiệm vẫn ở dạng đúng.</p>
      </header>

      <div className="chip-row">
        {SHAPES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip${shape === item.id ? ' is-active' : ''}`}
            onClick={() => choose(item.id)}
            title={item.hint}
          >
            {item.label}
          </button>
        ))}
      </div>

      <table className="coefficient-table">
        <thead>
          <tr>
            {rows > 1 ? <th aria-label="Phương trình" /> : null}
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {rows > 1 ? <th scope="row">({row + 1})</th> : null}
              {Array.from({ length: cols }, (_, col) => {
                const index = row * cols + col
                return (
                  <td key={col}>
                    <input
                      value={cells[index]}
                      placeholder="0"
                      aria-label={`Hệ số ${headers[col]} của phương trình ${row + 1}`}
                      onChange={(event) => {
                        const next = [...cells]
                        next[index] = event.target.value
                        setCells(next)
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="panel-actions">
        <button type="button" className="button is-primary" onClick={solve}>Giải</button>
        <button type="button" className="button" onClick={() => choose(shape)}>Xoá hết</button>
      </div>

      {error ? <p className="panel-error">{error}</p> : null}

      {roots ? (
        <div className="panel-result">
          <h3>Nghiệm</h3>
          <dl className="root-list">
            {roots.map((root, index) => (
              <div key={index}>
                <dt>{UNKNOWNS[shape][index] ?? `x${index + 1}`}</dt>
                <dd>{formatValue(root).forms[0]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  )
}
