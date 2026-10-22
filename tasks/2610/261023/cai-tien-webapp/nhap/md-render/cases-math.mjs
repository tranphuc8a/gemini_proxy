import { render } from './render.mjs'

const cases = {
  'dollar inline': 'Euler $e^{i\\pi}+1=0$ ok',
  'dollar display block': '$$\nx^2 + y^2 = z^2\n$$',
  'dollar display one line alone': '$$x^2 + y^2 = z^2$$',
  'dollar display one line spaces': '$$ x^2 + y^2 = z^2 $$',
  'dollar opener with content then newline': '$$ x^2 +\ny^2 = z^2 $$',
  'dollar display inside paragraph': 'Text before\n$$\nE = mc^2\n$$\ntext after',
  'bracket display multi-line (ChatGPT)': '\\[\nE = mc^2\n\\]',
  'bracket display one line': '\\[ E = mc^2 \\]',
  'paren inline (ChatGPT)': 'Energy \\( E = mc^2 \\) here',
  'paren with subscripts underscores': 'Let \\( x_1 + x_2 = a_i * b_j * c \\) hold',
  'bracket with \\\\ line breaks': '\\[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n\\]',
  'bare align env': '\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}',
  'bare equation env': '\\begin{equation}\nE = mc^2 \\tag{1}\n\\end{equation}',
  'bare pmatrix line': '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}',
  'fenced math': '```math\n\\frac{a}{b}\n```',
  'dollar with \\begin{align} in $$': '$$\n\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}\n$$',
  'double-escaped \\\\[ (copied from JSON)': '\\\\[ x^2 \\\\]',
  'boxed + tag': '$$\n\\boxed{x = 2} \\tag{2}\n$$',
  'mhchem ce': '$\\ce{H2O}$ and $\\pu{123 kJ}$',
  'currency false positive': 'It costs $5 and $10 total',
  'katex unsupported macro': '$\\unknownmacro{x}$',
  'gemini style $$ inline in sentence': 'The area is $$A = \\pi r^2$$ for a circle.',
  'bracket inside blockquote': '> \\[\n> a^2\n> \\]',
  'bracket in list': '- item\n  \\[\n  a^2\n  \\]',
  'paren in table cell': '| a | b |\n|---|---|\n| \\(x^2\\) | $y$ |',
  'dollar in table with pipe': '| a |\n|---|\n| $\\|x\\|$ |',
  'markdown link not math': 'See [docs](http://a.b) and \\[not math]',
  'html math raw': '<math><mi>x</mi></math>',
}

const summarize = (html) => {
  const inline = (html.match(/class="katex"/g) || []).length
  const display = (html.match(/class="katex-display"/g) || []).length
  const errors = (html.match(/katex-error/g) || []).length
  const text = html
    .replace(/<span class="katex-display">[\s\S]*?<\/annotation>/g, '[KD:')
    .replace(/<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">/g, '[K:')
    .replace(/<\/annotation>[\s\S]*?(?=<\/p>|<\/td>|<\/li>|<\/blockquote>|$)/g, ']')
  return { inline: inline - display, display, errors, text: text.slice(0, 260) }
}

for (const [name, src] of Object.entries(cases)) {
  let out
  try {
    out = summarize(render(src))
  } catch (e) {
    out = { crash: String(e) }
  }
  console.log(`### ${name}\nSRC: ${JSON.stringify(src)}\n=> ${JSON.stringify(out)}\n`)
}
