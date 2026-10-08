import { describe, expect, it } from 'vitest'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { contrastRatio, ensureContrast, parseColor, withContrast } from '../contrast'
import { prismLanguage } from '../codeLanguages'
import { markdownUrlTransform } from '../rehypeEnhance'

describe('contrast arithmetic', () => {
  it('parses hex, rgb() and hsl()', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255])
    expect(parseColor('#1f2328')).toEqual([31, 35, 40])
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30])
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual([255, 0, 0])
    expect(parseColor('inherit')).toBeNull()
  })

  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('leaves passing colours alone and lifts failing ones just past the line', () => {
    expect(ensureContrast('#1f2328', '#ffffff')).toBe('#1f2328')
    const lifted = ensureContrast('#a0a1a7', '#f3f5f7')
    expect(contrastRatio(lifted, '#f3f5f7')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(lifted, '#f3f5f7')).toBeLessThan(5.2)
    // On a dark background the colour moves towards white instead.
    expect(contrastRatio(ensureContrast('#5c6370', '#15171c'), '#15171c')).toBeGreaterThanOrEqual(4.5)
  })

  it('holds every token colour of the Prism themes to 4.5:1 on the reading backgrounds', () => {
    const cases = [
      [oneLight, '#f3f5f7'],
      [oneLight, '#ede3cb'],
      [oneDark, '#1d2026']
    ] as const
    for (const [sheet, background] of cases) {
      for (const rules of Object.values(withContrast(sheet, background))) {
        const color = (rules as { color?: unknown }).color
        if (typeof color === 'string' && parseColor(color)) {
          expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

describe('prismLanguage', () => {
  it('maps the short fence names to the grammars async-light can load', () => {
    expect(prismLanguage('js')).toBe('javascript')
    expect(prismLanguage('TS')).toBe('typescript')
    expect(prismLanguage('py')).toBe('python')
    expect(prismLanguage('sh')).toBe('bash')
    expect(prismLanguage('html')).toBe('markup')
    expect(prismLanguage('yml')).toBe('yaml')
  })

  it('passes full and unknown names through', () => {
    expect(prismLanguage('rust')).toBe('rust')
    expect(prismLanguage('brainfuck')).toBe('brainfuck')
  })
})

describe('markdownUrlTransform', () => {
  const img = { tagName: 'img' }
  const link = { tagName: 'a' }

  it('lets inline images through, which the default filter dropped', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    expect(markdownUrlTransform(png, 'src', img)).toBe(png)
    expect(markdownUrlTransform('data:image/svg+xml;utf8,%3Csvg%3E', 'src', img)).toContain('data:image/svg+xml')
  })

  it('still refuses data URLs anywhere else, and scripts everywhere', () => {
    expect(markdownUrlTransform('data:text/html;base64,PHNjcmlwdD4=', 'src', img)).toBe('')
    expect(markdownUrlTransform('data:image/png;base64,AAA', 'href', link)).toBe('')
    expect(markdownUrlTransform('javascript:alert(1)', 'href', link)).toBe('')
  })

  it('keeps ordinary links unchanged', () => {
    expect(markdownUrlTransform('https://example.com/a', 'href', link)).toBe('https://example.com/a')
    expect(markdownUrlTransform('#section', 'href', link)).toBe('#section')
    expect(markdownUrlTransform('./pic.png', 'src', img)).toBe('./pic.png')
  })
})
