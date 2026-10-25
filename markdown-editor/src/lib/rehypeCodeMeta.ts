/**
 * What follows the language on a fence's opening line (```` ```python title="main.py" ````) is the node's `meta`.
 * remark-rehype keeps it as `data.meta`, which `rehype-raw` then throws away, so this runs BEFORE `raw` and copies it
 * to a property (`data-meta`) the sanitiser keeps. `CodeBlock` shows the file name; the front-matter block (written by
 * `prepareMarkdown` as ```` ```yaml front-matter ````) is told apart by it.
 *
 * `fileNameOf` is pure: it reads the title/file/filename/name attribute, a bare `app.js` word in the meta, or the part
 * of the language after a colon (```` ```js:app.js ````).
 */

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  data?: { meta?: unknown }
}

const META_MAX = 300
const NAME_MAX = 120

const ATTRIBUTE = /(?:^|[ \t])(?:title|file|filename|name)[ \t]*=[ \t]*(?:"([^"]{1,120})"|'([^']{1,120})'|([^\s"'{}]{1,120}))/i

/** The file name a fence announces, or ''. `language` is the whole `language-…` token (colon form included). */
export function fileNameOf(meta: string | undefined, language: string | undefined): string {
  const attribute = ATTRIBUTE.exec(meta ?? '')
  if (attribute) return (attribute[1] ?? attribute[2] ?? attribute[3]).trim().slice(0, NAME_MAX)
  const bare = /^[ \t]*([^\s="'{}]{1,120}\.[A-Za-z0-9]{1,10})(?:[ \t]|$)/.exec(meta ?? '')
  if (bare) return bare[1]
  const colon = (language ?? '').indexOf(':')
  if (colon > 0 && colon < (language ?? '').length - 1) return (language as string).slice(colon + 1, colon + 1 + NAME_MAX)
  return ''
}

export default function rehypeCodeMeta() {
  return (tree: HastNode) => {
    const stack: HastNode[] = [tree]
    while (stack.length) {
      const node = stack.pop() as HastNode
      if (node.type === 'element' && node.tagName === 'code' && typeof node.data?.meta === 'string' && node.data.meta.trim()) {
        node.properties = { ...node.properties, 'data-meta': node.data.meta.trim().slice(0, META_MAX) }
      }
      if (node.children) for (let index = node.children.length - 1; index >= 0; index--) stack.push(node.children[index])
    }
  }
}
