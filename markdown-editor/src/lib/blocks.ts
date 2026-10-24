/**
 * Render by block (perf-md tasks 6 and 8, batch M5): the document is cut into blocks at blank lines, each block is
 * rendered on its own and remembered by its text, so typing re-renders the one block that changed instead of the whole
 * document.
 *
 * The cut is only allowed where the document is *closed* -- where parsing the pieces separately gives exactly what
 * parsing the whole would. Everything that can hold a blank line inside it is therefore an "open region" that never
 * splits (ke-hoach §1.1, "Toán × render theo khối"):
 *   - fenced code (``` and ~~~);
 *   - `$$` maths, a lone `\[` up to its `\]`, a `\begin{env}` up to `\end{env}`;
 *   - `@startxxx` … `@endxxx` (PlantUML), front matter at the top of the file;
 *   - raw HTML: comments, `<script|pre|style|textarea>`, `<?`, `<!X`, CDATA, and any container element
 *     (`<details>`, `<div>`, `<table>`, …) that is still open;
 *   - a list (a list item after a list item or an indented line is the same, possibly loose, list) and any indented
 *     line (list continuation, indented code).
 * Link reference definitions (`[a]: url`) are collected into `defs` and appended to every block that has a `[`.
 * Footnotes number across the whole document, so a document with footnote definitions (or a link label defined twice)
 * is reported as `needsWhole` and rendered the old way, in one piece.
 *
 * Block `start`/`end` are 1-based source lines, the blocks cover every line, and `text` is the block's lines joined with
 * `\n` (blank lines that follow it included), so `blocks.map(b => b.text).join('\n') === source`.
 */

import { prepareBlock } from './prepareMarkdown'

export interface MdBlock {
  /** First source line (1-based). */
  start: number
  /** Last source line (1-based, inclusive). */
  end: number
  text: string
  /** Stable while the text is unchanged, wherever the block sits in the document (React identity). */
  key: string
  /** The block has a `[` so the document's reference definitions are appended to it. */
  needsDefs: boolean
}

export interface SplitResult {
  blocks: MdBlock[]
  /** The document's link reference definitions, one per line; appended (after a blank line) to blocks with `needsDefs`. */
  defs: string
  hasFootnotes: boolean
  /** Render the whole document in one piece: footnotes, or a link label defined twice. */
  needsWhole: boolean
  lineCount: number
}

const CONTAINERS = 'details|div|section|table|figure|blockquote|ul|ol|dl|center|article|aside|nav|header|footer|main|picture|video|audio'
const OPEN_TAG = new RegExp(`<(?:${CONTAINERS})(?=[\\s>/])[^>]*>`, 'gi')
const CLOSE_TAG = new RegExp(`</(?:${CONTAINERS})\\s*>`, 'gi')

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const MATH_OPEN = /^ {0,3}(\${2,})([^$]*)$/
const MATH_CLOSE = /^ {0,3}(\${2,})\s*$/
const BRACKET_OPEN = /^ {0,3}\\\[\s*$/
const BRACKET_CLOSE = /^ {0,3}\\\]\s*$/
const ENV_OPEN = /^ {0,3}\\begin\{([A-Za-z]+\*?)\}/
const UML_OPEN = /^ {0,3}@start([a-z]+)/
const HTML_RAW = /^ {0,3}<(script|pre|style|textarea)(?=[\s>]|$)/i
const LIST_ITEM = /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:\s|$)/
const DEFINITION = /^ {0,3}\[([^\]\n]+)\]:(.*)$/

function isBlank(line: string): boolean {
  for (let index = 0; index < line.length; index++) {
    const code = line.charCodeAt(index)
    if (code !== 32 && code !== 9 && code !== 13) return false
  }
  return true
}

function isIndented(line: string): boolean {
  const first = line.charCodeAt(0)
  if (first === 9) return true
  return first === 32 && line.charCodeAt(1) === 32
}

function countMatches(line: string, pattern: RegExp): number {
  pattern.lastIndex = 0
  let count = 0
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    if (!match[0].endsWith('/>')) count += 1
  }
  return count
}

type Region =
  | { kind: 'fence'; char: string; length: number }
  | { kind: 'math'; length: number }
  | { kind: 'bracket' }
  | { kind: 'env'; end: string }
  | { kind: 'uml'; end: string }
  | { kind: 'frontMatter' }
  | { kind: 'html'; end: RegExp }

/** True when line 1 opens front matter that a later line closes. */
function hasFrontMatter(lines: string[]): boolean {
  if (!/^---\s*$/.test(lines[0] ?? '')) return false
  for (let index = 1; index < lines.length; index++) {
    if (/^(?:---|\.\.\.)\s*$/.test(lines[index])) return true
  }
  return false
}

const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase()

interface Scan {
  starts: number[]
  defs: string[]
  hasFootnotes: boolean
  duplicateLabel: boolean
  /** The text ends inside a fence or maths block that was never closed. */
  openAtEnd: boolean
}

/** The line scan: where the document may be cut, what it defines, and whether it ends inside an open fence. */
function scan(lines: string[]): Scan {
  const starts: number[] = [0]
  let region: Region | null = hasFrontMatter(lines) ? { kind: 'frontMatter' } : null
  let depth = 0
  let previousBlank = false
  /** Inside a list: set by a list item, kept by indented lines and lazy continuation, ended by plain text after a blank line. */
  let listActive = false
  /** The last line with text was a table row, a quote line, or a line mixing `$` and `|` (a formula that may span a table row): normalizeMath carries state past it that a cut would lose. */
  let previousQuoteOrRow = false
  let sawContent = false
  let hasFootnotes = false
  let duplicateLabel = false
  const labels = new Set<string>()
  const defs: string[] = []

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]
    // `.` in the patterns below does not match a carriage return.
    const line = raw.charCodeAt(raw.length - 1) === 13 ? raw.slice(0, -1) : raw
    const blank = isBlank(line)

    if (blank) {
      previousBlank = true
      continue
    }

    // A cut goes before a line with text that follows a blank line, when everything before it is closed.
    if (previousBlank && sawContent && !region && depth === 0 && !isIndented(line) && !previousQuoteOrRow && !(listActive && LIST_ITEM.test(line))) {
      starts.push(index)
    }
    const afterBlank = previousBlank
    previousBlank = false
    sawContent = true
    if (LIST_ITEM.test(line)) listActive = true
    else if (afterBlank && !isIndented(line)) listActive = false
    previousQuoteOrRow = /^ {0,3}[>|]/.test(line) || (line.includes('$') && line.includes('|'))

    if (region) {
      switch (region.kind) {
        case 'fence': {
          const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)
          if (close && close[1][0] === region.char && close[1].length >= region.length) region = null
          break
        }
        case 'math': {
          // Only a line of dollars alone closes a `$$` fence (`y^2 $$` at the end of a text line does not), however
          // far away it is -- normalizeMath pairs an opener such as `$$ x +` with that same later line.
          const close = MATH_CLOSE.exec(line)
          if (close && close[1].length >= region.length) region = null
          break
        }
        case 'bracket':
          if (BRACKET_CLOSE.test(line)) region = null
          break
        case 'env':
          if (line.includes(region.end)) region = null
          break
        case 'uml':
          if (line.includes(region.end)) region = null
          break
        case 'frontMatter':
          if (index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) region = null
          break
        case 'html':
          if (region.end.test(line)) region = null
          break
      }
      continue
    }

    const fence = FENCE_OPEN.exec(line)
    if (fence) {
      // A backtick fence's info string cannot hold a backtick (that is inline code).
      if (fence[1][0] !== '`' || !fence[2].includes('`')) {
        region = { kind: 'fence', char: fence[1][0], length: fence[1].length }
        continue
      }
    }

    if (line.charCodeAt(0) === 36 || line.charCodeAt(1) === 36 || line.charCodeAt(2) === 36) {
      const open = MATH_OPEN.exec(line)
      if (open) {
        // `$$ x +` (text after the dollars, no closing dollars on the line) is read by normalizeMath as text maths and
        // by micromark as a fence with an info string, and which of the two a later `$$` line belongs to depends on what
        // the whole document holds. The rest of the document is therefore one block (what render-by-block would
        // otherwise get wrong, it gets exactly as the whole-document render has it); a bare `$$` fence closes normally.
        region = { kind: 'math', length: open[2].trim() ? Number.POSITIVE_INFINITY : open[1].length }
        continue
      }
    }

    if (line.includes('\\')) {
      if (BRACKET_OPEN.test(line)) {
        region = { kind: 'bracket' }
        continue
      }
      const env = ENV_OPEN.exec(line)
      if (env) {
        const end = `\\end{${env[1]}}`
        if (!line.includes(end)) region = { kind: 'env', end }
        continue
      }
    }

    if (line.includes('@start')) {
      const uml = UML_OPEN.exec(line)
      if (uml) {
        const end = `@end${uml[1]}`
        if (!line.includes(end)) region = { kind: 'uml', end }
        continue
      }
    }

    if (line.includes('<')) {
      if (/^ {0,3}</.test(line)) {
        let rawTag: RegExpExecArray | null
        if (/^ {0,3}<!--/.test(line)) {
          if (!line.includes('-->', line.indexOf('<!--') + 4)) region = { kind: 'html', end: /-->/ }
        } else if (/^ {0,3}<\?/.test(line)) {
          if (!line.includes('?>', line.indexOf('<?') + 2)) region = { kind: 'html', end: /\?>/ }
        } else if (/^ {0,3}<!\[CDATA\[/.test(line)) {
          if (!line.includes(']]>')) region = { kind: 'html', end: /\]\]>/ }
        } else if (/^ {0,3}<![A-Za-z]/.test(line)) {
          if (!line.includes('>', line.indexOf('<!') + 2)) region = { kind: 'html', end: />/ }
        } else if ((rawTag = HTML_RAW.exec(line))) {
          const closing = new RegExp(`</${rawTag[1]}>`, 'i')
          if (!closing.test(line)) region = { kind: 'html', end: closing }
        } else {
          depth = Math.max(0, depth + countMatches(line, OPEN_TAG) - countMatches(line, CLOSE_TAG))
        }
        if (region) continue
      }
    }

    if (line.includes(']:')) {
      const definition = DEFINITION.exec(line)
      if (definition) {
        if (definition[1].startsWith('^')) {
          hasFootnotes = true
        } else {
          const label = normalizeLabel(definition[1])
          if (labels.has(label)) duplicateLabel = true
          labels.add(label)
          let text = line
          const rest = definition[2].trim()
          if (!rest) {
            // The destination is on the next line: a definition this module does not copy around.
            duplicateLabel = true
          } else {
            // A title may sit on the next line, unindented.
            const next = lines[index + 1]
            if (next !== undefined && /^\s*["'(]/.test(next) && !isBlank(next)) text += `\n${next}`
          }
          defs.push(text)
        }
      }
    }
  }

  return { starts, defs, hasFootnotes, duplicateLabel, openAtEnd: region !== null && region.kind !== 'html' && region.kind !== 'frontMatter' }
}

/**
 * How many blocks one merge step may glue before the rest of the document is taken as one block: a prepared block that
 * ends inside an open fence is joined to the next one until it closes, and a document that never closes must not make
 * that a quadratic walk.
 */
const MAX_MERGE_STEPS = 24

/** Whether a block's prepared text ends inside an open fence, remembered by the block's text (it is asked per block per edit). */
const openCache = new Map<string, boolean>()
function endsOpen(text: string): boolean {
  let open = openCache.get(text)
  if (open === undefined) {
    open = scan(prepareBlock(text).text.split('\n')).openAtEnd
    openCache.set(text, open)
    if (openCache.size > 4000) {
      let drop = 1000
      for (const key of openCache.keys()) {
        openCache.delete(key)
        if (--drop <= 0) break
      }
    }
  }
  return open
}

/**
 * Cuts a document into blocks. Cost is linear (about 10 ms for 10,000 lines, plus the preparation of each block, which
 * is remembered by the block's text).
 */
export function splitBlocks(source: string): SplitResult {
  const lines = source.split('\n')
  const { starts: cuts, defs, hasFootnotes, duplicateLabel } = scan(lines)

  // The raw rules cannot see what `normalizeMath` will write: `\[` ... `\]` can become a `$$` fence, and a fence that
  // the prepared text leaves open would swallow what follows the cut. So a block whose prepared text ends inside an
  // open fence is joined to the next one, until it closes.
  const starts: number[] = []
  const texts: string[] = []
  const slice = (from: number, to: number) => lines.slice(cuts[from], cuts[to + 1] ?? lines.length).join('\n')
  for (let at = 0; at < cuts.length; ) {
    let last = at
    let text = slice(at, at)
    for (let steps = 0; last + 1 < cuts.length && endsOpen(text); steps++) {
      last = steps >= MAX_MERGE_STEPS ? cuts.length - 1 : last + 1
      text = slice(at, last)
    }
    starts.push(cuts[at])
    texts.push(text)
    at = last + 1
  }

  const keys = blockKeys(texts)
  const blocks: MdBlock[] = starts.map((start, index) => ({
    start: start + 1,
    end: (starts[index + 1] ?? lines.length),
    text: texts[index],
    key: keys[index],
    needsDefs: defs.length > 0 && texts[index].includes('[')
  }))

  return {
    blocks,
    defs: defs.join('\n'),
    hasFootnotes,
    needsWhole: hasFootnotes || duplicateLabel,
    lineCount: lines.length
  }
}

/** Which block holds source line `line` (1-based): binary search over `start`. */
export function blockIndexAtLine(blocks: readonly MdBlock[], line: number): number {
  let low = 0
  let high = blocks.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (blocks[middle].start <= line) low = middle
    else high = middle - 1
  }
  return low
}

// ---------------------------------------------------------------------------------------------------------------------
// Stable keys
// ---------------------------------------------------------------------------------------------------------------------

/** A number for each distinct block text, kept between splits so an unchanged block keeps its React identity. */
const ids = new Map<string, number>()
let nextId = 1

/**
 * `${id}-${n}` for the n-th block with the same text. Equal text means an equal key wherever the block moves to, so
 * React keeps the instance (and its rendered DOM) when lines are inserted above it. The id table forgets texts that
 * did not occur in the last split once it has grown to well over the document.
 */
function blockKeys(texts: string[]): string[] {
  const occurrence = new Map<string, number>()
  const keys = texts.map((text) => {
    let id = ids.get(text)
    if (id === undefined) {
      id = nextId++
      ids.set(text, id)
    }
    const count = occurrence.get(text) ?? 0
    occurrence.set(text, count + 1)
    return `${id}-${count}`
  })
  if (ids.size > 2 * texts.length + 2000) {
    const keep = new Set(texts)
    for (const text of Array.from(ids.keys())) if (!keep.has(text)) ids.delete(text)
  }
  return keys
}

/** Test hook: how many texts the key table holds. */
export function blockKeyTableSize(): number {
  return ids.size
}

/** What is rendered for a block: the text, with the document's definitions after it when it can use them. */
export function blockSource(block: MdBlock, defs: string): string {
  return block.needsDefs && defs ? `${block.text}\n\n${defs}` : block.text
}
