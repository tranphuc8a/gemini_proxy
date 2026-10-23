import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { describe, expect, it } from 'vitest'
import MarkdownView from '../components/MarkdownView'
import { sanitizeSchema } from '../lib/rehypeEnhance'
import { fenceLanguage } from '../lib/markdownPipeline'
import { prismLanguage } from '../lib/codeLanguages'
import { prepareMarkdown } from '../lib/prepareMarkdown'
import { WELCOME } from '../lib/welcome'
import { RENDER_VECTORS, STREAM_ANSWERS, countMaths, openDelimiterAt, streamCuts, textOf } from '../lib/__tests__/mathVectors'

/**
 * The whole pipeline, rendered the way the preview renders it (MarkdownView → static HTML), on maths as Gemini,
 * ChatGPT and Claude write it (md-render.md §1.2, §3.1). Every vector: no KaTeX error, the right number of display and
 * inline formulas, the same number of lines after preparation.
 */
function render(md: string): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = renderToStaticMarkup(<MarkdownView source={md} theme="light" />)
  return div
}

const count = countMaths
const R = String.raw

// The vectors (and `countMaths`/`textOf`) are shared with gemini-chat: ../lib/__tests__/mathVectors.ts.
describe('MarkdownView: maths as LLMs write it', () => {
  it('has at least 40 vectors', () => {
    expect(RENDER_VECTORS.length).toBeGreaterThanOrEqual(40)
  })

  it.each(RENDER_VECTORS)('$name', ({ md, display, inline, has, hasNot, check }) => {
    const root = render(md)
    expect(count(root)).toEqual({ display, inline, errors: 0 })
    const text = textOf(root)
    for (const part of has ?? []) expect(text).toContain(part)
    for (const part of hasNot ?? []) expect(text).not.toContain(part)
    check?.(root)
    expect(prepareMarkdown(md).text.split('\n').length).toBe(md.split('\n').length)
  })

  it('shows a KaTeX error for TeX it really cannot render (the counter above is not blind)', () => {
    expect(count(render(R`$\unknownmacro{x}$`)).errors).toBeGreaterThan(0)
  })

  it('renders the welcome document with display maths, a bare align, mhchem, and no error', () => {
    const root = render(WELCOME)
    const counts = count(root)
    expect(counts.errors).toBe(0)
    expect(counts.display).toBe(2)
    expect(counts.inline).toBe(3)
    expect(textOf(root)).toContain('Prices stay prices: $5 and $10.')
  })
})

describe('MarkdownView: an answer as it streams in (the same answers gemini-chat checks)', () => {
  it.each(STREAM_ANSWERS)('$name', ({ md, display, inline }) => {
    expect(count(render(md))).toEqual({ display, inline, errors: 0 })
    const before = new Map<number, ReturnType<typeof count>>()
    for (const cut of streamCuts(md)) {
      const prefix = md.slice(0, cut)
      const counts = count(render(prefix))
      expect(counts.errors, JSON.stringify(prefix)).toBe(0)
      const at = openDelimiterAt(prefix)
      if (at === -1) continue
      if (!before.has(at)) before.set(at, count(render(prefix.slice(0, at))))
      // An open \[ or \( is still text: it adds no formula and swallows none of what came before.
      expect(counts, JSON.stringify(prefix)).toEqual(before.get(at))
    }
  }, 60_000)
})

describe('prepareMarkdown keeps the blocks of the author text', () => {
  /** The block elements Markdown alone makes of a text (raw HTML stays escaped text here, so it never counts). */
  const blocks = (md: string) =>
    (renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{md}</ReactMarkdown>).match(/<(?:li|tr|h[1-6]|blockquote|pre|table|hr|ul|ol)[ >]/g) ?? []).join('')

  it('never loses or adds a list item, table row, heading, quote or code block (randomised, author maths only)', () => {
    // Lines of prices and formulas behind block syntax. No \( \[ \begin: formulas written there on purpose may run over
    // a line that would start a block (that is what `\relax` is for).
    const prefixes = ['', '', '- ', '* ', '+ ', '1. ', '2) ', '  ', '# ', '## ', '> ', '> - ', '>> ', '| ', '    ', '\t', '    >>> ', '<details>', '<pre>', '```', '===', '---', '|---|---|', '- <p>']
    // `$$` words exercise the author's `$$…$$` across lines, and its closer at the start of a line (`\relax $$`).
    const words = ['5$/tháng', '10$.', '2$/lần', '$x$', '$5', '$a +', 'b$', '$', 'a', 'b c', '|', 'x_1', '\\$', '`', 'é', '<b>', '$$', '$$ a', 'x $$', '$$$']
    let seed = 2026
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]
    let compared = 0
    for (let round = 0; round < 400; round++) {
      const lines: string[] = []
      const count = 2 + Math.floor(random() * 5)
      for (let n = 0; n < count; n++) {
        let line = pick(prefixes)
        const length = Math.floor(random() * 4)
        for (let k = 0; k < length; k++) line += (k ? ' ' : '') + pick(words)
        lines.push(line)
        if (random() < 0.1) lines.push('')
      }
      const md = lines.join(random() < 0.2 ? '\r\n' : '\n')
      const prepared = prepareMarkdown(md)
      // A `$$ text` line closing later is rewritten on purpose (generated), so is a closing `$$` that would open a fence.
      if (prepared.generated.size || prepared.text.includes('\\relax $$')) continue
      compared++
      expect(blocks(prepared.text), JSON.stringify(md)).toBe(blocks(md))
    }
    expect(compared).toBeGreaterThan(350)
  })
})

describe('MarkdownView: source line anchors around maths', () => {
  it('keeps every block after a converted formula on its own source line', () => {
    const root = render('# T\n\n\\[\na\n\\]\n\n## After\n\nText \\(x\\) here\n\n\\begin{align}\nb\n\\end{align}\n\nLast')
    expect(root.querySelector('h2')?.getAttribute('data-line')).toBe('7')
    expect(root.querySelector('p')?.getAttribute('data-line')).toBe('9')
    expect(Array.from(root.querySelectorAll('.math-block')).map((node) => node.getAttribute('data-line'))).toEqual(['3', '11'])
    expect(Array.from(root.querySelectorAll('p')).pop()?.getAttribute('data-line')).toBe('15')
  })

  it('the paragraph after a "$$ x^2 +" … "$$" formula keeps its source line', () => {
    expect(render('$$ x^2 +\ny^2 = z^2 $$\n\nafter').querySelector('p[data-line="4"]')?.textContent).toBe('after')
  })

  it('wraps every maths block in div.math-block[data-line] (KaTeX replaces the <pre> that had it)', () => {
    const root = render('intro\n\n$$\nx\n$$\n\n$$y$$\n\n```math\nz\n```\n\ntail')
    const blocks = Array.from(root.querySelectorAll('div.math-block'))
    expect(blocks.map((node) => node.getAttribute('data-line'))).toEqual(['3', '7', '9'])
    for (const block of blocks) expect(block.querySelector('.katex-display')).not.toBeNull()
    expect(root.querySelector('pre')).toBeNull()
  })

  it('a promoted formula inside a list item keeps the item', () => {
    const root = render('- $$x$$\n- two')
    expect(root.querySelectorAll('li')).toHaveLength(2)
    expect(root.querySelector('li .math-block .katex-display')).not.toBeNull()
  })
})

describe('sanitizer schema', () => {
  const sanitize = (html: string) =>
    renderToStaticMarkup(
      <ReactMarkdown rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}>{html}</ReactMarkdown>
    )

  it('keeps language-*, math-inline and math-display on <code>, drops other classes there', () => {
    const out = sanitize('<code class="language-math math-display evil">x</code> <code class="math-inline">y</code>')
    expect(out).toContain('class="language-math math-display"')
    expect(out).toContain('class="math-inline"')
    expect(out).not.toContain('evil')
  })

  it('keeps the math-block class on a div (its data-line, set by rehypeEnhance, is checked through the full pipeline above)', () => {
    expect(sanitize('<div class="math-block">x</div>')).toContain('<div class="math-block">')
  })
})

describe('code fences', () => {
  it('```c++ keeps its whole name (it used to be cut to "c", so the c++ → cpp alias never applied)', () => {
    expect(render('```c++\nint main() { return 0; }\n```').querySelector('.code-block-lang')?.textContent).toBe('c++')
    expect(fenceLanguage('language-c++')).toBe('c++')
    expect(prismLanguage(fenceLanguage('language-c++'))).toBe('cpp')
  })

  it('```js:app.js still highlights as js; maths classes do not count as a language', () => {
    expect(render('```js:app.js\nconst a = 1\n```').querySelector('.code-block-lang')?.textContent).toBe('js')
    expect(fenceLanguage('language-math math-display')).toBe('math')
    expect(fenceLanguage(undefined)).toBe('')
  })
})
