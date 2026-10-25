import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../contrast'
import remarkAlerts, { ALERT_ALIASES } from '../remarkAlerts'
import remarkLlmCitations, { splitCitations } from '../remarkLlmCitations'
import remarkHighlight, { splitHighlights } from '../remarkHighlight'
import { fileNameOf } from '../rehypeCodeMeta'
import { fenceFrontMatter, prepareMarkdown } from '../prepareMarkdown'
import { render, htmlOf } from './renderHelper'

/**
 * md-render tasks 4, 5, 6 (batch M6): GitHub alerts and Obsidian callouts, LLM citation marks, `==mark==`, `mmd`,
 * front matter, code-file names. The plugins run through the whole pipeline (MarkdownView), because what matters is
 * what reaches the page; the pure helpers are also tested alone.
 */

const R = String.raw
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('alerts: GitHub kinds', () => {
  it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('> [!%s] becomes a titled alert of its own kind', (type) => {
    const root = render(`> [!${type}]\n> Body **bold** text`)
    const quote = root.querySelector('blockquote.markdown-alert')
    expect(quote).not.toBeNull()
    expect(quote!.classList.contains(`markdown-alert-${type.toLowerCase()}`)).toBe(true)
    expect(text(quote!.querySelector('.markdown-alert-title'))).toBe(type[0] + type.slice(1).toLowerCase())
    expect(quote!.querySelector('strong')?.textContent).toBe('bold')
    // The marker is gone from the text, and the blockquote keeps its source line.
    expect(root.textContent).not.toContain('[!')
    expect(quote!.getAttribute('data-line')).toBe('1')
  })

  it('is case-insensitive and takes a custom title', () => {
    const quote = render('> [!Tip] Use the *fast* path\n> body').querySelector('blockquote.markdown-alert-tip')!
    expect(quote.querySelector('.markdown-alert-title')!.innerHTML).toBe('Use the <em>fast</em> path')
    expect(text(quote)).toContain('body')
  })

  it('every alias is drawn as one of the five kinds', () => {
    const kinds = new Set(['note', 'tip', 'important', 'warning', 'caution'])
    for (const [alias, kind] of Object.entries(ALERT_ALIASES)) {
      expect(kinds.has(kind)).toBe(true)
      const quote = render(`> [!${alias}]\n> x`).querySelector('.markdown-alert')
      expect(quote?.classList.contains(`markdown-alert-${kind}`), alias).toBe(true)
    }
    expect(ALERT_ALIASES.hint).toBe('tip')
    expect(ALERT_ALIASES.faq).toBe('important')
    expect(ALERT_ALIASES.danger).toBe('caution')
    expect(ALERT_ALIASES.info).toBe('note')
  })

  it('an alias without a title shows its own name', () => {
    expect(text(render('> [!faq]\n> x').querySelector('.markdown-alert-title'))).toBe('Faq')
    expect(text(render('> [!HINT]\n> x').querySelector('.markdown-alert-title'))).toBe('Hint')
  })

  it('an unknown type, a marker that is not alone, or one not at the start stays a plain blockquote', () => {
    for (const md of ['> [!BANANA]\n> x', '> [!NOTE]x\n> y', '> text [!NOTE]\n> y', '> [! NOTE]\n> y', '[!NOTE]\nplain', '> **[!NOTE]**\n> y']) {
      const root = render(md)
      expect(root.querySelector('.markdown-alert'), md).toBeNull()
    }
  })

  it('an alert with only a marker line, or with a title and no body, still renders', () => {
    expect(render('> [!NOTE]').querySelector('.markdown-alert-note')).not.toBeNull()
    const root = render('> [!WARNING] Heads up')
    expect(text(root.querySelector('.markdown-alert-title'))).toBe('Heads up')
    expect(root.querySelectorAll('.markdown-alert > p').length).toBe(1)
  })

  it('keeps block content: lists, code, a second paragraph, nested quotes', () => {
    const root = render('> [!IMPORTANT]\n> intro\n>\n> - one\n> - two\n>\n> ```js\n> let a = 1\n> ```\n>\n> > [!TIP]\n> > nested')
    const outer = root.querySelector('.markdown-alert-important')!
    expect(outer.querySelectorAll('li').length).toBe(2)
    expect(outer.querySelector('.code-block')).not.toBeNull()
    expect(outer.querySelector('.markdown-alert-tip')).not.toBeNull()
  })

  it('works inside a list item', () => {
    const root = render('- item\n\n  > [!NOTE]\n  > inside')
    expect(root.querySelector('li .markdown-alert-note')).not.toBeNull()
  })

  it('body lines keep their source line numbers (the title does not claim one)', () => {
    const root = render('para\n\n> [!NOTE]\n> first\n> second\n\nafter')
    expect(root.querySelector('blockquote')!.getAttribute('data-line')).toBe('3')
    expect(root.querySelector('.markdown-alert-title')!.hasAttribute('data-line')).toBe(false)
    expect(root.querySelector('.markdown-alert > p:not(.markdown-alert-title)')!.getAttribute('data-line')).toBe('4')
  })
})

describe('alerts: Obsidian folding', () => {
  it('`-` folds (closed), `+` folds (open), a plain marker does not fold', () => {
    const closed = render('> [!tip]- Folded\n> hidden').querySelector('details.markdown-alert-tip')!
    expect(closed.hasAttribute('open')).toBe(false)
    expect(closed.querySelector('summary.markdown-alert-title')!.textContent).toBe('Folded')
    expect(text(closed)).toContain('hidden')
    const open = render('> [!faq]+ Open\n> shown').querySelector('details.markdown-alert-important')!
    expect(open.hasAttribute('open')).toBe(true)
    expect(render('> [!tip] Plain\n> x').querySelector('details')).toBeNull()
  })

  it('a folded callout without a title uses the type name', () => {
    expect(text(render('> [!question]-\n> a').querySelector('summary'))).toBe('Question')
  })
})

describe('alerts: injection', () => {
  it('HTML in the title or body is sanitised like any other', () => {
    const html = htmlOf('> [!NOTE] <img src=x onerror=alert(1)> <script>alert(2)</script>\n> <a href="javascript:alert(3)">x</a> <b onclick="alert(4)">b</b>')
    expect(html).not.toMatch(/onerror|onclick|<script|javascript:/i)
    expect(html).toContain('markdown-alert-note')
  })

  it('a `[!type]` the author writes inside code is not an alert', () => {
    expect(render('```\n> [!NOTE]\n> x\n```').querySelector('.markdown-alert')).toBeNull()
    expect(render('`> [!NOTE]`').querySelector('.markdown-alert')).toBeNull()
  })

  it('a runaway "title" (the whole paragraph on the marker line) is a body, not a 5 KB heading', () => {
    const long = 'word '.repeat(200)
    const root = render(`> [!NOTE] ${long}`)
    expect(text(root.querySelector('.markdown-alert-title'))).toBe('Note')
    expect(text(root.querySelector('.markdown-alert'))).toContain('word word')
  })
})

describe('alerts: stylesheet contrast (Alerts.css, both themes)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/components/Alerts.css'), 'utf8')
  const block = (selector: string) => {
    const at = css.indexOf(selector + ' {')
    expect(at, selector).toBeGreaterThanOrEqual(0)
    return css.slice(at, css.indexOf('}', at))
  }
  const value = (scope: string, name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(scope)?.[1] as string
  for (const [theme, selector] of [['light', ':root'], ['dark', ":root[data-theme='dark']"]] as const) {
    for (const kind of ['note', 'tip', 'important', 'warning', 'caution']) {
      it(`${theme} ${kind}: title and body text reach 4.5:1 on the tint, the bar 3:1 on the page`, () => {
        const scope = block(selector)
        const tint = value(scope, `alert-${kind}-bg`)
        expect(contrastRatio(value(scope, `alert-${kind}-title`), tint)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(value(scope, 'alert-body'), tint)).toBeGreaterThanOrEqual(4.5)
        const page = theme === 'light' ? '#ffffff' : '#0d1117'
        expect(contrastRatio(value(scope, `alert-${kind}-bar`), page)).toBeGreaterThanOrEqual(3)
      })
    }
    it(`${theme}: highlighted text reaches 4.5:1`, () => {
      const scope = block(selector)
      expect(contrastRatio(value(scope, 'mark-text'), value(scope, 'mark-bg'))).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('LLM citation marks', () => {
  const pieces = (value: string, hide = false) =>
    (splitCitations(value, hide) ?? [{ type: 'text', value }]).map((node) => (node.type === 'text' ? node.value : `<sup>${(node.children ?? [])[0].value}</sup>`)).join('')

  it.each([
    ['Gemini [cite: 1, 2] ends', 'Gemini<sup>[1, 2]</sup> ends'],
    ['range [cite: 3-5].', 'range<sup>[3-5]</sup>.'],
    ['one [cite:7]', 'one<sup>[7]</sup>'],
    ['ChatGPT 【4:0†source】 here', 'ChatGPT<sup>[4]</sup> here'],
    ['lines 【12†L3-L5】.', 'lines<sup>[12]</sup>.'],
    ['other ⟦1⟧ and ⟦2, 3⟧ and ⟦4†web⟧', 'other<sup>[1]</sup> and<sup>[2, 3]</sup> and<sup>[4]</sup>'],
    ['a[cite_start] b', 'a b'],
    ['a [cite_start]b', 'a b'],
    ['[cite_start]At start', 'At start'],
    ['x :contentReference[oaicite:0]{index=0} y', 'x y'],
    ['xciteturn0search1 y', 'x y']
  ])('%s → %s', (input, output) => {
    expect(pieces(input)).toBe(output)
  })

  it('leaves look-alikes alone', () => {
    for (const input of ['[cite: abc]', '[cite:]', '【注意】', '【1】', '【x†source】', '⟦ ⟧', '⟦a⟧', '[cited: 1]', 'oaicite:0', '[cite_start', 'cite_start]']) {
      expect(splitCitations(input), input).toBeNull()
    }
  })

  it('`hide` drops the numbered marks too', () => {
    expect(pieces('a [cite: 1] b 【2:0†s】', true)).toBe('a b')
  })

  it('renders as <sup class="llm-cite"> and never touches code spans, code blocks or maths', () => {
    const root = render('Fact [cite: 1, 2] and `[cite: 3]` and $a[cite: 4]$\n\n```text\n[cite_start] 【1†x】 ⟦2⟧\n```')
    expect(Array.from(root.querySelectorAll('sup.llm-cite')).map((el) => el.textContent)).toEqual(['[1, 2]'])
    expect(root.querySelector('code')!.textContent).toContain('[cite: 3]')
    expect(root.querySelector('.code-block')!.textContent).toContain('[cite_start] 【1†x】 ⟦2⟧')
    expect(root.textContent).toContain('[cite: 4]'.replace(/ /g, '')) // inside maths it is TeX text, not a citation
  })

  it('works inside headings, list items, table cells, emphasis and links', () => {
    const root = render('# Title [cite: 1]\n\n- item 【2:0†a】\n\n| a |\n|---|\n| cell [cite: 3] |\n\n*em [cite: 4]* [link ⟦5⟧](https://x.test)')
    expect(root.querySelectorAll('sup.llm-cite').length).toBe(5)
    expect(root.querySelector('h1 sup.llm-cite')).not.toBeNull()
    expect(root.querySelector('td sup.llm-cite')).not.toBeNull()
    expect(root.querySelector('a sup.llm-cite')).not.toBeNull()
  })

  it('HTML around a mark is still sanitised', () => {
    const html = htmlOf('<img src=x onerror=alert(1)> [cite: 1] <script>x</script>')
    expect(html).not.toMatch(/onerror|<script/i)
    expect(html).toContain('llm-cite')
  })
})

describe('==highlight==', () => {
  it.each([
    ['a ==hi== b', ['a ', 'MARK:hi', ' b']],
    ['==x==', ['MARK:x']],
    ['==two words== and ==more==', ['MARK:two words', ' and ', 'MARK:more']],
    ['x==y==z', ['x', 'MARK:y', 'z']]
  ])('%s', (input, expected) => {
    const nodes = splitHighlights(input)
    expect(nodes?.map((node) => (node.type === 'text' ? node.value : `MARK:${(node.children ?? [])[0].value}`))).toEqual(expected)
  })

  it.each(['== a ==', '==a', 'a==', '====', '=====x=====', '==\n==', '==a\nb==', 'a = b == c', '=x=', '=== a ==='])('%j is not a highlight', (input) => {
    expect(splitHighlights(input)).toBeNull()
  })

  it('renders <mark>, leaves code and maths alone, and the pair may not wrap other inline syntax (documented limit)', () => {
    const root = render('see ==this== and `==not==` and $a==b==c$ and ==**wrapped**==')
    expect(Array.from(root.querySelectorAll('mark')).map((el) => el.textContent)).toEqual(['this'])
    expect(root.querySelector('code')!.textContent).toBe('==not==')
    expect(root.textContent).toContain('==wrapped==')
  })

  it('works in headings and table cells; HTML <mark> still works', () => {
    const root = render('# A ==b==\n\n| x |\n|---|\n| ==c== |\n\n<mark>d</mark>')
    expect(Array.from(root.querySelectorAll('mark')).map((el) => el.textContent)).toEqual(['b', 'c', 'd'])
  })
})

describe('```mmd is Mermaid; code-file names', () => {
  it('mmd and mermaid fences both become diagrams, other languages do not', () => {
    expect(render('```mmd\ngraph TD\nA-->B\n```').querySelector('.mermaid-loading, .mermaid-diagram')).not.toBeNull()
    expect(render('```mermaid\ngraph TD\nA-->B\n```').querySelector('.mermaid-loading, .mermaid-diagram')).not.toBeNull()
    expect(render('```mmdx\nx\n```').querySelector('.mermaid-loading, .mermaid-diagram')).toBeNull()
  })

  it.each([
    ['title="main.py"', 'language-python', 'main.py'],
    ["title='src/app.js' {1,3}", 'language-js', 'src/app.js'],
    ['file=app.rs', 'language-rust', 'app.rs'],
    ['filename="a b.txt"', 'language-text', 'a b.txt'],
    ['name=x.c', 'language-c', 'x.c'],
    ['TITLE="Upper.ts"', 'language-ts', 'Upper.ts'],
    ['app.js', 'language-js', 'app.js'],
    ['app.js {2}', 'language-js', 'app.js'],
    ['', 'language-js:app.js', 'app.js'],
    [undefined, 'language-python:src/main.py', 'src/main.py'],
    ['{1,3}', 'language-js', ''],
    ['', 'language-c++', ''],
    ['', 'language-js:', ''],
    ['title=""', 'language-js', '']
  ])('meta %j on %s → %j', (meta, language, expected) => {
    expect(fileNameOf(meta, language.slice('language-'.length))).toBe(expected)
  })

  it('shows the name in the code block bar, escaped, for the three spellings', () => {
    const root = render('```python title="main.py"\nprint(1)\n```\n\n```js:app.js\nx\n```\n\n```ts title="<img src=x onerror=alert(1)>"\ny\n```')
    const names = Array.from(root.querySelectorAll('.code-block-file')).map((el) => el.textContent)
    expect(names).toEqual(['main.py', 'app.js', '<img src=x onerror=alert(1)>'])
    expect(root.querySelectorAll('.code-block-lang')[1].textContent).toBe('js')
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('[onerror]')).toBeNull()
  })

  it('a fence with an attribute-looking meta but no language still works', () => {
    expect(render('```\nplain\n```').querySelector('.code-block-file')).toBeNull()
  })
})

describe('front matter', () => {
  const FM = '---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body'

  it('becomes a closed "Front matter" block, not a rule and a heading', () => {
    const root = render(FM)
    const details = root.querySelector('details.md-front-matter')!
    expect(details).not.toBeNull()
    expect(details.hasAttribute('open')).toBe(false)
    expect(details.querySelector('summary')!.textContent).toBe('Front matter')
    expect(details.textContent).toContain('title: Hello')
    expect(root.querySelector('hr')).toBeNull()
    expect(root.querySelector('h2')).toBeNull()
    expect(root.querySelector('h1')!.getAttribute('data-line')).toBe('6')
  })

  it.each([
    ['closed by ...', '---\ntitle: x\n...\n\ntext'],
    ['CRLF', '---\r\ntitle: x\r\n---\r\n\r\ntext'],
    ['trailing spaces', '---  \ntitle: x\n---\t\n\ntext'],
    ['blank line inside', '---\ntitle: x\n\ntags: y\n---\n\ntext'],
    ['a list value first', '---\nkey:\n  - a\n---\n\ntext'],
    ['backticks inside', '---\ntitle: "```"\nnote: ````\n---\n\ntext']
  ])('%s: line count unchanged, fenced', (_name, source) => {
    const out = fenceFrontMatter(source)
    expect(out.split('\n').length).toBe(source.split('\n').length)
    expect(out).toMatch(/^`{3,}yaml front-matter/)
    expect(prepareMarkdown(source).text.split('\n').length).toBe(source.split('\n').length)
    expect(render(source).querySelector('details.md-front-matter')).not.toBeNull()
  })

  it.each([
    ['a document that starts with a rule', '---\n\nText\n\n---\n\nMore'],
    ['a rule then prose then a rule', '---\nThis is prose, not YAML\n---\n\nText'],
    ['no closing line', '---\ntitle: x\n\nno end'],
    ['not at the start', 'intro\n\n---\ntitle: x\n---\n'],
    ['only an opener', '---'],
    ['a longer dash line', '----\ntitle: x\n----'],
    ['empty front matter', '---\n---\ntext'],
    ['leading blank line', '\n---\ntitle: x\n---\n']
  ])('%s is left alone', (_name, source) => {
    expect(fenceFrontMatter(source)).toBe(source)
  })

  it('only a block that opens the document is front matter (render-by-block)', () => {
    const source = '---\ntitle: x\n---\n'
    expect(prepareMarkdown(source, true).text).not.toBe(source)
    expect(prepareMarkdown(source, false).text).toBe(source)
  })

  it('YAML cannot close the fence early', () => {
    const root = render('---\ntitle: x\nraw: ```\nmore: 1\n---\n\n# After')
    expect(root.querySelector('details.md-front-matter')!.textContent).toContain('more: 1')
    expect(root.querySelector('h1')).not.toBeNull()
  })

  it('a 256 KB document of nothing but `---` and `a: b` lines is handled in linear time', () => {
    const body = 'a: b\n'.repeat(52_000)
    const started = performance.now()
    fenceFrontMatter(`---\n${body}---\ntext`)
    fenceFrontMatter('---\na: b\n' + '---\n'.repeat(1).repeat(1) + '---\n'.repeat(50_000))
    fenceFrontMatter('---\n' + '`'.repeat(260_000) + '\n---')
    fenceFrontMatter(R`---` + '\n' + 'x'.repeat(260_000))
    expect(performance.now() - started).toBeLessThan(500 * Number(process.env.MD_PERF_SLACK ?? 1))
  })
})

describe('pathological inputs stay linear (256 KB)', () => {
  const SLACK = Number(process.env.MD_PERF_SLACK ?? 1)
  const big = (unit: string) => unit.repeat(Math.ceil(262_144 / unit.length)).slice(0, 262_144)
  const timed = (work: () => void) => {
    const started = performance.now()
    work()
    return performance.now() - started
  }
  const runPlugins = (tree: unknown) => [remarkAlerts(), remarkLlmCitations(), remarkHighlight()].forEach((plugin) => plugin(tree as never))
  const text = (value: string) => ({ type: 'text', value })
  const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children })
  /** Synthetic trees: the parser's own cost on 256 KB is its business (and slow in the test build); the plugins are measured on the tree. */
  const quotes = (count: number, value: string) => ({ type: 'root', children: Array.from({ length: count }, () => ({ type: 'blockquote', children: [paragraph(text(value))] })) })

  it.each(['[cite: ', '[cite: 1 1 1 1 ', '【1†', '⟦1 ', ':contentReference[oaicite:', 'cite', '[cite_start', '【', '⟦', '[cite:1,', '[cite: 1' + ' 1'.repeat(40), '', 'citeturn0search1'])('citations: a text of %j repeated', (unit) => {
    expect(timed(() => splitCitations(big(unit)))).toBeLessThan(400 * SLACK)
  })

  it.each(['==', '== a ', '==a', '= =', '==a=', '=', '=\n==\n', '==a' + ' b'.repeat(40) + '\n'])('highlight: a text of %j repeated', (unit) => {
    expect(timed(() => splitHighlights(big(unit)))).toBeLessThan(400 * SLACK)
  })

  it.each(['[!NOTE]\n', '[!NOTE] x\n[!tip]- y\n', '[!NOTE]\na', '[!', '[!NOTE'])('alerts: 30,000 quotes of %j', (unit) => {
    const tree = quotes(30_000, unit)
    expect(timed(() => runPlugins(tree))).toBeLessThan(800 * SLACK)
  })

  it('one 256 KB text node, as the quote\'s only paragraph, through every plugin', () => {
    const tree = { type: 'root', children: [{ type: 'blockquote', children: [paragraph(text('[!NOTE] ' + big('word [cite: 1] ==a== 【1†s】 ')))] }] }
    expect(timed(() => runPlugins(tree))).toBeLessThan(800 * SLACK)
  })

  it('many inline nodes in one paragraph (a title that never ends)', () => {
    const children = Array.from({ length: 40_000 }, (_, index) => (index % 2 ? { type: 'emphasis', children: [text('e')] } : text('t ')))
    children[0] = text('[!NOTE] start ')
    const tree = { type: 'root', children: [{ type: 'blockquote', children: [paragraph(...children)] }] }
    expect(timed(() => runPlugins(tree))).toBeLessThan(800 * SLACK)
  })

  it('nesting 200,000 deep does not overflow the plugin walks (an explicit stack, not recursion)', () => {
    let node: { type: string; children: unknown[] } = { type: 'blockquote', children: [paragraph(text('[!NOTE] x ==y== [cite: 1]'))] }
    for (let depth = 0; depth < 200_000; depth++) node = { type: depth % 2 ? 'blockquote' : 'listItem', children: [node] }
    expect(() => runPlugins({ type: 'root', children: [node] })).not.toThrow()
  })

  it('on a real parse: nested quotes 1,000 deep and a small document through the whole pipeline', () => {
    const processor = unified().use(remarkParse).use(remarkGfm)
    const tree = processor.runSync(processor.parse('>'.repeat(1000) + ' [!NOTE]\n> x ==y== [cite: 1]'))
    expect(() => runPlugins(tree)).not.toThrow()
    expect(timed(() => render('> [!NOTE]\n> x\n\n'.repeat(100)))).toBeLessThan(8000 * SLACK)
  })
})
