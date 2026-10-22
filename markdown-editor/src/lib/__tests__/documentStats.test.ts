import { describe, expect, it } from 'vitest'
import { extractHeadings, getDocumentStats, lineAtOffset, type DocumentStats } from '../markdown'
import { longDoc } from '../../test/longDoc'

/**
 * getDocumentStats used to run on every keystroke, built from split/regex passes (129 ms on a 30k-line
 * document). The one-pass rewrite must give exactly the same numbers, so the old implementation is kept
 * here, verbatim, as the reference.
 */
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

function legacyScanLines(markdown: string): { line: string; inCode: boolean }[] {
  let fence: string | null = null
  return markdown.split('\n').map((line) => {
    const match = FENCE.exec(line)
    if (match) {
      const marker = match[1][0]
      if (fence === null) {
        fence = marker
        return { line, inCode: true }
      }
      if (fence === marker) {
        fence = null
        return { line, inCode: true }
      }
    }
    return { line, inCode: fence !== null }
  })
}

function legacyStats(markdown: string): DocumentStats {
  const lines = markdown.split('\n')
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0
  const scanned = legacyScanLines(markdown)
  return {
    words,
    characters: markdown.length,
    charactersNoSpaces: markdown.replace(/\s/g, '').length,
    lines: lines.length,
    paragraphs: markdown.split(/\n\s*\n/).filter((block) => block.trim()).length,
    headings: extractHeadings(markdown).length,
    codeBlocks: scanned.filter((entry, index) => entry.inCode && !scanned[index - 1]?.inCode).length,
    readingMinutes: Math.max(1, Math.ceil(words / 200))
  }
}

function legacyLineAtOffset(value: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, value.length))
  let line = 1
  for (let index = 0; index < clamped; index += 1) {
    if (value[index] === '\n') line += 1
  }
  return line
}

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

// Every kind of character the counters treat specially: all of JavaScript's white space, the markers of
// fences and headings, inline markup that can empty a heading, and a surrogate pair.
const ALPHABET = [
  'a', 'b', 'Đ', 'ệ', '1', ' ', ' ', '\n', '\n', '\n', '\t', '\r', '\v', '\f', ' ', ' ', ' ', ' ', ' ',
  ' ', ' ', '　', '﻿', '#', '#', '`', '`', '~', '*', '_', '[', ']', '(', ')', '<', '>', '-', '😀'
]

function randomMarkdown(r: () => number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    const roll = r()
    if (roll < 0.05) out += '\n```js\n'
    else if (roll < 0.08) out += '\n~~~\n'
    else if (roll < 0.12) out += '\n## '
    else if (roll < 0.14) out += '\n   # **x**'
    else out += ALPHABET[Math.floor(r() * ALPHABET.length)]
  }
  return out
}

const PERF_SLACK = Number(process.env.MD_PERF_SLACK) || 1
/** The replaced implementation on the 30k document, on the design machine (perf-md §2.4). */
const LEGACY_MS_ON_DESIGN_MACHINE = 129

/**
 * The fastest of `times` runs after a warm-up. Other processes (vitest's own parallel workers, other jobs on
 * the machine) only ever add time, so the minimum is the steadiest estimate of the function's own cost; a
 * median of 3 failed under a fully loaded CPU with the code unchanged.
 */
function bestMs(run: () => void, times = 5): number {
  run() // warm-up: the first call pays for JIT and lazy regex compilation
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < times; i += 1) {
    const start = performance.now()
    run()
    best = Math.min(best, performance.now() - start)
  }
  return best
}

describe('getDocumentStats (one pass)', () => {
  it.each([
    '',
    '   \n  ',
    'one word',
    '# Title\n\nHello world here.\n\nSecond block.',
    '```js\na\n```\n\n```py\nb\n```\n',
    '~~~\n```\n# not a heading\n```\n~~~\n# Heading\n',
    '#\n# \n#  **  **\n##   Real ##\n####### seven\n    # indented code\n\t# tab\n',
    // A lone marker survives stripping, so these headings count; markup that empties a heading does not.
    '# ~\n# *\n# `\n# <>\n# ``\n# **a**\n# [](x)\n# ![](y)\n# [t](u)\n# _ _\n# ~~ ~~\n',
    'a\n\n\n\nb\n \n \nc\r\n\r\nd',
    '\n\n\nlead and trail\n\n\n',
    'text with odd　spaces﻿ and separators'
  ])('matches the reference on %j', (text) => {
    expect(getDocumentStats(text)).toEqual(legacyStats(text))
  })

  it('matches the reference on 3,000 random documents', () => {
    const r = rng(20261023)
    for (let i = 0; i < 3000; i += 1) {
      const text = randomMarkdown(r, 1 + Math.floor(r() * 120))
      expect(getDocumentStats(text), JSON.stringify(text)).toEqual(legacyStats(text))
    }
  })

  it.each(['doc-2k', 'doc-10k', 'wiki-12k'] as const)('matches the reference on the generated %s', (name) => {
    const text = longDoc(name)
    expect(getDocumentStats(text)).toEqual(legacyStats(text))
  })

  it(`takes at most 40 ms on the 30,000-line document on the design machine (MD_PERF_SLACK=${PERF_SLACK})`, () => {
    const text = longDoc('doc-30k')
    expect(getDocumentStats(text)).toEqual(legacyStats(text))
    // The old version, timed side by side, measures how fast this machine is right now (see codeBlock.test.tsx):
    // the design's 40 ms holds on a machine as fast as the design one and stretches with a busy CPU.
    const machine = Math.max(1, bestMs(() => legacyStats(text), 2) / LEGACY_MS_ON_DESIGN_MACHINE)
    const ms = bestMs(() => getDocumentStats(text))
    expect(ms, `machine factor ${machine.toFixed(2)}`).toBeLessThanOrEqual(40 * machine * PERF_SLACK)
  }, 60_000)

  it('is several times faster than the version it replaced, whatever the machine', () => {
    // Measured side by side, so a slow or busy machine slows both alike.
    const text = longDoc('doc-10k')
    const ratio = bestMs(() => getDocumentStats(text)) / bestMs(() => legacyStats(text))
    expect(ratio).toBeLessThan(0.5)
  })
})

describe('lineAtOffset (indexOf)', () => {
  it('matches the character-by-character reference at every offset of mixed text', () => {
    const text = '\nab\n\ncd\r\nef\n'
    for (let offset = -2; offset <= text.length + 2; offset += 1) {
      expect(lineAtOffset(text, offset)).toBe(legacyLineAtOffset(text, offset))
    }
  })

  it('matches the reference at random offsets of a long document', () => {
    const text = longDoc('doc-2k')
    const r = rng(7)
    for (let i = 0; i < 200; i += 1) {
      const offset = Math.floor(r() * (text.length + 10))
      expect(lineAtOffset(text, offset)).toBe(legacyLineAtOffset(text, offset))
    }
  })
})
