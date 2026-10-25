import { describe, expect, it } from 'vitest'
import { absolutizeCssUrls, buildHtmlDocument, embedFontFaces } from '../exporters'

/** md-render task 15 (batch M6): the exported HTML must still find KaTeX's fonts (absolute URLs), or carry them. */

const BASE = 'https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/index-abc123.css'

describe('absolutizeCssUrls', () => {
  it.each([
    ['src:url(KaTeX_Main-Regular.woff2) format("woff2")', 'src:url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/KaTeX_Main-Regular.woff2") format("woff2")'],
    ['src: url( "fonts/a.woff2" )', 'src: url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/fonts/a.woff2")'],
    ["src: url('./a.woff2')", 'src: url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/a.woff2")'],
    ['src: url(../icons/a.svg)', 'src: url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/icons/a.svg")'],
    ['src: url(/abs/a.woff2)', 'src: url("https://host.test/abs/a.woff2")'],
    ['src: URL(a.woff2)', 'src: url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/a.woff2")'],
    ['src: url(//cdn.test/a.woff2)', 'src: url("https://cdn.test/a.woff2")'],
    ['src: url("a b.woff2")', 'src: url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/a%20b.woff2")']
  ])('%s', (input, output) => {
    expect(absolutizeCssUrls(input, BASE)).toBe(output)
  })

  it.each([
    'src: url(data:font/woff2;base64,AAAA)',
    'src: url("data:image/svg+xml;utf8,<svg/>")',
    'background: url(#gradient)',
    'src: url(https://other.test/a.woff2)',
    'src: url(blob:https://x/1)',
    'color: red',
    ''
  ])('leaves %j as it is', (input) => {
    expect(absolutizeCssUrls(input, BASE)).toBe(input)
  })

  it('handles several urls and surrounding rules', () => {
    const css = '@font-face{font-family:K;src:url(a.woff2) format("woff2"),url(a.woff) format("woff")}.x{background:url(i.png)}'
    const out = absolutizeCssUrls(css, BASE)
    expect(out.match(/url\("https:\/\/host\.test\/webapp\/tranphuc8a\/markdown-editor-pro\/assets\/[a-z0-9.]+"\)/g)).toHaveLength(3)
    expect(out.startsWith('@font-face{font-family:K;')).toBe(true)
    expect(out.endsWith('}')).toBe(true)
  })

  it('an unclosed url( keeps the rest as it was; a 256 KB sheet of url( is linear', () => {
    expect(absolutizeCssUrls('a{b:url(x.png) c:url(y.png', BASE)).toBe('a{b:url("https://host.test/webapp/tranphuc8a/markdown-editor-pro/assets/x.png") c:url(y.png')
    const started = performance.now()
    absolutizeCssUrls('url('.repeat(90_000), BASE)
    absolutizeCssUrls('url("'.repeat(50_000), BASE)
    absolutizeCssUrls('url(a)'.repeat(40_000), BASE)
    expect(performance.now() - started).toBeLessThan(1500 * Number(process.env.MD_PERF_SLACK ?? 1))
  })
})

describe('embedFontFaces', () => {
  const face = (name: string) => `@font-face{font-family:KaTeX_${name};src:url("https://h.test/${name}.woff2") format("woff2"),url("https://h.test/${name}.woff") format("woff");font-weight:400}`
  const loader = (log: string[]) => async (url: string) => {
    log.push(url)
    return `data:font/woff2;base64,${'A'.repeat(100)}`
  }

  it('replaces the sources of KaTeX woff2 faces with the data URL, once each', async () => {
    const log: string[] = []
    const out = await embedFontFaces(face('Main') + '.x{color:red}' + face('Math'), loader(log))
    expect(log).toEqual(['https://h.test/Main.woff2', 'https://h.test/Math.woff2'])
    expect(out).toContain('src:url("data:font/woff2;base64,')
    expect(out).not.toContain('https://h.test')
    expect(out).toContain('.x{color:red}')
    expect(out).toContain('font-weight:400')
  })

  it('leaves other families, failed loads and faces beyond the budget alone', async () => {
    const other = '@font-face{font-family:Inter;src:url("https://h.test/i.woff2") format("woff2")}'
    const log: string[] = []
    expect(await embedFontFaces(other, loader(log))).toBe(other)
    expect(log).toEqual([])
    expect(await embedFontFaces(face('Main'), async () => null)).toBe(face('Main'))
    const log2: string[] = []
    const out = await embedFontFaces(face('A') + face('B') + face('C'), loader(log2), 250)
    expect(log2.length).toBe(3)
    expect(out.match(/data:font\/woff2/g)).toHaveLength(2)
    expect(out).toContain('https://h.test/C.woff2')
  })
})

describe('buildHtmlDocument', () => {
  it('escapes the title, carries theme, styles and body', () => {
    const html = buildHtmlDocument('<b>"x"</b>', 'dark', '.a{color:red}', '<p>hi</p>')
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('<title>&#60;b&#62;&#34;x&#34;&#60;/b&#62;</title>')
    expect(html).toContain('.a{color:red}')
    expect(html).toContain('<article class="markdown-body">\n<p>hi</p>\n</article>')
  })
})
