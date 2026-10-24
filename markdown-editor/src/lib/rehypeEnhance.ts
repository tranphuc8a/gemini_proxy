import { defaultSchema } from 'rehype-sanitize'
import { defaultUrlTransform } from 'react-markdown'
import { slugify } from './markdown'

/** Raster and SVG images; an <img> never runs script, whatever it holds. */
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i

/**
 * react-markdown's own URL filter, plus inline images.
 *
 * The default drops every `data:` URL, which silently broke images pasted or
 * dropped into the editor -- those are inserted as data URLs -- in the preview,
 * the exports and reading mode alike. Only an <img> source is let through.
 */
export function markdownUrlTransform(url: string, key: string, node: Readonly<{ tagName: string }>): string {
  if (key === 'src' && node.tagName === 'img' && DATA_IMAGE.test(url)) return url
  return defaultUrlTransform(url)
}

/** Minimal structural view of a hast tree; avoids a hard dep on @types/hast. */
interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
  position?: { start?: { line?: number } }
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'hr',
  'img',
  'details',
  'section',
  'figure'
])

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

function hasClass(node: HastNode | undefined, name: string): boolean {
  const value = node?.properties?.className
  return Array.isArray(value) ? value.includes(name) : typeof value === 'string' && value.split(/\s+/).includes(name)
}

/** `<pre><code class="language-math">` -- a `$$` block, a ```` ```math ```` fence, or a promoted formula. */
function isMathBlock(node: HastNode): boolean {
  return node.type === 'element' && node.tagName === 'pre' && (node.children ?? []).some((child) => child.tagName === 'code' && hasClass(child, 'language-math'))
}

export interface EnhanceOptions {
  /**
   * Prepended to heading ids. Reading mode renders the document a second time
   * while the preview stays mounted underneath; a prefix keeps the ids unique.
   */
  idPrefix?: string
  /**
   * Render-by-block mode: the document is rendered one block at a time, so a heading cannot know its place among the
   * repeats of its slug. It gets `data-slug` instead of `id`, and its anchor no `href`; `assignHeadingIds` (headingIds.ts)
   * fills both in after the blocks are in the page. `data-line` stays relative to the block.
   */
  blockMode?: boolean
}

/**
 * Stamps every block element with the source line it came from, so the
 * preview and the editor can follow each other precisely, and gives headings
 * stable ids matching the outline panel's slugs.
 *
 * KaTeX later replaces a maths block's whole `<pre>` -- the element holding
 * `data-line` -- so each one is wrapped in `<div class="math-block">` that
 * carries the line and survives.
 */
export function rehypeEnhance(options: EnhanceOptions = {}) {
  const prefix = options.idPrefix ?? ''
  const blockMode = options.blockMode === true
  return (tree: HastNode) => {
    const seen = new Map<string, number>()

    const walk = (node: HastNode) => {
      const children = node.children
      if (children && !(node.tagName === 'div' && hasClass(node, 'math-block'))) {
        for (let index = 0; index < children.length; index++) {
          const child = children[index]
          const line = child.position?.start?.line
          if (line && isMathBlock(child)) {
            children[index] = {
              type: 'element',
              tagName: 'div',
              properties: { className: ['math-block'], 'data-line': String(line) },
              children: [child],
              position: child.position
            }
          }
        }
      }

      if (node.type === 'element' && node.tagName) {
        const line = node.position?.start?.line
        if (line && BLOCK_TAGS.has(node.tagName)) {
          node.properties = { ...node.properties, 'data-line': String(line) }
        }

        if (HEADINGS.has(node.tagName)) {
          const base = slugify(textOf(node)) || 'section'
          const count = seen.get(base) ?? 0
          seen.set(base, count + 1)
          const id = prefix + (count === 0 ? base : `${base}-${count}`)
          node.properties = blockMode ? { ...node.properties, 'data-slug': base } : { ...node.properties, id }
          node.children = [
            {
              type: 'element',
              tagName: 'a',
              properties: blockMode
                ? { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 }
                : { href: `#${id}`, className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
              children: [{ type: 'text', value: '#' }]
            },
            ...(node.children ?? [])
          ]
        }
      }

      node.children?.forEach(walk)
    }

    walk(tree)
  }
}

/** `className` with no value constraint, for tags the default schema pins down. */
const ANY_CLASS = ['className'] as const

/**
 * Raw HTML in a document is rendered, but sanitised first: a file can arrive
 * from the shared backend and be viewed by anonymous visitors.
 *
 * KaTeX and the syntax highlighter generate their markup *after* this step, so
 * the schema only has to keep the hooks they look for -- `language-*`,
 * `math-inline` and `math-display` on `<code>`, which the default schema pins
 * to `language-*` alone (a tag's own entry beats the `'*'` one, so listing them
 * there was not enough: an inline formula could never be shown in display
 * style) -- plus the `data-line` anchors, including the one on
 * `div.math-block`. `style` is allowed, but rehypeStyleGuard has already
 * removed the declarations that load resources or cover the page.
 */
export const sanitizeSchema = {
  ...defaultSchema,
  // The GitHub schema rewrites every id to `user-content-<id>` to avoid DOM
  // clobbering. That breaks in-document `[text](#heading)` links and the
  // outline's lookups, and this editor does no security-sensitive id lookups.
  clobberPrefix: '',
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'kbd',
    'mark',
    'ins',
    'details',
    'summary',
    'figure',
    'figcaption',
    'abbr',
    'u',
    'small',
    'video',
    'audio',
    'source',
    'picture'
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'data-line', 'data-slug', 'style', 'ariaHidden'],
    // The default schema pins `a`'s className to the footnote class alone,
    // which would strip the heading anchors added above.
    a: [...(defaultSchema.attributes?.a ?? []).filter((entry) => !Array.isArray(entry) || entry[0] !== 'className'), ...ANY_CLASS],
    // remark-math marks formulas with these; rehype-katex picks display or inline style from them.
    code: [['className', /^language-./, 'math-inline', 'math-display']],
    // KaTeX and the highlighter both key off classes on these.
    span: [...ANY_CLASS, 'style', 'ariaHidden'],
    div: [...ANY_CLASS, 'style', 'data-line'],
    li: [...(defaultSchema.attributes?.li ?? []), ...ANY_CLASS],
    ol: [...(defaultSchema.attributes?.ol ?? []), ...ANY_CLASS],
    ul: [...(defaultSchema.attributes?.ul ?? []), ...ANY_CLASS],
    input: [...(defaultSchema.attributes?.input ?? []), 'type', 'checked', 'disabled'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align'],
    video: ['src', 'controls', 'width', 'height', 'poster', 'loop', 'muted'],
    audio: ['src', 'controls', 'loop', 'muted'],
    source: ['src', 'srcSet', 'type', 'media'],
    details: ['open']
  },
  // Relative and fragment URLs carry no protocol and stay allowed; this list
  // only constrains absolute ones.
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data'],
    href: ['http', 'https', 'mailto', 'tel']
  }
}
