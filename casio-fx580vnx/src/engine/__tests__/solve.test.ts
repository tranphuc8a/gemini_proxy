/**
 * The EQN and STAT modes, checked against answers you can verify by hand.
 */

import { describe, expect, it } from 'vitest'

import { emptyContext } from '../evaluate'
import { formatValue } from '../format'
import { oneVariable, regression, type DataPoint } from '../stats'
import { solveCubic, solveEquation, solveQuadratic, solveSimultaneous, splitEquation } from '../solve'
import { rational, toNumber, type Value } from '../value'

const shown = (value: Value) => formatValue(value).forms[0]
const int = (n: number) => rational(BigInt(n))

describe('polynomials', () => {
  it('solves a quadratic exactly when the roots are rational', () => {
    // x² − 5x + 6 = (x−2)(x−3)
    expect(solveQuadratic(int(1), int(-5), int(6)).map(shown)).toEqual(['3', '2'])
  })

  it('gives a complex pair when the discriminant is negative', () => {
    // x² + 1
    expect(solveQuadratic(int(1), int(0), int(1)).map(shown)).toEqual(['i', '−i'])
  })

  it('keeps an irrational root irrational rather than pretending', () => {
    const roots = solveQuadratic(int(1), int(0), int(-2))
    expect(toNumber(roots[0] as never)).toBeCloseTo(Math.SQRT2, 12)
  })

  it('drops to a linear equation when a is zero', () => {
    expect(solveQuadratic(int(0), int(2), int(-6)).map(shown)).toEqual(['3'])
  })

  it('solves a cubic with three whole roots', () => {
    // (x−1)(x−2)(x−3) = x³ − 6x² + 11x − 6
    const roots = solveCubic(int(1), int(-6), int(11), int(-6))
      .map((root) => Number(shown(root)))
      .sort((a, b) => a - b)
    expect(roots).toEqual([1, 2, 3])
  })
})

describe('simultaneous equations', () => {
  it('solves a 2×2 exactly', () => {
    //  x + y = 5 ;  x − y = 1
    const answer = solveSimultaneous([
      [int(1), int(1), int(5)],
      [int(1), int(-1), int(1)],
    ])
    expect(answer.map((value) => shown(value))).toEqual(['3', '2'])
  })

  it('solves a 3×3 with fractional answers, as fractions', () => {
    const answer = solveSimultaneous([
      [int(2), int(1), int(-1), int(8)],
      [int(-3), int(-1), int(2), int(-11)],
      [int(-2), int(1), int(2), int(-3)],
    ])
    expect(answer.map((value) => shown(value))).toEqual(['2', '3', '-1'])
  })

  it('refuses a singular system rather than answering Infinity', () => {
    expect(() =>
      solveSimultaneous([
        [int(1), int(1), int(2)],
        [int(2), int(2), int(4)],
      ]),
    ).toThrow()
  })
})

describe('Solve(', () => {
  it('splits at the top-level equals only', () => {
    expect(splitEquation('2x=6')).toEqual(['2x', '6'])
    expect(splitEquation('2x-6')).toEqual(['2x-6', null])
  })

  it('finds a root of a linear equation', () => {
    const { root } = solveEquation('2x=6', emptyContext(), 'x', 0)
    expect(shown(root)).toBe('3')
  })

  it('finds a root Newton alone would miss, by bracketing', () => {
    // x³ − x − 2 has one real root near 1.5214; starting at 0 the derivative
    // is negative and Newton walks the wrong way.
    const { root } = solveEquation('x^3-x-2', emptyContext(), 'x', 0)
    expect(toNumber(root)).toBeCloseTo(1.521379707, 6)
  })

  it('reports how far off zero it ended up, as the machine does', () => {
    const { root, residual } = solveEquation('x^2=4', emptyContext(), 'x', 1)
    expect(shown(root)).toBe('2')
    expect(Math.abs(toNumber(residual))).toBeLessThan(1e-9)
  })
})

describe('one-variable statistics', () => {
  const data: DataPoint[] = [
    { x: 2, y: 0, freq: 1 },
    { x: 4, y: 0, freq: 1 },
    { x: 4, y: 0, freq: 1 },
    { x: 4, y: 0, freq: 1 },
    { x: 5, y: 0, freq: 1 },
    { x: 5, y: 0, freq: 1 },
    { x: 7, y: 0, freq: 1 },
    { x: 9, y: 0, freq: 1 },
  ]

  it('gets the mean and both standard deviations', () => {
    const stats = oneVariable(data)
    expect(stats.n).toBe(8)
    expect(stats.mean).toBeCloseTo(5, 12)
    expect(stats.sigma).toBeCloseTo(2, 12)   // divides by n
    expect(stats.s).toBeCloseTo(2.13809, 4)  // divides by n−1
  })

  it('reads a frequency column rather than needing the rows repeated', () => {
    const grouped: DataPoint[] = [
      { x: 2, y: 0, freq: 1 },
      { x: 4, y: 0, freq: 3 },
      { x: 5, y: 0, freq: 2 },
      { x: 7, y: 0, freq: 1 },
      { x: 9, y: 0, freq: 1 },
    ]
    expect(oneVariable(grouped).mean).toBeCloseTo(oneVariable(data).mean, 12)
    expect(oneVariable(grouped).sigma).toBeCloseTo(oneVariable(data).sigma, 12)
  })

  it('finds the quartiles', () => {
    const stats = oneVariable(data)
    expect(stats.min).toBe(2)
    expect(stats.max).toBe(9)
    expect(stats.median).toBeCloseTo(4.5, 12)
  })

  it('does not answer NaN when every value is the same', () => {
    const flat: DataPoint[] = [
      { x: 3, y: 0, freq: 1 },
      { x: 3, y: 0, freq: 1 },
    ]
    expect(oneVariable(flat).sigma).toBe(0)
  })
})

describe('regression', () => {
  const line: DataPoint[] = [
    { x: 1, y: 3, freq: 1 },
    { x: 2, y: 5, freq: 1 },
    { x: 3, y: 7, freq: 1 },
    { x: 4, y: 9, freq: 1 },
  ]

  it('recovers a line it was given exactly', () => {
    const fit = regression(line, 'linear')
    expect(fit.coefficients[0]).toBeCloseTo(1, 10) // a
    expect(fit.coefficients[1]).toBeCloseTo(2, 10) // b
    expect(fit.r).toBeCloseTo(1, 10)
    expect(fit.predictY(5)).toBeCloseTo(11, 10)
    expect(fit.predictX?.(11)).toBeCloseTo(5, 10)
  })

  it('recovers an exponential it was given exactly', () => {
    const data: DataPoint[] = [1, 2, 3, 4].map((x) => ({ x, y: 3 * Math.exp(0.5 * x), freq: 1 }))
    const fit = regression(data, 'exp')
    expect(fit.coefficients[0]).toBeCloseTo(3, 8)
    expect(fit.coefficients[1]).toBeCloseTo(0.5, 8)
  })

  it('recovers a power law it was given exactly', () => {
    const data: DataPoint[] = [1, 2, 3, 4].map((x) => ({ x, y: 2 * x ** 3, freq: 1 }))
    const fit = regression(data, 'power')
    expect(fit.coefficients[0]).toBeCloseTo(2, 8)
    expect(fit.coefficients[1]).toBeCloseTo(3, 8)
  })

  it('recovers a parabola it was given exactly', () => {
    const data: DataPoint[] = [-2, -1, 0, 1, 2, 3].map((x) => ({
      x,
      y: 1 + 2 * x + 3 * x * x,
      freq: 1,
    }))
    const fit = regression(data, 'quadratic')
    expect(fit.coefficients[0]).toBeCloseTo(1, 8)
    expect(fit.coefficients[1]).toBeCloseTo(2, 8)
    expect(fit.coefficients[2]).toBeCloseTo(3, 8)
    expect(fit.r).toBeCloseTo(1, 8)
  })
})
