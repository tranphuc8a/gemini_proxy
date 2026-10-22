import { render, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import CodeBlock from '../components/CodeBlock'
import { prismLanguage } from '../lib/codeLanguages'
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

beforeAll(async () => {
  // The async-light build fetches grammars on demand; load them up front so rendering is synchronous.
  const highlighter = SyntaxHighlighter as AsyncHighlighter
  await highlighter.preload()
  for (const language of new Set(['typescript', ...BLOCKS.map((block) => prismLanguage(block.language))])) {
    await highlighter.loadLanguage(language)
  }
})

describe('CodeBlock', () => {
  it('colours tokens with classes and a per-theme stylesheet, not inline styles', async () => {
    const { container } = render(<CodeBlock language="ts" source={'const answer = 42 // the answer'} theme="light" />)
    await waitFor(() => expect(container.querySelector('span.token.keyword')).not.toBeNull())
    const tokens = Array.from(container.querySelectorAll<HTMLElement>('span.token'))
    expect(tokens.length).toBeGreaterThan(3)
    for (const token of tokens) expect(token.getAttribute('style') ?? '').not.toMatch(/color/)

    const wrapper = container.querySelector<HTMLElement>('.prismjs')!
    expect(wrapper).toHaveClass('prism-light')
    expect(wrapper.getAttribute('style') ?? '').not.toMatch(/(^|;)\s*color/)
    expect(document.head.querySelector('style[data-prism="prism-light"]')?.textContent).toContain('.prism-light .token.keyword')
  })

  it('uses a separate, contrast-adjusted sheet per reading background', async () => {
    const { container } = render(<CodeBlock language="ts" source="let x = 1" theme="dark" contrastBackground="#1d2026" />)
    await waitFor(() => expect(container.querySelector('span.token.keyword')).not.toBeNull())
    expect(container.querySelector('.prismjs')).toHaveClass('prism-dark-1d2026')
    expect(document.head.querySelector('style[data-prism="prism-dark-1d2026"]')).not.toBeNull()
  })

  it('is memoised, so an unchanged block is not highlighted again', () => {
    expect((CodeBlock as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'))
  })

  it(`highlights the ${BLOCKS.length} blocks of the 2,000-line document within 250 ms on the design machine (MD_PERF_SLACK=${PERF_SLACK})`, () => {
    expect(BLOCKS.length).toBeGreaterThanOrEqual(50)
    const renderAll = () => {
      let html = ''
      for (const block of BLOCKS) html += renderToStaticMarkup(<CodeBlock language={block.language} source={block.source} theme="light" />)
      return html
    }
    const html = renderAll()
    expect(html).toContain('class="token keyword"')
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
