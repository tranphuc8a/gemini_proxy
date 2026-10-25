/**
 * Citation markers an LLM leaves in its text when it is pasted out of its own interface. Runs on `text` nodes only, so
 * inline code, code blocks and maths are never touched.
 *
 *   Gemini     `[cite_start]` (dropped)            `[cite: 1, 2]`, `[cite: 3-5]`   → <sup class="llm-cite">[1, 2]</sup>
 *   ChatGPT    `【4:0†source】`, `【12†L3-L5】`     → <sup class="llm-cite">[4]</sup>
 *   ChatGPT    `:contentReference[oaicite:0]{index=0}` and the private-use `cite…turn0search1…` entities (dropped)
 *   others     `⟦1⟧`, `⟦2, 3⟧`, `⟦1†source⟧`       → <sup class="llm-cite">[1]</sup>
 *
 * One global pattern, every alternative bounded or stopped by a character it cannot contain, so a document made of
 * nothing but openers stays linear (pathological test in remarkLlmCitations.test.ts).
 * `hide: true` drops the numbered ones as well (nothing is rendered for a citation).
 */

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

const CITATION =
  /\[cite_start\]|\[cite:[ \t]*(\d[\d \t,;–-]{0,80})\]|【[ \t]*(\d{1,4})(?::\d{1,4})?[ \t]*†[^】\n]{0,60}】|⟦[ \t]*(\d[\d \t,;–-]{0,80})(?:†[^⟧\n]{0,60})?[ \t]*⟧|:contentReference\[oaicite:\d{1,4}\]\{index=\d{1,4}\}|[^\n]{0,60}/g

export interface CitationOptions {
  /** Remove numbered citations too instead of showing them as superscripts. */
  hide?: boolean
}

function numbers(list: string): string {
  return list
    .replace(/[ \t]+$/, '')
    .split(/[ \t]*[,;][ \t]*/)
    .filter(Boolean)
    .join(', ')
}

/** The pieces `value` is replaced by, or null when it holds no marker. */
export function splitCitations(value: string, hide = false): MdNode[] | null {
  if (!/[[【⟦:]/.test(value)) return null
  CITATION.lastIndex = 0
  const out: MdNode[] = []
  let text = ''
  let last = 0
  let found = false
  for (let match = CITATION.exec(value); match; match = CITATION.exec(value)) {
    found = true
    text += value.slice(last, match.index)
    last = match.index + match[0].length
    const marker = match[0]
    if (marker === '[cite_start]' || marker.startsWith(':contentReference') || marker.charCodeAt(0) === 0xe200) {
      // Dropped. The space that separated it from the word before it goes with it, one space after it otherwise.
      if (/[ \t]$/.test(text) || text === '') {
        if (value.charCodeAt(last) === 32) last += 1
      }
      continue
    }
    const label = match[1] ?? match[2] ?? match[3] ?? ''
    // The marker hangs off the word before it: no space between them.
    text = text.replace(/[ \t]+$/, '')
    if (hide) continue
    if (text) out.push({ type: 'text', value: text })
    text = ''
    out.push({
      type: 'emphasis',
      data: { hName: 'sup', hProperties: { className: ['llm-cite'] } },
      children: [{ type: 'text', value: `[${match[2] !== undefined ? match[2] : numbers(label)}]` }]
    })
  }
  if (!found) return null
  text += value.slice(last)
  if (text) out.push({ type: 'text', value: text })
  return out
}

export default function remarkLlmCitations(options: CitationOptions = {}) {
  const hide = options.hide === true
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
          const pieces = splitCitations(child.value, hide)
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
