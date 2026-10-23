import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { KNOWN_WELCOME_SHA256, LEGACY_WELCOME_SHA256, WELCOME, WELCOME_SHA256 } from '../welcome'
import { normalizeMath } from '../mathDelimiters'

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The two texts earlier builds stored as welcome.md (kept verbatim: their hashes must not drift). */
const FIRST_BUILD = '# Welcome to Markdown Editor\n\nStart typing markdown here...'
const TOUR_WITHOUT_MATH_SECTION = [
  '# Welcome to Markdown Editor',
  '',
  'A fast, offline-first editor with live GitHub-flavoured preview.',
  '',
  '## Try it out',
  '',
  '- **Bold**, *italic*, ~~strikethrough~~ and `inline code`',
  '- [ ] Click a checkbox in the preview to tick it off',
  '- [x] Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the command palette',
  '',
  '> Drag the divider to resize the panes, or press <kbd>Ctrl</kbd>+<kbd>/</kbd> for shortcuts.',
  '',
  '| Feature   | Shortcut       |',
  '| --------- | -------------- |',
  '| Bold      | Ctrl+B         |',
  '| Italic    | Ctrl+I         |',
  '| Link      | Ctrl+K then L  |',
  '| Find      | Ctrl+F         |',
  '',
  '```ts',
  'export function greet(name: string): string {',
  '  return `Hello, ${name}!`',
  '}',
  '```',
  '',
  '```mermaid',
  'flowchart LR',
  '  Write[Write Markdown] --> Preview[Live preview]',
  '  Preview --> Export[Export PDF / HTML]',
  '```',
  '',
  'Math works too: $e^{i\\pi} + 1 = 0$',
  ''
].join('\n')

describe('welcome document', () => {
  it('WELCOME_SHA256 is the hash of the current text (changed it? move the old hash to LEGACY_WELCOME_SHA256)', () => {
    expect(sha256(WELCOME)).toBe(WELCOME_SHA256)
  })

  it('remembers the hash of every earlier welcome text, so md-sync can tell an untouched copy from user writing', () => {
    expect(LEGACY_WELCOME_SHA256).toEqual([sha256(FIRST_BUILD), sha256(TOUR_WITHOUT_MATH_SECTION)])
    expect(KNOWN_WELCOME_SHA256).toEqual([...LEGACY_WELCOME_SHA256, WELCOME_SHA256])
    expect(new Set(KNOWN_WELCOME_SHA256).size).toBe(KNOWN_WELCOME_SHA256.length)
  })

  it('shows off the maths LLM answers use: \\( \\), \\[ \\], a bare align, mhchem, and prices left alone', () => {
    expect(WELCOME).toContain('\\( a^2 + b^2 = c^2 \\)')
    expect(WELCOME).toContain('\\[\n\\int_0^1')
    expect(WELCOME).toContain('\\begin{align}')
    expect(WELCOME).toContain('\\ce{2H2 + O2 -> 2H2O}')
    const prepared = normalizeMath(WELCOME)
    expect(prepared.text).toContain('Prices stay prices: \\$5 and \\$10.')
    expect(prepared.text.split('\n').length).toBe(WELCOME.split('\n').length)
  })
})
