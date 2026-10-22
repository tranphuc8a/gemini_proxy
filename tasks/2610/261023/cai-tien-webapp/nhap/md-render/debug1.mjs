import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import remarkLlmMath, { normalizeMathDelimiters } from './proto-llm-math.mjs'
const src = String.raw`So \[ a^2 \] is display`
const n = normalizeMathDelimiters(src, [])
console.log(JSON.stringify(n.text), [...n.display], [...n.generated])
const proc = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkLlmMath)
const tree = proc.runSync(proc.parse(src), src)
console.log(JSON.stringify(tree.children[0].children.map((c) => ({ t: c.type, v: c.value, off: c.position?.start.offset, data: c.data })), null, 0))
const hast = unified().use(remarkRehype).runSync(tree)
console.log(JSON.stringify(hast.children[0].children.map((c) => ({ t: c.tagName || c.type, p: c.properties }))))
