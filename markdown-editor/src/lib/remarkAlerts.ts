/**
 * GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) and Obsidian callouts
 * (`> [!info] A title`, `> [!faq]- folded`, `> [!tip]+ open but foldable`), as Claude, Gemini and ChatGPT write them.
 *
 * Runs after remark-math/mathPromote. A blockquote whose first paragraph starts with `[!type]` keeps its place in the
 * tree (so its line anchor survives) and gets classes; a folding one becomes `<details>` with a `<summary>` title.
 * Every alias maps to one of the five GitHub kinds, which the stylesheet (components/Alerts.css) colours; an unknown
 * type stays an ordinary blockquote (GitHub does the same).
 *
 * The tree is walked with an explicit stack: a document of 100,000 nested `>` must not overflow the call stack.
 */

/** Minimal structural view of an mdast node; avoids a hard dependency on @types/mdast. */
interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  position?: { start: { line: number; column: number; offset?: number }; end: { line: number; column: number; offset?: number } }
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

export type AlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution'

/** Written type (lower case) → the kind it is drawn as. */
export const ALERT_ALIASES: Readonly<Record<string, AlertKind>> = {
  note: 'note',
  info: 'note',
  todo: 'note',
  abstract: 'note',
  summary: 'note',
  tldr: 'note',
  example: 'note',
  quote: 'note',
  cite: 'note',
  tip: 'tip',
  hint: 'tip',
  success: 'tip',
  check: 'tip',
  done: 'tip',
  important: 'important',
  question: 'important',
  help: 'important',
  faq: 'important',
  warning: 'warning',
  warn: 'warning',
  attention: 'warning',
  caution: 'caution',
  danger: 'caution',
  error: 'caution',
  failure: 'caution',
  fail: 'caution',
  missing: 'caution',
  bug: 'caution'
}

/** `[!type]`, then optionally a fold marker, then the end of the line or a space (so `[!note]x` is not a marker). */
const MARKER = /^\[!([A-Za-z][A-Za-z0-9]{0,23})\]([+-]?)(?=[ \t\r\n]|$)/

const TITLE_MAX = 200

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** Splits a paragraph's children after the marker into the title (rest of the first line) and the body. */
function splitFirstLine(children: MdNode[], rest: string): { title: MdNode[]; body: MdNode[]; bodyStartsNextLine: boolean } {
  const title: MdNode[] = []
  const newline = rest.indexOf('\n')
  if (newline !== -1) {
    const head = rest.slice(0, newline).trim()
    if (head) title.push({ type: 'text', value: head })
    const tail = rest.slice(newline + 1)
    return { title, body: [...(tail ? [{ type: 'text', value: tail }] : []), ...children], bodyStartsNextLine: true }
  }
  const head = rest.replace(/^[ \t]+/, '')
  if (head) title.push({ type: 'text', value: head })
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (child.type === 'break') return { title, body: children.slice(index + 1), bodyStartsNextLine: true }
    if (child.type === 'text' && (child.value ?? '').includes('\n')) {
      const value = child.value ?? ''
      const cut = value.indexOf('\n')
      const before = value.slice(0, cut)
      if (before) title.push({ type: 'text', value: before })
      const after = value.slice(cut + 1)
      return { title, body: [...(after ? [{ type: 'text', value: after }] : []), ...children.slice(index + 1)], bodyStartsNextLine: true }
    }
    title.push(child)
  }
  return { title, body: [], bodyStartsNextLine: false }
}

function titleLength(nodes: MdNode[]): number {
  let length = 0
  const stack = [...nodes]
  while (stack.length && length <= TITLE_MAX) {
    const node = stack.pop() as MdNode
    length += (node.value ?? '').length
    if (node.children) stack.push(...node.children)
  }
  return length
}

/** Turns one blockquote into an alert, when it is one. Returns whether it did. */
function convert(quote: MdNode): boolean {
  const first = quote.children?.[0]
  if (!first || first.type !== 'paragraph' || !first.children?.length) return false
  const lead = first.children[0]
  if (lead.type !== 'text') return false
  const marker = MARKER.exec(lead.value ?? '')
  if (!marker) return false
  const written = marker[1].toLowerCase()
  const kind = ALERT_ALIASES[written]
  if (!kind) return false
  const fold = marker[2]

  const rest = (lead.value ?? '').slice(marker[0].length)
  const split = splitFirstLine(first.children.slice(1), rest)
  let titleNodes = split.title
  // A runaway "title" (the whole paragraph on one line) is a body, not a title.
  if (titleNodes.length && titleLength(titleNodes) > TITLE_MAX) {
    split.body.unshift(...titleNodes)
    titleNodes = []
  }
  if (!titleNodes.length) titleNodes = [{ type: 'text', value: capitalise(written) }]

  const folding = fold !== ''
  const titleNode: MdNode = {
    type: 'paragraph',
    children: titleNodes,
    data: { hName: folding ? 'summary' : 'p', hProperties: { className: ['markdown-alert-title'] } }
  }

  const rows = [titleNode]
  const hasBody = split.body.some((node) => node.type !== 'text' || (node.value ?? '').trim())
  if (hasBody) {
    const startLine = first.position?.start.line
    rows.push({
      type: 'paragraph',
      children: split.body,
      position: first.position && startLine !== undefined && split.bodyStartsNextLine ? { start: { ...first.position.start, line: startLine + 1, column: 1, offset: first.position.start.offset }, end: first.position.end } : first.position
    })
  }
  quote.children = [...rows, ...(quote.children ?? []).slice(1)]
  const classes = ['markdown-alert', `markdown-alert-${kind}`]
  if (folding) classes.push('markdown-alert-fold')
  quote.data = {
    ...quote.data,
    hName: folding ? 'details' : 'blockquote',
    hProperties: { ...quote.data?.hProperties, className: classes, ...(fold === '+' ? { open: true } : {}) }
  }
  return true
}

export default function remarkAlerts() {
  return (tree: MdNode) => {
    const stack: MdNode[] = [tree]
    while (stack.length) {
      const node = stack.pop() as MdNode
      if (!node.children) continue
      if (node.type === 'blockquote') convert(node)
      const children = node.children
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index]
        if (child.children) stack.push(child)
      }
    }
  }
}
