/**
 * The document a fresh workspace starts with (welcome.md, id `welcome`).
 *
 * Every build saves it to the browser like any other file, so an untouched copy of an OLD welcome text lives on in
 * people's workspaces. Whoever compares local documents with the server (md-sync, batch M4b) must recognise those
 * copies by hash and not upload them as the user's own writing -- hence the list below. When this text changes, add the
 * previous `WELCOME_SHA256` to `LEGACY_WELCOME_SHA256` (welcome.test.ts fails until the two agree).
 */
export const WELCOME = `# Welcome to Markdown Editor

A fast, offline-first editor with live GitHub-flavoured preview.

## Try it out

- **Bold**, *italic*, ~~strikethrough~~ and \`inline code\`
- [ ] Click a checkbox in the preview to tick it off
- [x] Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the command palette

> Drag the divider to resize the panes, or press <kbd>Ctrl</kbd>+<kbd>/</kbd> for shortcuts.

| Feature   | Shortcut       |
| --------- | -------------- |
| Bold      | Ctrl+B         |
| Italic    | Ctrl+I         |
| Link      | Ctrl+K then L  |
| Find      | Ctrl+F         |

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

\`\`\`mermaid
flowchart LR
  Write[Write Markdown] --> Preview[Live preview]
  Preview --> Export[Export PDF / HTML]
\`\`\`

## Math

Inline $e^{i\\pi} + 1 = 0$, or the way chat assistants write it: \\( a^2 + b^2 = c^2 \\).

\\[
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
\\]

\\begin{align}
(a + b)^2 &= a^2 + 2ab + b^2 \\\\
\\sin^2\\theta + \\cos^2\\theta &= 1
\\end{align}

Chemistry too: $\\ce{2H2 + O2 -> 2H2O}$. Prices stay prices: $5 and $10.
`

/** SHA-256 (UTF-8, hex) of `WELCOME`. */
export const WELCOME_SHA256 = '9f46a70e4a46cc978c19b18af869737c8fa35e9cf29a007fcc95e4624b3f45dd'

/**
 * SHA-256 (UTF-8, hex) of every earlier welcome text, oldest first:
 *  - `# Welcome to Markdown Editor\n\nStart typing markdown here...` (first builds, 2026-09-02 … 09-12, commits 1385c57 … 6aaa126);
 *  - the "Try it out" tour without the Math section (2026-09-12 … 2026-10-23, commits cb4bb93 … 8d9724e).
 * Checked against every branch: no other welcome text was ever committed.
 */
export const LEGACY_WELCOME_SHA256: readonly string[] = Object.freeze([
  '35b2144737d907df559727016b05a16fc54ee87472fb00ed333a8752f8efdbee',
  'bfe334b657c87a5a31845dc74560e6397911c0cf2609810b32a4b2570851b14f'
])

/** Every welcome text this app ever created, current one included. */
export const KNOWN_WELCOME_SHA256: readonly string[] = Object.freeze([...LEGACY_WELCOME_SHA256, WELCOME_SHA256])
