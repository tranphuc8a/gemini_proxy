import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { describe, expect, it } from 'vitest'
import MarkdownView from '../components/MarkdownView'
import { sanitizeSchema } from '../lib/rehypeEnhance'
import { fenceLanguage } from '../lib/markdownPipeline'
import { prismLanguage } from '../lib/codeLanguages'
import { prepareMarkdown } from '../lib/prepareMarkdown'
import { WELCOME } from '../lib/welcome'

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

function count(root: HTMLElement) {
  const display = root.querySelectorAll('.katex-display').length
  return {
    display,
    inline: root.querySelectorAll('.katex').length - display,
    errors: root.querySelectorAll('.katex-error').length + (root.innerHTML.includes('#cc0000') ? 1 : 0)
  }
}

/** Visible text with every formula replaced by «TeX». */
function textOf(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.katex').forEach((node) => {
    const tex = node.querySelector('annotation')?.textContent ?? '?'
    node.replaceWith(document.createTextNode(`«${tex}»`))
  })
  return copy.textContent ?? ''
}

interface Vector {
  name: string
  md: string
  display: number
  inline: number
  /** Substrings the visible text must contain. */
  has?: string[]
  /** Substrings the visible text must not contain. */
  hasNot?: string[]
  /** Extra checks on the rendered DOM. */
  check?: (root: HTMLElement) => void
}

const R = String.raw

const VECTORS: Vector[] = [
  { name: '$…$ inline', md: 'Euler $e^{i\\pi}+1=0$ ok', display: 0, inline: 1 },
  { name: '$$ block', md: '$$\nx^2 + y^2 = z^2\n$$', display: 1, inline: 0 },
  { name: '$$x$$ alone on its line (Gemini) → block', md: R`$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$`, display: 1, inline: 0 },
  { name: '$$ x $$ alone with spaces → block', md: '$$ x^2 + y^2 = z^2 $$', display: 1, inline: 0 },
  {
    name: '"$$ x^2 +" then "y^2 = z^2 $$" → one block, nothing lost',
    md: '$$ x^2 +\ny^2 = z^2 $$\n\nafter',
    display: 1,
    inline: 0,
    check: (root) => {
      expect(root.querySelector('annotation')?.textContent).toContain('y^2 = z^2')
      expect(root.querySelector('p[data-line="4"]')?.textContent).toBe('after')
    }
  },
  { name: '$$ block inside a paragraph', md: 'Text before\n$$\nE = mc^2\n$$\ntext after', display: 1, inline: 0, has: ['Text before', 'text after'] },
  { name: '\\[ \\] on lines of their own (ChatGPT)', md: '\\[\nE = mc^2\n\\]', display: 1, inline: 0, hasNot: ['[', ']'] },
  { name: '\\[ \\] on one line', md: R`\[ E = mc^2 \]`, display: 1, inline: 0, hasNot: ['['] },
  { name: '\\( \\) inline (ChatGPT)', md: R`Energy \( E = mc^2 \) here`, display: 0, inline: 1, has: ['Energy «E = mc^2» here'] },
  {
    name: '\\( \\) keeps _ and * as maths',
    md: R`Let \( x_1 * x_2 = a_i * b_j * c \) hold`,
    display: 0,
    inline: 1,
    check: (root) => expect(root.querySelector('em')).toBeNull()
  },
  {
    name: '\\[ aligned \\] keeps its \\\\ line breaks',
    md: '\\[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n\\]',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('annotation')?.textContent).toContain('a &= b \\\\')
  },
  {
    name: 'bare \\begin{align} keeps its \\\\',
    md: '\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('annotation')?.textContent).toContain('a &= b \\\\')
  },
  { name: 'bare equation with \\tag', md: '\\begin{equation}\nE = mc^2 \\tag{1}\n\\end{equation}', display: 1, inline: 0 },
  { name: 'bare pmatrix on one line', md: R`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`, display: 1, inline: 0 },
  { name: 'bare cases', md: R`\begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}`, display: 1, inline: 0 },
  {
    name: 'bare align with lines starting + and - stays one formula',
    md: '\\begin{align}\nf(x) &= x^2\n+ 2x \\\\\n- 3 &= 0\n\\end{align}',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('ul, li')).toBeNull()
  },
  { name: '```math fence', md: '```math\n\\frac{a}{b}\n```', display: 1, inline: 0 },
  { name: '$$ \\begin{align} $$ (Gemini)', md: '$$\n\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}\n$$', display: 1, inline: 0 },
  { name: '\\boxed and \\tag', md: '$$\n\\boxed{x = 2} \\tag{2}\n$$', display: 1, inline: 0 },
  { name: 'mhchem \\ce and \\pu', md: R`$\ce{H2O}$ and $\pu{123 kJ}$`, display: 0, inline: 2 },
  { name: 'mhchem inside \\( \\)', md: R`\(\ce{H2O + CO2 -> H2CO3}\)`, display: 0, inline: 1 },
  { name: 'prices $5 and $10 are not maths', md: 'It costs $5 and $10 total', display: 0, inline: 0, has: ['It costs $5 and $10 total'] },
  { name: 'a price before real maths', md: 'Pay $5 for $x$ items', display: 0, inline: 1, has: ['Pay $5 for «x» items'] },
  { name: 'plan prices', md: 'Plus costs $20/month and Pro $200/month.', display: 0, inline: 0, has: ['$20/month and Pro $200/month.'] },
  { name: 'price range', md: 'between $5-$10 each', display: 0, inline: 0, has: ['between $5-$10 each'] },
  { name: 'escaped dollar stays a dollar', md: 'Literal \\$5 and $y$', display: 0, inline: 1, has: ['Literal $5 and «y»'] },
  { name: '$ x $ with inner spaces is text (pandoc)', md: '$ x $', display: 0, inline: 0, has: ['$ x $'] },
  { name: '$$…$$ mid-sentence stays inline', md: 'The area is $$A = \\pi r^2$$ for a circle.', display: 0, inline: 1 },
  {
    name: '\\[ \\] inside a blockquote',
    md: '> \\[\n> a^2\n> \\]',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('blockquote .katex-display')).not.toBeNull()
  },
  {
    name: '\\[ \\] inside a list item',
    md: '- item\n  \\[\n  a^2\n  \\]\n- next',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelectorAll('li')).toHaveLength(2)
  },
  { name: '\\( \\) in a table cell', md: '| a | b |\n|---|---|\n| \\(x^2\\) | $y$ |', display: 0, inline: 2 },
  { name: '\\\\[ (copied from JSON) is text', md: R`\\[ x^2 \\]`, display: 0, inline: 0, has: ['\\[ x^2 \\]'] },
  { name: 'escaped brackets of a link-like text', md: R`See [docs](http://a.b) and \[not math]`, display: 0, inline: 0, has: ['[not math]'] },
  { name: '\\[Enter\\] mid-sentence is text', md: R`Press \[Enter\] to continue`, display: 0, inline: 0, has: ['Press [Enter] to continue'] },
  {
    name: 'code span untouched',
    md: 'Use `\\(x\\)` literally',
    display: 0,
    inline: 0,
    check: (root) => expect(root.querySelector('code')?.textContent).toBe('\\(x\\)')
  },
  { name: 'fenced code untouched', md: '```\n\\[ x \\] costs $5 and $10\n```', display: 0, inline: 0, has: ['\\[ x \\] costs $5 and $10'] },
  {
    name: '\\label, \\tag and \\eqref',
    md: '\\[\nx = 1 \\label{eq:a} \\tag{1}\n\\]\nSee \\(\\eqref{eq:a}\\).',
    display: 1,
    inline: 1,
    check: (root) => expect(Array.from(root.querySelectorAll('.katex-html')).pop()?.textContent).toContain('(eq:a)')
  },
  { name: '\\ref', md: R`Equation \(\ref{eq:a}\) holds`, display: 0, inline: 1 },
  { name: '\\require (MathJax) is dropped', md: R`$$\require{cancel}\cancel{x}$$`, display: 1, inline: 0 },
  { name: 'multline → gather', md: '\\begin{multline}\na + b \\\\\nc\n\\end{multline}', display: 1, inline: 0 },
  { name: 'eqnarray → align', md: '\\begin{eqnarray}\na &=& b\n\\end{eqnarray}', display: 1, inline: 0 },
  { name: 'flalign → align', md: '$$\n\\begin{flalign}\na &= b\n\\end{flalign}\n$$', display: 1, inline: 0 },
  {
    name: '\\[ \\] mid-sentence renders in display style',
    md: R`So \[ a^2 \] is display`,
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('p .katex-display')).not.toBeNull()
  },
  { name: 'escaped dollar inside \\( \\)', md: R`Price \(\$5\) ok`, display: 0, inline: 1 },
  { name: 'escaped dollar inside $…$', md: R`$\$5$ ok`, display: 0, inline: 1 },
  { name: '\\( \\) at the start of a line', md: R`\(f\) is continuous`, display: 0, inline: 1 },
  { name: 'inline HTML inside maths stays maths', md: '$a <b c>d$ and $y$', display: 0, inline: 2 },
  {
    name: 'dollar in a link address',
    md: '[buy](http://x.test/?p=$5) and $z$',
    display: 0,
    inline: 1,
    check: (root) => expect(root.querySelector('a')?.getAttribute('href')).toBe('http://x.test/?p=$5')
  },
  { name: 'maths in a heading', md: '## Energy $E=mc^2$', display: 0, inline: 1 },
  {
    name: 'inline, block and dollar maths in one paragraph',
    md: 'Inline \\(a\\), display\n\\[\nb\n\\]\nand $c$',
    display: 1,
    inline: 2
  },
  {
    name: '\\[ \\] in <details> after a blank line',
    md: '<details>\n<summary>Proof</summary>\n\n\\[\nx^2\n\\]\n\n</details>',
    display: 1,
    inline: 0
  },
  { name: '"Text $$" … "$$" across lines', md: 'Text $$\nx\n$$', display: 0, inline: 1 },
  {
    name: 'a ChatGPT answer',
    md: [
      'The quadratic formula gives the roots of \\(ax^2 + bx + c = 0\\):',
      '',
      '\\[',
      'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      '\\]',
      '',
      'For example, if the course costs $49 and the book $15, the total is $64.',
      '',
      '1. Compute the discriminant \\( \\Delta = b^2 - 4ac \\).',
      '2. If \\( \\Delta < 0 \\), there are no real roots.'
    ].join('\n'),
    display: 1,
    inline: 3,
    has: ['costs $49 and the book $15, the total is $64.']
  },
  {
    name: 'a Gemini answer',
    md: ['Phương trình Schrödinger:', '', '$$i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat H \\Psi$$', '', 'với $\\hbar = h / 2\\pi$.'].join('\n'),
    display: 1,
    inline: 1
  }
]

describe('MarkdownView: maths as LLMs write it', () => {
  it('has at least 40 vectors', () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(40)
  })

  it.each(VECTORS)('$name', ({ md, display, inline, has, hasNot, check }) => {
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

describe('MarkdownView: source line anchors around maths', () => {
  it('keeps every block after a converted formula on its own source line', () => {
    const root = render('# T\n\n\\[\na\n\\]\n\n## After\n\nText \\(x\\) here\n\n\\begin{align}\nb\n\\end{align}\n\nLast')
    expect(root.querySelector('h2')?.getAttribute('data-line')).toBe('7')
    expect(root.querySelector('p')?.getAttribute('data-line')).toBe('9')
    expect(Array.from(root.querySelectorAll('.math-block')).map((node) => node.getAttribute('data-line'))).toEqual(['3', '11'])
    expect(Array.from(root.querySelectorAll('p')).pop()?.getAttribute('data-line')).toBe('15')
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
