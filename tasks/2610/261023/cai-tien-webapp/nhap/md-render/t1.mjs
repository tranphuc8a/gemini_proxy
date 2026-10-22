import { render } from './render.mjs'
const show = (s) => {
  const h = render(s)
  console.log(JSON.stringify(s), '\n  ', h.includes('color:#cc0000') || h.includes('katex-error') ? 'RED/ERROR' : 'ok', h.replace(/<math[\s\S]*?<\/math>/g, '').replace(/<span class="katex-html"[\s\S]*?(<\/span>)+/g, '[KH]').slice(0, 300))
}
show(String.raw`$\ce{H2O}$`)
show(String.raw`$\unknownmacro{x}$`)
show(String.raw`$ x $`)
show(String.raw`$\$5$`)
show(String.raw`$$\text{costs $5}$$`)
show(String.raw`Text \$5 and $x$`)
show(String.raw`$x$5`)
show(String.raw`a $x$ b`)
