import { describe, expect, it } from 'vitest'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { withContrast } from '../contrast'
import { cssProperty, ensurePrismSheet, prismScope, prismThemeToCss } from '../prismCss'

/** Declarations of one rule, as a map, from generated CSS. */
function rule(css: string, selector: string): Record<string, string> | null {
  const line = css.split('\n').find((entry) => entry.startsWith(`${selector} {`))
  if (!line) return null
  const body = line.slice(selector.length + 2, line.lastIndexOf('}')).trim()
  return Object.fromEntries(
    body
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()])
  )
}

describe('cssProperty', () => {
  it('hyphenates like React, vendor prefixes included', () => {
    expect(cssProperty('color')).toBe('color')
    expect(cssProperty('fontStyle')).toBe('font-style')
    expect(cssProperty('MozTabSize')).toBe('-moz-tab-size')
    expect(cssProperty('WebkitHyphens')).toBe('-webkit-hyphens')
    expect(cssProperty('msHyphens')).toBe('-ms-hyphens')
  })
})

describe('prismScope', () => {
  it('is a class name safe in a selector, distinct per theme and background', () => {
    expect(prismScope('light')).toBe('prism-light')
    expect(prismScope('dark', '#1d2026')).toBe('prism-dark-1d2026')
    expect(prismScope('light', 'rgb(1, 2, 3)')).toMatch(/^prism-light-[a-z0-9]+$/)
    expect(prismScope('light', '#f3f5f7')).not.toBe(prismScope('light', '#ede3cb'))
  })
})

describe('prismThemeToCss', () => {
  const themes = {
    light: oneLight,
    dark: oneDark,
    'reading contrast (sepia)': withContrast(oneLight, '#ede3cb')
  }

  it.each(Object.entries(themes))('colours every token kind of the %s theme', (_, sheet) => {
    const css = prismThemeToCss(sheet as Record<string, object>, 'scope-x')
    for (const kind of ['keyword', 'string', 'comment', 'function', 'number', 'operator', 'punctuation']) {
      const declared = rule(css, `.scope-x .token.${kind}`)
      expect(declared, kind).not.toBeNull()
      expect(declared!.color).toBe((sheet as Record<string, { color?: string }>)[kind].color)
    }
    expect(rule(css, '.scope-x .token.comment')!['font-style']).toBe('italic')
  })

  it('styles the wrapper like inline mode did, minus what CodeBlock sets itself', () => {
    const css = prismThemeToCss(oneLight as Record<string, object>, 'scope-x')
    const wrapper = rule(css, '.scope-x')!
    const pre = oneLight['pre[class*="language-"]'] as Record<string, string>
    expect(wrapper.color).toBe(pre.color)
    expect(wrapper['line-height']).toBe('1.5')
    expect(wrapper['tab-size']).toBe('2')
    expect(wrapper.overflow).toBe('auto')
    expect(wrapper).not.toHaveProperty('background')
    expect(wrapper).not.toHaveProperty('padding')
    expect(wrapper).not.toHaveProperty('margin')
  })

  it('leaves out every selector inline mode never matched', () => {
    const css = prismThemeToCss(oneLight as Record<string, object>, 'scope-x')
    expect(css).not.toMatch(/::selection|language-css|\[class|:not\(|toolbar|line-numbers/)
    // Every rule is scoped.
    for (const line of css.split('\n')) expect(line.startsWith('.scope-x')).toBe(true)
  })

  it('keeps contrast-adjusted colours for reading mode', () => {
    const adjusted = withContrast(oneLight, '#ede3cb')
    const css = prismThemeToCss(adjusted as Record<string, object>, 'scope-y')
    expect(rule(css, '.scope-y .token.comment')!.color).toBe((adjusted as Record<string, { color: string }>).comment.color)
    expect(rule(css, '.scope-y .token.comment')!.color).not.toBe((oneLight as Record<string, { color: string }>).comment.color)
  })

  it('drops values that could break out of a rule', () => {
    const css = prismThemeToCss({ keyword: { color: 'red; } body { display: none' }, string: { color: 'green' } }, 's')
    expect(css).not.toMatch(/display/)
    expect(css).toContain('.s .token.string { color: green }')
  })
})

describe('ensurePrismSheet', () => {
  it('adds one <style data-prism> per scope and reuses it', () => {
    ensurePrismSheet('prism-test', '.prism-test .token.keyword { color: red }')
    ensurePrismSheet('prism-test', '.prism-test .token.keyword { color: red }')
    const sheets = document.head.querySelectorAll('style[data-prism="prism-test"]')
    expect(sheets).toHaveLength(1)
    expect(sheets[0].textContent).toContain('.token.keyword')
  })
})
