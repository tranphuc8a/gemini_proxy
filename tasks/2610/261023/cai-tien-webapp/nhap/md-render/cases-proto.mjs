import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import 'katex/contrib/mhchem'
import { render } from './render.mjs'
import { rehypeEnhance, sanitizeSchema } from './gen/rehypeEnhance.mjs'
import remarkLlmMath, { normalizeMathDelimiters } from './proto-llm-math.mjs'

const schema = { ...sanitizeSchema, attributes: { ...sanitizeSchema.attributes, code: [['className', /^language-./, 'math-inline', 'math-display']] } }
const opts = {
  remarkPlugins: [remarkGfm, remarkMath, remarkLlmMath],
  rehypePlugins: [rehypeRaw, [rehypeEnhance, { idPrefix: '' }], [rehypeSanitize, schema], [rehypeKatex, { strict: 'ignore', macros: { '\\eqref': '\\text{(#1)}', '\\ref': '\\text{#1}', '\\label': '\\mathrlap{\\phantom{\\text{#1}}}' } }]]
}
const R = String.raw
const cases = {
  'bracket multi-line': R`\[
E = mc^2
\]`,
  'bracket one line': R`\[ E = mc^2 \]`,
  'bracket opener+content then newline': R`\[ x^2 +
y^2 = z^2 \]`,
  'paren inline': R`Energy \( E = mc^2 \) here`,
  'paren at line start': R`\(f\) is continuous`,
  'paren underscores stars': R`Let \( x_1 * x_2 = a_i * b_j \) hold`,
  'bracket with aligned and \\': R`\[
\begin{aligned}
a &= b \\
c &= d
\end{aligned}
\]`,
  'bare align': R`\begin{align}
a &= b \\
c &= d
\end{align}`,
  'bare align with + line': R`\begin{align}
f(x) &= x^2
+ 2x \\
- 3 &= 0
\end{align}`,
  'bare pmatrix one line': R`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`,
  'bare eqnarray (alias)': R`\begin{eqnarray}
a &=& b
\end{eqnarray}`,
  'begin inside $$ untouched': R`$$
\begin{align}
a &= b
\end{align}
$$`,
  'gemini $$ one line': R`$$x = \frac{-b}{2a}$$`,
  'gemini $$ inline in sentence stays inline': R`Area is $$A=\pi r^2$$ ok`,
  'bracket mid-sentence': R`So \[ a^2 \] is display`,
  'quote bracket': R`> \[
> a^2
> \]`,
  'list bracket': R`- item
  \[
  a^2
  \]
- next`,
  'table paren': R`| a | b |
|---|---|
| \(x^2\) | $y$ |`,
  'inline code untouched': R`Use ` + '`\\(x\\)`' + R` literally`,
  'fence untouched': '```\n\\[ x \\]\n```',
  'escaped backslash \\\\[ not math': R`\\[ not math \\]`,
  'currency guard': R`It costs $5 and $10 total`,
  'currency with real math': R`Pay $5 for $x$ items`,
  'chatgpt pricing': R`Plus costs $20/month and Pro $200/month.`,
  'escaped dollar kept': R`Literal \$5 and $y$`,
  'dollar spaces (pandoc says not math)': R`$ x $`,
  'dollar in link url': R`[a](http://x.com/?p=$5) and $z$`,
  'mhchem': R`\(\ce{H2O + CO2 -> H2CO3}\)`,
  'label eqref': R`\[
x = 1 \label{eq:a} \tag{1}
\]
See \(\eqref{eq:a}\).`,
  'dollar inside paren content': R`Price \(\$5\) ok`,
  'require cancel': R`$$\require{cancel}\cancel{x}$$`,
  'line numbers kept': R`# T

\[
a
\]

## After`,
}
const strip = (h) => h
  .replace(/<span class="katex-display">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?(?=<\/p>|<\/li>|<\/td>|<\/blockquote>|<h\d|<p |$)/g, '[DISPLAY:$1]')
  .replace(/<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span><\/span><\/span>(<\/span>)*/g, '[inline:$1]')
  .replace(/\n+/g, ' ').replace(/</g, '‹').replace(/>/g, '›')
for (const [name, src] of Object.entries(cases)) {
  let out
  try {
    const h = render(src, opts)
    out = (h.includes('#cc0000') || h.includes('katex-error') ? 'RED! ' : '') + strip(h).slice(0, 300)
  } catch (e) { out = 'CRASH ' + (e.stack || e) }
  console.log(`### ${name}\n${out}\n`)
}
// line preservation property
const sample = R`a \(x\) b
\[
y
\]
\begin{align}
z
\end{align}`
const n = normalizeMathDelimiters(sample, [])
console.log('lines before/after:', sample.split('\n').length, n.text.split('\n').length)
console.log(JSON.stringify(n.text))
