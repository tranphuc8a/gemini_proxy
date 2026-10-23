import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyPatch, diffLines, makePatch, merge3, type LinePatch } from '../lineDiff'

interface FixtureCase {
  name: string
  base: string
  patch: LinePatch
  result: string
}

/** The same file the server's tests apply (backend/fastapi/tests/fixtures/markdown_patches.json). */
const FIXTURE = JSON.parse(
  readFileSync(resolve(process.cwd(), '..', 'backend', 'fastapi', 'tests', 'fixtures', 'markdown_patches.json'), 'utf-8')
) as FixtureCase[]

/** A small deterministic generator (the prototype's, so the cases are reproducible). */
function random(seed: number) {
  let state = seed
  return () => (state = (state * 48271) % 2147483647) / 2147483647
}

function lines(next: () => number, longest = 12, alphabet = 'abcde'): string {
  return Array.from({ length: Math.floor(next() * longest) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('\n')
}

describe('patch fixture shared with the server', () => {
  it('has the cases the Python side applies', () => {
    expect(FIXTURE.length).toBeGreaterThanOrEqual(10)
  })

  it.each(FIXTURE.map((c) => [c.name, c] as const))('applies the server fixture: %s', (_name, c) => {
    expect(applyPatch(c.base, c.patch)).toBe(c.result)
  })

  it.each(FIXTURE.map((c) => [c.name, c] as const))('makes a patch that rebuilds the fixture result: %s', (_name, c) => {
    const hunks = diffLines(c.base, c.result)
    expect(hunks).not.toBeNull()
    expect(applyPatch(c.base, { v: 1, h: hunks! })).toBe(c.result)
  })
})

describe('diffLines / applyPatch', () => {
  it('round-trips 500 random pairs', () => {
    const next = random(7)
    for (let index = 0; index < 500; index += 1) {
      const a = lines(next)
      const b = lines(next)
      expect(applyPatch(a, { v: 1, h: diffLines(a, b)! })).toBe(b)
    }
  })

  it('keeps CRLF, empty texts and the empty last line', () => {
    const pairs: [string, string][] = [
      ['', ''],
      ['', 'x'],
      ['x', ''],
      ['a\r\nb', 'a\r\nb\r\nc'],
      ['a\r\nb\r\n', 'a\r\nB\r\n'],
      ['x\ny\nz\n', 'x\nY\nz\n'],
      ['\n\n', '\n'],
      ['é\nệ\n😀', 'é\nệ!\n😀\n']
    ]
    for (const [a, b] of pairs) expect(applyPatch(a, { v: 1, h: diffLines(a, b)! })).toBe(b)
  })

  it('describes an identical pair as no hunk at all', () => {
    expect(diffLines('same\ntext', 'same\ntext')).toEqual([])
  })

  it('gives up past the edit ceiling', () => {
    const a = Array.from({ length: 300 }, (_, i) => `old ${i}`).join('\n')
    const b = Array.from({ length: 300 }, (_, i) => `new ${i}`).join('\n')
    expect(diffLines(a, b, 100)).toBeNull()
    expect(diffLines(a, b)).not.toBeNull()
  })

  it('makes a one-line patch for one edited line of a long text', () => {
    const base = Array.from({ length: 5000 }, (_, i) => `line number ${i} of the long document`).join('\n')
    const edited = base.replace('line number 2500 ', 'line number 2500 EDITED ')
    const patch = makePatch(base, edited)
    expect(patch).not.toBeNull()
    expect(patch!.h).toHaveLength(1)
    expect(JSON.stringify(patch).length).toBeLessThan(200)
    expect(applyPatch(base, patch!)).toBe(edited)
  })

  it('declines a patch that is not much smaller than the text (a rewrite)', () => {
    const a = Array.from({ length: 40 }, (_, i) => `old line ${i}`).join('\n')
    const b = Array.from({ length: 40 }, (_, i) => `new line ${i}`).join('\n')
    expect(makePatch(a, b)).toBeNull()
  })

  it('refuses a patch that does not fit the text or overlaps itself', () => {
    expect(() => applyPatch('a\nb', { v: 1, h: [[5, 1, []]] })).toThrow()
    expect(() => applyPatch('a\nb', { v: 1, h: [[0, 1, ['x']], [0, 1, ['y']]] })).toThrow()
    expect(() => applyPatch('a\nb', { v: 1, h: [[-1, 0, []]] })).toThrow()
    expect(() => applyPatch('a\nb', { v: 2 } as unknown as LinePatch)).toThrow()
  })
})

describe('merge3', () => {
  const base = ['# Title', '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'].join('\n')

  it('keeps both edits that touch different lines', () => {
    const ours = base.replace('two', 'TWO')
    const theirs = base.replace('six', 'SIX')
    expect(merge3(base, ours, theirs)).toEqual({ text: base.replace('two', 'TWO').replace('six', 'SIX'), conflicts: 0 })
  })

  it('counts an edit made on both sides once', () => {
    const both = base.replace('two', 'TWO')
    expect(merge3(base, both, both)).toEqual({ text: both, conflicts: 0 })
  })

  it('reports the same line edited two ways as a conflict', () => {
    const ours = base.replace('two', 'ours')
    const theirs = base.replace('two', 'theirs')
    const merged = merge3(base, ours, theirs)
    expect(merged?.conflicts).toBe(1)
  })

  it('reports two different insertions at one point as a conflict, the same insertion as none', () => {
    expect(merge3(base, base.replace('two', 'two\nA'), base.replace('two', 'two\nB'))?.conflicts).toBe(1)
    expect(merge3(base, base.replace('two', 'two\nA'), base.replace('two', 'two\nA'))).toEqual({ text: base.replace('two', 'two\nA'), conflicts: 0 })
  })

  it('reports an edit against a deletion of the same line as a conflict', () => {
    const ours = base.replace('\nthree', '')
    const theirs = base.replace('three', 'THREE')
    expect(merge3(base, ours, theirs)?.conflicts).toBe(1)
  })

  it('takes the other side when one side did not move', () => {
    const edited = base.replace('five', 'FIVE')
    expect(merge3(base, base, edited)).toEqual({ text: edited, conflicts: 0 })
    expect(merge3(base, edited, base)).toEqual({ text: edited, conflicts: 0 })
  })

  it('merges edits made far apart in a 1 MB document without conflict', () => {
    const big = Array.from({ length: 20000 }, (_, i) => `paragraph ${i} ${'x'.repeat(40)}`).join('\n')
    const ours = big.replace('paragraph 100 ', 'paragraph 100 OURS ')
    const theirs = big.replace('paragraph 19000 ', 'paragraph 19000 THEIRS ')
    const merged = merge3(big, ours, theirs)
    expect(merged?.conflicts).toBe(0)
    expect(merged?.text).toBe(big.replace('paragraph 100 ', 'paragraph 100 OURS ').replace('paragraph 19000 ', 'paragraph 19000 THEIRS '))
  })

  it('does not merge two sides that each rewrote more than the ceiling (the caller asks the person)', () => {
    const a = Array.from({ length: 400 }, (_, i) => `a ${i}`).join('\n')
    const b = Array.from({ length: 400 }, (_, i) => `b ${i}`).join('\n')
    const c = Array.from({ length: 400 }, (_, i) => `c ${i}`).join('\n')
    expect(merge3(a, b, c, 50)).toBeNull()
  })

  it('agrees with applying each side alone on 500 random bases', () => {
    const next = random(11)
    for (let index = 0; index < 500; index += 1) {
      const p = lines(next)
      const q = lines(next)
      expect(merge3(p, q, p)).toEqual({ text: q, conflicts: 0 })
      expect(merge3(p, p, q)).toEqual({ text: q, conflicts: 0 })
    }
  })

  it('keeps edits made on disjoint stretches of random texts (property)', () => {
    const next = random(23)
    for (let index = 0; index < 300; index += 1) {
      const body = Array.from({ length: 30 }, (_, i) => `row ${i}`)
      const top = Math.floor(next() * 10)
      const bottom = 15 + Math.floor(next() * 14)
      const ours = [...body]
      ours[top] = `OURS ${index}`
      const theirs = [...body]
      theirs[bottom] = `THEIRS ${index}`
      const expected = [...body]
      expected[top] = `OURS ${index}`
      expected[bottom] = `THEIRS ${index}`
      expect(merge3(body.join('\n'), ours.join('\n'), theirs.join('\n'))).toEqual({ text: expected.join('\n'), conflicts: 0 })
    }
  })
})
