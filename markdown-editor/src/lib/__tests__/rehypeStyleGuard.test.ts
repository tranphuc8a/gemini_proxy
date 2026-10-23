import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MarkdownView from '../../components/MarkdownView'
import { cleanStyle } from '../rehypeStyleGuard'

describe('cleanStyle', () => {
  it.each([
    ['color: red', 'color: red'],
    ['color:red; text-align:center', 'color:red; text-align:center'],
    ['font-weight: bold; background: url(https://tracker.test/p.png)', 'font-weight: bold'],
    ['background-image:URL( "https://tracker.test/p.png" )', ''],
    ['background: image-set("https://tracker.test/p.png" 1x)', ''],
    ['background: -webkit-image-set("https://tracker.test/p.png" 1x)', ''],
    ['list-style: url(x.png) inside; color: blue', 'color: blue'],
    ['cursor: url(c.cur), auto', ''],
    ['border-image: cross-fade(url(a.png), url(b.png)) 30', ''],
    ['background: element(#x)', ''],
    ['content: src("https://x.test/a.png")', ''],
    ['width: expression(alert(1))', ''],
    ['behavior: url(x.htc); color: green', 'color: green'],
    ['-moz-binding: url(x.xml#y)', ''],
    ['position: fixed; inset: 0; z-index: 9999', 'inset: 0; z-index: 9999'],
    ['position:sticky;top:0', 'top:0'],
    ['position: -webkit-sticky', ''],
    ['position: var(--p)', ''],
    ['position: relative; left: 2px', 'position: relative; left: 2px'],
    ['position: absolute !important', 'position: absolute !important'],
    // CSS escapes and comments are what the CSS parser decodes: u\72l( is url(, ur/**/l is not even a function.
    ['background: u\\72l(https://tracker.test/p.png)', ''],
    ['background: \\75 rl(https://tracker.test/p.png)', ''],
    ['pos\\ition: fixed', ''],
    ['background: url/**/(https://tracker.test/p.png)', ''],
    ['background: red; @import "x.css"', 'background: red'],
    // Shorthands: url( after another value of the same declaration (white space is gone in the canonical text, so
    // there is no boundary on the left to wait for).
    ['background: red url(https://tracker.test/p.png)', ''],
    ['background: #fff url("https://tracker.test/p.png") no-repeat; color: red', 'color: red'],
    ['background: no-repeat url(https://tracker.test/p.png)', ''],
    ['background: 0 0 url(https://tracker.test/p.png)', ''],
    ['background:center/cover url(https://tracker.test/p.png)', ''],
    ['border-image: 30 url(https://tracker.test/p.png)', ''],
    ['list-style: square url(https://tracker.test/p.png)', ''],
    ['background: red/**/url(https://tracker.test/p.png)', ''],
    ['background: red\\ url(https://tracker.test/p.png)', ''],
    ['background: red -webkit-image-set("https://tracker.test/p.png" 1x)', ''],
    ['mask: linear-gradient(#000, #000) 0 0 / 10px no-repeat, red url(m.svg)', ''],
    ['filter: blur(2px) url(#f)', ''],
    ['content: "a" attr(data-x)', ''],
    // …and still nothing safe goes: no ordinary function name ends in one of the blocked ones.
    ['background: linear-gradient(90deg, red, blue) no-repeat', 'background: linear-gradient(90deg, red, blue) no-repeat'],
    ['transform: translate(2px) rotate(3deg) scale(1.1)', 'transform: translate(2px) rotate(3deg) scale(1.1)'],
    ['color: color-mix(in srgb, red 40%, blue)', 'color: color-mix(in srgb, red 40%, blue)'],
    ['box-shadow: 0 0 2px rgba(0, 0, 0, .3); width: calc(100% - 2em)', 'box-shadow: 0 0 2px rgba(0, 0, 0, .3); width: calc(100% - 2em)'],
    ['grid-template-columns: repeat(2, minmax(0, 1fr))', 'grid-template-columns: repeat(2, minmax(0, 1fr))'],
    ['font-family: "Source Sans", sans-serif; background: var(--bg, #fff) border-box', 'font-family: "Source Sans", sans-serif; background: var(--bg, #fff) border-box'],
    // A semicolon inside a data URL or a string does not split the declaration.
    ['background: url("data:image/png;base64,AAAA"); color: red', 'color: red'],
    ['font-family: "a;b", serif', 'font-family: "a;b", serif'],
    ['', ''],
    ['   ;  ; ', '']
  ])('%j → %j', (input, expected) => {
    expect(cleanStyle(input)).toBe(expected)
  })
})

describe('rehypeStyleGuard in the pipeline', () => {
  const html = (md: string) => renderToStaticMarkup(createElement(MarkdownView, { source: md, theme: 'light' }))

  it('strips resource-loading and page-covering declarations from raw HTML, keeps the rest', () => {
    const out = html('<span style="color:red;background:url(https://tracker.test/p.png)">t</span>\n\n<div style="position:fixed;top:0;left:0;width:100%">overlay</div>')
    expect(out).toContain('<span style="color:red">t</span>')
    expect(out).not.toContain('tracker.test')
    expect(out).not.toMatch(/position:\s*fixed/)
    expect(out).toContain('top:0')
  })

  it('strips url( inside shorthands too (background, border-image, list-style), from every element', () => {
    const out = html(
      [
        '<span style="color:red;background:#fff url(https://tracker.test/a.png) no-repeat">a</span>',
        '<div style="border-image: 30 url(https://tracker.test/b.png)">b</div>',
        '<ul><li style="list-style: square url(https://tracker.test/c.png)">c</li></ul>',
        '<p style="background: red/**/url(https://tracker.test/d.png)">d</p>'
      ].join('\n\n')
    )
    expect(out).toContain('<span style="color:red">a</span>')
    expect(out).not.toContain('tracker.test')
    expect(out).not.toContain('url(')
  })

  it('removes the attribute when nothing safe is left', () => {
    expect(html('<p style="background-image:url(x.png)">x</p>')).toMatch(/<p data-line="1">x<\/p>/)
  })

  it('leaves KaTeX output (generated after the guard) with its own inline styles', () => {
    const out = html('$$\n\\frac{a}{b}\n$$')
    expect(out).toContain('class="katex-display"')
    expect(out).toMatch(/style="(?:height|vertical-align|top|margin)/)
  })
})
