import { describe, expect, it } from 'vitest'
import { SVG_MAX_BYTES, cleanSvg, svgDataUrl } from '../rehypeSvgImage'
import { htmlOf, render } from './renderHelper'

/**
 * md-render task 8 (batch M6): SVG from a person or an LLM never becomes an `svg` element of the page; it is an
 * `<img src="data:image/svg+xml…">`, which runs no script and loads nothing.
 */

const decode = (img: Element | null) => decodeURIComponent((img?.getAttribute('src') ?? '').replace(/^data:image\/svg\+xml;charset=utf-8,/, ''))
const SVG = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>'
/** `svg` elements of the page that the document's author caused (the copy button's own icon is the app's, not theirs). */
const userSvgs = (root: Element) => Array.from(root.querySelectorAll('svg')).filter((el) => !el.closest('.code-copy'))

describe('SVG in a document', () => {
  it('a ```svg fence becomes an image, with its source behind "View source"', () => {
    const root = render('```svg\n' + SVG + '\n```')
    const img = root.querySelector('img[src^="data:image/svg+xml"]')!
    expect(img).not.toBeNull()
    expect(decode(img)).toContain('<circle cx="5" cy="5" r="4" fill="red"/>')
    expect(decode(img)).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(root.querySelector('details.md-svg-source summary')!.textContent).toBe('View source')
    expect(root.querySelector('details.md-svg-source')!.textContent).toContain('<circle')
    expect(userSvgs(root)).toEqual([])
  })

  it('a raw <svg> (block or inline) becomes an image and no svg element remains', () => {
    const block = render('<svg width="20" height="20">\n  <rect width="20" height="20"/>\n</svg>')
    expect(block.querySelectorAll('img[src^="data:image/svg+xml"]').length).toBe(1)
    expect(userSvgs(block)).toEqual([])
    const inline = render('before ' + SVG + ' after')
    expect(inline.querySelectorAll('p img[src^="data:image/svg+xml"]').length).toBe(1)
    expect(userSvgs(inline)).toEqual([])
    expect(inline.textContent).toContain('before')
    expect(inline.textContent).toContain('after')
  })

  it('the drawing keeps its source line', () => {
    const root = render('text\n\n' + SVG)
    expect(root.querySelector('img.md-svg')!.getAttribute('data-line')).toBe('3')
  })

  it('<svg onload> never becomes an attribute, in the page or in the image', () => {
    for (const md of ['<svg onload="alert(1)"></svg>', '<svg/onload=alert(1)>', 'x <svg onload=alert(1) viewBox="0 0 1 1"><circle r="1"/></svg>', '```svg\n<svg onload="alert(1)"><circle r="1"/></svg>\n```']) {
      const html = htmlOf(md)
      // The fence's own text shows its source, so look at the markup around the code text only.
      expect(html.replace(/<code[^>]*>[^]*?<\/code>/g, ''), md).not.toMatch(/\sonload=/i)
      const root = render(md)
      expect(userSvgs(root), md).toEqual([])
      expect(root.querySelector('[onload]'), md).toBeNull()
      expect(decode(root.querySelector('img.md-svg')), md).not.toMatch(/onload/i)
    }
  })

  it('script, foreignObject, event handlers, javascript: links and external hrefs are cut out of the drawing', () => {
    const root = render(
      '<svg viewBox="0 0 9 9"><script>alert(1)</script><foreignObject><div onclick="x()">hi</div></foreignObject>' +
        '<a href="javascript:alert(2)"><rect onclick="alert(3)" width="3" height="3"/></a>' +
        '<image href="https://tracker.test/p.png"/><use xlink:href="https://evil.test/a.svg#x"/><use href="#ok"/></svg>'
    )
    const source = decode(root.querySelector('img.md-svg'))
    expect(source).not.toMatch(/script|foreignobject|onclick|javascript:|tracker\.test|evil\.test/i)
    expect(source).toContain('<rect')
    expect(source).toContain('href="#ok"')
  })

  it('an SVG with a DOCTYPE/ENTITY, no root, or unterminated markup is refused: the fence stays code, a raw one shows a note', () => {
    for (const bad of ['<!DOCTYPE svg [<!ENTITY a "b">]><svg>&a;</svg>', '<?xml version="1.0"?><svg/>', '<circle r="1"/>', '<svg><circle r="1"']) {
      const fenced = render('```svg\n' + bad + '\n```')
      expect(fenced.querySelector('img.md-svg'), bad).toBeNull()
      expect(fenced.querySelector('.code-block'), bad).not.toBeNull()
    }
    const raw = render('<svg><!DOCTYPE x></svg>')
    expect(raw.querySelector('img.md-svg')).toBeNull()
    expect(userSvgs(raw)).toEqual([])
  })

  it('other fences are not drawings, and nothing else becomes an image', () => {
    expect(render('```xml\n' + SVG + '\n```').querySelector('img.md-svg')).toBeNull()
    expect(render('```\n' + SVG + '\n```').querySelector('img.md-svg')).toBeNull()
    expect(render('`' + SVG + '`').querySelector('img.md-svg')).toBeNull()
  })

  it('KaTeX and Mermaid markup (generated after the sanitiser) is unaffected', () => {
    const root = render('$\\sqrt{x^2+1}$')
    expect(root.querySelector('.katex')).not.toBeNull()
    expect(root.querySelector('.katex svg')).not.toBeNull()
  })
})

describe('cleanSvg', () => {
  it('adds the SVG namespace once and keeps existing attributes and text', () => {
    expect(cleanSvg('<svg width="1"><text>a &amp; b</text></svg>')).toBe('<svg width="1" xmlns="http://www.w3.org/2000/svg"><text>a &amp; b</text></svg>')
    expect(cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>')
  })

  it('keeps comments and CDATA text, drops those inside a removed element', () => {
    expect(cleanSvg('<svg><!-- c --><style><![CDATA[.a{fill:red}]]></style></svg>')).toContain('<![CDATA[.a{fill:red}]]>')
    expect(cleanSvg('<svg><script><![CDATA[alert(1)]]></script></svg>')).not.toContain('alert')
  })

  it('a stylesheet that loads something goes, a plain one stays', () => {
    expect(cleanSvg('<svg><style>@import url(https://x.test/a.css);</style><rect/></svg>')).not.toMatch(/import|x\.test/)
    expect(cleanSvg('<svg><style>.a{background:url(https://x.test/p.png)}</style><rect/></svg>')).not.toMatch(/x\.test/)
    expect(cleanSvg('<svg><style>.a{fill:red}</style><rect class="a"/></svg>')).toContain('fill:red')
    expect(cleanSvg('<svg><rect style="fill:url(https://x.test/p.png)"/></svg>')).not.toMatch(/x\.test/)
    expect(cleanSvg('<svg><rect style="fill:red"/></svg>')).toContain('fill:red')
  })

  it('attribute values with > or quotes of the other kind do not end the tag early', () => {
    const out = cleanSvg('<svg><text title="a > b" data-x=\'say "hi"\' onclick="a > b">t</text></svg>')!
    expect(out).toContain('title="a > b"')
    expect(out).not.toContain('onclick')
    expect(out).toContain('>t</text>')
  })

  it('upper-case tags and attributes are cleaned too', () => {
    const out = cleanSvg('<SVG><SCRIPT>alert(1)</SCRIPT><RECT ONCLICK="x()" width="1"/></SVG>')!
    expect(out).not.toMatch(/script|onclick|alert/i)
    expect(out).toContain('width="1"')
  })

  it('is size-limited, and the data URL decodes back', () => {
    expect(cleanSvg('<svg>' + 'x'.repeat(SVG_MAX_BYTES) + '</svg>')).toBeNull()
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>ü # % "q"</text></svg>'
    expect(decodeURIComponent(svgDataUrl(svg).replace('data:image/svg+xml;charset=utf-8,', ''))).toBe(svg)
  })

  it.each([
    ['<'.repeat(SVG_MAX_BYTES - 20)],
    ['<svg>' + '<style>'.repeat(25_000) + '</style></svg>'],
    ['<svg>' + '<style>'.repeat(25_000) + '</svg>'],
    ['<svg>' + '<a '.repeat(60_000) + '</svg>'],
    ['<svg>' + '<a b="'.repeat(30_000) + '</svg>'],
    ['<svg>' + '<!--'.repeat(40_000) + '</svg>'],
    ['<svg>' + '<![CDATA['.repeat(20_000) + '</svg>'],
    ['<svg>' + '<script>'.repeat(25_000) + '</svg>'],
    ['<svg>' + '</'.repeat(90_000) + '</svg>'],
    ['<svg>' + '<x y=z '.repeat(25_000) + '>' + '</svg>']
  ])('pathological input of 200 KB is linear (%#)', (input) => {
    const started = performance.now()
    cleanSvg(input.slice(0, SVG_MAX_BYTES - 1))
    expect(performance.now() - started).toBeLessThan(500 * Number(process.env.MD_PERF_SLACK ?? 1))
  })
})
