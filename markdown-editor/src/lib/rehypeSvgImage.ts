/**
 * SVG written by a person or an LLM: a ```` ```svg ```` fence or a raw `<svg>…</svg>`. It is NEVER put into the page as
 * an `svg` element (an inline SVG is a document of its own: script, `<use>`, `<foreignObject>`, style that reaches
 * outside); it becomes `<img src="data:image/svg+xml,…">`, which cannot run script or load anything. The sanitiser
 * would drop the raw element anyway; this plugin keeps the drawing instead of leaving an empty paragraph.
 *
 * Runs after `raw` and before `enhance`/`sanitize`. A raw `<svg>`'s text is cut verbatim out of the source by the
 * element's position (re-serialising the tree would put Markdown's reading of `*x*` inside the drawing), then cleaned
 * by `cleanSvg` -- belt and braces for the day someone opens the image on its own: `<script>`, `<foreignObject>`,
 * event attributes and non-local `href`s are removed, DOCTYPE/ENTITY declarations refuse the whole drawing.
 * `cleanSvg` walks the text once, with no nested quantifiers, so a 256 KB document of nothing but `<` is linear.
 */

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
  position?: { start?: { offset?: number }; end?: { offset?: number } }
}

/** Larger drawings stay a code block (the data URL would be larger still). */
export const SVG_MAX_BYTES = 200_000

const DROPPED_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'handler', 'listener'])
const SVG_NS = 'http://www.w3.org/2000/svg'

function isNameChar(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 45 || code === 95 || code === 58 || code === 46
}

/** `href` values an image may keep: fragments, and raster/SVG images given as data URLs. */
function safeHref(value: string): boolean {
  // Browsers ignore control characters and spaces inside a URL scheme (`java\tscript:`), so compare without them.
  let flat = ''
  for (let index = 0; index < value.length; index++) if (value.charCodeAt(index) > 32) flat += value[index]
  flat = flat.toLowerCase()
  return flat.startsWith('#') || /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,]/.test(flat)
}

/**
 * The cleaned drawing, or null when it cannot be trusted or is not a drawing (no `<svg` root, DOCTYPE/ENTITY,
 * unterminated markup, too big).
 */
export function cleanSvg(source: string): string | null {
  if (source.length > SVG_MAX_BYTES) return null
  const length = source.length
  let out = ''
  let i = 0
  let skipDepth = 0
  let skipName = ''
  let sawRoot = false
  // `<style>`: the text up to the next `</style`, checked once (a later `<style>` inside a checked, clean one reuses it).
  const styleClose = /<\/style/gi
  let closeAt = -2
  let cleanUntil = -1
  const nextStyleClose = (from: number): number => {
    if (closeAt === -1 || closeAt >= from) return closeAt
    styleClose.lastIndex = from
    const found = styleClose.exec(source)
    closeAt = found ? found.index : -1
    return closeAt
  }
  while (i < length) {
    const lt = source.indexOf('<', i)
    if (lt === -1) {
      if (!skipDepth) out += source.slice(i)
      break
    }
    if (!skipDepth) out += source.slice(i, lt)
    i = lt
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4)
      if (end === -1) return null
      i = end + 3
      continue
    }
    if (source.startsWith('<![CDATA[', i)) {
      const end = source.indexOf(']]>', i + 9)
      if (end === -1) return null
      if (!skipDepth) out += source.slice(i, end + 3)
      i = end + 3
      continue
    }
    if (source.charCodeAt(i + 1) === 33 || source.charCodeAt(i + 1) === 63) return null // <!DOCTYPE, <!ENTITY, <?xml-stylesheet…
    const closing = source.charCodeAt(i + 1) === 47
    let j = i + (closing ? 2 : 1)
    const nameStart = j
    while (j < length && isNameChar(source.charCodeAt(j))) j++
    const name = source.slice(nameStart, j).toLowerCase()
    if (!name) {
      // A `<` that opens no tag is text.
      if (!skipDepth) out += '&lt;'
      i += 1
      continue
    }
    // Attributes, up to the `>` that is outside quotes.
    const attributes: Array<[string, string | null]> = []
    let selfClosing = false
    let terminated = false
    while (j < length) {
      const code = source.charCodeAt(j)
      if (code === 62) {
        terminated = true
        j++
        break
      }
      if (code === 47) {
        selfClosing = source.charCodeAt(j + 1) === 62
        j++
        continue
      }
      if (code <= 32) {
        j++
        continue
      }
      const attrStart = j
      while (j < length) {
        const c = source.charCodeAt(j)
        if (c <= 32 || c === 61 || c === 62 || c === 47) break
        j++
      }
      if (j === attrStart) {
        j++
        continue
      }
      const attrName = source.slice(attrStart, j)
      while (j < length && source.charCodeAt(j) <= 32) j++
      let value: string | null = null
      if (source.charCodeAt(j) === 61) {
        j++
        while (j < length && source.charCodeAt(j) <= 32) j++
        const quote = source[j]
        if (quote === '"' || quote === "'") {
          const end = source.indexOf(quote, j + 1)
          if (end === -1) return null
          value = source.slice(j + 1, end)
          j = end + 1
        } else {
          const valueStart = j
          while (j < length && source.charCodeAt(j) > 32 && source.charCodeAt(j) !== 62) j++
          value = source.slice(valueStart, j)
        }
      }
      attributes.push([attrName, value])
    }
    if (!terminated) return null
    i = j

    if (skipDepth) {
      if (name === skipName) {
        if (closing) skipDepth--
        else if (!selfClosing) skipDepth++
      }
      continue
    }
    if (DROPPED_ELEMENTS.has(name)) {
      if (!closing && !selfClosing) {
        skipDepth = 1
        skipName = name
      }
      continue
    }
    if (closing) {
      out += `</${name === 'svg' ? 'svg' : source.slice(nameStart, nameStart + name.length)}>`
      continue
    }
    if (name === 'svg' && !sawRoot) sawRoot = true
    else if (!sawRoot) return null // markup before the root is not a drawing
    if (name === 'style' && !selfClosing) {
      const close = nextStyleClose(i)
      if (close === -1) return null
      if (close > cleanUntil) {
        if (/@import|url\s*\(|expression\s*\(|javascript:/i.test(source.slice(i, close))) {
          // The whole element goes, up to the `>` of its closing tag.
          const end = source.indexOf('>', close)
          if (end === -1) return null
          i = end + 1
          continue
        }
        cleanUntil = close
      }
    }
    let tag = `<${source.slice(nameStart, nameStart + name.length)}`
    let hasNs = false
    for (const [attrName, value] of attributes) {
      const lower = attrName.toLowerCase()
      if (lower.startsWith('on')) continue
      if (lower === 'href' || lower === 'xlink:href' || lower === 'src') {
        if (value === null || !safeHref(value)) continue
      }
      if (lower === 'style' && value !== null && /url\s*\(|@import|expression\s*\(|javascript:/i.test(value.replace(/\\/g, ''))) continue
      if (lower === 'xmlns') hasNs = true
      if (!/^[A-Za-z_:][\w:.-]*$/.test(attrName)) continue
      tag += value === null ? ` ${attrName}` : ` ${attrName}="${value.replace(/"/g, '&quot;')}"`
    }
    if (name === 'svg' && !hasNs) tag += ` xmlns="${SVG_NS}"`
    out += selfClosing ? `${tag}/>` : `${tag}>`
  }
  if (!sawRoot) return null
  return out
}

/** `data:image/svg+xml` URL for a cleaned drawing. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function hasClass(node: HastNode, name: string): boolean {
  const value = node.properties?.className
  return Array.isArray(value) ? value.includes(name) : typeof value === 'string' && value.split(/\s+/).includes(name)
}

function textOf(node: HastNode): string {
  let text = ''
  const stack = [node]
  while (stack.length) {
    const current = stack.pop() as HastNode
    if (current.type === 'text') text += current.value ?? ''
    else if (current.children) for (let index = current.children.length - 1; index >= 0; index--) stack.push(current.children[index])
  }
  return text
}

function image(svg: string, label: string): HastNode {
  return { type: 'element', tagName: 'img', properties: { src: svgDataUrl(svg), alt: label, className: ['md-svg'] }, children: [] }
}

/** The text shown when a drawing is refused. */
function blocked(): HastNode {
  return { type: 'element', tagName: 'span', properties: { className: ['md-svg-blocked'] }, children: [{ type: 'text', value: '[SVG not shown]' }] }
}

export default function rehypeSvgImage() {
  return (tree: HastNode, file?: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : String(file?.value ?? '')
    const stack: HastNode[] = [tree]
    while (stack.length) {
      const parent = stack.pop() as HastNode
      const children = parent.children
      if (!children) continue
      for (let index = 0; index < children.length; index++) {
        const child = children[index]
        if (child.type !== 'element') continue

        // ```svg … ```: the fence stays reachable behind "View source".
        if (child.tagName === 'pre') {
          const code = (child.children ?? []).find((entry) => entry.type === 'element' && entry.tagName === 'code' && (Array.isArray(entry.properties?.className) ? entry.properties.className : []).some((name) => name === 'language-svg' || String(name).startsWith('language-svg:')))
          if (code) {
            const svg = cleanSvg(textOf(code))
            children[index] = svg
              ? {
                  type: 'element',
                  tagName: 'div',
                  properties: { className: ['md-svg-figure'] },
                  children: [
                    image(svg, 'SVG drawing'),
                    { type: 'element', tagName: 'details', properties: { className: ['md-svg-source'] }, children: [{ type: 'element', tagName: 'summary', properties: {}, children: [{ type: 'text', value: 'View source' }] }, child] }
                  ],
                  position: child.position
                }
              : child
          }
          continue
        }

        if (child.tagName === 'svg') {
          const start = child.position?.start?.offset
          const end = child.position?.end?.offset
          const svg = start !== undefined && end !== undefined && end > start ? cleanSvg(source.slice(start, end)) : null
          children[index] = svg ? { ...image(svg, 'SVG drawing'), position: child.position } : blocked()
          continue
        }
        if (child.children?.length && !hasClass(child, 'md-svg-figure')) stack.push(child)
      }
    }
  }
}
