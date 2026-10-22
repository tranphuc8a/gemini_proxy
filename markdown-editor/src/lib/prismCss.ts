/**
 * Code-block colours as one stylesheet per theme instead of inline styles.
 *
 * react-syntax-highlighter's inline mode recomputes the selector list of the
 * *whole* theme for every token (create-element.js), which made highlighting
 * the costliest part of a preview render: 1.5 s of a 3 s render on a
 * 2,000-line document. In class mode tokens are plain `span.token.<kind>`
 * and these rules colour them, so the work is one stylesheet per theme.
 *
 * The rules reproduce what inline mode actually applied, nothing more:
 *  - `pre[class*="language-"]` styled the highlighter's wrapper (here a div
 *    carrying the scope class), minus what CodeBlock sets inline itself;
 *  - keys naming token classes (`keyword`, or `a.b` combinations) styled the
 *    tokens carrying those classes.
 * Every other key (`.language-css .token.selector`, `::selection`, plugin
 * rules) never matched anything in inline mode, so it is left out and the
 * colours stay exactly as they were.
 */

type StyleSheet = Record<string, object>

const WRAPPER_KEY = 'pre[class*="language-"]'
/** A class name, or class names joined by dots: what inline mode looked keys up by. */
const TOKEN_KEY = /^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*$/
/** CodeBlock sets these inline on the wrapper (customStyle), and inline wins anyway. */
const WRAPPER_SKIPPED = new Set(['background', 'backgroundColor', 'padding', 'margin'])
/** Numbers React writes without a unit; everything else numeric gets px, as React does. */
const UNITLESS = new Set(['lineHeight', 'opacity', 'fontWeight', 'zIndex', 'tabSize', 'MozTabSize', 'OTabSize', 'flex', 'order', 'zoom'])

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

function declarations(style: object, skip?: Set<string>): string {
  const parts: string[] = []
  for (const [name, raw] of Object.entries(style)) {
    if (skip?.has(name)) continue
    const value = cssValue(name, raw)
    if (value !== null) parts.push(`${cssProperty(name)}: ${value}`)
  }
  return parts.join('; ')
}

/** A class name safe to put in a selector, derived from the theme and background it stands for. */
export function prismScope(theme: string, background?: string): string {
  const tail = background ? `-${background.toLowerCase().replace(/[^a-z0-9]+/g, '')}` : ''
  return `prism-${theme.toLowerCase().replace(/[^a-z0-9]+/g, '')}${tail}`
}

/**
 * The stylesheet of a react-syntax-highlighter theme, scoped to `.${scope}`:
 * the wrapper rule on `.${scope}` itself, token rules on `.${scope} .token.<kind>`.
 */
export function prismThemeToCss(sheet: StyleSheet, scope: string): string {
  const rules: string[] = []
  const wrapper = sheet[WRAPPER_KEY]
  if (wrapper) {
    const body = declarations(wrapper, WRAPPER_SKIPPED)
    if (body) rules.push(`.${scope} { ${body} }`)
  }
  for (const [key, style] of Object.entries(sheet)) {
    if (!TOKEN_KEY.test(key) || !style || typeof style !== 'object') continue
    const body = declarations(style)
    if (body) rules.push(`.${scope} .token.${key} { ${body} }`)
  }
  return rules.join('\n')
}

const installed = new Set<string>()

/**
 * Puts the stylesheet for `scope` into the document head once. The element is
 * a plain same-origin <style>, so "Export HTML" copies it with every other
 * rule and the exported file keeps its colours.
 */
export function ensurePrismSheet(scope: string, css: string): void {
  if (typeof document === 'undefined') return
  if (installed.has(scope) && document.head.querySelector(`style[data-prism="${scope}"]`)) return
  let element = document.head.querySelector<HTMLStyleElement>(`style[data-prism="${scope}"]`)
  if (!element) {
    element = document.createElement('style')
    element.dataset.prism = scope
    document.head.appendChild(element)
  }
  element.textContent = css
  installed.add(scope)
}
