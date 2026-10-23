// FILE SINH RA — ĐỪNG SỬA Ở ĐÂY. Nguồn thật: markdown-editor/src/lib/remarkMathPromote.ts
// Sửa ở nguồn rồi chạy: node scripts/sync-math.mjs   (kiểm lệch: node scripts/sync-math.mjs --kiem)
/**
 * Runs after remark-math, on the text `normalizeMath` prepared:
 *  - a paragraph holding nothing but one formula becomes a display block when the formula was marked `display`
 *    (`\[ x \]`, bare `\begin{align}`) or when the author wrote it with `$$` (`$$x$$` alone on its line, as Gemini does --
 *    micromark reads that as inline maths);
 *  - a `display` formula in the middle of a sentence keeps its place but renders in display style;
 *  - every formula gets `fixTex`: environments KaTeX lacks are mapped to the nearest one it has, `\require{…}` is dropped.
 *
 * mdast-util-math builds the HTML from `data.hChildren`, not from `value`, so both are updated together.
 */

/** Minimal structural view of an mdast node; avoids a hard dependency on @types/mdast. */
interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  position?: { start: { line: number; column: number; offset?: number }; end: { line: number; column: number; offset?: number } }
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
    hChildren?: Array<{ type: string; tagName?: string; properties?: Record<string, unknown>; value?: string; children?: unknown[] }>
  }
}

export interface MathPromoteOptions {
  /** Offsets of opening `$` runs that must render as display maths (from `normalizeMath`). */
  display?: ReadonlySet<number>
  /** Offsets of opening `$` runs written by `normalizeMath`, not by the author. */
  generated?: ReadonlySet<number>
  /** The parsed text; defaults to the file's value. Needed to see whether the author wrote `$$`. */
  text?: string
}

const EMPTY: ReadonlySet<number> = new Set()

/** Environments KaTeX does not have, mapped to the closest one it does; `\require{…}` (MathJax) removed. */
export function fixTex(tex: string): string {
  if (!tex.includes('\\')) return tex
  return tex
    .replace(/\\(begin|end)\{(multline|flalign|eqnarray)(\*?)\}/g, (_match, edge: string, env: string, star: string) => `\\${edge}{${env === 'multline' ? 'gather' : 'align'}${star}}`)
    .replace(/\\require\{[^{}]*\}/g, '')
}

function setValue(node: MdNode, value: string) {
  node.value = value
  const data = (node.data ??= {})
  if (node.type === 'inlineMath') {
    data.hChildren = [{ type: 'text', value }]
    return
  }
  const code = data.hChildren?.[0]
  if (code && code.type === 'element') code.children = [{ type: 'text', value }]
}

function blockMath(value: string, position: MdNode['position']): MdNode {
  return {
    type: 'math',
    value,
    position,
    data: {
      hName: 'pre',
      hChildren: [{ type: 'element', tagName: 'code', properties: { className: ['language-math', 'math-display'] }, children: [{ type: 'text', value }] }]
    }
  }
}

export default function remarkMathPromote(options: MathPromoteOptions = {}) {
  const display = options.display ?? EMPTY
  const generated = options.generated ?? EMPTY

  return (tree: MdNode, file?: { value?: unknown }) => {
    const text = options.text ?? String(file?.value ?? '')

    const promote = (paragraph: MdNode): MdNode | null => {
      let math: MdNode | null = null
      for (const child of paragraph.children ?? []) {
        if (child.type === 'text' && !(child.value ?? '').trim()) continue
        if (child.type !== 'inlineMath' || math) return null
        math = child
      }
      const offset = math?.position?.start.offset
      if (!math || offset === undefined) return null
      const isDisplay = display.has(offset) || (!generated.has(offset) && text.startsWith('$$', offset))
      return isDisplay ? blockMath(fixTex(math.value ?? ''), paragraph.position) : null
    }

    const visit = (node: MdNode) => {
      const children = node.children
      if (!children) return
      for (let index = 0; index < children.length; index++) {
        const child = children[index]
        if (child.type === 'paragraph') {
          const block = promote(child)
          if (block) {
            children[index] = block
            continue
          }
        }
        if (child.type === 'math' || child.type === 'inlineMath') {
          const value = child.value ?? ''
          const fixed = fixTex(value)
          if (fixed !== value) setValue(child, fixed)
          const offset = child.position?.start.offset
          if (child.type === 'inlineMath' && offset !== undefined && display.has(offset)) {
            const data = (child.data ??= {})
            data.hProperties = { ...data.hProperties, className: ['language-math', 'math-display'] }
          }
          continue
        }
        visit(child)
      }
    }

    visit(tree)
  }
}
