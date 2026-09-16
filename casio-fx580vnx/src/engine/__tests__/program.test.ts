/**
 * Memories, multi-statement lines and CALC.
 */

import { describe, expect, it } from 'vitest'

import { emptyContext } from '../evaluate'
import { formatValue } from '../format'
import { calculate, run, splitTopLevel, variablesUsed } from '../program'
import { MathError, inexact, rational } from '../value'

const shown = (source: string, context = emptyContext()) =>
  formatValue(run(source, context).value).forms[0]

describe('splitting', () => {
  it('ignores a separator inside brackets', () => {
    expect(splitTopLevel('A:B', ':')).toEqual(['A', 'B'])
    expect(splitTopLevel('Pol(1,2)', ',')).toEqual(['Pol(1,2)'])
    expect(splitTopLevel('(A:B)', ':')).toEqual(['(A:B)'])
  })
})

describe('memories', () => {
  it('stores and reads back', () => {
    const context = emptyContext()
    run('3→A', context)
    expect(shown('A×2', context)).toBe('6')
  })

  it('reads an untouched memory as zero, as the machine does', () => {
    expect(shown('F+1')).toBe('1')
  })

  it('refuses to store into something that is not a memory', () => {
    expect(() => run('3→π', emptyContext())).toThrow(MathError)
  })

  it('runs several statements and shows the last one', () => {
    const context = emptyContext()
    expect(shown('2→A:3→B:A+B', context)).toBe('5')
    expect(shown('A×B', context)).toBe('6')
  })

  it('reports every step, not only the answer', () => {
    const result = run('2→A:A^2', emptyContext())
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].storedIn).toBe('A')
    expect(formatValue(result.steps[1].value).forms[0]).toBe('4')
  })
})

describe('Ans', () => {
  it('carries the last answer into the next entry', () => {
    const context = emptyContext()
    run('2+3', context)
    expect(shown('Ans×2', context)).toBe('10')
  })

  it('keeps the one before it too', () => {
    const context = emptyContext()
    run('7', context)
    run('9', context)
    // Ans is 9, so the answer before it — PreAns — is 7.
    expect(shown('PreAns', context)).toBe('7')
  })

  it('is not mistaken for the memory A', () => {
    const context = emptyContext()
    run('5→A', context)
    run('100', context)
    expect(shown('Ans', context)).toBe('100')
    expect(shown('A', context)).toBe('5')
  })
})

describe('CALC', () => {
  const context = emptyContext()

  it('substitutes without disturbing the stored memories', () => {
    context.variables.A = rational(1n)
    const value = calculate('A^2', { A: rational(9n) }, context)
    expect(formatValue(value).forms[0]).toBe('81')
    expect(formatValue(context.variables.A).forms[0]).toBe('1')
  })

  it('asks for exactly the memories the formula mentions', () => {
    expect(variablesUsed('A^2+B')).toEqual(['A', 'B'])
  })

  it('does not ask for a memory that was only ever part of a function name', () => {
    // `sin` and `ln` both contain an `n`, which is a memory on this machine.
    expect(variablesUsed('sin(x)+ln(2)')).toEqual(['x'])
  })

  it('does not ask for Ans', () => {
    expect(variablesUsed('Ans+A')).toEqual(['A'])
  })

  it('works with an inexact binding', () => {
    const value = calculate('2x', { x: inexact(1.5) }, emptyContext())
    expect(formatValue(value).forms[0]).toBe('3')
  })
})
