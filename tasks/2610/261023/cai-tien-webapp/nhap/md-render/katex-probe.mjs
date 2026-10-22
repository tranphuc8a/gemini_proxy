import katex from 'katex'
const tryK = (tex, opts = {}) => {
  try {
    const html = katex.renderToString(tex, { displayMode: true, throwOnError: true, ...opts })
    const red = html.includes('#cc0000')
    return red ? 'RENDERED-WITH-RED' : 'ok'
  } catch (e) {
    return 'ERR ' + e.message.slice(0, 90)
  }
}
const list = {
  relax: String.raw`\relax -b + c`,
  align: String.raw`\begin{align} a &= b \\ c &= d \end{align}`,
  'align*': String.raw`\begin{align*} a &= b \end{align*}`,
  equation: String.raw`\begin{equation} E=mc^2 \end{equation}`,
  gather: String.raw`\begin{gather} a \\ b \end{gather}`,
  multline: String.raw`\begin{multline} a \\ b \end{multline}`,
  eqnarray: String.raw`\begin{eqnarray} a &=& b \end{eqnarray}`,
  split: String.raw`\begin{split} a &= b \end{split}`,
  alignat: String.raw`\begin{alignat}{2} a &= b & c &= d \end{alignat}`,
  flalign: String.raw`\begin{flalign} a &= b \end{flalign}`,
  cases: String.raw`f(x)=\begin{cases} 1 & x>0 \\ 0 \end{cases}`,
  pmatrix: String.raw`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`,
  CD: String.raw`\begin{CD} A @>a>> B \end{CD}`,
  boxed: String.raw`\boxed{x=2}`,
  tag: String.raw`x \tag{1}`,
  label: String.raw`x \label{eq:1}`,
  eqref: String.raw`\eqref{eq:1}`,
  ref: String.raw`\ref{eq:1}`,
  nonumber: String.raw`\begin{align} a \nonumber \\ b \notag \end{align}`,
  ce_without_mhchem: String.raw`\ce{H2O}`,
  require: String.raw`\require{cancel} \cancel{x}`,
  bm: String.raw`\bm{x}`,
  si: String.raw`\SI{3}{m}`,
  operatorname: String.raw`\operatorname{argmax}_x f`,
  textcolor: String.raw`\textcolor{red}{x}`,
  href: String.raw`\href{javascript:alert(1)}{x}`,
  dfrac: String.raw`\dfrac{a}{b}`,
  newline_in_text: String.raw`a \\[2pt] b`,
  emptygroup_minus: String.raw`{}-b`,
}
for (const [k, v] of Object.entries(list)) console.log(k.padEnd(20), tryK(v))
await import('katex/contrib/mhchem')
console.log('after mhchem import:', 'ce', tryK(String.raw`\ce{H2O + CO2 -> H2CO3}`), 'pu', tryK(String.raw`\pu{123 kJ/mol}`))
const macros = { '\\label': '\\htmlId{#1}{}', '\\eqref': '\\text{(#1)}', '\\ref': '\\text{#1}' }
console.log('label macro (htmlId, trust false):', tryK(String.raw`x \label{eq:1}`, { macros: { ...macros } }))
console.log('label macro gobble:', tryK(String.raw`x \label{eq:1}`, { macros: { '\\label': '\\@gobble{#1}' } }))
console.log('label macro vphantom:', tryK(String.raw`x \label{eq:1}`, { macros: { '\\label': '\\vphantom{}' } }), '(leaves {eq:1})')
console.log('label macro mathrlap phantom:', tryK(String.raw`x \label{eq:1}`, { macros: { '\\label': '\\mathrlap{\\phantom{\\text{#1}}}' } }))
console.log('eqref macro:', tryK(String.raw`\eqref{eq:1}`, { macros: { '\\eqref': '\\text{(#1)}' } }))
