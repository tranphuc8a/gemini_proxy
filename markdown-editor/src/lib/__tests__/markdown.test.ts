import { describe, expect, it } from 'vitest'
import {
  columnAtOffset,
  extractHeadings,
  findMatches,
  getDocumentStats,
  lineAtOffset,
  offsetAtLine,
  replaceAll,
  slugify,
  stripInlineMarkdown
} from '../markdown'

describe('slugify', () => {
  it('produces GitHub-style anchors', () => {
    expect(slugify('Hello World')).toBe('hello-world')
    expect(slugify('What is this?!')).toBe('what-is-this')
    expect(slugify('  Spaced   out  ')).toBe('spaced-out')
  })

  it('folds Vietnamese diacritics', () => {
    expect(slugify('Tiếng Việt')).toBe('tieng-viet')
    expect(slugify('Đường dẫn')).toBe('duong-dan')
  })

  it('never leaves leading or trailing dashes', () => {
    expect(slugify('--- Title ---')).toBe('title')
    expect(slugify('###')).toBe('')
  })
})

describe('extractHeadings', () => {
  it('reads ATX headings with levels and lines', () => {
    const headings = extractHeadings('# One\n\ntext\n\n### Three\n')
    expect(headings).toEqual([
      { level: 1, text: 'One', slug: 'one', line: 1 },
      { level: 3, text: 'Three', slug: 'three', line: 5 }
    ])
  })

  it('ignores hashes inside fenced code blocks', () => {
    const markdown = '# Real\n\n```bash\n# not a heading\n```\n\n## Also real\n'
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['Real', 'Also real'])
  })

  it('handles tilde fences', () => {
    const markdown = '~~~\n# hidden\n~~~\n# visible\n'
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['visible'])
  })

  it('strips inline markup and closing hashes', () => {
    const headings = extractHeadings('## **Bold** and `code` ##\n')
    expect(headings[0].text).toBe('Bold and code')
  })

  it('de-duplicates repeated slugs', () => {
    const headings = extractHeadings('# Setup\n# Setup\n# Setup\n')
    expect(headings.map((h) => h.slug)).toEqual(['setup', 'setup-1', 'setup-2'])
  })

  it('requires a space after the hashes', () => {
    expect(extractHeadings('#no-space\n')).toEqual([])
  })
})

describe('stripInlineMarkdown', () => {
  it('unwraps links, images and emphasis', () => {
    expect(stripInlineMarkdown('[text](http://x)')).toBe('text')
    expect(stripInlineMarkdown('![alt](img.png)')).toBe('alt')
    expect(stripInlineMarkdown('**bold** _italic_ ~~gone~~')).toBe('bold italic gone')
  })
})

describe('getDocumentStats', () => {
  it('counts words, lines and paragraphs', () => {
    const stats = getDocumentStats('# Title\n\nHello world here.\n\nSecond block.')
    expect(stats.words).toBe(7)
    expect(stats.lines).toBe(5)
    expect(stats.paragraphs).toBe(3)
    expect(stats.headings).toBe(1)
  })

  it('reports zero words for an empty document', () => {
    const stats = getDocumentStats('   \n  ')
    expect(stats.words).toBe(0)
    expect(stats.charactersNoSpaces).toBe(0)
  })

  it('counts fenced blocks once each', () => {
    expect(getDocumentStats('```js\na\n```\n\n```py\nb\n```\n').codeBlocks).toBe(2)
  })

  it('rounds reading time up to at least one minute', () => {
    expect(getDocumentStats('one word').readingMinutes).toBe(1)
    expect(getDocumentStats(Array.from({ length: 450 }, () => 'w').join(' ')).readingMinutes).toBe(3)
  })
})

describe('offset and line mapping', () => {
  const text = 'alpha\nbeta\ngamma'

  it('maps offsets to 1-based lines', () => {
    expect(lineAtOffset(text, 0)).toBe(1)
    expect(lineAtOffset(text, 6)).toBe(2)
    expect(lineAtOffset(text, text.length)).toBe(3)
  })

  it('maps lines back to offsets', () => {
    expect(offsetAtLine(text, 1)).toBe(0)
    expect(offsetAtLine(text, 2)).toBe(6)
    expect(offsetAtLine(text, 3)).toBe(11)
  })

  it('clamps out-of-range input', () => {
    expect(lineAtOffset(text, -5)).toBe(1)
    expect(lineAtOffset(text, 999)).toBe(3)
    expect(offsetAtLine(text, 0)).toBe(0)
    expect(offsetAtLine(text, 99)).toBe(11)
  })

  it('reports the column within a line', () => {
    expect(columnAtOffset(text, 0)).toBe(0)
    expect(columnAtOffset(text, 8)).toBe(2)
  })

  it('round-trips line to offset to line', () => {
    for (let line = 1; line <= 3; line += 1) {
      expect(lineAtOffset(text, offsetAtLine(text, line))).toBe(line)
    }
  })
})

describe('search', () => {
  it('finds every match case-insensitively by default', () => {
    expect(findMatches('Cat cat CAT', 'cat')).toHaveLength(3)
    expect(findMatches('Cat cat CAT', 'cat', { caseSensitive: true })).toHaveLength(1)
  })

  it('reports match boundaries', () => {
    expect(findMatches('a-bug-here', 'bug')).toEqual([{ start: 2, end: 5 }])
  })

  it('honours whole-word mode', () => {
    expect(findMatches('cat category', 'cat', { wholeWord: true })).toHaveLength(1)
  })

  it('treats the query literally unless regex mode is on', () => {
    expect(findMatches('a.b axb', 'a.b')).toEqual([{ start: 0, end: 3 }])
    expect(findMatches('a.b axb', 'a.b', { regex: true })).toHaveLength(2)
  })

  it('returns nothing for an invalid regex instead of throwing', () => {
    expect(findMatches('text', '([', { regex: true })).toEqual([])
  })

  it('does not hang on a zero-length regex match', () => {
    expect(findMatches('abc', 'x*', { regex: true }).length).toBeLessThanOrEqual(4)
  })

  it('replaces all matches without interpreting $ patterns', () => {
    expect(replaceAll('a a a', 'a', 'b')).toBe('b b b')
    expect(replaceAll('x', 'x', '$&$&')).toBe('$&$&')
  })
})
