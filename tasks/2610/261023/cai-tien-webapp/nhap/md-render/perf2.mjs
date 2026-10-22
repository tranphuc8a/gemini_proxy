import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { normalizeMathDelimiters } from './proto-llm-math.mjs'
import fs from 'node:fs'

const R = String.raw
const block = R`## Section

ChatGPT style: the energy \( E = mc^2 \) and price $20/month, see $x_1 + y$.

\[
\int_0^1 x^2 \, dx = \frac{1}{3}
\]

- item with \(a_i\) and **bold** text

`
for (const kb of [50, 300]) {
  const llm = block.repeat(Math.ceil((kb * 1024) / block.length))
  let t0 = performance.now()
  const r = normalizeMathDelimiters(llm, [])
  console.log(`normalize only ${kb}KB:`, (performance.now() - t0).toFixed(1), 'ms', 'lines same:', llm.split('\n').length === r.text.split('\n').length)
  const proc = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
  t0 = performance.now()
  proc.parse(llm)
  console.log(`parse only (gfm+math) ${kb}KB:`, (performance.now() - t0).toFixed(1), 'ms')
}
// a real repo markdown file for scale
const real = fs.readFileSync('C:/Users/tranphuc8a/Desktop/gemini_proxy/docs/nang-cap-tinh-nang-ban-giao.md', 'utf8')
const proc = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
let t0 = performance.now(); proc.parse(real)
console.log(`real doc ${(real.length / 1024).toFixed(0)}KB parse:`, (performance.now() - t0).toFixed(1), 'ms')
