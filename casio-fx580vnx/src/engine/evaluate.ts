/**
 * Walking the syntax tree and producing a value.
 *
 * Two things shape this file.
 *
 * **Exactness is preserved as far as it can be.** `1÷3` stays a ratio, `√8`
 * becomes `2√2` only at display time, and a decimal appears when a function
 * genuinely has no exact answer. That is what lets the result panel offer
 * `S⇔D` — there is nothing to switch to if everything was a float from the
 * start.
 *
 * **Angle mode is a property of the machine, not of the expression.** `sin 30`
 * is ½ in degrees and −0.988 in radians, and the same string must give both
 * depending on a setting. So every trigonometric call converts through the
 * context rather than assuming radians.
 */

import { type Node, parse } from './parser'
import {
  type Complex,
  type Matrix,
  type Real,
  type Value,
  MathError,
  ZERO,
  abs,
  add,
  compare,
  complex,
  div,
  equals,
  expectReal,
  factorial,
  fromDecimalString,
  inexact,
  isZero,
  matrix,
  mul,
  neg,
  pow,
  rational,
  sub,
  toBigInt,
  toNumber,
} from './value'

export type AngleMode = 'deg' | 'rad' | 'gra'

export interface Context {
  angle: AngleMode
  /** A–F, M, x, y, z — the machine's memories. */
  variables: Record<string, Value>
  /** Named matrices MatA…MatD. */
  matrices: Record<string, Matrix>
  /** Statistics data, for the functions that read it. */
  stats: { x: number[]; y: number[]; freq: number[] }
}

export function emptyContext(): Context {
  return {
    angle: 'deg',
    variables: {},
    matrices: {},
    stats: { x: [], y: [], freq: [] },
  }
}

// ----------------------------------------------------------------- angles

/** Whatever the user typed, in radians. */
function toRadians(value: Real, mode: AngleMode): number {
  const n = toNumber(value)
  if (mode === 'rad') return n
  if (mode === 'deg') return (n * Math.PI) / 180
  return (n * Math.PI) / 200 // gradians: 400 to a full turn
}

/** A radian result, back in whatever the user is working in. */
function fromRadians(radians: number, mode: AngleMode): Real {
  if (mode === 'rad') return inexact(radians)
  if (mode === 'deg') return inexact((radians * 180) / Math.PI)
  return inexact((radians * 200) / Math.PI)
}

/**
 * An angle given in `unit`, re-expressed in `mode`.
 *
 * Returned unchanged when the two agree, which keeps `sin(30°)` exact in DEG
 * rather than routing a whole number through two floating-point divisions.
 */
function inUnit(value: Real, unit: AngleMode, mode: AngleMode): Real {
  if (unit === mode) return value
  return fromRadians(toRadians(value, unit), mode)
}

/**
 * Exact trigonometric values, so `sin 30` is ½ and not 0.49999999999999994.
 *
 * Only in degrees, and only for the multiples of 15° and 30° a student meets.
 * Everything else falls through to `Math.sin`, which is what the real machine
 * effectively does too — it just rounds the display.
 */
const EXACT_SIN: Record<number, Real | undefined> = {
  0: rational(0n),
  30: rational(1n, 2n),
  90: rational(1n),
  150: rational(1n, 2n),
  180: rational(0n),
  210: rational(-1n, 2n),
  270: rational(-1n),
  330: rational(-1n, 2n),
  360: rational(0n),
}

const EXACT_TAN_UNDEFINED = new Set([90, 270, -90, -270])

// -------------------------------------------------------------- evaluation

export function evaluate(source: string, context: Context): Value {
  return evaluateNode(parse(source), context)
}

export function evaluateNode(node: Node, context: Context): Value {
  switch (node.type) {
    case 'number':
      // A typed decimal is exact: `0.1` means one tenth, not the nearest float.
      return fromDecimalString(node.value)

    case 'variable': {
      // MatA…MatD live in their own namespace, so a matrix and a scalar can
      // share a letter the way they do on the machine.
      const stored = context.matrices[node.name]
      if (stored) return stored
      // An unset memory reads as zero rather than erroring — same as the real
      // calculator, where every variable starts at 0.
      return context.variables[node.name] ?? ZERO
    }

    case 'constant':
      return evaluateConstant(node.name)

    case 'unary':
      return applyUnary(node.op, evaluateNode(node.operand, context))

    case 'postfix':
      return applyPostfix(node.op, evaluateNode(node.operand, context), context)

    case 'binary':
      return applyBinary(node.op, node, context)

    case 'call':
      return applyCall(node.name, node.args, context)
  }
}

function evaluateConstant(name: string): Value {
  switch (name) {
    case 'π':
      return inexact(Math.PI)
    case 'e':
      return inexact(Math.E)
    case 'i':
      return complex(ZERO, rational(1n))
    case 'Ran#':
      return inexact(Math.random())
    default:
      throw new MathError(`Syntax ERROR: hằng số lạ “${name}”`)
  }
}

function applyUnary(op: string, value: Value): Value {
  if (op !== '-') throw new MathError(`Syntax ERROR: toán tử “${op}”`)
  if (value.kind === 'real') return neg(value)
  if (value.kind === 'complex') return complex(neg(value.re), neg(value.im))
  if (value.kind === 'matrix') {
    return matrix(value.rows, value.cols, value.cells.map(neg))
  }
  return { kind: 'vector', cells: value.cells.map(neg) }
}

function applyPostfix(op: string, value: Value, context: Context): Value {
  switch (op) {
    case '!':
      return factorial(expectReal(value, 'giai thừa'))
    case '⁻¹':
      return reciprocal(value)
    case '%':
      // The machine's `%` is "divide by 100" in isolation; the percentage-of
      // behaviour lives in how it combines, which `applyBinary` handles.
      return div(expectReal(value), rational(100n))
    // A unit mark says what the number *is*, whatever the current mode is:
    // `sin(30°)` is a half even in RAD. Converting into the working unit here
    // means `sin` downstream needs to know nothing about it.
    case '°':
      return inUnit(expectReal(value), 'deg', context.angle)
    case 'ʳ':
      return inUnit(expectReal(value), 'rad', context.angle)
    case 'ᵍ':
      return inUnit(expectReal(value), 'gra', context.angle)
    default:
      throw new MathError(`Syntax ERROR: toán tử “${op}”`)
  }
}

function reciprocal(value: Value): Value {
  if (value.kind === 'real') return div(rational(1n), value)
  if (value.kind === 'complex') {
    const denominator = add(mul(value.re, value.re), mul(value.im, value.im))
    if (isZero(denominator)) throw new MathError('Math ERROR: chia cho 0')
    return complex(div(value.re, denominator), neg(div(value.im, denominator)))
  }
  if (value.kind === 'matrix') return invertMatrix(value)
  throw new MathError('Math ERROR: không nghịch đảo được')
}

function applyBinary(op: string, node: Extract<Node, { type: 'binary' }>, context: Context): Value {
  const left = evaluateNode(node.left, context)
  const right = evaluateNode(node.right, context)

  switch (op) {
    case '+':
      return addValues(left, right)
    case '-':
    case '−':
      return addValues(left, applyUnary('-', right))
    case '×':
    case '*':
    case '·':
      return mulValues(left, right)
    case '÷':
    case '/':
      return divValues(left, right)
    case '^':
      return powValues(left, right)
    case 'Mod':
    case 'MOD': {
      const a = toBigInt(expectReal(left))
      const b = toBigInt(expectReal(right))
      if (b === 0n) throw new MathError('Math ERROR: chia cho 0')
      // The sign follows the *dividend*, which is what the machine's ÷R key
      // does: −7 ÷R 3 is −2 remainder −1, not −3 remainder 2. Mathematicians
      // usually want the other convention; the calculator is being simulated,
      // so it wins.
      return rational(a % b)
    }
    case 'nPr':
      return permutations(expectReal(left), expectReal(right))
    case 'nCr':
      return combinations(expectReal(left), expectReal(right))
    case '∠': {
      // Polar entry: r∠θ is a complex number.
      const r = expectReal(left)
      const theta = toRadians(expectReal(right), context.angle)
      return complex(inexact(toNumber(r) * Math.cos(theta)), inexact(toNumber(r) * Math.sin(theta)))
    }
    case '=':
      return equals(expectReal(left), expectReal(right)) ? rational(1n) : ZERO
    case '<':
      return compare(expectReal(left), expectReal(right)) < 0 ? rational(1n) : ZERO
    case '>':
      return compare(expectReal(left), expectReal(right)) > 0 ? rational(1n) : ZERO
    case '≤':
      return compare(expectReal(left), expectReal(right)) <= 0 ? rational(1n) : ZERO
    case '≥':
      return compare(expectReal(left), expectReal(right)) >= 0 ? rational(1n) : ZERO
    case '≠':
      return equals(expectReal(left), expectReal(right)) ? ZERO : rational(1n)
    default:
      throw new MathError(`Syntax ERROR: toán tử “${op}”`)
  }
}

// ------------------------------------------------------- value arithmetic

function asComplex(value: Value): Complex {
  if (value.kind === 'complex') return value
  if (value.kind === 'real') return complex(value, ZERO)
  throw new MathError('Math ERROR: cần số')
}

export function addValues(a: Value, b: Value): Value {
  if (a.kind === 'real' && b.kind === 'real') return add(a, b)

  if (a.kind === 'matrix' || b.kind === 'matrix') {
    if (a.kind !== 'matrix' || b.kind !== 'matrix') throw new MathError('Dimension ERROR')
    if (a.rows !== b.rows || a.cols !== b.cols) throw new MathError('Dimension ERROR')
    return matrix(a.rows, a.cols, a.cells.map((cell, at) => add(cell, b.cells[at])))
  }

  if (a.kind === 'vector' || b.kind === 'vector') {
    if (a.kind !== 'vector' || b.kind !== 'vector' || a.cells.length !== b.cells.length) {
      throw new MathError('Dimension ERROR')
    }
    return { kind: 'vector', cells: a.cells.map((cell, at) => add(cell, b.cells[at])) }
  }

  const x = asComplex(a)
  const y = asComplex(b)
  return normaliseComplex(complex(add(x.re, y.re), add(x.im, y.im)))
}

export function mulValues(a: Value, b: Value): Value {
  if (a.kind === 'real' && b.kind === 'real') return mul(a, b)

  if (a.kind === 'matrix' && b.kind === 'matrix') return multiplyMatrices(a, b)
  if (a.kind === 'matrix' && b.kind === 'real') {
    return matrix(a.rows, a.cols, a.cells.map((cell) => mul(cell, b)))
  }
  if (a.kind === 'real' && b.kind === 'matrix') {
    return matrix(b.rows, b.cols, b.cells.map((cell) => mul(cell, a)))
  }

  if (a.kind === 'vector' && b.kind === 'vector') {
    // The dot product; the cross product is a named function.
    if (a.cells.length !== b.cells.length) throw new MathError('Dimension ERROR')
    return a.cells.reduce((total, cell, at) => add(total, mul(cell, b.cells[at])), ZERO)
  }
  if (a.kind === 'vector' && b.kind === 'real') {
    return { kind: 'vector', cells: a.cells.map((cell) => mul(cell, b)) }
  }
  if (a.kind === 'real' && b.kind === 'vector') {
    return { kind: 'vector', cells: b.cells.map((cell) => mul(cell, a)) }
  }

  const x = asComplex(a)
  const y = asComplex(b)
  return normaliseComplex(
    complex(sub(mul(x.re, y.re), mul(x.im, y.im)), add(mul(x.re, y.im), mul(x.im, y.re))),
  )
}

export function divValues(a: Value, b: Value): Value {
  if (a.kind === 'real' && b.kind === 'real') return div(a, b)
  if (a.kind === 'matrix' && b.kind === 'real') {
    return matrix(a.rows, a.cols, a.cells.map((cell) => div(cell, b)))
  }
  if (a.kind === 'vector' && b.kind === 'real') {
    return { kind: 'vector', cells: a.cells.map((cell) => div(cell, b)) }
  }
  const inverse = reciprocal(b)
  return mulValues(a, inverse)
}

function powValues(base: Value, exponent: Value): Value {
  if (base.kind === 'real' && exponent.kind === 'real') {
    // A negative base with a fractional exponent has no real answer; the
    // machine reports an error rather than NaN.
    if (compare(base, ZERO) < 0 && !Number.isInteger(toNumber(exponent))) {
      throw new MathError('Math ERROR: luỹ thừa số âm')
    }
    return pow(base, exponent)
  }

  if (base.kind === 'matrix' && exponent.kind === 'real') {
    const times = Number(toBigInt(exponent))
    if (times < 0) return powValues(invertMatrix(base), inexact(-times))
    if (base.rows !== base.cols) throw new MathError('Dimension ERROR')
    let result: Value = identityMatrix(base.rows)
    for (let i = 0; i < times; i++) result = mulValues(result, base)
    return result
  }

  const z = asComplex(base)
  const w = asComplex(exponent)

  // A whole-number power is repeated multiplication, and doing it that way
  // keeps it exact: through the polar route below, `i²` comes back as
  // −1 + 1.2×10⁻¹⁶i, because atan2 and cos disagree about π/2 in the last bit.
  if (isZero(w.im) && w.re.exact && w.re.den === 1n && w.re.num >= -64n && w.re.num <= 64n) {
    const negative = w.re.num < 0n
    const times = negative ? -w.re.num : w.re.num
    let result: Value = rational(1n)
    for (let i = 0n; i < times; i++) result = mulValues(result, z)
    return negative ? divValues(rational(1n), result) : result
  }

  // Everything else goes through e^(ln z · w).
  const modulus = Math.hypot(toNumber(z.re), toNumber(z.im))
  if (modulus === 0) return ZERO
  const argument = Math.atan2(toNumber(z.im), toNumber(z.re))
  const lnRe = Math.log(modulus)
  const re = toNumber(w.re) * lnRe - toNumber(w.im) * argument
  const im = toNumber(w.im) * lnRe + toNumber(w.re) * argument
  const magnitude = Math.exp(re)
  return normaliseComplex(
    complex(inexact(magnitude * Math.cos(im)), inexact(magnitude * Math.sin(im))),
  )
}

/** A complex number with no imaginary part is a real one. */
function normaliseComplex(value: Complex): Value {
  return isZero(value.im) ? value.re : value
}

// ----------------------------------------------------------- combinatorics

function permutations(n: Real, r: Real): Real {
  const nn = toBigInt(n)
  const rr = toBigInt(r)
  if (nn < 0n || rr < 0n || rr > nn) throw new MathError('Math ERROR: nPr không hợp lệ')
  let result = 1n
  for (let i = 0n; i < rr; i++) result *= nn - i
  return rational(result)
}

function combinations(n: Real, r: Real): Real {
  const nn = toBigInt(n)
  const rr = toBigInt(r)
  if (nn < 0n || rr < 0n || rr > nn) throw new MathError('Math ERROR: nCr không hợp lệ')
  // Multiply and divide as we go, so the intermediate never exceeds the answer
  // by more than one factor — C(69,34) is fine, 69! alone would not be.
  let result = 1n
  const k = rr > nn - rr ? nn - rr : rr
  for (let i = 1n; i <= k; i++) {
    result = (result * (nn - k + i)) / i
  }
  return rational(result)
}

// ---------------------------------------------------------------- matrices

export function identityMatrix(size: number): Matrix {
  const cells: Real[] = []
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) cells.push(row === col ? rational(1n) : ZERO)
  }
  return matrix(size, size, cells)
}

function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.rows) throw new MathError('Dimension ERROR')
  const cells: Real[] = []
  for (let row = 0; row < a.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      let total: Real = ZERO
      for (let k = 0; k < a.cols; k++) {
        total = add(total, mul(a.cells[row * a.cols + k], b.cells[k * b.cols + col]))
      }
      cells.push(total)
    }
  }
  return matrix(a.rows, b.cols, cells)
}

export function transpose(value: Matrix): Matrix {
  const cells: Real[] = []
  for (let col = 0; col < value.cols; col++) {
    for (let row = 0; row < value.rows; row++) cells.push(value.cells[row * value.cols + col])
  }
  return matrix(value.cols, value.rows, cells)
}

/**
 * Determinant by exact Gaussian elimination.
 *
 * Exact, not floating point: the determinant of an integer matrix is an
 * integer, and a float answer of 6.000000000000001 for a 3×3 of small integers
 * is the kind of thing this calculator exists to avoid.
 */
export function determinant(value: Matrix): Real {
  if (value.rows !== value.cols) throw new MathError('Dimension ERROR')
  const size = value.rows
  const grid = value.cells.map((cell) => cell)
  let result: Real = rational(1n)

  for (let col = 0; col < size; col++) {
    let pivot = -1
    for (let row = col; row < size; row++) {
      if (!isZero(grid[row * size + col])) {
        pivot = row
        break
      }
    }
    if (pivot === -1) return ZERO

    if (pivot !== col) {
      for (let k = 0; k < size; k++) {
        const swap = grid[pivot * size + k]
        grid[pivot * size + k] = grid[col * size + k]
        grid[col * size + k] = swap
      }
      // A row swap flips the sign of the determinant.
      result = neg(result)
    }

    const head = grid[col * size + col]
    result = mul(result, head)

    for (let row = col + 1; row < size; row++) {
      const factor = div(grid[row * size + col], head)
      if (isZero(factor)) continue
      for (let k = col; k < size; k++) {
        grid[row * size + k] = sub(grid[row * size + k], mul(factor, grid[col * size + k]))
      }
    }
  }
  return result
}

export function invertMatrix(value: Matrix): Matrix {
  if (value.rows !== value.cols) throw new MathError('Dimension ERROR')
  const size = value.rows
  if (isZero(determinant(value))) throw new MathError('Math ERROR: ma trận suy biến')

  // Gauss–Jordan on [A | I], exactly.
  const left = value.cells.map((cell) => cell)
  const right = identityMatrix(size).cells.slice()

  for (let col = 0; col < size; col++) {
    let pivot = col
    while (pivot < size && isZero(left[pivot * size + col])) pivot++
    if (pivot === size) throw new MathError('Math ERROR: ma trận suy biến')

    if (pivot !== col) {
      for (let k = 0; k < size; k++) {
        ;[left[pivot * size + k], left[col * size + k]] = [left[col * size + k], left[pivot * size + k]]
        ;[right[pivot * size + k], right[col * size + k]] = [right[col * size + k], right[pivot * size + k]]
      }
    }

    const head = left[col * size + col]
    for (let k = 0; k < size; k++) {
      left[col * size + k] = div(left[col * size + k], head)
      right[col * size + k] = div(right[col * size + k], head)
    }

    for (let row = 0; row < size; row++) {
      if (row === col) continue
      const factor = left[row * size + col]
      if (isZero(factor)) continue
      for (let k = 0; k < size; k++) {
        left[row * size + k] = sub(left[row * size + k], mul(factor, left[col * size + k]))
        right[row * size + k] = sub(right[row * size + k], mul(factor, right[col * size + k]))
      }
    }
  }
  return matrix(size, size, right)
}

// --------------------------------------------------------------- functions

function applyCall(name: string, args: Node[], context: Context): Value {
  // Calculus and iteration bind their own variable, so their arguments are
  // *not* evaluated here — the body is re-evaluated per step instead.
  if (name === 'Σ' || name === '∏') return iterate(name, args, context)
  if (name === '∫') return integrate(args, context)
  if (name === 'd/dx') return differentiate(args, context)

  const values = args.map((arg) => evaluateNode(arg, context))
  const first = values[0]

  switch (name) {
    // --- trigonometry ----------------------------------------------------
    case 'sin':
    case 'cos':
    case 'tan':
      return trigonometry(name, expectReal(first), context)

    case 'sin⁻¹':
    case 'cos⁻¹':
    case 'tan⁻¹':
      return inverseTrigonometry(name, expectReal(first), context)

    case 'sinh':
      return inexact(Math.sinh(toNumber(expectReal(first))))
    case 'cosh':
      return inexact(Math.cosh(toNumber(expectReal(first))))
    case 'tanh':
      return inexact(Math.tanh(toNumber(expectReal(first))))
    case 'sinh⁻¹':
      return inexact(Math.asinh(toNumber(expectReal(first))))
    case 'cosh⁻¹': {
      const x = toNumber(expectReal(first))
      if (x < 1) throw new MathError('Math ERROR: cosh⁻¹ cần x ≥ 1')
      return inexact(Math.acosh(x))
    }
    case 'tanh⁻¹': {
      const x = toNumber(expectReal(first))
      if (x <= -1 || x >= 1) throw new MathError('Math ERROR: tanh⁻¹ cần |x| < 1')
      return inexact(Math.atanh(x))
    }

    // --- roots, logs, exponentials ---------------------------------------
    case '√':
      return squareRoot(first)
    case '∛': {
      const x = toNumber(expectReal(first))
      return inexact(Math.cbrt(x))
    }
    case 'log': {
      // Two arguments is log base b; one is base 10, as the machine does.
      if (values.length === 2) {
        return inexact(Math.log(toNumber(expectReal(values[1]))) / Math.log(toNumber(expectReal(first))))
      }
      const x = toNumber(expectReal(first))
      if (x <= 0) throw new MathError('Math ERROR: log của số không dương')
      return exactLog10(x) ?? inexact(Math.log10(x))
    }
    case 'ln': {
      const x = toNumber(expectReal(first))
      if (x <= 0) throw new MathError('Math ERROR: ln của số không dương')
      return inexact(Math.log(x))
    }
    case 'exp':
      return inexact(Math.exp(toNumber(expectReal(first))))

    // --- rounding and parts ----------------------------------------------
    case 'Abs':
    case 'abs':
      return absoluteValue(first)
    case 'Int':
      // Truncates toward zero, which is what the machine's Int does.
      return rational(BigInt(Math.trunc(toNumber(expectReal(first)))))
    case 'Intg':
      return rational(BigInt(Math.floor(toNumber(expectReal(first)))))
    case 'Frac': {
      const value = expectReal(first)
      return sub(value, rational(BigInt(Math.trunc(toNumber(value)))))
    }
    case 'Rnd':
    case 'Round': {
      const digits = values.length > 1 ? Number(toBigInt(expectReal(values[1]))) : 0
      const factor = 10 ** digits
      return inexact(Math.round(toNumber(expectReal(first)) * factor) / factor)
    }

    // --- number theory ---------------------------------------------------
    case 'GCD': {
      let result = bigAbs(toBigInt(expectReal(first)))
      for (const value of values.slice(1)) result = bigGcd(result, bigAbs(toBigInt(expectReal(value))))
      return rational(result)
    }
    case 'LCM': {
      let result = bigAbs(toBigInt(expectReal(first)))
      for (const value of values.slice(1)) {
        const other = bigAbs(toBigInt(expectReal(value)))
        if (result === 0n || other === 0n) return ZERO
        result = (result / bigGcd(result, other)) * other
      }
      return rational(result)
    }

    // --- complex ----------------------------------------------------------
    case 'Arg': {
      const z = asComplex(first)
      return fromRadians(Math.atan2(toNumber(z.im), toNumber(z.re)), context.angle)
    }
    case 'Conjg': {
      const z = asComplex(first)
      return complex(z.re, neg(z.im))
    }
    case 'Real':
      return asComplex(first).re
    case 'Imag':
      return asComplex(first).im

    // --- coordinates -------------------------------------------------------
    case 'Pol': {
      const x = toNumber(expectReal(first))
      const y = toNumber(expectReal(values[1]))
      const r = Math.hypot(x, y)
      const theta = fromRadians(Math.atan2(y, x), context.angle)
      context.variables.x = inexact(r)
      context.variables.y = theta
      return { kind: 'vector', cells: [inexact(r), theta] }
    }
    case 'Rec': {
      const r = toNumber(expectReal(first))
      const theta = toRadians(expectReal(values[1]), context.angle)
      const x = inexact(r * Math.cos(theta))
      const y = inexact(r * Math.sin(theta))
      context.variables.x = x
      context.variables.y = y
      return { kind: 'vector', cells: [x, y] }
    }

    // --- matrices ----------------------------------------------------------
    case 'det':
      return determinant(expectMatrix(first))
    case 'Trn':
      return transpose(expectMatrix(first))
    case 'Identity':
      return identityMatrix(Number(toBigInt(expectReal(first))))

    // --- random -------------------------------------------------------------
    case 'Ran#':
    case 'Rand':
      return inexact(Math.random())
    case 'RanInt': {
      const low = Number(toBigInt(expectReal(first)))
      const high = Number(toBigInt(expectReal(values[1])))
      if (high < low) throw new MathError('Math ERROR: RanInt cần a ≤ b')
      return rational(BigInt(low + Math.floor(Math.random() * (high - low + 1))))
    }

    // --- lists --------------------------------------------------------------
    case 'max':
      return values.map((v) => expectReal(v)).reduce((best, v) => (compare(v, best) > 0 ? v : best))
    case 'min':
      return values.map((v) => expectReal(v)).reduce((best, v) => (compare(v, best) < 0 ? v : best))
    case 'sum':
      return values.map((v) => expectReal(v)).reduce((total, v) => add(total, v), ZERO)
    case 'mean': {
      const reals = values.map((v) => expectReal(v))
      return div(reals.reduce((total, v) => add(total, v), ZERO), rational(BigInt(reals.length)))
    }

    case 'nPr':
      return permutations(expectReal(first), expectReal(values[1]))
    case 'nCr':
      return combinations(expectReal(first), expectReal(values[1]))

    default:
      throw new MathError(`Syntax ERROR: hàm lạ “${name}”`)
  }
}

function expectMatrix(value: Value): Matrix {
  if (value.kind !== 'matrix') throw new MathError('Math ERROR: cần một ma trận')
  return value
}

function bigAbs(value: bigint): bigint {
  return value < 0n ? -value : value
}

function bigGcd(a: bigint, b: bigint): bigint {
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

function absoluteValue(value: Value): Value {
  if (value.kind === 'real') return abs(value)
  if (value.kind === 'complex') return inexact(Math.hypot(toNumber(value.re), toNumber(value.im)))
  if (value.kind === 'vector') {
    return inexact(Math.hypot(...value.cells.map(toNumber)))
  }
  throw new MathError('Math ERROR: |x| không xác định')
}

/**
 * Square root, kept exact for perfect squares.
 *
 * `√16` is 4, not 4.0000000001, and `√(9/4)` is 3/2. Anything else becomes a
 * float here; the *display* layer is what turns `√8` into `2√2`.
 */
function squareRoot(value: Value): Value {
  if (value.kind === 'complex') {
    const modulus = Math.hypot(toNumber(value.re), toNumber(value.im))
    const argument = Math.atan2(toNumber(value.im), toNumber(value.re))
    const r = Math.sqrt(modulus)
    return normaliseComplex(
      complex(inexact(r * Math.cos(argument / 2)), inexact(r * Math.sin(argument / 2))),
    )
  }

  const real = expectReal(value)
  if (compare(real, ZERO) < 0) {
    // In COMP mode this is an error; CMPLX mode is handled by the caller
    // passing a complex value.
    throw new MathError('Math ERROR: căn của số âm')
  }
  if (real.exact) {
    const num = bigSqrt(real.num)
    const den = bigSqrt(real.den)
    if (num !== null && den !== null) return rational(num, den)
  }
  return inexact(Math.sqrt(toNumber(real)))
}

/** The exact integer square root, or null when there is not one. */
function bigSqrt(value: bigint): bigint | null {
  if (value < 0n) return null
  if (value < 2n) return value
  let low = 1n
  let high = value
  while (low <= high) {
    const middle = (low + high) / 2n
    const square = middle * middle
    if (square === value) return middle
    if (square < value) low = middle + 1n
    else high = middle - 1n
  }
  return null
}

/** `log 1000` is exactly 3; the float version is 2.9999999999999996. */
function exactLog10(x: number): Real | null {
  if (!Number.isInteger(x) || x <= 0) return null
  let value = BigInt(x)
  let power = 0n
  while (value % 10n === 0n) {
    value /= 10n
    power++
  }
  return value === 1n ? rational(power) : null
}

function trigonometry(name: string, value: Real, context: Context): Real {
  if (context.angle === 'deg' && value.exact && value.den === 1n) {
    const degrees = Number(value.num)
    const wrapped = ((degrees % 360) + 360) % 360
    if (name === 'sin') {
      const exact = EXACT_SIN[wrapped]
      if (exact) return exact
    }
    if (name === 'cos') {
      const exact = EXACT_SIN[(wrapped + 90) % 360]
      if (exact) return exact
    }
    if (name === 'tan' && EXACT_TAN_UNDEFINED.has(wrapped)) {
      throw new MathError('Math ERROR: tan không xác định')
    }
  }

  const radians = toRadians(value, context.angle)
  const result = name === 'sin' ? Math.sin(radians) : name === 'cos' ? Math.cos(radians) : Math.tan(radians)
  // `Math.tan(π/2)` is a huge finite number rather than infinity; the machine
  // calls that an error, and so does this.
  if (name === 'tan' && Math.abs(result) > 1e15) throw new MathError('Math ERROR: tan không xác định')
  return inexact(result)
}

function inverseTrigonometry(name: string, value: Real, context: Context): Real {
  const x = toNumber(value)
  if ((name === 'sin⁻¹' || name === 'cos⁻¹') && (x < -1 || x > 1)) {
    throw new MathError('Math ERROR: cần −1 ≤ x ≤ 1')
  }
  const radians = name === 'sin⁻¹' ? Math.asin(x) : name === 'cos⁻¹' ? Math.acos(x) : Math.atan(x)
  return fromRadians(radians, context.angle)
}

// ------------------------------------------------------ calculus and series

/** The variable Σ, ∏, ∫ and d/dx bind. */
const ITERATION_VARIABLE = 'x'

function withVariable<T>(context: Context, name: string, value: Value, body: () => T): T {
  const previous = context.variables[name]
  context.variables[name] = value
  try {
    return body()
  } finally {
    // Restored even on error: leaving `x` set would silently change the next
    // expression the user types.
    if (previous === undefined) delete context.variables[name]
    else context.variables[name] = previous
  }
}

function iterate(name: string, args: Node[], context: Context): Value {
  if (args.length < 3) throw new MathError(`Syntax ERROR: ${name} cần (biểu thức, đầu, cuối)`)
  const from = Number(toBigInt(expectReal(evaluateNode(args[1], context))))
  const to = Number(toBigInt(expectReal(evaluateNode(args[2], context))))
  if (to < from) throw new MathError('Math ERROR: cận trên nhỏ hơn cận dưới')
  if (to - from > 10000) throw new MathError('Math ERROR: quá nhiều số hạng (≤ 10000)')

  let total: Value = name === 'Σ' ? ZERO : rational(1n)
  for (let i = from; i <= to; i++) {
    const term = withVariable(context, ITERATION_VARIABLE, rational(BigInt(i)), () =>
      evaluateNode(args[0], context),
    )
    total = name === 'Σ' ? addValues(total, term) : mulValues(total, term)
  }
  return total
}

/**
 * Definite integral by adaptive Simpson's rule.
 *
 * Simpson rather than the trapezoid rule because it is exact for cubics and
 * converges far faster, which matters when every evaluation re-walks the syntax
 * tree. The subdivision count is fixed and even, as the machine's own is.
 */
function integrate(args: Node[], context: Context): Value {
  if (args.length < 3) throw new MathError('Syntax ERROR: ∫ cần (f(x), a, b)')
  const a = toNumber(expectReal(evaluateNode(args[1], context)))
  const b = toNumber(expectReal(evaluateNode(args[2], context)))
  if (a === b) return ZERO

  const f = (x: number): number =>
    toNumber(expectReal(withVariable(context, ITERATION_VARIABLE, inexact(x), () =>
      evaluateNode(args[0], context),
    )))

  const steps = 1000 // even, so Simpson's pairing works out
  const h = (b - a) / steps
  let total = f(a) + f(b)
  for (let i = 1; i < steps; i++) {
    total += f(a + i * h) * (i % 2 === 0 ? 2 : 4)
  }
  return inexact((total * h) / 3)
}

/**
 * Derivative by the symmetric difference quotient.
 *
 * Symmetric, not forward: its error is O(h²) rather than O(h), which is the
 * difference between five correct digits and two. `h` scales with the point so
 * the step stays meaningful at x = 1000 as well as x = 0.001.
 */
function differentiate(args: Node[], context: Context): Value {
  if (args.length < 2) throw new MathError('Syntax ERROR: d/dx cần (f(x), a)')
  const at = toNumber(expectReal(evaluateNode(args[1], context)))
  const h = Math.max(1e-7, Math.abs(at) * 1e-7)

  const f = (x: number): number =>
    toNumber(expectReal(withVariable(context, ITERATION_VARIABLE, inexact(x), () =>
      evaluateNode(args[0], context),
    )))

  return inexact((f(at + h) - f(at - h)) / (2 * h))
}
