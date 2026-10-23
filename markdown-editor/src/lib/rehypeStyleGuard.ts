/**
 * Inline `style` in a document's raw HTML is kept (colours, alignment, sizes), minus the declarations that reach out
 * of the document or over the page:
 *  - anything that loads a resource: `url(…)`, `image(…)`, `image-set(…)`, `cross-fade(…)`, `element(…)`, `src(…)`,
 *    `attr(…)`, `paint(…)` -- a remote background is a tracking pixel for every anonymous reader of a shared document;
 *  - legacy script hooks: `expression(…)`, `behavior`, `-moz-binding`, `@import`;
 *  - `position` other than static/relative/absolute -- `fixed`/`sticky` can cover the whole app with a fake interface.
 *
 * Runs before the sanitiser (which allows `style`) and before KaTeX, whose own inline styles are generated later and
 * are not touched. CSS escapes (`u\72l(`) and comments (`ur/**\/l(`) are decoded before checking.
 */

/** Minimal structural view of a hast node; avoids a hard dependency on @types/hast. */
interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const BLOCKED_PROPERTY = /^(?:behavior|-moz-binding|-ms-behavior)$/
/**
 * Looked for anywhere in the canonical value, with no boundary on the left: white space is gone there, so the
 * shorthand `background: #fff url(…) no-repeat` reads `#fffurl(…)no-repeat`, and `red/**\/url(…)` reads `redurl(…)`.
 * No CSS function a style needs ends in one of these names (vendor prefixes like `-webkit-image-set(` included).
 */
const LOADING_FUNCTION = /(?:url|image|image-set|cross-fade|element|src|attr|paint|expression)\(/
const SAFE_POSITION = /^(?:static|relative|absolute|initial|inherit|unset|revert|revert-layer)(?:!important)?$/

/** Splits a declaration list on `;` outside strings and parentheses. */
function splitDeclarations(style: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < style.length; i++) {
    const c = style[i]
    if (c === '\\') {
      i++
      continue
    }
    if (quote) {
      if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    else if (c === ';' && depth === 0) {
      parts.push(style.slice(start, i))
      start = i + 1
    }
  }
  parts.push(style.slice(start))
  return parts.map((part) => part.trim()).filter(Boolean)
}

/** Lower-case, escapes decoded, comments and white space removed: what the CSS parser would actually see. */
function canonical(text: string): string {
  const decoded = text.replace(/\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\r\n|[\n\r\f]|([\s\S]))/g, (_match, hex: string | undefined, other: string | undefined) => {
    if (hex) {
      const code = parseInt(hex, 16)
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '�' : String.fromCodePoint(code)
    }
    return other ?? ''
  })
  return decoded.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '').replace(/\s+/g, '').toLowerCase()
}

/** The style attribute without its dangerous declarations ('' when nothing is left). */
export function cleanStyle(style: string): string {
  const kept: string[] = []
  for (const declaration of splitDeclarations(style)) {
    const flat = canonical(declaration)
    const colon = flat.indexOf(':')
    if (colon <= 0) continue
    const name = flat.slice(0, colon)
    const value = flat.slice(colon + 1)
    if (BLOCKED_PROPERTY.test(name)) continue
    if (name === 'position' && !SAFE_POSITION.test(value)) continue
    if (flat.includes('@import') || LOADING_FUNCTION.test(value)) continue
    kept.push(declaration)
  }
  return kept.join('; ')
}

export default function rehypeStyleGuard() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      const style = node.properties?.style
      if (node.type === 'element' && node.properties && style !== undefined) {
        const cleaned = typeof style === 'string' ? cleanStyle(style) : ''
        if (cleaned) node.properties.style = cleaned
        else delete node.properties.style
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}
