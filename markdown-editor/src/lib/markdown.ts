export interface Heading {
  level: number
  text: string
  slug: string
  /** 1-based source line. */
  line: number
}

export interface DocumentStats {
  words: number
  characters: number
  charactersNoSpaces: number
  lines: number
  paragraphs: number
  headings: number
  codeBlocks: number
  /** Rounded up, based on 200 words per minute. */
  readingMinutes: number
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/

/**
 * Splits into lines while reporting which of them sit inside a fenced code
 * block, so callers never mistake a shell comment for a heading.
 */
function scanLines(markdown: string): { line: string; inCode: boolean }[] {
  let fence: string | null = null
  return markdown.split('\n').map((line) => {
    const match = FENCE.exec(line)
    if (match) {
      const marker = match[1][0]
      if (fence === null) {
        fence = marker
        return { line, inCode: true }
      }
      if (fence === marker) {
        fence = null
        return { line, inCode: true }
      }
    }
    return { line, inCode: fence !== null }
  })
}

/** GitHub-compatible anchor slug; folds Vietnamese diacritics to ASCII. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/** Strips inline markup so outline entries read as plain text. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/[<>]/g, '')
    .trim()
}

/** ATX headings outside fenced code, with de-duplicated GitHub-style slugs. */
export function extractHeadings(markdown: string): Heading[] {
  const seen = new Map<string, number>()
  const headings: Heading[] = []

  scanLines(markdown).forEach(({ line, inCode }, index) => {
    if (inCode) return
    const match = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (!match) return

    const text = stripInlineMarkdown(match[2])
    if (!text) return

    const base = slugify(text) || 'section'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)

    headings.push({
      level: match[1].length,
      text,
      slug: count === 0 ? base : `${base}-${count}`,
      line: index + 1
    })
  })

  return headings
}

/**
 * Exactly the characters JavaScript's `\s` (and `String.prototype.trim`)
 * treat as white space, so the counts below match the regex definitions they
 * replaced: words are runs of non-space, paragraphs are split by a run of
 * space holding at least two line feeds.
 */
function isSpace(code: number): boolean {
  if (code <= 32) return code === 32 || (code >= 9 && code <= 13)
  if (code < 160) return false
  return (
    code === 160 ||
    code === 5760 ||
    (code >= 8192 && code <= 8202) ||
    code === 8232 ||
    code === 8233 ||
    code === 8239 ||
    code === 8287 ||
    code === 12288 ||
    code === 65279
  )
}

const HEADING_LINE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
/**
 * Without `[`/`(` no link is removed, so a character outside these survives
 * stripInlineMarkdown. (The reverse does not hold: a lone `~` or `*` stays.)
 */
const MAY_LOSE_TEXT = /[[(]/
const PLAIN_TEXT = /[^\s*_~`<>]/

/** Whether a heading's text is non-empty once stripped; skips the seven replaces in the common case. */
function headingHasText(raw: string): boolean {
  if (!MAY_LOSE_TEXT.test(raw) && PLAIN_TEXT.test(raw)) return true
  return stripInlineMarkdown(raw) !== ''
}

/**
 * Word, line and block counts in one pass over the text -- no `split`, no
 * per-word array. Same results as the regex version it replaced (pinned by
 * tests against that version), at a fraction of the cost: it ran on every
 * keystroke and took 129 ms on a 30,000-line document.
 */
export function getDocumentStats(markdown: string): DocumentStats {
  const length = markdown.length
  let words = 0
  let spaces = 0
  let lines = 1
  let paragraphs = 0
  let seenText = false
  let gapNewlines = 0
  let inWord = false

  for (let index = 0; index < length; index += 1) {
    const code = markdown.charCodeAt(index)
    if (isSpace(code)) {
      spaces += 1
      inWord = false
      if (code === 10) {
        lines += 1
        gapNewlines += 1
      }
    } else {
      if (!inWord) {
        words += 1
        inWord = true
      }
      // A blank line between two runs of text ends a paragraph.
      if (seenText && gapNewlines >= 2) paragraphs += 1
      seenText = true
      gapNewlines = 0
    }
  }
  if (seenText) paragraphs += 1

  // Headings and fenced blocks: only lines that could open one are examined.
  let headings = 0
  let codeBlocks = 0
  let fence: string | null = null
  let previousInCode = false
  let start = 0
  while (start <= length) {
    let end = markdown.indexOf('\n', start)
    if (end === -1) end = length
    let inCode = fence !== null
    // The first non-space character within the first four decides it.
    let probe = start
    while (probe < end && probe - start < 4 && isSpace(markdown.charCodeAt(probe))) probe += 1
    // 96 is a backtick, 126 a tilde, 35 a hash.
    const lead = probe < end && probe - start < 4 ? markdown.charCodeAt(probe) : 0
    if (lead === 96 || lead === 126 || lead === 35) {
      const line = markdown.slice(start, end)
      const match = FENCE.exec(line)
      if (match) {
        const marker = match[1][0]
        if (fence === null) {
          fence = marker
          inCode = true
        } else if (fence === marker) {
          fence = null
          inCode = true
        }
      }
      if (!inCode && lead === 35) {
        const heading = HEADING_LINE.exec(line)
        if (heading && headingHasText(heading[2])) headings += 1
      }
    }
    // Count entries into a fenced block rather than fence lines: a nested
    // ``` inside a ~~~ block is content, not a new block.
    if (inCode && !previousInCode) codeBlocks += 1
    previousInCode = inCode
    start = end + 1
  }

  return {
    words,
    characters: length,
    charactersNoSpaces: length - spaces,
    lines,
    paragraphs,
    headings,
    codeBlocks,
    readingMinutes: Math.max(1, Math.ceil(words / 200))
  }
}

/** Number of lines, as `text.split('\n').length` would say, without building the array. */
export function countLines(text: string): number {
  let lines = 1
  let at = text.indexOf('\n')
  while (at !== -1) {
    lines += 1
    at = text.indexOf('\n', at + 1)
  }
  return lines
}

/** 1-based line number containing `offset`. Counts line feeds with indexOf, not character by character. */
export function lineAtOffset(value: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, value.length))
  let line = 1
  let at = value.indexOf('\n')
  while (at !== -1 && at < clamped) {
    line += 1
    at = value.indexOf('\n', at + 1)
  }
  return line
}

/** Character offset where the 1-based `line` starts. */
export function offsetAtLine(value: string, line: number): number {
  const lines = value.split('\n')
  const target = Math.max(1, Math.min(line, lines.length))
  let offset = 0
  for (let index = 0; index < target - 1; index += 1) {
    offset += lines[index].length + 1
  }
  return offset
}

/** Zero-based column of `offset` within its line. */
export function columnAtOffset(value: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, value.length))
  const start = value.lastIndexOf('\n', clamped - 1)
  return clamped - (start + 1)
}

export interface SearchMatch {
  start: number
  end: number
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
}

export function buildSearchRegExp(query: string, options: SearchOptions = {}): RegExp | null {
  if (!query) return null
  let source = options.regex ? query : escapeRegExp(query)
  if (options.wholeWord) source = `\\b(?:${source})\\b`
  try {
    return new RegExp(source, options.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

export function findMatches(value: string, query: string, options: SearchOptions = {}): SearchMatch[] {
  const pattern = buildSearchRegExp(query, options)
  if (!pattern) return []

  const matches: SearchMatch[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length })
    // Zero-length matches (e.g. the regex `a*`) would otherwise loop forever.
    if (match[0].length === 0) pattern.lastIndex += 1
  }
  return matches
}

export function replaceAll(value: string, query: string, replacement: string, options: SearchOptions = {}): string {
  const pattern = buildSearchRegExp(query, options)
  if (!pattern) return value
  return value.replace(pattern, () => replacement)
}
