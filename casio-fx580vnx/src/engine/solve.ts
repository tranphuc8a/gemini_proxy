/**
 * The EQN mode: polynomials, simultaneous equations, and Solve.
 *
 * Three different jobs the machine puts behind one menu, and they want three
 * different methods:
 *
 *   - a polynomial of degree 2 or 3 has a closed form, and using it means
 *     x² − 2 gives ±√2 rather than ±1.414213562
 *   - simultaneous equations are Gaussian elimination, exact when the
 *     coefficients are
 *   - `Solve(` is anything at all, so it is Newton's method with a bisection
 *     fallback — the same "type a guess and press =" experience as the machine
 *
 * Roots come back as `Value`, so a complex pair from a negative discriminant
 * needs no special case at the call site.
 */

import { evaluate, evaluateNode, type Context } from './evaluate'
import { parse } from './parser'
import {
  MathError,
  type Real,
  type Value,
  add,
  complex,
  div,
  inexact,
  isZero,
  mul,
  neg,
  rational,
  sub,
  toNumber,
  ZERO,
} from './value'

/** An exact √ when the radicand is a perfect square, a decimal otherwise. */
function sqrtReal(value: Real): Real {
  const n = toNumber(value)
  if (n < 0) throw new MathError('Math ERROR: căn số âm')
  if (value.exact) {
    const root = (x: bigint): bigint | null => {
      if (x < 0n) return null
      if (x < 2n) return x
      let lo = 1n
      let hi = x
      while (lo <= hi) {
        const mid = (lo + hi) / 2n
        const square = mid * mid
        if (square === x) return mid
        if (square < x) lo = mid + 1n
        else hi = mid - 1n
      }
      return null
    }
    const num = root(value.num)
    const den = root(value.den)
    if (num !== null && den !== null) return rational(num, den)
  }
  return inexact(Math.sqrt(n))
}

// ------------------------------------------------------------- polynomials

/**
 * Roots of ax² + bx + c.
 *
 * The exact path matters here: with a = 1, b = 0, c = −2 the discriminant is 8,
 * and √8 is irrational, so both roots come back inexact — but with c = −4 they
 * come back as exactly ±2, which is what a student checking their homework
 * needs to see.
 */
export function solveQuadratic(a: Real, b: Real, c: Real): Value[] {
  if (isZero(a)) return solveLinear(b, c)

  const discriminant = sub(mul(b, b), mul(rational(4n), mul(a, c)))
  const twoA = mul(rational(2n), a)

  if (toNumber(discriminant) >= 0) {
    const root = sqrtReal(discriminant)
    return [div(add(neg(b), root), twoA), div(sub(neg(b), root), twoA)]
  }

  const imaginary = div(sqrtReal(neg(discriminant)), twoA)
  const real = div(neg(b), twoA)
  return [complex(real, imaginary), complex(real, neg(imaginary))]
}

export function solveLinear(a: Real, b: Real): Value[] {
  if (isZero(a)) {
    if (isZero(b)) throw new MathError('Vô số nghiệm')
    throw new MathError('Vô nghiệm')
  }
  return [div(neg(b), a)]
}

/**
 * Roots of ax³ + bx² + cx + d.
 *
 * One real root is found numerically, then the cubic is deflated to a quadratic
 * and that is solved exactly. Going after all three at once via Cardano means
 * cube roots of complex numbers for the case where all three roots are *real*,
 * which is both slower and less accurate than this.
 */
export function solveCubic(a: Real, b: Real, c: Real, d: Real): Value[] {
  if (isZero(a)) return solveQuadratic(b, c, d)

  const [an, bn, cn, dn] = [a, b, c, d].map(toNumber)
  const f = (x: number) => ((an * x + bn) * x + cn) * x + dn
  const df = (x: number) => (3 * an * x + 2 * bn) * x + cn

  let x = -bn / (3 * an) // the inflection point: a good start for any cubic
  for (let i = 0; i < 200; i++) {
    const slope = df(x)
    const step = Math.abs(slope) < 1e-14 ? f(x) : f(x) / slope
    const next = x - step
    if (!Number.isFinite(next)) break
    if (Math.abs(next - x) < 1e-15 * Math.max(1, Math.abs(x))) {
      x = next
      break
    }
    x = next
  }

  // A root that is a whole number almost certainly *is* one; snapping keeps the
  // deflated quadratic exact instead of carrying 2.0000000000000004 into it.
  const rounded = Math.round(x)
  const root: Real = Math.abs(f(rounded)) < 1e-9 ? rational(BigInt(rounded)) : inexact(x)

  // Synthetic division by (x − root).
  const b2 = add(mul(a, root), b)
  const c2 = add(mul(b2, root), c)

  return [root, ...solveQuadratic(a, b2, c2)]
}

// -------------------------------------------------------------- simultaneous

/**
 * Solve an n×n system by Gauss–Jordan, exactly where the input is exact.
 *
 * `rows` holds the augmented matrix: n coefficients plus the right-hand side.
 */
export function solveSimultaneous(rows: Real[][]): Real[] {
  const n = rows.length
  const m = rows.map((row) => [...row])
  if (m.some((row) => row.length !== n + 1)) throw new MathError('Dimension ERROR')

  for (let col = 0; col < n; col++) {
    // Partial pivoting: with exact rationals this is about avoiding a zero
    // pivot, not about conditioning, but it costs nothing to pick the largest.
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(toNumber(m[row][col])) > Math.abs(toNumber(m[pivot][col]))) pivot = row
    }
    if (isZero(m[pivot][col])) throw new MathError('Math ERROR: hệ vô nghiệm hoặc vô số nghiệm')
    ;[m[col], m[pivot]] = [m[pivot], m[col]]

    const lead = m[col][col]
    for (let k = col; k <= n; k++) m[col][k] = div(m[col][k], lead)

    for (let row = 0; row < n; row++) {
      if (row === col || isZero(m[row][col])) continue
      const factor = m[row][col]
      for (let k = col; k <= n; k++) m[row][k] = sub(m[row][k], mul(factor, m[col][k]))
    }
  }

  return m.map((row) => row[n])
}

// --------------------------------------------------------------- Solve(

export interface SolveResult {
  root: Real
  /** How far off zero the left-hand side still is — the machine shows this. */
  residual: Real
}

/**
 * Newton's method on `left = right`, falling back to bisection.
 *
 * Newton alone fails on the things people actually type — a flat spot sends it
 * to infinity — so when it leaves the region or stops improving, a bracketing
 * search takes over. Slower, but it answers.
 */
export function solveEquation(
  source: string,
  context: Context,
  variable = 'X',
  guess = 0,
): SolveResult {
  const [leftText, rightText] = splitEquation(source)
  const left = parse(leftText)
  const right = rightText === null ? null : parse(rightText)

  const f = (x: number): number => {
    const saved = context.variables[variable]
    context.variables[variable] = inexact(x)
    try {
      const l = toNumber(asReal(evaluateNode(left, context)))
      const r = right === null ? 0 : toNumber(asReal(evaluateNode(right, context)))
      return l - r
    } finally {
      if (saved === undefined) delete context.variables[variable]
      else context.variables[variable] = saved
    }
  }

  let x = guess
  for (let i = 0; i < 100; i++) {
    const value = f(x)
    if (Math.abs(value) < 1e-12) return finish(x, value)
    // A symmetric difference quotient, scaled to the point, rather than a
    // symbolic derivative: the expression can contain ∫ or Σ.
    const h = Math.max(1e-7, Math.abs(x) * 1e-7)
    const slope = (f(x + h) - f(x - h)) / (2 * h)
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-14) break
    const next = x - value / slope
    if (!Number.isFinite(next)) break
    if (Math.abs(next - x) < 1e-13 * Math.max(1, Math.abs(x))) return finish(next, f(next))
    x = next
  }

  const bracketed = bisect(f, guess)
  if (bracketed === null) throw new MathError("Can't Solve: không tìm được nghiệm")
  return finish(bracketed, f(bracketed))
}

function finish(x: number, residual: number): SolveResult {
  // Snap a root that is a whole number, for the same reason as in the cubic.
  const rounded = Math.round(x)
  const root = Math.abs(x - rounded) < 1e-10 ? rational(BigInt(rounded)) : inexact(x)
  return { root, residual: Math.abs(residual) < 1e-14 ? ZERO : inexact(residual) }
}

/** Widen a window around the guess until the sign flips, then halve it. */
function bisect(f: (x: number) => number, centre: number): number | null {
  let lo = centre
  let hi = centre
  let flo = f(centre)
  if (!Number.isFinite(flo)) return null

  for (let step = 1; step <= 1e6; step *= 2) {
    lo = centre - step
    hi = centre + step
    const a = f(lo)
    const b = f(hi)
    if (Number.isFinite(a) && a * flo <= 0) {
      hi = centre
      flo = a
      break
    }
    if (Number.isFinite(b) && b * flo <= 0) {
      lo = centre
      break
    }
    if (step > 1e6) return null
  }

  if (f(lo) * f(hi) > 0) return null

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const value = f(mid)
    if (value === 0) return mid
    if (f(lo) * value < 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** `2x=6` → `['2x', '6']`; `2x-6` → `['2x-6', null]`. */
export function splitEquation(source: string): [string, string | null] {
  let depth = 0
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === '=' && depth === 0) {
      return [source.slice(0, i), source.slice(i + 1)]
    }
  }
  return [source, null]
}

function asReal(value: Value): Real {
  if (value.kind === 'real') return value
  if (value.kind === 'complex' && isZero(value.im)) return value.re
  throw new MathError('Math ERROR: cần số thực')
}

/** Evaluate a coefficient the user typed into an EQN cell. */
export function coefficient(source: string, context: Context): Real {
  if (!source.trim()) return ZERO
  return asReal(evaluate(source, context))
}
