import { describe, expect, it } from 'vitest'
import {
  classifyHref,
  formatBytes,
  isShareableDocId,
  isValidToken,
  parseShareHash,
  scanDocumentRefs,
  shareHashFor,
  shareLinkFor,
  shareTitleFromName,
  utf8Bytes
} from '../share'
import { referenceScanDocumentRefs } from './shareScanReference'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'

describe('the #share= address', () => {
  it('parses a token and a store', () => {
    expect(parseShareHash(`#share=${TOKEN}&backend=mysql`)).toEqual({ token: TOKEN, backend: 'mysql' })
    expect(parseShareHash(`#backend=mongo&share=${TOKEN}`)).toEqual({ token: TOKEN, backend: 'mongo' })
  })

  it('an unknown store is ignored (the server default is used), and no share key means not a share link', () => {
    expect(parseShareHash(`#share=${TOKEN}&backend=postgres`)).toEqual({ token: TOKEN, backend: null })
    expect(parseShareHash('')).toBeNull()
    expect(parseShareHash('#')).toBeNull()
    expect(parseShareHash('#section-2')).toBeNull()
    expect(parseShareHash('#backend=json')).toBeNull()
  })

  it('"#share" and "#share=" are NOT share addresses: an empty token is the heading anchor "Share", not a link', () => {
    // rehypeEnhance gives a heading named "Share" `href="#share"`, and `[x](#share)` is an ordinary anchor: clicking either
    // in the editor must not reload into the "Link not available" page.
    for (const hash of ['#share', '#share=', '#share=&backend=json', '#share&backend=json', '#backend=json&share=', '#share=%20', '#share=+']) {
      expect(parseShareHash(hash), hash).toBeNull()
    }
    expect(parseShareHash('#Share')).toBeNull()
    expect(parseShareHash('#sharing')).toBeNull()
    expect(parseShareHash('#share=x')).toEqual({ token: 'x', backend: null })
  })

  it('a malformed token still makes a share address (the page then says "not found")', () => {
    const parsed = parseShareHash('#share=%E0%A4%A&backend=json')
    expect(parsed).not.toBeNull()
    expect(isValidToken(parsed!.token)).toBe(false)
    expect(isValidToken(TOKEN)).toBe(true)
    expect(isValidToken('a'.repeat(101))).toBe(false)
    expect(isValidToken('../x')).toBe(false)
  })

  it('composes and round-trips', () => {
    expect(shareHashFor(TOKEN, 'json')).toBe(`#share=${TOKEN}&backend=json`)
    expect(parseShareHash(shareHashFor(TOKEN, 'json'))).toEqual({ token: TOKEN, backend: 'json' })
    expect(shareHashFor(TOKEN, null)).toBe(`#share=${TOKEN}`)
  })
})

describe('shareLinkFor', () => {
  const app = 'https://host.example/webapp/tranphuc8a/markdown-editor-pro/'

  it('is the app folder plus the hash, whatever the current address carries', () => {
    expect(shareLinkFor(app, TOKEN, 'json')).toBe(`${app}#share=${TOKEN}&backend=json`)
    expect(shareLinkFor(`${app}?read=1#old`, TOKEN, 'json')).toBe(`${app}#share=${TOKEN}&backend=json`)
    expect(shareLinkFor(`${app}#share=other&backend=mysql`, TOKEN, 'mysql')).toBe(`${app}#share=${TOKEN}&backend=mysql`)
  })

  it('never index.html: the installed app runs at index.html?source=pwa (ke-hoach §1.4)', () => {
    expect(shareLinkFor(`${app}index.html?source=pwa`, TOKEN, 'json')).toBe(`${app}#share=${TOKEN}&backend=json`)
    expect(shareLinkFor(`${app}INDEX.HTM`, TOKEN, 'json')).toBe(`${app}#share=${TOKEN}&backend=json`)
  })

  it('adds the folder slash when it is missing', () => {
    expect(shareLinkFor('http://127.0.0.1:8000/webapp/tranphuc8a/markdown-editor-pro', TOKEN, 'json')).toBe(
      `http://127.0.0.1:8000/webapp/tranphuc8a/markdown-editor-pro/#share=${TOKEN}&backend=json`
    )
    expect(shareLinkFor('http://h:1', TOKEN, 'json')).toBe(`http://h:1/#share=${TOKEN}&backend=json`)
  })
})

describe('classifyHref', () => {
  it.each([
    ['#intro', 'anchor'],
    ['https://example.com', 'external'],
    ['HTTP://example.com', 'external'],
    ['mailto:a@b.c', 'external'],
    ['tel:+84', 'external'],
    ['//cdn.example.com/x', 'external'],
    ['khac.md', 'internal'],
    ['./a/b.md#x', 'internal'],
    ['/duong-dan', 'internal'],
    ['', 'blocked'],
    [undefined, 'blocked'],
    ['javascript:alert(1)', 'blocked'],
    [' JavaScript:alert(1)', 'blocked'],
    ['data:text/html,x', 'blocked'],
    ['file:///etc/passwd', 'blocked']
  ])('%s → %s', (href, kind) => {
    expect(classifyHref(href as string | undefined)).toBe(kind)
  })
})

describe('scanDocumentRefs', () => {
  it('finds links to other documents and images by origin', () => {
    const refs = scanDocumentRefs(
      [
        '[khác](khac.md) and [ngoài](https://example.com) and [mục](#muc)',
        '![a](./a.png) ![b](https://img.example/b.png "title") ![c](data:image/png;base64,AAAA)',
        '<a href="/x">x</a> <img src=\'pic.jpg\'> <a href="https://ok">ok</a>',
        '[spaced](<other doc.md>)'
      ].join('\n')
    )
    expect(refs.internalLinks).toEqual(['khac.md', 'other doc.md', '/x'])
    expect(refs.relativeImages).toEqual(['./a.png', 'pic.jpg'])
    expect(refs.externalImages).toEqual(['https://img.example/b.png'])
    expect(refs.dataImages).toBe(1)
  })

  it('ignores code blocks and code spans', () => {
    const refs = scanDocumentRefs('```md\n[x](inside.md)\n![y](z.png)\n```\n\n`[q](code.md)`\n\n~~~\n<img src="a.png">\n~~~\n')
    expect(refs).toEqual({ internalLinks: [], relativeImages: [], externalImages: [], dataImages: 0 })
  })

  it('code spans follow CommonMark: a run closes with the next run of the SAME length', () => {
    expect(scanDocumentRefs('``a ` [x](one.md) ` b`` [y](two.md)').internalLinks).toEqual(['two.md'])
    expect(scanDocumentRefs('`one [x](a.md)`` [y](b.md)').internalLinks).toEqual(['a.md', 'b.md'])
    expect(scanDocumentRefs('x ``` [x](a.md)').internalLinks).toEqual(['a.md'])
    expect(scanDocumentRefs('`[x](a.md)` and ` [y](b.md) `').internalLinks).toEqual([])
  })

  it('reads an escaped bracket, nested parentheses and a bracket inside a label like the renderer', () => {
    expect(scanDocumentRefs('[a \\] b](x.md) [c [d](y.md)').internalLinks).toEqual(['x.md', 'y.md'])
    expect(scanDocumentRefs('[a](b (c) d.md) [e](f)').internalLinks).toEqual(['b', 'f'])
    expect(scanDocumentRefs('![a](./i.png)![b](./j.png)').relativeImages).toEqual(['./i.png', './j.png'])
    expect(scanDocumentRefs('<A HREF=x.md>t</A> <IMG SRC="y.png">')).toMatchObject({ internalLinks: ['x.md'], relativeImages: ['y.png'] })
  })
})

/**
 * M3V (góp ý 6). The scan runs every time the owner opens the share dialog, on a document of up to megabytes, so one
 * hostile or merely odd line must not cost more than linear time. The M3 regexes were quadratic on both of these.
 */
describe('scanDocumentRefs is linear on pathological input', () => {
  const time = (text: string) => {
    const start = performance.now()
    const refs = scanDocumentRefs(text)
    return { refs, ms: performance.now() - start }
  }
  // 256 KB each: a linear scan needs ~10 ms, the quadratic regexes needed seconds. 1.5 s leaves room for a loaded machine.
  const BUDGET_MS = 1500

  const cases: [string, (n: number) => string][] = [
    ['a line of "[" with no "]"', (n) => '['.repeat(n)],
    ['"<a " repeated, never closed', (n) => '<a '.repeat(n / 3)],
    ['"<img " repeated, never closed', (n) => '<img '.repeat(n / 5)],
    ['"<a href=" repeated, never closed', (n) => '<a href='.repeat(n / 8)],
    ['"<a href=" with an open quote, repeated', (n) => '<a href="x '.repeat(n / 11)],
    ['"[a](" repeated, never closed', (n) => '[a]('.repeat(n / 4)],
    ['"[a](b(" repeated with open parentheses', (n) => '[a](b('.repeat(n / 6)],
    ['"![" repeated', (n) => '!['.repeat(n / 2)],
    ['"](" repeated', (n) => ']('.repeat(n / 2)],
    ['an escape at the end of a line, repeated', (n) => '[x\\\n'.repeat(n / 4)],
    ['a long run of "(" after "]("', (n) => '[a](' + '('.repeat(n)],
    ['a long target never closed', (n) => '[a](' + 'x'.repeat(n)],
    ['a backtick run, one x, a shorter run', (n) => '`'.repeat(n / 2) + 'x' + '`'.repeat(n / 2 - 1)],
    ['backtick runs of growing length', (n) => Array.from({ length: Math.floor(Math.sqrt(n)) }, (_, i) => '`'.repeat(i + 1) + 'a').join('')],
    ['"<" repeated', (n) => '<'.repeat(n)],
    ['"href" then spaces and no "="', (n) => `<a href${' '.repeat(n)}`]
  ]

  it.each(cases)('%s: 256 KB stays inside the budget, and a small copy still answers what the regex scanner did', (_name, make) => {
    const sample = make(4096)
    expect(scanDocumentRefs(sample)).toEqual(referenceScanDocumentRefs(sample))
    time(make(65_536))
    expect(time(make(262_144)).ms).toBeLessThan(BUDGET_MS)
  })

  it('still finds what follows the pathological lines', () => {
    const text = `${'['.repeat(60_000)}\n${'<a '.repeat(30_000)}\n[ok](after.md)\n<img src="after.png">`
    const { refs, ms } = time(text)
    expect(refs.internalLinks).toEqual(['after.md'])
    expect(refs.relativeImages).toEqual(['after.png'])
    expect(ms).toBeLessThan(BUDGET_MS)
  })

  it('ordinary markdown with tens of thousands of links scans quickly and completely', () => {
    const paragraph = 'Một đoạn văn có [liên kết](muc-$.md) và ![ảnh](anh-$.png) và <a href="trang-$.html">html</a>.\n'
    const text = Array.from({ length: 10_000 }, (_, i) => paragraph.split('$').join(String(i))).join('')
    const { refs, ms } = time(text)
    expect(refs.internalLinks).toHaveLength(20_000)
    expect(refs.relativeImages).toHaveLength(10_000)
    expect(ms).toBeLessThan(BUDGET_MS)
  })
})

describe('the linear scanner answers exactly what the regex scanner did (fuzz)', () => {
  // Pieces made of the tokens that matter, so most strings are nearly valid links/tags. No backtick, `~` or `\r`
  // (see shareScanReference.ts for the one deliberate difference).
  const PIECES = [
    '[', ']', '(', ')', '!', '\\', '<a ', '<img ', '<a', '<A ', '<IMG ', '>', 'href=', 'src=', 'HREF=', 'SRC =', '"', "'", ' ', '\n',
    'x.md', '/y', 'https://e.x', 'data:image/png;base64,AA', './i.png', '<', '#h', 'a', 'b c', 'hr', 'ef=', 'data-href=', '/>'
  ]

  function rng(seed: number) {
    let state = seed >>> 0
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 0x1_0000_0000
    }
  }

  it('on 30,000 random strings', () => {
    const next = rng(20261024)
    for (let round = 0; round < 30_000; round += 1) {
      const length = 1 + Math.floor(next() * 14)
      let text = ''
      for (let i = 0; i < length; i += 1) text += PIECES[Math.floor(next() * PIECES.length)]
      const expected = referenceScanDocumentRefs(text)
      const actual = scanDocumentRefs(text)
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`differs on ${JSON.stringify(text)}\nold: ${JSON.stringify(expected)}\nnew: ${JSON.stringify(actual)}`)
      }
    }
  })
})

describe('sizes and titles', () => {
  it('counts UTF-8 bytes, Vietnamese and emoji included', () => {
    for (const text of ['', 'abc', 'Tiếng Việt có dấu', 'ệ'.repeat(1000), '😀👍', 'aé中😀', '\ud800 lone']) {
      expect(utf8Bytes(text)).toBe(new TextEncoder().encode(text).length)
    }
  })

  it('formats sizes in decimal units', () => {
    expect(formatBytes(1)).toBe('1 byte')
    expect(formatBytes(999)).toBe('999 bytes')
    expect(formatBytes(1500)).toBe('2 KB')
    expect(formatBytes(1_200_000)).toBe('1.2 MB')
    expect(formatBytes(2_000_000)).toBe('2 MB')
  })

  it('turns a file name into a title', () => {
    expect(shareTitleFromName('Ghi chú.md')).toBe('Ghi chú')
    expect(shareTitleFromName('notes.MARKDOWN')).toBe('notes')
    expect(shareTitleFromName('a.txt')).toBe('a')
    expect(shareTitleFromName('')).toBe('Untitled')
    expect(shareTitleFromName(undefined)).toBe('Untitled')
    expect(shareTitleFromName('x'.repeat(300))).toHaveLength(200)
  })

  it('knows which documents can be shared', () => {
    expect(isShareableDocId('file-lz3k-1-abcde')).toBe(true)
    expect(isShareableDocId('welcome')).toBe(true)
    expect(isShareableDocId('root')).toBe(false)
    expect(isShareableDocId('has space')).toBe(false)
    expect(isShareableDocId('x'.repeat(81))).toBe(false)
    expect(isShareableDocId(null)).toBe(false)
  })
})
