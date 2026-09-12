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
    .replace(/<[^>]+>/g, '')
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

export function getDocumentStats(markdown: string): DocumentStats {
  const lines = markdown.split('\n')
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0
  const scanned = scanLines(markdown)

  return {
    words,
    characters: markdown.length,
    charactersNoSpaces: markdown.replace(/\s/g, '').length,
    lines: lines.length,
    paragraphs: markdown.split(/\n\s*\n/).filter((block) => block.trim()).length,
    headings: extractHeadings(markdown).length,
    // Count entries into a fenced block rather than fence lines: a nested
    // ``` inside a ~~~ block is content, not a new block.
    codeBlocks: scanned.filter((entry, index) => entry.inCode && !scanned[index - 1]?.inCode).length,
    readingMinutes: Math.max(1, Math.ceil(words / 200))
  }
}

/** 1-based line number containing `offset`. */
export function lineAtOffset(value: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, value.length))
  let line = 1
  for (let index = 0; index < clamped; index += 1) {
    if (value[index] === '\n') line += 1
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
