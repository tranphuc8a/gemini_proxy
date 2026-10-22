import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { render } from './render.mjs'
import { rehypeEnhance, sanitizeSchema } from './gen/rehypeEnhance.mjs'
import remarkLlmMath from './proto-llm-math.mjs'
const h = render(String.raw`So \[ a^2 \] is display`, {
  remarkPlugins: [remarkGfm, remarkMath, remarkLlmMath],
  rehypePlugins: [rehypeRaw, [rehypeEnhance, { idPrefix: '' }], [rehypeSanitize, sanitizeSchema], rehypeKatex]
})
console.log('has katex-display:', h.includes('katex-display'))
const h2 = render(String.raw`So \[ a^2 \] is display`, {
  remarkPlugins: [remarkGfm, remarkMath, remarkLlmMath],
  rehypePlugins: [rehypeRaw, [rehypeEnhance, { idPrefix: '' }], rehypeKatex]
})
console.log('without sanitize has katex-display:', h2.includes('katex-display'))
