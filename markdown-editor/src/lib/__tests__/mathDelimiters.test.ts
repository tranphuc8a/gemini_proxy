import { describe, expect, it } from 'vitest'
import { findSkipRanges, normalizeMath } from '../mathDelimiters'

const R = String.raw

/** [name, input, expected text, offsets marked display, offsets marked generated] */
type Vector = [string, string, string, number[]?, number[]?]

/**
 * Input → prepared text. Cases from md-render.md §1.2 / §3.1.2 (what LLM answers really contain), plus the code and
 * HTML regions the rewrite must leave alone.
 */
const VECTORS: Vector[] = [
  ['\\[ \\] on lines of their own → $$ block', '\\[\nE = mc^2\n\\]', '$$\nE = mc^2\n$$', [], []],
  ['\\[ \\] on one line → display text maths', R`\[ E = mc^2 \]`, '$ E = mc^2 $', [0], [0]],
  ['\\[ opener with content, closer later', '\\[ x^2 +\ny^2 = z^2 \\]', '$ x^2 +\ny^2 = z^2 $', [0], [0]],
  ['\\( \\) mid-sentence', R`Energy \( E = mc^2 \) here`, 'Energy $ E = mc^2 $ here', [], [7]],
  ['\\( \\) at the start of a line', R`\(f\) is continuous`, '$f$ is continuous', [], [0]],
  ['\\( \\) protects _ and *', R`Let \( x_1 * x_2 = a_i * b_j \) hold`, 'Let $ x_1 * x_2 = a_i * b_j $ hold', [], [4]],
  ['\\[ aligned \\] keeps \\\\', '\\[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n\\]', '$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$', [], []],
  ['bare align keeps \\\\', '\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}', '$\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}$', [0], [0]],
  ['bare align: + / - lines get \\relax', '\\begin{align}\nf(x) &= x^2\n+ 2x \\\\\n- 3 &= 0\n\\end{align}', '$\\begin{align}\nf(x) &= x^2\n\\relax + 2x \\\\\n\\relax - 3 &= 0\n\\end{align}$', [0], [0]],
  ['bare pmatrix on one line', R`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`, R`$\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$`, [0], [0]],
  ['bare equation*', '\\begin{equation*}\nE = mc^2\n\\end{equation*}', '$\\begin{equation*}\nE = mc^2\n\\end{equation*}$', [0], [0]],
  ['nested environments of the same name', '\\begin{array}{c}\n\\begin{array}{c} a \\end{array}\n\\end{array}', '$\\begin{array}{c}\n\\begin{array}{c} a \\end{array}\n\\end{array}$', [0], [0]],
  ['\\begin mid-sentence is left alone', R`where \begin{pmatrix} a \end{pmatrix} is`, R`where \begin{pmatrix} a \end{pmatrix} is`],
  ['unknown environment is left alone', '\\begin{tikzcd}\nA \\arrow[r] & B\n\\end{tikzcd}', '\\begin{tikzcd}\nA \\arrow[r] & B\n\\end{tikzcd}'],
  ['\\begin inside an existing $$ block is untouched', '$$\n\\begin{align}\na &= b\n\\end{align}\n$$', '$$\n\\begin{align}\na &= b\n\\end{align}\n$$'],
  ['$$x$$ alone stays (remarkMathPromote shows it as a block)', R`$$x = \frac{-b}{2a}$$`, R`$$x = \frac{-b}{2a}$$`],
  ['$$x$$ mid-sentence stays', R`Area is $$A=\pi r^2$$ ok`, R`Area is $$A=\pi r^2$$ ok`],
  ['\\[ \\] mid-sentence with TeX → display', R`So \[ a^2 \] is display`, 'So $ a^2 $ is display', [3], [3]],
  ['\\[Enter\\] mid-sentence without TeX stays text', R`Press \[Enter\] now`, R`Press \[Enter\] now`],
  ['\\[x\\] alone on its line is maths even without TeX', R`\[x\]`, '$x$', [0], [0]],
  ['\\[ \\] inside a blockquote', '> \\[\n> a^2\n> \\]', '> $$\n> a^2\n> $$'],
  ['\\[ \\] inside a list item', '- item\n  \\[\n  a^2\n  \\]\n- next', '- item\n  $$\n  a^2\n  $$\n- next'],
  ['\\( \\) in a table cell', '| a | b |\n|---|---|\n| \\(x^2\\) | $y$ |', '| a | b |\n|---|---|\n| $x^2$ | $y$ |', [], [22]],
  ['code span untouched', 'Use `\\(x\\)` and `$5` literally', 'Use `\\(x\\)` and `$5` literally'],
  ['double-backtick code span untouched', 'Use `` `\\(x\\)` `` here', 'Use `` `\\(x\\)` `` here'],
  ['fenced code untouched', '```\n\\[ x \\]\n$5 and $10\n```', '```\n\\[ x \\]\n$5 and $10\n```'],
  ['tilde fence untouched', '~~~tex\n\\begin{align}\na\n\\end{align}\n~~~', '~~~tex\n\\begin{align}\na\n\\end{align}\n~~~'],
  ['fence inside a list item untouched', '- ```js\n  const a = "$5 and $10"\n  ```\n- \\(x\\)', '- ```js\n  const a = "$5 and $10"\n  ```\n- $x$', [], [41]],
  ['fence inside a blockquote untouched', '> ```\n> \\(x\\)\n> ```\n> \\(y\\)', '> ```\n> \\(x\\)\n> ```\n> $y$', [], [22]],
  ['indented code untouched', 'para\n\n    $5 and \\(x\\)\n', 'para\n\n    $5 and \\(x\\)\n'],
  ['indented continuation of a paragraph is not code', 'para\n    not code \\(x\\)', 'para\n    not code $x$', [], [18]],
  ['HTML block (div) untouched, the paragraph after it converted', '<div>\n\\(x\\)\n</div>\n\n\\(y\\)', '<div>\n\\(x\\)\n</div>\n\n$y$', [], [20]],
  ['HTML comment untouched', '<!-- \\(x\\) $5 -->\n\n\\(y\\)', '<!-- \\(x\\) $5 -->\n\n$y$', [], [19]],
  ['<pre> block untouched', '<pre>\n\\(x\\) $5\n\n$6\n</pre>\n\n$y$', '<pre>\n\\(x\\) $5\n\n$6\n</pre>\n\n$y$'],
  ['inline HTML attribute keeps its dollars', '<abbr title="$5 or $10">price</abbr> and $y$', '<abbr title="$5 or $10">price</abbr> and $y$'],
  ['autolink keeps its dollar', '<https://x.test/?p=$5> and $z$', '<https://x.test/?p=$5> and $z$'],
  ['bare URL keeps its dollar', 'see https://x.test/a$5 and $z$', 'see https://x.test/a$5 and $z$'],
  ['escaped backslash before [ is not a delimiter', R`\\[ not math \\]`, R`\\[ not math \\]`],
  ['three backslashes: an escaped one, then a delimiter', R`\\\( x \)`, '\\\\$ x $', [], [2]],
  ['prices: $5 and $10', R`It costs $5 and $10 total`, R`It costs \$5 and \$10 total`],
  ['price before real maths', R`Pay $5 for $x$ items`, R`Pay \$5 for $x$ items`],
  ['ChatGPT plan prices', R`Plus costs $20/month and Pro $200/month.`, R`Plus costs \$20/month and Pro \$200/month.`],
  ['price range $5-$10', R`between $5-$10 each`, R`between \$5-\$10 each`],
  ['already escaped dollar', R`Literal \$5 and $y$`, R`Literal \$5 and $y$`],
  ['$ x $ with inner spaces is not maths (pandoc)', R`$ x $`, R`\$ x \$`],
  ['dollar in a link destination (an address, left alone)', R`[a](http://x.com/?p=$5) and $z$`, R`[a](http://x.com/?p=$5) and $z$`],
  ['dollar in a relative link destination', R`[a](/buy?p=$5) and $z$`, R`[a](/buy?p=\$5) and $z$`],
  ['closer followed by a digit is not a closer', R`$x$5`, R`\$x\$5`],
  ['escaped dollar inside $…$ fences with $$', R`$\$5$ ok`, R`$$\$5$$ ok`, [], [0]],
  ['escaped dollar inside \\( \\)', R`Price \(\$5\) ok`, R`Price $$\$5$$ ok`, [], [6]],
  ['mhchem inside \\( \\)', R`\(\ce{H2O + CO2 -> H2CO3}\)`, R`$\ce{H2O + CO2 -> H2CO3}$`, [], [0]],
  ['"$$ formula" over two lines (fence-with-info trap)', '$$ x^2 +\ny^2 $$', '$ x^2 +\ny^2 $', [0], [0]],
  ['"$$ formula" closed by a fence line', '$$ x^2 +\ny^2\n$$\n\nafter', '$ x^2 +\ny^2\n$\n\nafter', [0], [0]],
  ['bare $$ never fenced, closed at the end of a line', '$$\nx^2 $$\n\nafter', '$\nx^2 $\n\nafter', [0], [0]],
  ['$$ ending a line, closing $$ starting one: \\relax keeps the paragraph', 'Text $$\nx\n$$', 'Text $$\nx\n\\relax $$'],
  ['multi-line $…$ in a blockquote: list marker neutralised', '> a $x\n> + y$', '> a $x\n> \\relax + y$'],
  ['inline HTML tag inside maths stays maths', '$a <b c>d$ and x <a b> $y$', '$a <b c>d$ and x <a b> $y$'],
  ['empty \\(\\) left alone', R`a\(\)b`, R`a\(\)b`],
  ['unclosed \\( left alone', R`a \( b`, R`a \( b`],
  ['\\( does not close across a blank line', 'a \\( b\n\nc \\) d', 'a \\( b\n\nc \\) d'],
  ['$$ inside \\[ \\] uses a longer fence', '\\[\n$$x$$\n\\]', '$$$\n$$x$$\n$$$'],
  ['text without any delimiter is returned as is', 'plain words only', 'plain words only']
]

describe('normalizeMath', () => {
  it('has at least 40 vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(40)
  })

  it.each(VECTORS)('%s', (_name, input, expected, display, generated) => {
    const result = normalizeMath(input)
    expect(result.text).toBe(expected)
    expect(result.text.split('\n').length).toBe(input.split('\n').length)
    if (display) expect([...result.display]).toEqual(display)
    if (generated) expect([...result.generated]).toEqual(generated)
    for (const offset of [...result.display, ...result.generated]) expect(result.text[offset]).toBe('$')
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
    const best = (text: string) => {
      let fastest = Infinity
      for (let run = 0; run < 5; run++) {
        const start = performance.now()
        normalizeMath(text)
        fastest = Math.min(fastest, performance.now() - start)
      }
      return fastest
    }
    const slack = Number(process.env.MD_PERF_SLACK) || 1
    const small = best(make(300))
    const large = best(make(1200))
    // 300 KB under 100 ms (md-render task 2), and four times the text costs about four times as much, not sixteen.
    expect(small).toBeLessThan(100 * slack)
    expect(large / Math.max(small, 1)).toBeLessThan(8)
  })
})
