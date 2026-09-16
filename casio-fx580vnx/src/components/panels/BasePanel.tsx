/**
 * BASE-N mode.
 *
 * Shows one integer in all four bases at once, which the real machine cannot
 * do — it has one line, so you convert, look, convert back. Seeing them side by
 * side is the whole reason to reach for this mode.
 *
 * Logic operations (and, or, xor, not, neg) work on the 32-bit two's-complement
 * value, as they do on the machine.
 */

import { useState } from 'react'

import { formatInBase, parseInBase } from '../../engine/format'

const BASES: { radix: number; label: string; hint: string }[] = [
  { radix: 16, label: 'HEX', hint: 'Hệ 16' },
  { radix: 10, label: 'DEC', hint: 'Hệ 10' },
  { radix: 8, label: 'OCT', hint: 'Hệ 8' },
  { radix: 2, label: 'BIN', hint: 'Hệ 2' },
]

const OPERATIONS = ['and', 'or', 'xor', 'xnor'] as const
type Operation = (typeof OPERATIONS)[number]

/** 32-bit two's complement, the width the machine works in. */
const MASK = (1n << 32n) - 1n

function wrap(value: bigint): bigint {
  const masked = value & MASK
  return masked >= 1n << 31n ? masked - (1n << 32n) : masked
}

export function BasePanel() {
  const [radix, setRadix] = useState(10)
  const [text, setText] = useState('255')
  const [operand, setOperand] = useState('15')
  const [error, setError] = useState<string | null>(null)

  let value: bigint | null = null
  try {
    value = parseInBase(text, radix)
  } catch {
    value = null
  }

  function apply(operation: Operation | 'not' | 'neg') {
    try {
      const left = parseInBase(text, radix)
      if (operation === 'not') return commit(wrap(~left))
      if (operation === 'neg') return commit(wrap(-left))

      const right = parseInBase(operand, radix)
      const result =
        operation === 'and'
          ? left & right
          : operation === 'or'
            ? left | right
            : operation === 'xor'
              ? left ^ right
              : ~(left ^ right)
      commit(wrap(result))
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem))
    }
  }

  function commit(result: bigint) {
    setText(formatInBase(result, radix).slice(1))
    setError(null)
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Đổi hệ cơ số</h2>
        <p>Số nguyên 32 bit, số âm hiển thị dạng bù hai — giống máy thật.</p>
      </header>

      <div className="chip-row">
        {BASES.map((item) => (
          <button
            key={item.radix}
            type="button"
            className={`chip${radix === item.radix ? ' is-active' : ''}`}
            onClick={() => {
              // Convert what is on screen into the new base rather than
              // reinterpreting the digits, which would change the number.
              try {
                const current = parseInBase(text, radix)
                setText(formatInBase(current, item.radix).slice(1))
                setError(null)
              } catch {
                setText('0')
              }
              setRadix(item.radix)
            }}
            title={item.hint}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="base-input">
        Giá trị ({BASES.find((item) => item.radix === radix)?.label})
        <input
          value={text}
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value.toUpperCase())
            setError(null)
          }}
        />
      </label>

      <div className="panel-result">
        <h3>Tất cả các hệ</h3>
        <dl className="stat-list">
          {BASES.map((item) => (
            <div key={item.radix}>
              <dt>{item.label}</dt>
              <dd className="is-mono">
                {value === null ? '—' : formatInBase(value, item.radix).slice(1)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="panel-row">
        <label>
          Toán hạng thứ hai
          <input
            value={operand}
            spellCheck={false}
            onChange={(event) => setOperand(event.target.value.toUpperCase())}
          />
        </label>
      </div>

      <div className="panel-actions">
        {OPERATIONS.map((operation) => (
          <button key={operation} type="button" className="button" onClick={() => apply(operation)}>
            {operation}
          </button>
        ))}
        <button type="button" className="button" onClick={() => apply('not')}>not</button>
        <button type="button" className="button" onClick={() => apply('neg')}>neg</button>
      </div>

      {error ? <p className="panel-error">{error}</p> : null}
    </section>
  )
}
