import { describe, expect, it } from 'vitest'

import {
  EjsonParseError,
  documentKey,
  idFilter,
  kindOf,
  normaliseRelaxed,
  parseFilter,
  parsePipeline,
  parseRelaxed,
  preview,
  toShell,
  valueAtPath,
  withoutId,
  wrapperKey,
} from '../lib/ejson'

describe('normaliseRelaxed', () => {
  it('quotes bare keys', () => {
    expect(JSON.parse(normaliseRelaxed('{status: 1}'))).toEqual({ status: 1 })
  })

  it('quotes bare keys at every depth', () => {
    expect(JSON.parse(normaliseRelaxed('{a: {b: {c: 1}}}'))).toEqual({ a: { b: { c: 1 } } })
  })

  it('converts single quotes to double quotes', () => {
    expect(JSON.parse(normaliseRelaxed("{name: 'ann'}"))).toEqual({ name: 'ann' })
  })

  it('leaves a colon inside a string alone', () => {
    expect(JSON.parse(normaliseRelaxed('{url: "http://x/y"}'))).toEqual({ url: 'http://x/y' })
  })

  it('does not treat a constructor name inside a string as a call', () => {
    expect(JSON.parse(normaliseRelaxed('{note: "call ObjectId(x) later"}'))).toEqual({
      note: 'call ObjectId(x) later',
    })
  })

  it('escapes a double quote that was inside single quotes', () => {
    expect(JSON.parse(normaliseRelaxed(`{q: 'say "hi"'}`))).toEqual({ q: 'say "hi"' })
  })

  it('drops trailing commas', () => {
    expect(JSON.parse(normaliseRelaxed('{a: 1, b: 2,}'))).toEqual({ a: 1, b: 2 })
    expect(JSON.parse(normaliseRelaxed('[1, 2,]'))).toEqual([1, 2])
  })

  it('drops line and block comments', () => {
    expect(JSON.parse(normaliseRelaxed('{ // pick active\n a: 1 /* only */ }'))).toEqual({ a: 1 })
  })

  it('keeps operator keys quoted', () => {
    expect(JSON.parse(normaliseRelaxed('{qty: {$gt: 4}}'))).toEqual({ qty: { $gt: 4 } })
  })

  it('accepts already-strict JSON unchanged in meaning', () => {
    expect(JSON.parse(normaliseRelaxed('{"a": [1, {"b": null}]}'))).toEqual({ a: [1, { b: null }] })
  })
})

describe('shell constructors', () => {
  it('expands ObjectId', () => {
    expect(parseRelaxed('{_id: ObjectId("507f1f77bcf86cd799439011")}')).toEqual({
      _id: { $oid: '507f1f77bcf86cd799439011' },
    })
  })

  it('accepts the ObjectID spelling too', () => {
    expect(parseRelaxed('ObjectID("abc")')).toEqual({ $oid: 'abc' })
  })

  it('expands ISODate and Date', () => {
    expect(parseRelaxed('{at: ISODate("2026-09-13T00:00:00Z")}')).toEqual({
      at: { $date: '2026-09-13T00:00:00Z' },
    })
    expect(parseRelaxed('{at: new Date("2026-01-01T00:00:00Z")}')).toEqual({
      at: { $date: '2026-01-01T00:00:00Z' },
    })
  })

  it('expands the numeric constructors', () => {
    expect(parseRelaxed('{a: NumberLong(9), b: NumberInt(3), c: NumberDecimal("1.50")}')).toEqual({
      a: { $numberLong: '9' },
      b: { $numberInt: '3' },
      c: { $numberDecimal: '1.50' },
    })
  })

  it('expands MinKey, MaxKey and Timestamp', () => {
    expect(parseRelaxed('{a: MinKey(), b: MaxKey(), c: Timestamp(5, 1)}')).toEqual({
      a: { $minKey: 1 },
      b: { $maxKey: 1 },
      c: { $timestamp: { t: 5, i: 1 } },
    })
  })

  it('expands Infinity and NaN', () => {
    expect(parseRelaxed('{a: Infinity, b: NaN}')).toEqual({
      a: { $numberDouble: 'Infinity' },
      b: { $numberDouble: 'NaN' },
    })
  })

  it('expands a regex literal', () => {
    expect(parseRelaxed('{name: /^an/i}')).toEqual({
      name: { $regularExpression: { pattern: '^an', options: 'i' } },
    })
  })

  it('keeps a slash inside a regex character class', () => {
    expect(parseRelaxed('{p: /[a/b]+/}')).toEqual({
      p: { $regularExpression: { pattern: '[a/b]+', options: '' } },
    })
  })

  it('handles a constructor nested inside an operator', () => {
    expect(parseRelaxed('{_id: {$in: [ObjectId("a"), ObjectId("b")]}}')).toEqual({
      _id: { $in: [{ $oid: 'a' }, { $oid: 'b' }] },
    })
  })

  it('rejects an unknown constructor', () => {
    expect(() => parseRelaxed('{a: Nonsense("x")}')).toThrow(EjsonParseError)
  })

  it('rejects a bareword that is not a key', () => {
    expect(() => parseRelaxed('{a: banana}')).toThrow(EjsonParseError)
  })

  it('reports an unterminated string', () => {
    expect(() => parseRelaxed('{a: "oops}')).toThrow(EjsonParseError)
  })
})

describe('parseFilter and parsePipeline', () => {
  it('an empty filter is an empty object', () => {
    expect(parseFilter('')).toEqual({})
    expect(parseFilter('   ')).toEqual({})
  })

  it('a filter must be an object', () => {
    expect(() => parseFilter('[1, 2]')).toThrow(/must be an object/)
    expect(() => parseFilter('5')).toThrow(/must be an object/)
  })

  it('an empty pipeline is an empty array', () => {
    expect(parsePipeline('')).toEqual([])
  })

  it('a pipeline must be an array', () => {
    expect(() => parsePipeline('{$match: {}}')).toThrow(/must be an array/)
  })

  it('parses a real pipeline', () => {
    expect(parsePipeline('[{ $match: { a: 1 } }, { $limit: 5 }]')).toEqual([
      { $match: { a: 1 } },
      { $limit: 5 },
    ])
  })

  it('parseRelaxed without a fallback refuses empty input', () => {
    expect(() => parseRelaxed('')).toThrow(EjsonParseError)
  })
})

describe('wrapperKey and kindOf', () => {
  it('recognises wrappers', () => {
    expect(wrapperKey({ $oid: 'a' })).toBe('$oid')
    expect(wrapperKey({ $date: 'x' })).toBe('$date')
  })

  it('a plain object is not a wrapper', () => {
    expect(wrapperKey({ name: 'a' })).toBeNull()
    expect(wrapperKey({ $oid: 'a', extra: 1 })).toBeNull()
    expect(wrapperKey(null)).toBeNull()
    expect(wrapperKey([{ $oid: 'a' }])).toBeNull()
  })

  it('$code may carry a $scope', () => {
    expect(wrapperKey({ $code: 'f()', $scope: {} })).toBe('$code')
  })

  it('classifies every value the grid colours', () => {
    expect(kindOf(null)).toBe('null')
    expect(kindOf(undefined)).toBe('null')
    expect(kindOf(true)).toBe('boolean')
    expect(kindOf(3)).toBe('number')
    expect(kindOf('x')).toBe('string')
    expect(kindOf([1])).toBe('array')
    expect(kindOf({ a: 1 })).toBe('object')
    expect(kindOf({ $oid: 'a' })).toBe('objectId')
    expect(kindOf({ $date: 'a' })).toBe('date')
    expect(kindOf({ $numberLong: '1' })).toBe('number')
    expect(kindOf({ $numberDecimal: '1' })).toBe('decimal')
    expect(kindOf({ $binary: { base64: '', subType: '00' } })).toBe('binary')
  })
})

describe('preview', () => {
  it('unwraps scalars', () => {
    expect(preview({ $oid: '507f1f77bcf86cd799439011' })).toBe('507f1f77bcf86cd799439011')
    expect(preview({ $numberLong: '42' })).toBe('42')
    expect(preview(null)).toBe('null')
    expect(preview(12)).toBe('12')
  })

  it('summarises containers rather than dumping them', () => {
    expect(preview([1, 2, 3])).toBe('[ 3 ]')
    expect(preview({ a: 1, b: 2 })).toBe('{ 2 }')
  })

  it('renders a date readably', () => {
    expect(preview({ $date: '2026-09-13T10:30:00.000Z' })).toBe('2026-09-13 10:30:00Z')
  })

  it('renders a regex', () => {
    expect(preview({ $regularExpression: { pattern: '^a', options: 'i' } })).toBe('/^a/i')
  })

  it('truncates long strings', () => {
    expect(preview('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`)
  })
})

describe('toShell', () => {
  it('round-trips through parseRelaxed', () => {
    const document = {
      _id: { $oid: '507f1f77bcf86cd799439011' },
      name: 'ann',
      tags: ['a', 'b'],
      meta: { active: true, score: 4.5 },
      created: { $date: '2026-09-13T00:00:00Z' },
      big: { $numberLong: '900' },
    }
    expect(parseRelaxed(toShell(document))).toEqual(document)
  })

  it('writes shell spellings', () => {
    expect(toShell({ $oid: 'abc' })).toBe('ObjectId("abc")')
    expect(toShell({ $date: '2026-01-01T00:00:00Z' })).toBe('ISODate("2026-01-01T00:00:00Z")')
    expect(toShell({ $minKey: 1 })).toBe('MinKey()')
    expect(toShell({ $numberDecimal: '1.5' })).toBe('NumberDecimal("1.5")')
  })

  it('leaves identifier keys unquoted and quotes the rest', () => {
    expect(toShell({ name: 1 })).toContain('name: 1')
    expect(toShell({ 'with space': 1 })).toContain('"with space": 1')
  })

  it('collapses empty containers', () => {
    expect(toShell({})).toBe('{}')
    expect(toShell([])).toBe('[]')
  })

  it('indents nested structures', () => {
    expect(toShell({ a: { b: 1 } })).toBe('{\n  a: {\n    b: 1\n  }\n}')
  })
})

describe('document helpers', () => {
  it('builds an _id filter', () => {
    expect(idFilter({ _id: { $oid: 'a' }, n: 1 })).toEqual({ _id: { $oid: 'a' } })
  })

  it('refuses a document with no _id', () => {
    expect(idFilter({ n: 1 })).toBeNull()
  })

  it('derives a stable key', () => {
    expect(documentKey({ _id: { $oid: 'abc' } }, 0)).toBe('abc')
    expect(documentKey({ _id: 7 }, 0)).toBe('7')
    expect(documentKey({ _id: { a: 1 } }, 0)).toBe('{"a":1}')
    expect(documentKey({ n: 1 }, 3)).toBe('row-3')
  })

  it('strips _id without touching the original', () => {
    const original = { _id: 1, name: 'a' }
    expect(withoutId(original)).toEqual({ name: 'a' })
    expect(original._id).toBe(1)
  })

  it('reads dotted paths', () => {
    expect(valueAtPath({ a: { b: 2 } }, 'a.b')).toBe(2)
    expect(valueAtPath({ 'a.b': 9 }, 'a.b')).toBe(9) // a literal dotted key wins
    expect(valueAtPath({ a: 1 }, 'a.b.c')).toBeUndefined()
    expect(valueAtPath({}, 'missing')).toBeUndefined()
  })
})
