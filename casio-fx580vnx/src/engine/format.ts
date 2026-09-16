/**
 * Turning a value into what the screen shows.
 *
 * This is where the fx-580VN X's character comes from. The same result can be
 * written several ways — `1÷3` is `1/3`, `0.3333333333` or `0.333…` — and the
 * machine picks one and lets `S⇔D` cycle the rest. So a formatted result is not
 * a string but a **list of forms**, and the UI shows the first and rotates on
 * demand.
 *
 * Display precision is 10 significant digits, as on the real machine, while the
 * value itself stays exact. Rounding here rather than in the arithmetic is what
 * stops errors accumulating across a chain of operations.
 */

import {
  type Matrix,
  type Real,
  type Value,
  abs,
  compare,
  isZero,
  toNumber,
  ZERO,
} from './value'

/** The real machine shows ten significant digits. */
export const DISPLAY_DIGITS = 10

/** What SETUP's display section asks for. */
export interface FormatOptions {
  notation?: 'norm' | 'fix' | 'sci'
  /** Decimal places for Fix, significant digits for Sci. */
  digits?: number
}

export interface Formatted {
  /** Alternative spellings of the same value, best first. */
  forms: string[]
  /** True when the exact form differs from the decimal, so S⇔D has a job. */
  hasAlternative: boolean
}

// ------------------------------------------------------------------ numbers

/**
 * A decimal with the machine's precision.
 *
 * Switches to scientific notation outside the range the display can hold, the
 * same way the hardware does rather than printing twenty digits.
 */
export function toDecimalString(
  value: number,
  digits = DISPLAY_DIGITS,
  options: FormatOptions = {},
): string {
  if (!Number.isFinite(value)) return 'Math ERROR'

  // Fix and Sci are absolute instructions: they show the requested number of
  // places even when that means `2.000`, which is the point of choosing them.
  if (options.notation === 'fix') return value.toFixed(options.digits ?? 3)
  if (options.notation === 'sci') {
    const [mantissa, exponent] = value.toExponential((options.digits ?? 4) - 1).split('e')
    return `${mantissa}×10^${Number(exponent)}`
  }

  if (value === 0) return '0'

  const magnitude = Math.abs(value)
  if (magnitude >= 1e10 || magnitude < 1e-9) {
    const text = value.toExponential(digits - 1)
    const [mantissa, exponent] = text.split('e')
    return `${trimZeros(mantissa)}×10^${Number(exponent)}`
  }

  // `toPrecision` then trim: fixed decimal places would show 2.5000000000.
  const text = value.toPrecision(digits)
  return trimZeros(text.includes('e') ? Number(text).toString() : text)
}

function trimZeros(text: string): string {
  if (!text.includes('.')) return text
  return text.replace(/\.?0+$/, '')
}

/** `7/3` → `2 1/3`, the mixed form the machine prefers for improper fractions. */
function toMixedFraction(value: Real): string | null {
  if (!value.exact || value.den === 1n) return null
  const negative = value.num < 0n
  const num = negative ? -value.num : value.num
  const whole = num / value.den
  const remainder = num % value.den
  if (whole === 0n) return null
  return `${negative ? '-' : ''}${whole}⌟${remainder}⌟${value.den}`
}

function toFraction(value: Real): string | null {
  if (!value.exact || value.den === 1n) return null
  return `${value.num}⌟${value.den}`
}

/**
 * A surd form for a value that came from a square root.
 *
 * Not derivable from the number alone — 2.828… could be anything — so this is
 * only used where the caller knows a root produced it.
 */
export function simplifySurd(radicand: bigint): { outside: bigint; inside: bigint } {
  let outside = 1n
  let inside = radicand
  for (let factor = 2n; factor * factor <= inside; factor++) {
    const square = factor * factor
    while (inside % square === 0n) {
      inside /= square
      outside *= factor
    }
  }
  return { outside, inside }
}

export function formatReal(value: Real, options: FormatOptions = {}): Formatted {
  const decimal = toDecimalString(toNumber(value), DISPLAY_DIGITS, options)

  if (!value.exact) return { forms: [decimal], hasAlternative: false }
  // Fix and Sci were asked for explicitly, so an exact form would be ignoring
  // the request — show the decimal and nothing else.
  const plain = options.notation === 'fix' || options.notation === 'sci'
  if (plain) return { forms: [decimal], hasAlternative: false }
  if (value.den === 1n) return { forms: [value.num.toString()], hasAlternative: false }

  const fraction = toFraction(value)
  const mixed = toMixedFraction(value)
  // Improper first, mixed second, decimal last — the machine's own order for
  // the a b/c display setting this app defaults to.
  const forms = [fraction, mixed, decimal].filter((form): form is string => Boolean(form))
  return { forms, hasAlternative: forms.length > 1 }
}

// ----------------------------------------------------------------- complex

function formatComplexPart(value: Real, options: FormatOptions): string {
  return formatReal(value, options).forms[0]
}

export function formatComplex(re: Real, im: Real, options: FormatOptions = {}): Formatted {
  if (isZero(im)) return formatReal(re, options)

  const sign = compare(im, ZERO) < 0 ? '−' : '+'
  const magnitude = formatComplexPart(abs(im), options)
  const imaginary = magnitude === '1' ? 'i' : `${magnitude}i`
  const rectangular = isZero(re)
    ? `${compare(im, ZERO) < 0 ? '−' : ''}${imaginary}`
    : `${formatComplexPart(re, options)} ${sign} ${imaginary}`

  // The polar form is what `r∠θ` shows; offered as the alternative.
  const r = Math.hypot(toNumber(re), toNumber(im))
  const theta = (Math.atan2(toNumber(im), toNumber(re)) * 180) / Math.PI
  const polar = `${toDecimalString(r)}∠${toDecimalString(theta)}`

  return { forms: [rectangular, polar], hasAlternative: true }
}

// ----------------------------------------------------------------- matrices

export function formatMatrix(value: Matrix, options: FormatOptions = {}): Formatted {
  const rows: string[] = []
  for (let row = 0; row < value.rows; row++) {
    const cells: string[] = []
    for (let col = 0; col < value.cols; col++) {
      cells.push(formatReal(value.cells[row * value.cols + col], options).forms[0])
    }
    rows.push(`[ ${cells.join('  ')} ]`)
  }
  return { forms: [rows.join('\n')], hasAlternative: false }
}

// -------------------------------------------------------------------- entry

export function formatValue(value: Value, options: FormatOptions = {}): Formatted {
  switch (value.kind) {
    case 'real':
      return formatReal(value, options)
    case 'complex':
      return formatComplex(value.re, value.im, options)
    case 'matrix':
      return formatMatrix(value, options)
    case 'vector':
      return {
        forms: [
          `( ${value.cells.map((cell) => formatReal(cell, options).forms[0]).join(' , ')} )`,
        ],
        hasAlternative: false,
      }
  }
}

// --------------------------------------------------------------- base-N

const BASE_PREFIX: Record<number, string> = { 2: 'b', 8: 'o', 10: 'd', 16: 'h' }

/**
 * Base-N display.
 *
 * Negative values are shown in two's complement over 32 bits, which is what the
 * machine does — `-1` in binary is thirty-two 1s, not `-1`.
 */
export function formatInBase(value: bigint, base: number): string {
  const width = 32n
  const wrapped = value < 0n ? (1n << width) + value : value
  return BASE_PREFIX[base] + wrapped.toString(base).toUpperCase()
}

export function parseInBase(text: string, base: number): bigint {
  const cleaned = text.replace(/^[bodh]/i, '').trim()
  if (!cleaned) return 0n
  const digits = '0123456789ABCDEF'.slice(0, base)
  let result = 0n
  for (const char of cleaned.toUpperCase()) {
    const at = digits.indexOf(char)
    if (at === -1) throw new Error(`Syntax ERROR: chữ số “${char}” không hợp lệ ở hệ ${base}`)
    result = result * BigInt(base) + BigInt(at)
  }
  // Values above half the range are negative in two's complement.
  const limit = 1n << 32n
  return result >= limit / 2n ? result - limit : result
}
