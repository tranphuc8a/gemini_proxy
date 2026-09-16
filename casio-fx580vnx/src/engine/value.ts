/**
 * The values this calculator computes with.
 *
 * A real fx-580VN X shows `1/3` as a fraction, `√8` as `2√2`, and only falls
 * back to a decimal when it has to. That behaviour is not cosmetic — it is the
 * difference between a calculator that agrees with a textbook and one that
 * answers 0.333333333. So the number type is a **rational**, not a float, and
 * decimals appear only where an exact answer does not exist (sin, ln, √2 as a
 * lone value).
 *
 * Four value kinds:
 *
 *   `Real`    — an exact rational, or a float when exactness was lost
 *   `Complex` — a pair of reals, for CMPLX mode
 *   `Matrix`  — a rectangular array of reals, for MATRIX mode
 *   `Vector`  — a 2- or 3-element array, for VECTOR mode
 *
 * Rationals use BigInt, so 20!/19! is exactly 20 and not 19.999999999999996.
 * The cost is that every arithmetic step allocates; at the scale of a
 * calculator keypress that is invisible.
 */

// ---------------------------------------------------------------- rationals

/**
 * An exact rational, or an inexact float.
 *
 * `exact` says which. Once a transcendental function is applied the result
 * cannot be represented as a ratio, so `exact` goes false and stays false
 * through the rest of that expression — which is exactly when the real machine
 * stops offering a fraction.
 */
export interface Real {
  kind: 'real'
  /** Numerator, or the float's bits when `exact` is false. */
  num: bigint
  den: bigint
  exact: boolean
  /** Only meaningful when `exact` is false. */
  approx: number
}

export interface Complex {
  kind: 'complex'
  re: Real
  im: Real
}

export interface Matrix {
  kind: 'matrix'
  rows: number
  cols: number
  /** Row-major. */
  cells: Real[]
}

export interface VectorValue {
  kind: 'vector'
  cells: Real[]
}

export type Value = Real | Complex | Matrix | VectorValue

export class MathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MathError'
  }
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** Build an exact rational, normalised so the sign is on the numerator. */
export function rational(num: bigint, den: bigint = 1n): Real {
  if (den === 0n) throw new MathError('Math ERROR: chia cho 0')
  if (den < 0n) {
    num = -num
    den = -den
  }
  const divisor = gcd(num, den) || 1n
  const n = num / divisor
  const d = den / divisor
  return { kind: 'real', num: n, den: d, exact: true, approx: Number(n) / Number(d) }
}

/** An inexact value: something a ratio cannot express. */
export function inexact(value: number): Real {
  if (!Number.isFinite(value)) {
    throw new MathError(Number.isNaN(value) ? 'Math ERROR' : 'Math ERROR: tràn số')
  }
  return { kind: 'real', num: 0n, den: 1n, exact: false, approx: value }
}

export const ZERO = rational(0n)
export const ONE = rational(1n)

/**
 * Turn a JS number into a Real, keeping exactness where it is real.
 *
 * Integers and short decimals entered on the keypad *are* exact — `0.1` typed
 * by a user means one tenth, not the float nearest to it — so they become
 * ratios. A number that arrived from `Math.sin` is not, and stays inexact.
 */
export function fromNumber(value: number, assumeExact = false): Real {
  if (!Number.isFinite(value)) return inexact(value)
  if (!assumeExact) return inexact(value)
  if (Number.isInteger(value)) return rational(BigInt(value))
  return fromDecimalString(String(value))
}

/** `12.34` → 1234/100, exactly. */
export function fromDecimalString(text: string): Real {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.trim())
  if (!match) throw new MathError('Syntax ERROR')
  const [, sign, whole = '', frac = '', exp] = match
  const digits = (whole || '0') + frac
  let num = BigInt(digits || '0')
  let den = 10n ** BigInt(frac.length)
  if (exp) {
    const power = BigInt(Math.abs(Number(exp)))
    if (Number(exp) >= 0) num *= 10n ** power
    else den *= 10n ** power
  }
  return rational(sign === '-' ? -num : num, den)
}

export function toNumber(value: Real): number {
  if (!value.exact) return value.approx
  // Big ratios lose precision through Number(); dividing the BigInts first
  // keeps the magnitude in range.
  const n = Number(value.num)
  const d = Number(value.den)
  if (Number.isFinite(n) && Number.isFinite(d)) return n / d
  return Number(value.num * 10n ** 20n / value.den) / 1e20
}

export function isZero(value: Real): boolean {
  return value.exact ? value.num === 0n : value.approx === 0
}

export function isInteger(value: Real): boolean {
  return value.exact ? value.den === 1n : Number.isInteger(value.approx)
}

/** The integer inside a Real, for the many functions that demand one. */
export function toBigInt(value: Real): bigint {
  if (value.exact && value.den === 1n) return value.num
  const n = toNumber(value)
  if (!Number.isInteger(n)) throw new MathError('Math ERROR: cần số nguyên')
  return BigInt(n)
}

// ------------------------------------------------------------- arithmetic

/** Run the exact path when both sides are exact, else fall back to floats. */
function combine(
  a: Real,
  b: Real,
  exactly: (a: Real, b: Real) => Real,
  approximately: (a: number, b: number) => number,
): Real {
  if (a.exact && b.exact) return exactly(a, b)
  return inexact(approximately(toNumber(a), toNumber(b)))
}

export function add(a: Real, b: Real): Real {
  return combine(a, b, (x, y) => rational(x.num * y.den + y.num * x.den, x.den * y.den), (x, y) => x + y)
}

export function sub(a: Real, b: Real): Real {
  return combine(a, b, (x, y) => rational(x.num * y.den - y.num * x.den, x.den * y.den), (x, y) => x - y)
}

export function mul(a: Real, b: Real): Real {
  return combine(a, b, (x, y) => rational(x.num * y.num, x.den * y.den), (x, y) => x * y)
}

export function div(a: Real, b: Real): Real {
  if (isZero(b)) throw new MathError('Math ERROR: chia cho 0')
  return combine(a, b, (x, y) => rational(x.num * y.den, x.den * y.num), (x, y) => x / y)
}

export function neg(a: Real): Real {
  return a.exact ? rational(-a.num, a.den) : inexact(-a.approx)
}

export function abs(a: Real): Real {
  return a.exact ? rational(a.num < 0n ? -a.num : a.num, a.den) : inexact(Math.abs(a.approx))
}

export function compare(a: Real, b: Real): number {
  if (a.exact && b.exact) {
    const left = a.num * b.den
    const right = b.num * a.den
    return left < right ? -1 : left > right ? 1 : 0
  }
  const x = toNumber(a)
  const y = toNumber(b)
  return x < y ? -1 : x > y ? 1 : 0
}

export function equals(a: Real, b: Real): boolean {
  return compare(a, b) === 0
}

/**
 * Exponentiation, exact where it can be.
 *
 * An integer exponent on an exact base stays exact — `(2/3)^10` is a ratio, and
 * a float would already have drifted. Everything else goes through `Math.pow`.
 */
export function pow(base: Real, exponent: Real): Real {
  if (base.exact && exponent.exact && exponent.den === 1n) {
    const e = exponent.num
    // A huge exponent on an exact base would allocate a number with millions of
    // digits; past this point the float answer is the useful one.
    if (e >= -1024n && e <= 1024n) {
      if (e >= 0n) return rational(base.num ** e, base.den ** e)
      if (isZero(base)) throw new MathError('Math ERROR: chia cho 0')
      const p = -e
      return rational(base.den ** p, base.num ** p)
    }
  }
  const result = Math.pow(toNumber(base), toNumber(exponent))
  if (Number.isNaN(result)) throw new MathError('Math ERROR: luỹ thừa không xác định')
  return inexact(result)
}

/** Integer factorial. The real machine refuses above 69, and so does this. */
export function factorial(value: Real): Real {
  const n = toBigInt(value)
  if (n < 0n) throw new MathError('Math ERROR: giai thừa của số âm')
  if (n > 69n) throw new MathError('Math ERROR: tràn số (n ≤ 69)')
  let result = 1n
  for (let i = 2n; i <= n; i++) result *= i
  return rational(result)
}

// ------------------------------------------------------------- constructors

export function complex(re: Real, im: Real): Complex {
  return { kind: 'complex', re, im }
}

export function matrix(rows: number, cols: number, cells: Real[]): Matrix {
  if (cells.length !== rows * cols) throw new MathError('Dimension ERROR')
  return { kind: 'matrix', rows, cols, cells }
}

export function vector(cells: Real[]): VectorValue {
  return { kind: 'vector', cells }
}

export function isReal(value: Value): value is Real {
  return value.kind === 'real'
}

export function isComplex(value: Value): value is Complex {
  return value.kind === 'complex'
}

/** A Real, or a refusal — most functions are defined on reals only. */
export function expectReal(value: Value, what = 'giá trị'): Real {
  if (value.kind === 'real') return value
  if (value.kind === 'complex' && isZero(value.im)) return value.re
  throw new MathError(`Math ERROR: ${what} phải là số thực`)
}
