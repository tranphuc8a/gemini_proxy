/**
 * What the machine does, written down.
 *
 * Every case here is either a rule the parser's docstring commits to, or an
 * answer taken from the fx-580VN X's own behaviour. The point is that
 * "implicit multiplication binds tighter than division" stops being an opinion
 * in a comment and becomes something that fails loudly if it stops being true.
 */

import { describe, expect, it } from 'vitest'

import { emptyContext, evaluate, type AngleMode } from '../evaluate'
import { formatInBase, formatValue, parseInBase, toDecimalString } from '../format'
import { MathError, toNumber, type Value } from '../value'

function run(source: string, angle: AngleMode = 'deg'): Value {
  const context = emptyContext()
  context.angle = angle
  return evaluate(source, context)
}

/** The first thing the display would show. */
function shown(source: string, angle: AngleMode = 'deg'): string {
  return formatValue(run(source, angle)).forms[0]
}

function approx(source: string, angle: AngleMode = 'deg'): number {
  const value = run(source, angle)
  if (value.kind !== 'real') throw new Error('not a real')
  return toNumber(value)
}

describe('precedence, as the docstring promises', () => {
  it('lets the power bind tighter than unary minus, so −2² is −4', () => {
    expect(shown('-2²')).toBe('-4')
    expect(shown('−2^2')).toBe('-4')
  })

  it('raises right to left, so 2^3^2 is 512 and not 64', () => {
    expect(shown('2^3^2')).toBe('512')
  })

  it('gives a bare function argument everything up to the next + or −', () => {
    expect(shown('sin 30 + 1')).toBe('3⌟2') // sin(30) + 1
    expect(approx('sin 2×30')).toBeCloseTo(Math.sqrt(3) / 2, 12) // sin(60), not sin(2)×30
  })

  it('binds an implicit product tighter than division, so 1÷2π is 1÷(2π)', () => {
    expect(approx('1÷2π')).toBeCloseTo(1 / (2 * Math.PI), 12)
    // and a typed × does not get the same treatment
    expect(approx('1÷2×π')).toBeCloseTo(Math.PI / 2, 12)
  })

  it('reads adjacency as multiplication in every shape the keypad allows', () => {
    expect(shown('2(3)')).toBe('6')
    expect(shown('(2)(3)')).toBe('6')
    expect(shown('2√9')).toBe('6')
    expect(approx('2e')).toBeCloseTo(2 * Math.E, 12)
  })

  it('applies postfix operators before anything else, so 5!² is (5!)²', () => {
    expect(shown('5!^2')).toBe('14400')
  })
})

describe('exact arithmetic', () => {
  it('keeps a third a third', () => {
    expect(shown('1÷3')).toBe('1⌟3')
    expect(shown('1÷3+1÷6')).toBe('1⌟2')
  })

  it('does not drift over a long exact chain', () => {
    expect(shown('20!÷19!')).toBe('20')
  })

  it('treats a typed decimal as the number it reads as, not the float near it', () => {
    expect(shown('0.1+0.2')).toBe('3⌟10')
  })

  it('stays exact through integer powers of a fraction', () => {
    expect(shown('(2÷3)^3')).toBe('8⌟27')
  })

  it('refuses to divide by zero rather than answering Infinity', () => {
    expect(() => run('1÷0')).toThrow(MathError)
  })
})

describe('trigonometry', () => {
  it('answers the textbook values exactly in degrees', () => {
    expect(shown('sin(30)')).toBe('1⌟2')
    expect(shown('cos(60)')).toBe('1⌟2')
    expect(shown('tan(45)')).toBe('1')
  })

  it('refuses tan 90 instead of returning 1.6e16', () => {
    expect(() => run('tan(90)')).toThrow(MathError)
  })

  it('works in radians when the mode says so', () => {
    expect(approx('sin(π÷6)', 'rad')).toBeCloseTo(0.5, 12)
  })

  it('honours a degree mark even in radian mode', () => {
    expect(approx('sin(30°)', 'rad')).toBeCloseTo(0.5, 12)
  })

  it('honours a radian mark even in degree mode', () => {
    expect(approx('sin((π÷6)ʳ)')).toBeCloseTo(0.5, 12)
  })

  it('inverts back to the working unit', () => {
    expect(approx('sin⁻¹(0.5)')).toBeCloseTo(30, 10)
    expect(approx('sin⁻¹(0.5)', 'rad')).toBeCloseTo(Math.PI / 6, 12)
  })
})

describe('the functions a student reaches for', () => {
  it('does logs', () => {
    expect(shown('log(1000)')).toBe('3')
    expect(approx('ln(e)')).toBeCloseTo(1, 12)
    expect(shown('log(2,8)')).toBe('3') // log base 2 of 8
  })

  it('does roots, exactly where the answer is a whole number', () => {
    expect(shown('√(9)')).toBe('3')
    expect(shown('∛(27)')).toBe('3')
    expect(approx('√(2)')).toBeCloseTo(Math.SQRT2, 12)
  })

  it('does GCD and LCM', () => {
    expect(shown('GCD(12,18)')).toBe('6')
    expect(shown('LCM(4,6)')).toBe('12')
  })

  it('does remainder division with the sign on the dividend, as ÷R does', () => {
    expect(shown('7 Mod 3')).toBe('1')
    expect(shown('(-7) Mod 3')).toBe('-1')
    expect(shown('7 Mod (-3)')).toBe('1')
  })

  it('does permutations and combinations without overflowing on the way', () => {
    expect(shown('10 nPr 3')).toBe('720')
    expect(shown('10 nCr 3')).toBe('120')
    expect(shown('60 nCr 30')).toBe('118264581564861424')
  })

  it('refuses a factorial the machine itself refuses', () => {
    expect(shown('5!')).toBe('120')
    expect(() => run('70!')).toThrow(MathError)
  })
})

describe('calculus and iteration', () => {
  it('sums a series', () => {
    expect(shown('Σ(x,1,10)')).toBe('55')
    expect(shown('Σ(x^2,1,5)')).toBe('55')
  })

  it('multiplies a product', () => {
    expect(shown('∏(x,1,5)')).toBe('120')
  })

  it('integrates to the precision the display shows', () => {
    expect(approx('∫(x^2,0,3)')).toBeCloseTo(9, 6)
    expect(approx('∫(sin(x),0,π)', 'rad')).toBeCloseTo(2, 6)
  })

  it('differentiates', () => {
    expect(approx('d/dx(x^3,2)')).toBeCloseTo(12, 5)
    expect(approx('d/dx(sin(x),0)', 'rad')).toBeCloseTo(1, 5)
  })
})

describe('complex numbers', () => {
  it('adds and multiplies them', () => {
    expect(shown('(1+2i)+(3+4i)')).toBe('4 + 6i')
    expect(shown('(1+2i)×(3+4i)')).toBe('-5 + 10i')
  })

  it('knows i² is −1', () => {
    expect(shown('i^2')).toBe('-1')
  })

  it('takes a conjugate and a modulus', () => {
    expect(shown('Conjg(3+4i)')).toBe('3 − 4i')
    expect(shown('Abs(3+4i)')).toBe('5')
  })
})

describe('matrices', () => {
  it('finds a determinant exactly', () => {
    expect(shown('det(Identity(3))')).toBe('1')
  })
})

describe('the display', () => {
  it('shows ten significant digits, not seventeen', () => {
    expect(toDecimalString(1 / 3)).toBe('0.3333333333')
    expect(toDecimalString(2)).toBe('2')
  })

  it('goes scientific outside the range the screen holds', () => {
    expect(toDecimalString(1.234e15)).toBe('1.234×10^15')
  })

  it('offers the fraction, the mixed number and the decimal, in that order', () => {
    const forms = formatValue(run('7÷3')).forms
    expect(forms).toEqual(['7⌟3', '2⌟1⌟3', '2.333333333'])
  })
})

describe('base-N', () => {
  const sample = 0x2fedcba9n

  it('round-trips through every base the machine has', () => {
    for (const base of [2, 8, 10, 16]) {
      expect(parseInBase(formatInBase(sample, base), base)).toBe(sample)
    }
  })

  it("writes a negative value in two's complement, as the machine does", () => {
    expect(formatInBase(-1n, 16)).toBe('hFFFFFFFF')
    expect(parseInBase('FFFFFFFF', 16)).toBe(-1n)
  })
})
