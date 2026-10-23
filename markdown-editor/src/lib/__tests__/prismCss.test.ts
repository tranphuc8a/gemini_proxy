import { describe, expect, it } from 'vitest'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as createElementModule from 'react-syntax-highlighter/dist/esm/create-element'
import { withContrast } from '../contrast'
import { PrismSheet, TOKEN_RULE_PREFIX, cssProperty, prismScope, prismThemeToCss, tokenStyle } from '../prismCss'

type Sheet = Record<string, object>

/** The library's own merge, the one inline mode runs per token (exported, but missing from its typings). */
const { createStyleObject } = createElementModule as unknown as {
  createStyleObject: (classNames: string[], elementStyle: object, stylesheet: Sheet) => Record<string, unknown>
}

const THEMES: Record<string, Sheet> = {
  light: oneLight as Sheet,
  dark: oneDark as Sheet,
  'reading light': withContrast(oneLight, '#f3f5f7') as Sheet,
  'reading sepia': withContrast(oneLight, '#ede3cb') as Sheet,
  'reading dark': withContrast(oneDark, '#1d2026') as Sheet
}

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

/** The declarations behind a token's class attribute, read back from the sheet's CSS. */
function styleOf(sheet: PrismSheet, classAttr: string): Record<string, string> {
  const ruleClass = classAttr.split(' ').find((name) => name.startsWith(TOKEN_RULE_PREFIX))
  return ruleClass ? rule(sheet.css(), `.${sheet.scope} .${ruleClass}`) ?? {} : {}
}

/** `style` as CSS declarations (hyphenated, as strings), for comparing with generated rules. */
function asDeclarations(style: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(style).map(([name, value]) => [cssProperty(name), String(value).trim()]))
}

/** Deterministic pseudo-random numbers, so a failure can be replayed. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
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
    expect(prismScope('light', 'rgb(1, 2, 3)')).toMatch(/^prism-light-[a-z0-9_]+$/)
    expect(prismScope('light', '#f3f5f7')).not.toBe(prismScope('light', '#ede3cb'))
  })

  it('keeps the digits of rgb() backgrounds apart', () => {
    expect(prismScope('light', 'rgb(1,23,4)')).not.toBe(prismScope('light', 'rgb(12,3,4)'))
  })
})

describe('tokenStyle', () => {
  // The token classes of every theme, plus a few no theme styles, in random lists of 0 to 6.
  const kinds = Array.from(
    new Set(
      Object.keys(oneLight)
        .concat(Object.keys(oneDark))
        .filter((key) => /^[\w-]+(\.[\w-]+)*$/.test(key))
        .flatMap((key) => key.split('.'))
    )
  ).concat(['plain', 'language-html', 'unknown-kind'])

  it.each(Object.entries(THEMES))('merges like inline mode for 3,000 random class lists (%s)', (_, sheet) => {
    const next = random(7)
    for (let i = 0; i < 3000; i += 1) {
      const length = Math.floor(next() * 7)
      const classes = ['token']
      for (let j = 0; j < length; j += 1) classes.push(kinds[Math.floor(next() * kinds.length)])
      expect(tokenStyle(sheet, classes), classes.join(' ')).toEqual(createStyleObject(classes, {}, sheet))
    }
  })

  it('lets the inner token win, as inline mode did (the class order the highlighter writes)', () => {
    const light = oneLight as Record<string, { color?: string }>
    // Attribute names inside a tag: the attribute colour, not the tag colour.
    expect(tokenStyle(oneLight as Sheet, ['token', 'tag', 'attr-name']).color).toBe(light['attr-name'].color)
    expect(tokenStyle(oneLight as Sheet, ['token', 'tag', 'punctuation']).color).toBe(light.punctuation.color)
    expect(tokenStyle(oneLight as Sheet, ['token', 'builtin', 'class-name']).color).toBe(light['class-name'].color)
    expect(tokenStyle(oneLight as Sheet, ['token', 'macro', 'property', 'directive', 'keyword']).color).toBe(light.keyword.color)
    // The order alone decides it.
    expect(tokenStyle(oneLight as Sheet, ['token', 'attr-name', 'tag']).color).toBe(light.tag.color)
  })
})

describe('prismThemeToCss', () => {
  it('styles the wrapper like inline mode did, minus what CodeBlock sets itself', () => {
    const css = prismThemeToCss(oneLight as Sheet, 'scope-x')
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

  it('writes the wrapper rule only: token rules come per class list', () => {
    const css = prismThemeToCss(oneLight as Sheet, 'scope-x')
    expect(css.split('\n')).toHaveLength(1)
    expect(css).not.toMatch(/\.token|::selection|language-css|\[class/)
  })
})

describe('PrismSheet', () => {
  it.each(Object.entries(THEMES))('gives each class list one rule with exactly the inline-mode style (%s)', (name, sheet) => {
    const prism = new PrismSheet(sheet, `prism-test-${name.replace(/\W+/g, '')}`)
    const lists = [
      ['token', 'keyword'],
      ['token', 'comment'],
      ['token', 'tag'],
      ['token', 'tag', 'punctuation'],
      ['token', 'tag', 'attr-name'],
      ['token', 'tag', 'attr-value', 'punctuation'],
      ['token', 'tag', 'attr-value', 'punctuation', 'attr-equals'],
      ['token', 'builtin', 'class-name'],
      ['token', 'macro', 'property', 'directive', 'keyword'],
      ['token', 'macro', 'property', 'directive-hash'],
      ['token', 'script', 'language-javascript', 'keyword'],
      ['token', 'plain']
    ]
    for (const classes of lists) {
      const attr = prism.classAttribute(classes)
      expect(attr.startsWith(classes.join(' ')), attr).toBe(true)
      expect(styleOf(prism, attr), classes.join(' ')).toEqual(asDeclarations(createStyleObject(classes, {}, sheet)))
    }
  })

  it('shares one rule between class lists with the same style, and writes it into its <style>', () => {
    const prism = new PrismSheet({ keyword: { color: 'red' }, tag: { color: 'blue' }, important: { color: 'red' } }, 'prism-test-share')
    const a = prism.classAttribute(['token', 'keyword'])
    const b = prism.classAttribute(['token', 'tag', 'important'])
    expect(a.split(' ').pop()).toBe(b.split(' ').pop())
    expect(prism.classAttribute(['token', 'keyword'])).toBe(a)
    const element = document.head.querySelector<HTMLStyleElement>('style[data-prism="prism-test-share"]')!
    const selectors = Array.from(element.sheet!.cssRules).map((entry) => (entry as CSSStyleRule).selectorText)
    expect(selectors).toContain(`.prism-test-share .${a.split(' ').pop()}`)
    expect(selectors.filter((selector) => selector.includes(TOKEN_RULE_PREFIX))).toHaveLength(1)
  })

  it('adds no rule for a token the theme leaves unstyled', () => {
    const prism = new PrismSheet({ keyword: { color: 'red' } }, 'prism-test-plain')
    expect(prism.classAttribute(['token', 'plain'])).toBe('token plain')
    expect(prism.css()).not.toContain(TOKEN_RULE_PREFIX)
  })

  it('drops values that could break out of a rule', () => {
    const prism = new PrismSheet({ keyword: { color: 'red; } body { display: none' }, string: { color: 'green' } }, 's')
    prism.classAttribute(['token', 'keyword'])
    const attr = prism.classAttribute(['token', 'string'])
    expect(prism.css()).not.toMatch(/display/)
    expect(prism.css()).toContain(`.s .${attr.split(' ').pop()} { color: green }`)
  })

  it('keeps one <style data-prism> per scope, and puts every rule back if it is removed', () => {
    const prism = new PrismSheet(oneLight as Sheet, 'prism-test-again')
    const attr = prism.classAttribute(['token', 'keyword'])
    expect(document.head.querySelectorAll('style[data-prism="prism-test-again"]')).toHaveLength(1)
    document.head.querySelector('style[data-prism="prism-test-again"]')!.remove()
    prism.classAttribute(['token', 'string'])
    const element = document.head.querySelector<HTMLStyleElement>('style[data-prism="prism-test-again"]')!
    expect(element.textContent).toContain(`.prism-test-again .${attr.split(' ').pop()}`)
    expect(element.textContent).toContain('.prism-test-again {')
  })
})
