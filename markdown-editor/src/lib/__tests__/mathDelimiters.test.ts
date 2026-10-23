import { describe, expect, it } from 'vitest'
import { findSkipRanges, normalizeMath } from '../mathDelimiters'
import { NORMALIZE_VECTORS, STREAM_ANSWERS, streamPrefixFailure } from './mathVectors'

const R = String.raw

const slack = Number(process.env.MD_PERF_SLACK) || 1

/**
 * Whether `normalizeMath` scales linearly from `small` to `large` (four times the text): the larger takes under
 * `msPerKb` per KB, and at most `ratio` times the smaller (linear ≈ 4, quadratic ≈ 16; times under `floor` ms count as
 * `floor`, so a 1 ms run is not compared with a 6 ms one). vitest runs some 35 files in parallel and the machine is
 * shared: the two inputs are timed alternately (best of three each, under the same load), and a case gets three
 * attempts. A quadratic scan fails all three; noise does not. Returns the last measurement when it fails, else ''.
 *
 * The ratio only catches quadratic growth: n^1.5 (K openers times L lines, K ~ sqrt(n)) grows about eight times over
 * four times the text, under 12. The absolute budget is what catches it, so keep `msPerKb` tight: 1 ms/KB for the
 * pathological cases, where n^1.5 costs several ms per KB at 256 KB.
 */
function linearFailure(small: string, large: string, msPerKb: number, ratio = 12, floor = 5): string {
  let report = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    let tSmall = Infinity
    let tLarge = Infinity
    for (let run = 0; run < 3; run++) {
      let start = performance.now()
      normalizeMath(small)
      tSmall = Math.min(tSmall, performance.now() - start)
      start = performance.now()
      normalizeMath(large)
      tLarge = Math.min(tLarge, performance.now() - start)
    }
    const budget = (large.length / 1024) * msPerKb * slack
    if (tLarge < budget && tLarge / Math.max(tSmall, floor) < ratio) return ''
    report = `small ${tSmall.toFixed(1)} ms, large ${tLarge.toFixed(1)} ms (budget ${budget.toFixed(0)} ms, ratio < ${ratio})`
  }
  return report
}

// The vectors are shared with gemini-chat (frontend/), which runs them on its synced copy: ./mathVectors.ts.
describe('normalizeMath', () => {
  it('has at least 40 vectors', () => {
    expect(NORMALIZE_VECTORS.length).toBeGreaterThanOrEqual(40)
  })

  it.each(NORMALIZE_VECTORS)('%s', (_name, input, expected, display, generated) => {
    const result = normalizeMath(input)
    expect(result.text).toBe(expected)
    expect(result.text.split('\n').length).toBe(input.split('\n').length)
    if (display) expect([...result.display]).toEqual(display)
    if (generated) expect([...result.generated]).toEqual(generated)
    for (const offset of [...result.display, ...result.generated]) expect(result.text[offset]).toBe('$')
  })

  it.each(STREAM_ANSWERS)('streaming, cut at every character: $name', ({ md }) => {
    for (let cut = 1; cut <= md.length; cut++) {
      const prefix = md.slice(0, cut)
      expect(streamPrefixFailure(prefix, normalizeMath(prefix).text), JSON.stringify(prefix)).toBe('')
    }
    // Once the whole answer is in, every \( and \[ has become maths.
    expect(normalizeMath(md).text).not.toMatch(/\\[[(]/)
  })

  it('returns the same string when there is nothing to do', () => {
    const text = 'no maths here\n\njust text'
    expect(normalizeMath(text).text).toBe(text)
  })

  it('handles CRLF line endings', () => {
    const result = normalizeMath('\\[\r\nE = mc^2\r\n\\]\r\n\r\n$5 and $10')
    expect(result.text).toBe('$$\r\nE = mc^2\r\n$$\r\n\r\n\\$5 and \\$10')
  })

  it('never changes the number of lines, and never throws (randomised)', () => {
    const pieces = ['\\(', '\\)', '\\[', '\\]', '$', '$$', '\n', '\n\n', 'a', 'x_1', ' ', '\\begin{align}', '\\end{align}', '`', '```', '- ', '> ', '\\\\', '<b>', '5', '\\', '{', '}', '&', '<!--', '-->', '    ', '1. ', '|']
    let seed = 7
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let round = 0; round < 3000; round++) {
      let text = ''
      const n = 1 + Math.floor(random() * 30)
      for (let k = 0; k < n; k++) text += pieces[Math.floor(random() * pieces.length)]
      const result = normalizeMath(text)
      expect(result.text.split('\n').length, JSON.stringify(text)).toBe(text.split('\n').length)
      for (const offset of [...result.display, ...result.generated]) expect(result.text[offset], JSON.stringify(text)).toBe('$')
    }
  })

  it('keeps every skipped region byte for byte', () => {
    const doc = [
      'Intro \\(a\\) and $5.',
      '',
      '```python',
      'print("$5 and $10", r"\\(x\\)")',
      '```',
      '',
      '$$',
      '\\begin{align} a &= b \\\\ c \\end{align}',
      '$$',
      '',
      '<details>',
      '<summary>\\(x\\) $1</summary>',
      '',
      'Inside: \\[ y^2 \\]',
      '',
      '</details>'
    ].join('\n')
    const ranges = findSkipRanges(doc)
    const result = normalizeMath(doc)
    for (const [start, end] of ranges) expect(result.text).toContain(doc.slice(start, end))
    expect(ranges.map(([s, e]) => doc.slice(s, e))).toEqual([
      '```python\nprint("$5 and $10", r"\\(x\\)")\n```',
      '$$\n\\begin{align} a &= b \\\\ c \\end{align}\n$$',
      '<details>\n<summary>\\(x\\) $1</summary>',
      '</details>'
    ])
    expect(result.text).toContain('Inside: $ y^2 $')
    expect(result.text).toContain('Intro $a$ and \\$5.')
  })

  it('finds fences that end with their list item or blockquote', () => {
    expect(findSkipRanges('- ```js\n  x\n  ```\n- y')).toEqual([[0, 17]])
    // The blockquote ends without a closing fence: so does the fence, and the line after is text again.
    const quoted = '> ```\n> code $5\nplain \\(x\\)'
    expect(findSkipRanges(quoted)).toEqual([[0, 15]])
    expect(normalizeMath(quoted).text).toBe('> ```\n> code $5\nplain $x$')
  })

  it('runs in linear time: well under 0.2 ms per KB', () => {
    const block = [
      '## Section',
      '',
      'ChatGPT style: the energy \\( E = mc^2 \\) and price $20/month, see $x_1 + y$.',
      '',
      '\\[',
      '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
      '\\]',
      '',
      '- item with \\(a_i\\) and **bold** text',
      '',
      '```js',
      'const cost = "$5"',
      '```',
      ''
    ].join('\n')
    const make = (kb: number) => block.repeat(Math.ceil((kb * 1024) / block.length))
    // 300 KB under 100 ms (md-render task 2): 1200 KB under 400 ms, and about four times as long as 300 KB, not sixteen.
    expect(linearFailure(make(300), make(1200), 100 / 300)).toBe('')
  })
})

describe('normalizeMath on pathological input', () => {
  /**
   * Each of these used to be quadratic (a question about a position rescanned what an earlier one had covered): 50 KB
   * of the first took 20 s, of `\[` lines without a closer 0.5 s, of `> $$ a` lines 1.9 s. Now every one is linear:
   * four times the text costs about four times as much (quadratic would be sixteen), and stays far below 1 ms per KB
   * (measured 0.01–0.3; the budget is 0.2 for real documents).
   */
  const fill = (unit: string, kb: number) => unit.repeat(Math.ceil((kb * 1024) / unit.length))
  const sizes = (start: number, kb: number) => {
    let text = ''
    for (let n = start; text.length < kb * 1024; n++) text += '$'.repeat(n) + ' x '
    return text
  }
  /** Dollar runs of sizes 2, 3, 4… on one line, about `kb` long: each pairs with nothing but its twin. */
  const runLine = (kb: number) => {
    const runs: string[] = []
    for (let n = 2, size = 0; size < kb * 1024; n++, size += n + 2) runs.push('$'.repeat(n) + 'a')
    return runs.join(' ')
  }
  const CASES: Array<[string, (kb: number) => string]> = [
    ['$a$a$a… without a space', (kb) => fill('$a', kb)],
    ['one long line of prices', (kb) => fill('price $5 and more words ', kb)],
    ['one long line of formulas', (kb) => fill('$x$ ', kb)],
    ['escaped dollars on one line', (kb) => fill(R`$a \$ `, kb)],
    ['unclosed \\( along a line', (kb) => fill(R`x \( y `, kb)],
    ['unclosed \\[ along a line', (kb) => fill(R`x \[ y `, kb)],
    ['\\[ lines that never close', (kb) => fill('\\[\na\n', kb)],
    ['\\( followed by escaped closers', (kb) => fill(R`\(\\)`, kb)],
    ['unclosed $$ text lines', (kb) => fill('$$ a\n', kb)],
    ['unclosed $$ text lines in a blockquote', (kb) => fill('> $$ a\n', kb)],
    ['\\begin{align} lines that never end', (kb) => fill('\\begin{align}\n', kb)],
    ['a huge blockquote prefix, then formulas', (kb) => '>'.repeat(kb * 512) + ' ' + fill('$a$ ', kb / 2)],
    ['a huge list-marker prefix, then formulas', (kb) => fill('- ', kb / 2) + fill('$a$ ', kb / 2)],
    ['$ runs of ever longer sizes', (kb) => sizes(2, kb)],
    ['inline <!-- that never closes', (kb) => '$x$ ' + fill('a <!-- b ', kb)],
    ['prices in list items, one per line', (kb) => fill('- Gói 5$/tháng\n', kb)],
    ['prices in table rows', (kb) => '| a | b |\n|---|---|\n' + fill('| x | 5$/mo |\n', kb)],
    ['multi-line formulas without a block start', (kb) => fill('$a +\nb$ ', kb)],
    ['$$ and $$$ runs alternating over lines', (kb) => fill('a $$ b $$$ c\n', kb)],
    ['a long paragraph, one dollar per line', (kb) => fill('word 5$ and more words\n', kb)],
    // Every run's twin lies many lines below, on a line that starts a block: each run used to walk those lines again
    // (n^1.5: 246 KB took 2.1 s, 8.7 ms per KB).
    ['runs of many sizes closed far below, past a list marker', (kb) => {
      const runs = runLine(kb / 6)
      return 'x ' + runs + '\n' + fill('b\n', (kb * 2) / 3) + '- ' + runs + '\n'
    }],
    ['runs of many sizes closed far below, in a deeper blockquote', (kb) => {
      const runs = runLine(kb / 6)
      return '> x ' + runs + '\n' + fill('> b\n', (kb * 2) / 3) + '>> c ' + runs + '\n'
    }],
    // Phase 5: a regex rerun from every `<` up to a terminator that never comes (256 KB took 2.3 s, 15.5 s, 0.9 s).
    ['inline <? that never closes, one per paragraph', (kb) => '$x$\n\n' + fill('a <? b\n\n', kb)],
    ['inline <!X that never closes', (kb) => '$x$ ' + fill('a <!a b ', kb)],
    ['inline <![CDATA[ that never closes', (kb) => '$x$ ' + fill('a <![CDATA[ b ', kb)],
    // Openers in front of one closer that are all left alone, each asking about the shared content or closer again.
    ['\\( openers sharing a closer, a backtick before it', (kb) => fill(R`\( ă `, kb) + '`x` \\)'],
    ['\\( openers sharing a closer, white space before it', (kb) => fill(R`\( a `, kb / 2) + '`x`' + ' '.repeat(kb * 512) + R`\)`],
    ['\\[ openers sharing a closer, white space after it', (kb) => fill(R`\[ a `, kb / 2) + '`x` \\]' + ' '.repeat(kb * 512)],
    ['\\[ lines sharing a closer at the end of a long line', (kb) => fill('\\[\n', kb / 2) + '`x` ' + 'a'.repeat(kb * 512) + ' \\]'],
    // The scan for the next `$`, `\`, backtick or `<` ran past each skipped block to the far `$`, once per block.
    ['indented code blocks, one dollar at the end', (kb) => '$\n\n' + fill('    c\n\nb\n\n', kb) + '$']
  ]

  it.each(CASES)('%s', (_name, make) => {
    const small = make(64)
    const large = make(256)
    expect(normalizeMath(large).text.split('\n').length).toBe(large.split('\n').length)
    expect(linearFailure(small, large, 1)).toBe('')
  })
})
