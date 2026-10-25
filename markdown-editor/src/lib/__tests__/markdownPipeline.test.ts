import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { describe, expect, it } from 'vitest'
import {
  KATEX_MACROS,
  PLANNED_REHYPE_ORDER,
  PLANNED_REMARK_ORDER,
  katexOptions,
  rehypePipeline,
  rehypePlugins,
  remarkPipeline,
  remarkPlugins
} from '../markdownPipeline'
import { prepareMarkdown } from '../prepareMarkdown'
import remarkMathPromote from '../remarkMathPromote'
import remarkAlerts from '../remarkAlerts'
import remarkLlmCitations from '../remarkLlmCitations'
import remarkHighlight from '../remarkHighlight'
import rehypeCodeMeta from '../rehypeCodeMeta'
import rehypeSvgImage from '../rehypeSvgImage'
import rehypeStyleGuard from '../rehypeStyleGuard'
import { rehypeEnhance, sanitizeSchema } from '../rehypeEnhance'

/** True when `items` appear in `order` in the same relative order. */
function isSubsequence(items: readonly string[], order: readonly string[]): boolean {
  let at = 0
  for (const item of items) {
    at = order.indexOf(item, at)
    if (at === -1) return false
    at++
  }
  return true
}

const prepared = prepareMarkdown('x')
const first = (entry: unknown) => (Array.isArray(entry) ? entry[0] : entry)

describe('markdownPipeline: fixed plugin order (ke-hoach §1.1)', () => {
  it('the planned order is the agreed one', () => {
    expect(PLANNED_REMARK_ORDER).toEqual(['gfm', 'math', 'mathPromote', 'alerts', 'citations', 'highlight'])
    // M6 added codeMeta in front of raw (raw drops the `data.meta` it copies); a deliberate change of the pinned order.
    expect(PLANNED_REHYPE_ORDER).toEqual(['codeMeta', 'raw', 'styleGuard', 'svgImage', 'enhance', 'sanitize', 'katex'])
  })

  it('remark: gfm → math → mathPromote → alerts → citations → highlight (all of the planned order)', () => {
    const names = remarkPipeline(prepared).map((entry) => entry.name)
    expect(names).toEqual(['gfm', 'math', 'mathPromote', 'alerts', 'citations', 'highlight'])
    expect(isSubsequence(names, PLANNED_REMARK_ORDER)).toBe(true)
  })

  it('rehype: codeMeta → raw → styleGuard → svgImage → enhance → sanitize → katex (all of the planned order)', () => {
    const names = rehypePipeline().map((entry) => entry.name)
    expect(names).toEqual(['codeMeta', 'raw', 'styleGuard', 'svgImage', 'enhance', 'sanitize', 'katex'])
    // codeMeta reads `data.meta`, which raw discards; svgImage cuts the raw SVG out of the source and must precede the sanitiser.
    expect(names.indexOf('codeMeta')).toBeLessThan(names.indexOf('raw'))
    expect(names.indexOf('svgImage')).toBeGreaterThan(names.indexOf('raw'))
    expect(names.indexOf('svgImage')).toBeLessThan(names.indexOf('sanitize'))
    expect(isSubsequence(names, PLANNED_REHYPE_ORDER)).toBe(true)
    // The guards read raw HTML and must run before the sanitiser; KaTeX's trusted markup comes last.
    expect(names.indexOf('styleGuard')).toBeGreaterThan(names.indexOf('raw'))
    expect(names.indexOf('styleGuard')).toBeLessThan(names.indexOf('sanitize'))
    expect(names.indexOf('enhance')).toBeLessThan(names.indexOf('sanitize'))
    expect(names[names.length - 1]).toBe('katex')
  })

  it('each name is the plugin it says, and the lists handed to react-markdown follow the same order', () => {
    const remark = remarkPipeline(prepared)
    const remarkList = [remarkGfm, remarkMath, remarkMathPromote, remarkAlerts, remarkLlmCitations, remarkHighlight]
    expect(remark.map((entry) => first(entry.plugin))).toEqual(remarkList)
    expect(remarkPlugins(prepared)?.map(first)).toEqual(remarkList)
    const rehype = rehypePipeline({ idPrefix: 'r-' })
    const rehypeList = [rehypeCodeMeta, rehypeRaw, rehypeStyleGuard, rehypeSvgImage, rehypeEnhance, rehypeSanitize]
    expect(rehype.slice(0, 6).map((entry) => first(entry.plugin))).toEqual(rehypeList)
    expect(rehypePlugins({ idPrefix: 'r-' })?.map(first).slice(0, 6)).toEqual(rehypeList)
    expect((rehype[4].plugin as unknown[])[1]).toEqual({ idPrefix: 'r-' })
    expect((rehype[5].plugin as unknown[])[1]).toBe(sanitizeSchema)
  })

  it('mathPromote gets what prepareMarkdown found', () => {
    const doc = prepareMarkdown('\\[ x \\]')
    const options = (remarkPipeline(doc)[2].plugin as unknown[])[1] as Record<string, unknown>
    expect(options).toEqual({ display: doc.display, generated: doc.generated, text: doc.text })
  })

  it('KaTeX gets fresh macros every time (\\gdef writes into the object it is given)', () => {
    const a = katexOptions()
    const b = katexOptions()
    expect(a.macros).not.toBe(b.macros)
    expect(a.macros).toEqual(KATEX_MACROS)
    expect(a.strict).toBe('ignore')
    expect(Object.isFrozen(KATEX_MACROS)).toBe(true)
  })
})
