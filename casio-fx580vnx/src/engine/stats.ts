/**
 * STAT mode: the summary figures and the regressions.
 *
 * Everything here is derived from four running sums (n, Σx, Σx², and for
 * two-variable work Σy, Σy², Σxy), which is how the machine does it too — it
 * keeps the sums, not the data, which is why editing a row recomputes rather
 * than adjusts.
 *
 * The one thing worth stating out loud is the difference between the two
 * standard deviations. `σ` divides by n and describes *this* data; `s` divides
 * by n−1 and estimates the population the data came from. The machine shows
 * both, side by side, and students pick the wrong one constantly — so both are
 * named in full here.
 */

export interface DataPoint {
  x: number
  y: number
  freq: number
}

export interface OneVariableStats {
  n: number
  sumX: number
  sumX2: number
  mean: number
  /** Population standard deviation, dividing by n. */
  sigma: number
  /** Sample standard deviation, dividing by n−1. */
  s: number
  min: number
  max: number
  median: number
  q1: number
  q3: number
}

export type RegressionKind = 'linear' | 'quadratic' | 'log' | 'exp' | 'power' | 'inverse'

export interface Regression {
  kind: RegressionKind
  /** a, b and (quadratic only) c, in the machine's own naming. */
  coefficients: number[]
  /** Correlation coefficient r, or the coefficient of determination for a quadratic. */
  r: number
  /** y for a given x. */
  predictY: (x: number) => number
  /** x for a given y, where the relation can be inverted. */
  predictX: ((y: number) => number) | null
}

function expand(data: DataPoint[]): number[] {
  const values: number[] = []
  for (const point of data) {
    const times = Math.max(0, Math.round(point.freq))
    for (let i = 0; i < times; i++) values.push(point.x)
  }
  return values.sort((a, b) => a - b)
}

/** The value at a fractional position in a sorted list. */
function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return NaN
  const position = fraction * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower])
}

export function oneVariable(data: DataPoint[]): OneVariableStats {
  let n = 0
  let sumX = 0
  let sumX2 = 0
  for (const point of data) {
    n += point.freq
    sumX += point.x * point.freq
    sumX2 += point.x * point.x * point.freq
  }

  const mean = n === 0 ? NaN : sumX / n
  const variance = n === 0 ? NaN : sumX2 / n - mean * mean
  const sorted = expand(data)

  return {
    n,
    sumX,
    sumX2,
    mean,
    // Clamped at zero: with all-equal data the subtraction above can land a
    // hair below it and Math.sqrt would answer NaN.
    sigma: Math.sqrt(Math.max(0, variance)),
    s: n > 1 ? Math.sqrt(Math.max(0, (sumX2 - n * mean * mean) / (n - 1))) : NaN,
    min: sorted.length ? sorted[0] : NaN,
    max: sorted.length ? sorted[sorted.length - 1] : NaN,
    median: percentile(sorted, 0.5),
    q1: percentile(sorted, 0.25),
    q3: percentile(sorted, 0.75),
  }
}

interface Sums {
  n: number
  x: number
  y: number
  xx: number
  yy: number
  xy: number
}

function sums(data: DataPoint[], fx: (x: number) => number, fy: (y: number) => number): Sums {
  const total: Sums = { n: 0, x: 0, y: 0, xx: 0, yy: 0, xy: 0 }
  for (const point of data) {
    const x = fx(point.x)
    const y = fy(point.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    total.n += point.freq
    total.x += x * point.freq
    total.y += y * point.freq
    total.xx += x * x * point.freq
    total.yy += y * y * point.freq
    total.xy += x * y * point.freq
  }
  return total
}

/** Least squares on transformed coordinates, which is every kind but quadratic. */
function fitLine(s: Sums): { a: number; b: number; r: number } {
  const denominator = s.n * s.xx - s.x * s.x
  const b = (s.n * s.xy - s.x * s.y) / denominator
  const a = (s.y - b * s.x) / s.n
  const r =
    (s.n * s.xy - s.x * s.y) /
    Math.sqrt(denominator * (s.n * s.yy - s.y * s.y))
  return { a, b, r }
}

export function regression(data: DataPoint[], kind: RegressionKind): Regression {
  if (kind === 'quadratic') return quadraticRegression(data)

  // Each kind is a straight line once both axes are bent the right way. `exp`
  // is y = A·e^(Bx), so ln y against x; `power` is y = A·x^B, so both logged.
  const transforms: Record<
    Exclude<RegressionKind, 'quadratic'>,
    { fx: (x: number) => number; fy: (y: number) => number }
  > = {
    linear: { fx: (x) => x, fy: (y) => y },
    log: { fx: Math.log, fy: (y) => y },
    exp: { fx: (x) => x, fy: Math.log },
    power: { fx: Math.log, fy: Math.log },
    inverse: { fx: (x) => 1 / x, fy: (y) => y },
  }

  const { fx, fy } = transforms[kind]
  const { a, b, r } = fitLine(sums(data, fx, fy))

  switch (kind) {
    case 'linear':
      return {
        kind,
        coefficients: [a, b],
        r,
        predictY: (x) => a + b * x,
        predictX: (y) => (y - a) / b,
      }
    case 'log':
      return {
        kind,
        coefficients: [a, b],
        r,
        predictY: (x) => a + b * Math.log(x),
        predictX: (y) => Math.exp((y - a) / b),
      }
    case 'exp': {
      const A = Math.exp(a)
      return {
        kind,
        coefficients: [A, b],
        r,
        predictY: (x) => A * Math.exp(b * x),
        predictX: (y) => Math.log(y / A) / b,
      }
    }
    case 'power': {
      const A = Math.exp(a)
      return {
        kind,
        coefficients: [A, b],
        r,
        predictY: (x) => A * Math.pow(x, b),
        predictX: (y) => Math.pow(y / A, 1 / b),
      }
    }
    case 'inverse':
      return {
        kind,
        coefficients: [a, b],
        r,
        predictY: (x) => a + b / x,
        predictX: (y) => b / (y - a),
      }
  }
}

/** y = a + bx + cx², by the normal equations. */
function quadraticRegression(data: DataPoint[]): Regression {
  let n = 0
  let x1 = 0
  let x2 = 0
  let x3 = 0
  let x4 = 0
  let y1 = 0
  let xy = 0
  let x2y = 0
  for (const point of data) {
    const { x, y, freq } = point
    n += freq
    x1 += x * freq
    x2 += x * x * freq
    x3 += x ** 3 * freq
    x4 += x ** 4 * freq
    y1 += y * freq
    xy += x * y * freq
    x2y += x * x * y * freq
  }

  const matrix = [
    [n, x1, x2, y1],
    [x1, x2, x3, xy],
    [x2, x3, x4, x2y],
  ]

  // Gaussian elimination on a 3×3; floats are fine here because the answer is
  // a fit, not an identity.
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row
    }
    ;[matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]]
    const lead = matrix[col][col]
    for (let k = col; k < 4; k++) matrix[col][k] /= lead
    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = matrix[row][col]
      for (let k = col; k < 4; k++) matrix[row][k] -= factor * matrix[col][k]
    }
  }

  const [a, b, c] = [matrix[0][3], matrix[1][3], matrix[2][3]]
  const predictY = (x: number) => a + b * x + c * x * x

  // R², reported in the slot where the linear fits report r.
  const meanY = y1 / n
  let residual = 0
  let total = 0
  for (const point of data) {
    residual += point.freq * (point.y - predictY(point.x)) ** 2
    total += point.freq * (point.y - meanY) ** 2
  }

  return {
    kind: 'quadratic',
    coefficients: [a, b, c],
    r: total === 0 ? 1 : 1 - residual / total,
    predictY,
    // Two answers in general, so the machine asks which; not offered here.
    predictX: null,
  }
}
