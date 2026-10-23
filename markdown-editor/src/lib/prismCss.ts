/**
 * Code-block colours from stylesheet rules instead of inline styles, with the
 * colours inline mode gave -- exactly.
 *
 * react-syntax-highlighter's inline mode recomputes the selector list of the
 * *whole* theme for every token (create-element.js), which made highlighting
 * the costliest part of a preview render: 1.5 s of a 3 s render on a
 * 2,000-line document.
 *
 * Plain class mode is not a drop-in replacement. The highlighter flattens
 * nested tokens, so a leaf carries its parents' classes before its own
 * (`token tag attr-name`), and inline mode merges the theme entries in that
 * order: the inner token's colour wins. One `.token.<kind>` rule per theme key
 * cannot say that -- equal specificity lets whichever rule comes later in the
 * theme win -- and HTML attribute names turned red like tag names, `#include`
 * took the macro colour, and so on (45 of 99 tokens of a small HTML/bash/JSX/
 * C++ sample changed colour).
 *
 * So the merge is done the way inline mode does it, once per distinct class
 * list: `tokenStyle` reproduces create-element.js's `createStyleObject`, the
 * result becomes one rule (`.${scope} .prism-tN`), and the token gets that
 * class next to its own. Rules are added to the scope's `<style>` the first
 * time a class list shows up; a document uses a few dozen.
 */
import { createElement, type ElementType, type ReactNode } from 'react'

type StyleSheet = Record<string, object>
type Style = Record<string, unknown>

const WRAPPER_KEY = 'pre[class*="language-"]'
/** CodeBlock sets these inline on the wrapper (customStyle), and inline wins anyway. */
const WRAPPER_SKIPPED = new Set(['background', 'backgroundColor', 'padding', 'margin'])
/** Numbers React writes without a unit; everything else numeric gets px, as React does. */
const UNITLESS = new Set(['lineHeight', 'opacity', 'fontWeight', 'zIndex', 'tabSize', 'MozTabSize', 'OTabSize', 'flex', 'order', 'zoom'])
/** Prefix of the per-class-list rule classes. */
export const TOKEN_RULE_PREFIX = 'prism-t'

/** camelCase (and vendor-prefixed) style names to CSS properties, the way React hyphenates them. */
export function cssProperty(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^ms-/, '-ms-')
}

function cssValue(name: string, value: unknown): string | null {
  if (typeof value === 'number') return UNITLESS.has(name) || value === 0 ? String(value) : `${value}px`
  if (typeof value !== 'string' || !value.trim()) return null
  // Theme values are built in, but a brace or angle bracket could still end the rule early.
  if (/[{};<>]/.test(value)) return null
  return value.trim()
}

/** A style object as the body of a CSS rule; '' when nothing in it would be written. */
export function declarations(style: object, skip?: Set<string>): string {
  const parts: string[] = []
  for (const [name, raw] of Object.entries(style)) {
    if (skip?.has(name)) continue
    const value = cssValue(name, raw)
    if (value !== null) parts.push(`${cssProperty(name)}: ${value}`)
  }
  return parts.join('; ')
}

/**
 * Every ordered selection of 1..m of `items`, shortest first, each length in
 * lexicographic order of positions -- the list create-element.js's
 * `powerSetPermutations` spells out by hand. Like it, only the first four
 * classes count.
 */
function classCombinations(items: readonly string[]): string[] {
  const pool = items.slice(0, 4)
  const out: string[] = []
  const used = new Array<boolean>(pool.length).fill(false)
  const picked: string[] = []
  const walk = (length: number) => {
    if (picked.length === length) {
      out.push(picked.join('.'))
      return
    }
    for (let i = 0; i < pool.length; i += 1) {
      if (used[i]) continue
      used[i] = true
      picked.push(pool[i])
      walk(length)
      picked.pop()
      used[i] = false
    }
  }
  for (let length = 1; length <= pool.length; length += 1) walk(length)
  return out
}

const combinationCache = new Map<string, string[]>()

/**
 * The style inline mode gives an element with these classes: the theme
 * entries for each class and each dotted combination, merged in
 * create-element.js's order, later entries winning property by property.
 */
export function tokenStyle(sheet: StyleSheet, classNames: readonly string[], base?: object): Style {
  const kinds = classNames.filter((name) => name !== 'token')
  const key = kinds.join('.')
  let combinations = combinationCache.get(key)
  if (!combinations) {
    combinations = classCombinations(kinds)
    combinationCache.set(key, combinations)
  }
  const style: Style = { ...base }
  for (const combination of combinations) Object.assign(style, sheet[combination])
  return style
}

/** A class name safe to put in a selector, derived from the theme and background it stands for. */
export function prismScope(theme: string, background?: string): string {
  const tail = background ? `-${background.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}` : ''
  return `prism-${theme.toLowerCase().replace(/[^a-z0-9]+/g, '')}${tail}`
}

/**
 * The wrapper rule of a react-syntax-highlighter theme, scoped to `.${scope}`:
 * what inline mode put on the `pre` (here a div carrying the scope class),
 * minus what CodeBlock sets inline itself. Token rules are added per class
 * list by `PrismSheet`.
 */
export function prismThemeToCss(sheet: StyleSheet, scope: string): string {
  const wrapper = sheet[WRAPPER_KEY]
  const body = wrapper ? declarations(wrapper, WRAPPER_SKIPPED) : ''
  return body ? `.${scope} { ${body} }` : ''
}

/**
 * One theme on one background: its `<style data-prism>` element and the token
 * rules made so far. The element is a plain same-origin <style>, so "Export
 * HTML" (which copies every rule of the page) keeps the colours.
 */
export class PrismSheet {
  readonly scope: string
  private readonly sheet: StyleSheet
  private readonly rules: string[] = []
  /** Class list → the token's class attribute. */
  private readonly classAttrs = new Map<string, string>()
  /** Rule body → the class carrying it, so equal styles share one rule. */
  private readonly ruleClasses = new Map<string, string>()
  private element: HTMLStyleElement | null = null

  constructor(sheet: StyleSheet, scope: string) {
    this.sheet = sheet
    this.scope = scope
    const wrapper = prismThemeToCss(sheet, scope)
    if (wrapper) this.rules.push(wrapper)
    this.install()
  }

  /** The class attribute for a token with these classes: its own classes, plus the rule holding inline mode's style. */
  classAttribute(classNames: readonly string[]): string {
    const key = classNames.join(' ')
    let attr = this.classAttrs.get(key)
    if (attr === undefined) {
      const body = declarations(tokenStyle(this.sheet, classNames))
      let ruleClass = body ? this.ruleClasses.get(body) : ''
      if (ruleClass === undefined) {
        ruleClass = `${TOKEN_RULE_PREFIX}${this.ruleClasses.size}`
        this.ruleClasses.set(body, ruleClass)
        this.addRule(`.${this.scope} .${ruleClass} { ${body} }`)
      }
      attr = ruleClass ? (key ? `${key} ${ruleClass}` : ruleClass) : key
      this.classAttrs.set(key, attr)
    }
    return attr
  }

  /** Every rule of this scope, as written to its <style>. */
  css(): string {
    return this.rules.join('\n')
  }

  private addRule(rule: string): void {
    this.rules.push(rule)
    const element = this.element
    if (!element?.isConnected) {
      this.install()
      return
    }
    try {
      const sheet = element.sheet
      if (sheet) {
        sheet.insertRule(rule, sheet.cssRules.length)
        return
      }
    } catch {
      // A parser that rejects the rule: fall back to the text, which keeps what it can read.
    }
    element.appendChild(document.createTextNode(`\n${rule}`))
  }

  /** Puts the scope's <style> in the head (again, if something removed it), holding every rule so far. */
  private install(): void {
    if (typeof document === 'undefined') return
    let element = document.head.querySelector<HTMLStyleElement>(`style[data-prism="${this.scope}"]`)
    if (!element) {
      element = document.createElement('style')
      element.dataset.prism = this.scope
      document.head.appendChild(element)
    }
    element.textContent = this.css()
    this.element = element
  }
}

/** What react-syntax-highlighter hands a renderer (its tree after flattening nested tokens). */
export interface HighlightNode {
  type: string
  tagName?: ElementType
  value?: string | number
  properties?: { className?: string[]; style?: object; [key: string]: unknown }
  children?: HighlightNode[]
}

function renderNode(node: HighlightNode, key: string, sheet: PrismSheet): ReactNode {
  if (node.type === 'text') return node.value
  if (!node.tagName) return null
  const { className, ...rest } = node.properties ?? {}
  const children = node.children?.map((child, index) => renderNode(child, `${key}-${index}`, sheet))
  return createElement(node.tagName, { ...rest, key, className: sheet.classAttribute(className ?? []) || undefined }, children)
}

const renderers = new WeakMap<PrismSheet, (props: { rows: HighlightNode[] }) => ReactNode>()

/**
 * A react-syntax-highlighter `renderer` for class mode whose tokens carry the
 * per-class-list rule of `sheet`. Same elements as the stock renderer, one
 * extra class each; one function per sheet, so memoised blocks stay equal.
 */
export function prismRenderer(sheet: PrismSheet): (props: { rows: HighlightNode[] }) => ReactNode {
  let renderer = renderers.get(sheet)
  if (!renderer) {
    renderer = ({ rows }) => rows.map((node, index) => renderNode(node, `code-segment-${index}`, sheet))
    renderers.set(sheet, renderer)
  }
  return renderer
}
