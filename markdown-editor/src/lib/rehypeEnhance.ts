import { defaultSchema } from 'rehype-sanitize'
import { slugify } from './markdown'

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

/**
 * Stamps every block element with the source line it came from, so the
 * preview and the editor can follow each other precisely, and gives headings
 * stable ids matching the outline panel's slugs.
 */
export function rehypeEnhance() {
  return (tree: HastNode) => {
    const seen = new Map<string, number>()

    const walk = (node: HastNode) => {
      if (node.type === 'element' && node.tagName) {
        const line = node.position?.start?.line
        if (line && BLOCK_TAGS.has(node.tagName)) {
          node.properties = { ...node.properties, 'data-line': String(line) }
        }

        if (HEADINGS.has(node.tagName)) {
          const base = slugify(textOf(node)) || 'section'
          const count = seen.get(base) ?? 0
          seen.set(base, count + 1)
          const id = count === 0 ? base : `${base}-${count}`
          node.properties = { ...node.properties, id }
          node.children = [
            {
              type: 'element',
              tagName: 'a',
              properties: { href: `#${id}`, className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
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
 * the schema only has to keep the hooks they look for (`math-inline`,
 * `math-display`, `language-*`) plus the `data-line` anchors.
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
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'data-line', 'style', 'ariaHidden'],
    // The default schema pins `a`'s className to the footnote class alone,
    // which would strip the heading anchors added above.
    a: [...(defaultSchema.attributes?.a ?? []).filter((entry) => !Array.isArray(entry) || entry[0] !== 'className'), ...ANY_CLASS],
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
