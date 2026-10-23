import { render, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import CodeBlock from '../components/CodeBlock'
import MarkdownView from '../components/MarkdownView'
import { prismLanguage } from '../lib/codeLanguages'
import { withContrast } from '../lib/contrast'
import { PrismSheet, TOKEN_RULE_PREFIX } from '../lib/prismCss'
import { longDoc } from '../test/longDoc'

/** Every fenced code block of the generated 2,000-line document, minus the diagrams. */
function codeBlocksOf(markdown: string): { language: string; source: string }[] {
  const blocks: { language: string; source: string }[] = []
  const fence = /^```(\w+)\n([\s\S]*?)\n```$/gm
  let match: RegExpExecArray | null
  while ((match = fence.exec(markdown)) !== null) {
    if (match[1] !== 'mermaid') blocks.push({ language: match[1], source: match[2] })
  }
  return blocks
}

const BLOCKS = codeBlocksOf(longDoc('doc-2k'))

/**
 * Code whose grammars nest tokens (the leaf then carries several classes, and
 * which one wins decides the colour): markup and JSX attributes, shell
 * builtins, C/C++ directives, CSS inside HTML, PHP, Markdown and more.
 */
const NESTED_SAMPLES: { language: string; source: string }[] = [
  { language: 'html', source: '<!DOCTYPE html>\n<div class="box" id=\'main\' data-x=1><a href="/x?a=1&amp;b=2">link</a><br/></div>\n<style>.a { color: red; }</style>\n<script>const x = 1; if (x) { alert("hi") }</script>\n<!-- comment -->' },
  { language: 'xml', source: '<?xml version="1.0" encoding="UTF-8"?>\n<root xmlns:x="urn:x"><x:item key="a">text &lt; more</x:item><![CDATA[ raw ]]></root>' },
  { language: 'bash', source: 'echo "hi $HOME"; cd /tmp && export X=1\ntest -f a && printf \'%s\' b\nfor f in *.md; do wc -l "$f"; done # count\nfunction go() { local y=$((1 + 2)); return 0; }' },
  { language: 'jsx', source: 'const A = () => <div className="a" onClick={() => go(1)}>{name}<B x={2} {...rest} /></div>\nexport default function App({ items }) { return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul> }' },
  { language: 'tsx', source: 'type P = { n: number }\nexport const C: React.FC<P> = ({ n }) => <span title={`n=${n}`}>{n as number}</span>' },
  { language: 'cpp', source: '#include <vector>\n#include "local.h"\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\ntemplate <typename T> class Box { public: T v; };\nint main() { std::vector<int> v{1, 2}; return MAX(v[0], 3); }' },
  { language: 'c', source: '#ifndef A_H\n#define A_H 1\nstatic const char *s = "x\\n";\nstruct p { int x; };\n#endif' },
  { language: 'css', source: '@media (max-width: 600px) { .a > b:hover, #id::before { color: #fff !important; content: "x"; } }\n:root { --gap: calc(1rem + 2px); }\n@import url("x.css");' },
  { language: 'php', source: '<?php\nnamespace App;\nfunction f(int $x): string { return "v=$x" . strtoupper(\'a\'); }\n$arr = [\'k\' => new \\DateTime()];\n?>\n<p><?= $arr[\'k\'] ?></p>' },
  { language: 'markdown', source: '# Title\n\nSome **bold** and _it_ with `code` and [a link](http://x.y "t").\n\n> quote\n\n- [ ] task\n\n```js\nconst a = 1\n```' },
  { language: 'python', source: '@decorator\nclass A(Base):\n    """Doc."""\n    def f(self, x: int = 1) -> str:\n        return f"{x!r:>4}" if x else None  # c' },
  { language: 'java', source: '@Override\npublic final class A<T extends B> implements C { private static int n = 0x1F; String s = "x"; }' },
  { language: 'go', source: 'package main\nimport "fmt"\nfunc main() { x := []int{1, 2}; fmt.Println(x, nil, true) }' },
  { language: 'rust', source: '#[derive(Debug)]\nstruct S<\'a> { s: &\'a str }\nfn main() { let v: Vec<u8> = vec![1]; println!("{:?}", v); }' },
  { language: 'sql', source: "SELECT a.id, COUNT(*) AS n FROM users a LEFT JOIN t ON t.u = a.id WHERE a.name LIKE 'x%' GROUP BY 1; -- c" },
  { language: 'yaml', source: 'key: value\nlist:\n  - &anchor 1\n  - *anchor\nstr: "q" # c\n? complex\n: yes' },
  { language: 'json', source: '{ "a": 1, "b": [true, null, "s"], "c": { "d": -1.5e3 } }' },
  { language: 'diff', source: '--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n-old\n+new\n unchanged' }
]

/** The same themes and backgrounds the preview and reading mode use. */
const VARIANTS: { name: string; theme: 'light' | 'dark'; background?: string }[] = [
  { name: 'preview light', theme: 'light' },
  { name: 'preview dark', theme: 'dark' },
  { name: 'reading light', theme: 'light', background: '#f3f5f7' },
  { name: 'reading sepia', theme: 'light', background: '#ede3cb' },
  { name: 'reading dark', theme: 'dark', background: '#1d2026' }
]

const PERF_SLACK = Number(process.env.MD_PERF_SLACK) || 1
/** The former inline-style rendering of these blocks on the design machine (perf-md §2.4, bench-rsh). */
const INLINE_MS_ON_DESIGN_MACHINE = 1497

function bestOf(times: number, run: () => void): number {
  run() // warm-up
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < times; i += 1) {
    const start = performance.now()
    run()
    best = Math.min(best, performance.now() - start)
  }
  return best
}

type AsyncHighlighter = typeof SyntaxHighlighter & {
  preload: () => Promise<void>
  loadLanguage: (language: string) => Promise<void>
}

/** `prop: value; …` as a map, whitespace dropped from values. */
function parseDeclarations(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of text.split(';')) {
    const at = part.indexOf(':')
    if (at > 0) out[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).replace(/\s+/g, '')
  }
  return out
}

/**
 * Inline declarations as the browser reads them: through the same CSS parser
 * as the installed rules (jsdom normalises colours and drops properties it
 * does not know, on both sides alike).
 */
function parseInline(text: string): Record<string, string> {
  const probe = document.createElement('span')
  const out: Record<string, string> = {}
  // One declaration at a time: jsdom drops a whole attribute it cannot fully read.
  for (const part of text.split(';')) {
    probe.setAttribute('style', part)
    Object.assign(out, parseDeclarations(probe.style.cssText))
  }
  return out
}

/** Every rule of the page's prism sheets, by selector. */
function installedRules(): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>()
  for (const element of Array.from(document.head.querySelectorAll<HTMLStyleElement>('style[data-prism]'))) {
    for (const entry of Array.from(element.sheet?.cssRules ?? [])) {
      const styleRule = entry as CSSStyleRule
      const body = styleRule.cssText.slice(styleRule.cssText.indexOf('{') + 1, styleRule.cssText.lastIndexOf('}'))
      rules.set(styleRule.selectorText, parseDeclarations(body))
    }
  }
  return rules
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

beforeAll(async () => {
  // The async-light build fetches grammars on demand; load them up front so rendering is synchronous.
  const highlighter = SyntaxHighlighter as AsyncHighlighter
  await highlighter.preload()
  const languages = ['typescript', ...BLOCKS.map((block) => block.language), ...NESTED_SAMPLES.map((sample) => sample.language)]
  for (const language of new Set(languages.map(prismLanguage))) await highlighter.loadLanguage(language)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CodeBlock', () => {
  it('colours tokens from a per-theme stylesheet, not inline styles', async () => {
    const { container } = render(<CodeBlock language="ts" source={'const answer = 42 // the answer'} theme="light" />)
    await waitFor(() => expect(container.querySelector('span.token.keyword')).not.toBeNull())
    const tokens = Array.from(container.querySelectorAll<HTMLElement>('span.token'))
    expect(tokens.length).toBeGreaterThan(3)
    for (const token of tokens) expect(token.getAttribute('style') ?? '').not.toMatch(/color/)
    expect(container.querySelector('span.token.keyword')!.className).toMatch(new RegExp(`^token keyword ${TOKEN_RULE_PREFIX}\\d+$`))

    const wrapper = container.querySelector<HTMLElement>('.prismjs')!
    expect(wrapper).toHaveClass('prism-light')
    expect(wrapper.getAttribute('style') ?? '').not.toMatch(/(^|;)\s*color/)
    expect(document.head.querySelector('style[data-prism="prism-light"]')).not.toBeNull()
  })

  it('uses a separate, contrast-adjusted sheet per reading background', async () => {
    const { container } = render(<CodeBlock language="ts" source="let x = 1" theme="dark" contrastBackground="#1d2026" />)
    await waitFor(() => expect(container.querySelector('span.token.keyword')).not.toBeNull())
    expect(container.querySelector('.prismjs')).toHaveClass('prism-dark-1d2026')
    expect(document.head.querySelector('style[data-prism="prism-dark-1d2026"]')).not.toBeNull()
  })

  it.each(VARIANTS)(
    'gives every token, nested ones included, exactly the style inline mode gave it ($name)',
    ({ theme, background }) => {
      const base = theme === 'dark' ? oneDark : oneLight
      const sheet = background ? withContrast(base, background) : base
      let nested = 0
      for (const { language, source } of [...NESTED_SAMPLES, ...BLOCKS]) {
        const inline = parse(renderToStaticMarkup(<SyntaxHighlighter language={prismLanguage(language)} style={sheet} PreTag="div" customStyle={{ margin: 0, background: 'transparent', padding: '14px 16px', fontSize: '0.85em' }} codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}>{source}</SyntaxHighlighter>))
        const ours = parse(renderToStaticMarkup(<CodeBlock language={language} source={source} theme={theme} contrastBackground={background} />))
        const rules = installedRules()
        const wrapper = ours.querySelector<HTMLElement>('.prismjs')!
        const scope = Array.from(wrapper.classList).find((name) => name.startsWith('prism-'))!

        // The wrapper: its rule, then what CodeBlock sets inline on top -- as inline mode merged them.
        const inlineWrapper = inline.querySelector<HTMLElement>('body > div')!
        expect({ ...rules.get(`.${scope}`), ...parseInline(wrapper.getAttribute('style') ?? '') }, `${language} wrapper`).toEqual(
          parseInline(inlineWrapper.getAttribute('style') ?? '')
        )
        expect(ours.querySelector('code')!.getAttribute('style'), `${language} code`).toBe(inline.querySelector('code')!.getAttribute('style'))

        // The same tokens, in the same order, each styled the same.
        const inlineSpans = Array.from(inline.querySelectorAll<HTMLElement>('code span'))
        const ourSpans = Array.from(ours.querySelectorAll<HTMLElement>('code span'))
        expect(ourSpans.length, `${language} tokens`).toBe(inlineSpans.length)
        expect(ourSpans.length, `${language} highlighted`).toBeGreaterThan(0)
        ourSpans.forEach((span, index) => {
          const classes = span.className.split(' ')
          const ruleClass = classes.find((name) => name.startsWith(TOKEN_RULE_PREFIX))
          if (classes.filter((name) => name !== 'token' && !name.startsWith(TOKEN_RULE_PREFIX)).length > 1) nested += 1
          expect(span.textContent).toBe(inlineSpans[index].textContent)
          expect(span.getAttribute('style'), span.className).toBeNull()
          const got = ruleClass ? rules.get(`.${scope} .${ruleClass}`) : {}
          expect(got, `${language} [${span.className}] ${JSON.stringify(span.textContent)}`).toEqual(
            parseInline(inlineSpans[index].getAttribute('style') ?? '')
          )
        })
      }
      // Many leaves carry more than one token class: the case one rule per theme key got wrong.
      expect(nested).toBeGreaterThan(100)
    },
    120_000
  )

  it('is memoised: a preview render highlights only the blocks whose code changed', () => {
    const doc = (paragraph: string, second: string) =>
      `# Doc\n\n${paragraph}\n\n\`\`\`ts\nconst a = 1 // first\n\`\`\`\n\n\`\`\`bash\n${second}\n\`\`\`\n`
    const spy = vi.spyOn(PrismSheet.prototype, 'classAttribute')
    const { rerender, container } = render(<MarkdownView source={doc('One.', 'echo one')} theme="light" />)
    expect(container.querySelectorAll('.code-block')).toHaveLength(2)
    const firstRender = spy.mock.calls.length
    expect(firstRender).toBeGreaterThan(4)

    spy.mockClear()
    rerender(<MarkdownView source={doc('One, edited.', 'echo one')} theme="light" />)
    expect(container.textContent).toContain('One, edited.')
    expect(spy).not.toHaveBeenCalled()

    rerender(<MarkdownView source={doc('One, edited.', 'echo two')} theme="light" />)
    expect(container.textContent).toContain('echo two')
    const highlighted = spy.mock.calls.map(([classes]) => classes.join(' '))
    expect(highlighted.length).toBeGreaterThan(0)
    // Only the bash block ran again: nothing from the TypeScript one.
    expect(highlighted.some((classes) => classes.includes('comment'))).toBe(false)
  })

  it(`highlights the ${BLOCKS.length} blocks of the 2,000-line document within 250 ms on the design machine (MD_PERF_SLACK=${PERF_SLACK})`, () => {
    expect(BLOCKS.length).toBeGreaterThanOrEqual(50)
    const renderAll = () => {
      let html = ''
      for (const block of BLOCKS) html += renderToStaticMarkup(<CodeBlock language={block.language} source={block.source} theme="light" />)
      return html
    }
    const html = renderAll()
    expect(html).toMatch(new RegExp(`class="token keyword ${TOKEN_RULE_PREFIX}\\d+"`))
    expect(html).not.toMatch(/<span[^>]*style="color/)

    // The former inline-style rendering, measured side by side, says how fast this machine is right now:
    // a busy or slow machine stretches the budget by the same factor, so the gate stays the design's 250 ms
    // on a machine as fast as the one it was set on, and does not fail because other jobs share the CPU.
    const inline = bestOf(2, () => {
      for (const block of BLOCKS) renderToStaticMarkup(<SyntaxHighlighter language={prismLanguage(block.language)} style={oneLight}>{block.source}</SyntaxHighlighter>)
    })
    const classes = bestOf(5, renderAll)
    const machine = Math.max(1, inline / INLINE_MS_ON_DESIGN_MACHINE)
    expect(classes, `inline ${inline.toFixed(0)} ms, classes ${classes.toFixed(0)} ms`).toBeLessThanOrEqual(250 * machine * PERF_SLACK)
    // And class mode stays several times cheaper than inline mode, whatever the machine.
    expect(classes / inline).toBeLessThan(0.3)
  }, 120_000)
})
