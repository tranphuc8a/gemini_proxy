/**
 * `==highlighted==` (Obsidian, sometimes Claude) → `<mark>`. Runs on `text` nodes, so code and maths are untouched.
 *
 * Limit, on purpose: the pair must sit inside one text node, so `==**bold** inside==` (a pair that wraps another
 * inline construct) is left as typed rather than guessed at. The pattern cannot cross a `=` or a line end, which keeps
 * it linear: each opener scans only up to the next `=`.
 */

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

const MARK = /==(?![=\s])([^=\n]*?[^=\s])==(?!=)/g

/** The pieces `value` is replaced by, or null when it holds no highlight. */
export function splitHighlights(value: string): MdNode[] | null {
  if (!value.includes('==')) return null
  MARK.lastIndex = 0
  const out: MdNode[] = []
  let last = 0
  for (let match = MARK.exec(value); match; match = MARK.exec(value)) {
    // `a==b==` inside a word or after another `=` is not a highlight start.
    if (match.index > 0 && value[match.index - 1] === '=') continue
    if (match.index > last) out.push({ type: 'text', value: value.slice(last, match.index) })
    out.push({ type: 'emphasis', data: { hName: 'mark' }, children: [{ type: 'text', value: match[1] }] })
    last = match.index + match[0].length
  }
  if (!out.length) return null
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) })
  return out
}

export default function remarkHighlight() {
  return (tree: MdNode) => {
    const stack: MdNode[] = [tree]
    while (stack.length) {
      const node = stack.pop() as MdNode
      const children = node.children
      if (!children) continue
      let rewritten: MdNode[] | null = null
      for (let index = 0; index < children.length; index++) {
        const child = children[index]
        if (child.type === 'text' && child.value) {
          const pieces = splitHighlights(child.value)
          if (pieces) {
            rewritten ??= children.slice(0, index)
            rewritten.push(...pieces)
            continue
          }
        } else if (child.children) {
          stack.push(child)
        }
        rewritten?.push(child)
      }
      if (rewritten) node.children = rewritten
    }
  }
}
