import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkLlmMath from './proto-llm-math.mjs'

const R = String.raw
const block = R`## Section

ChatGPT style: the energy \( E = mc^2 \) and price $20/month, see $x_1 + y$.

\[
\int_0^1 x^2 \, dx = \frac{1}{3}
\]

- item with \(a_i\) and **bold** text
- another item ` + '`code \\(x\\)`' + R`

| a | b |
|---|---|
| \(x\) | $y$ |

` + '```js\nconst a = "\\\\(x\\\\)"\n```\n\n'
const plain = '## Section\n\nJust some text with **bold** and a [link](http://a.b) and more words here.\n\n- item\n- item two\n\n'
function time(label, src, plugins) {
  const proc = unified().use(remarkParse).use(plugins)
  proc.runSync(proc.parse(src.slice(0, 2000)), src.slice(0, 2000)) // warm
  const t0 = performance.now()
  const runs = 3
  for (let k = 0; k < runs; k++) proc.runSync(proc.parse(src), src)
  console.log(label.padEnd(44), ((performance.now() - t0) / runs).toFixed(1), 'ms', `(${(src.length / 1024).toFixed(0)} KB)`)
}
for (const kb of [50, 300]) {
  const llm = block.repeat(Math.ceil((kb * 1024) / block.length))
  const pl = plain.repeat(Math.ceil((kb * 1024) / plain.length))
  time(`LLM-style math, baseline (gfm+math)`, llm, [remarkGfm, remarkMath])
  time(`LLM-style math, + remarkLlmMath (2 parses)`, llm, [remarkGfm, remarkMath, remarkLlmMath])
  time(`no math, baseline`, pl, [remarkGfm, remarkMath])
  time(`no math, + remarkLlmMath (fast path)`, pl, [remarkGfm, remarkMath, remarkLlmMath])
}
