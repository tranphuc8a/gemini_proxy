import { Fragment, createElement } from 'react'
import type { Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
// Registers \ce and \pu (mhchem) on the same KaTeX instance rehype-katex renders with.
import 'katex/contrib/mhchem'
// Without this stylesheet KaTeX output renders as unstyled spans.
import 'katex/dist/katex.min.css'
import { KATEX_MACROS, katexOptions } from './katexOptions'
import { classifyHref } from './share'
import { rehypeEnhance, sanitizeSchema } from './rehypeEnhance'
import rehypeStyleGuard from './rehypeStyleGuard'
import remarkMathPromote from './remarkMathPromote'
import type { PreparedMarkdown } from './prepareMarkdown'
import MermaidDiagram from '../components/MermaidDiagram'
import CodeBlock from '../components/CodeBlock'

/**
 * THE Markdown pipeline. The preview, reading mode, the Smart-format preview and the exports (which copy the
 * rendered DOM) all render through MarkdownView, which takes everything from here, so a document reads the same
 * everywhere. Later batches add plugins into the planned slots below; they never reorder them.
 *
 * Order (ke-hoach §1.1, asserted by markdownPipeline.test.ts):
 *   source → prepareMarkdown (line-preserving rewrites; see prepareMarkdown.ts)
 *   remark: gfm → math → mathPromote → alerts → citations → highlight
 *   rehype: raw → styleGuard → svgImage → enhance → sanitize → katex
 * styleGuard and svgImage read raw HTML, so they sit between `raw` and `sanitize`; `enhance` adds the classes and
 * `data-line` anchors the sanitiser keeps; KaTeX runs last because its markup is trusted and would not survive the
 * sanitiser.
 */
export const PLANNED_REMARK_ORDER = ['gfm', 'math', 'mathPromote', 'alerts', 'citations', 'highlight'] as const
export const PLANNED_REHYPE_ORDER = ['raw', 'styleGuard', 'svgImage', 'enhance', 'sanitize', 'katex'] as const

type RemarkName = (typeof PLANNED_REMARK_ORDER)[number]
type RehypeName = (typeof PLANNED_REHYPE_ORDER)[number]
type Pluggable = NonNullable<Options['remarkPlugins']>[number]

export interface NamedPlugin<Name extends string> {
  name: Name
  plugin: Pluggable
}

// KaTeX settings live in a pure module that gemini-chat shares (scripts/sync-math.mjs); re-exported for callers here.
export { KATEX_MACROS, katexOptions }

/** rehype-katex with fresh options each time a processor is built (once per render). */
function rehypeKatexFresh() {
  return rehypeKatex(katexOptions())
}

export interface PipelineOptions {
  /** Prepended to heading ids, for a second rendering of the same document on the page (reading mode, Smart format). */
  idPrefix?: string
  /** Render-by-block: headings carry `data-slug` and no id (see `rehypeEnhance`, `assignHeadingIds`). */
  blockMode?: boolean
}

/** The remark plugins, in order, for a document prepared by `prepareMarkdown`. */
export function remarkPipeline(prepared: PreparedMarkdown): NamedPlugin<RemarkName>[] {
  return [
    { name: 'gfm', plugin: remarkGfm },
    { name: 'math', plugin: remarkMath },
    { name: 'mathPromote', plugin: [remarkMathPromote, { display: prepared.display, generated: prepared.generated, text: prepared.text }] }
  ]
}

/** The rehype plugins, in order. */
export function rehypePipeline(options: PipelineOptions = {}): NamedPlugin<RehypeName>[] {
  return [
    { name: 'raw', plugin: rehypeRaw },
    { name: 'styleGuard', plugin: rehypeStyleGuard },
    { name: 'enhance', plugin: [rehypeEnhance, { idPrefix: options.idPrefix ?? '', blockMode: options.blockMode === true }] },
    { name: 'sanitize', plugin: [rehypeSanitize, sanitizeSchema] },
    { name: 'katex', plugin: rehypeKatexFresh }
  ]
}

export const remarkPlugins = (prepared: PreparedMarkdown): Options['remarkPlugins'] => remarkPipeline(prepared).map((entry) => entry.plugin)
export const rehypePlugins = (options: PipelineOptions = {}): Options['rehypePlugins'] =>
  rehypePipeline(options).map((entry) => entry.plugin) as Options['rehypePlugins']

/** The fence language of a `language-…` class: `c++` stays whole, `js:app.js` names the language before the colon. */
export function fenceLanguage(className: string | undefined): string {
  return /language-([^\s:]+)/.exec(className ?? '')?.[1] ?? ''
}

/**
 * How links behave. `app` (the editor, reading mode): as always. `shared` (a read-only link opened by anyone, md-share
 * V9): a link to another document of the owner's tree, an empty or `javascript:` target becomes plain text; images load
 * without a referrer and a relative image (there is no asset store) becomes a placeholder; task boxes are disabled.
 */
export type LinkPolicy = 'app' | 'shared'

export interface ComponentOptions {
  /** Picks the highlighter and Mermaid palettes. */
  theme: 'light' | 'dark'
  /** Background behind code blocks; when set, token colours are held to 4.5:1 against it. */
  codeBackground?: string
  /** See `LinkPolicy`; default `app`. */
  links?: LinkPolicy
}

const DEAD_LINK_TITLE = "Links to another document that isn't part of this share"

/** The element overrides react-markdown renders with. */
export function markdownComponents({ theme, codeBackground, links = 'app' }: ComponentOptions): Options['components'] {
  const shared = links === 'shared'
  return {
    a: ({ node, ...props }: any) => {
      void node
      const href = String(props.href ?? '')
      if (shared) {
        const kind = classifyHref(href)
        if (kind === 'anchor') return createElement('a', props)
        if (kind === 'external') return createElement('a', { ...props, target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' })
        const { href: _href, target: _target, rel: _rel, ...rest } = props
        void _href
        void _target
        void _rel
        return createElement('span', { ...rest, className: 'md-dead-link', title: DEAD_LINK_TITLE })
      }
      // In-document anchors must scroll the preview, not open a new tab.
      return href.startsWith('#') ? createElement('a', props) : createElement('a', { ...props, target: '_blank', rel: 'noopener noreferrer' })
    },
    img: ({ node, ...props }: any) => {
      void node
      if (shared) {
        const src = String(props.src ?? '')
        if (!/^data:image\//i.test(src) && classifyHref(src) !== 'external') {
          return createElement('span', { className: 'md-missing-image' }, `[image${props.alt ? `: ${props.alt}` : ''}]`)
        }
        return createElement('img', { ...props, loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' })
      }
      return createElement('img', { ...props, loading: 'lazy', decoding: 'async' })
    },
    input: ({ node, ...props }: any) => {
      void node
      if (shared) return createElement('input', { ...props, readOnly: true, disabled: true })
      return createElement('input', { ...props, readOnly: false, onChange: () => undefined, disabled: false })
    },
    code: ({ node, className, children, ...props }: any) => {
      void node
      const language = fenceLanguage(className)
      const code = String(children).replace(/\n$/, '')
      if (!language) return createElement('code', { className, ...props }, children)
      if (language === 'mermaid') return createElement(MermaidDiagram, { source: code, theme })
      return createElement(CodeBlock, { language, source: code, theme, contrastBackground: codeBackground })
    },
    // The highlighter brings its own wrapper, so the default <pre> would
    // nest a second scroll container around it.
    pre: ({ children }: any) => createElement(Fragment, null, children)
  }
}
