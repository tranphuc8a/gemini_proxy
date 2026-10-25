import { normalizeMath, type PreparedMath } from './mathDelimiters'

/**
 * What the Markdown parser is actually given: the document after the line-preserving rewrites that have to happen
 * before parsing, plus what those rewrites tell the plugins that run after it (`remarkMathPromote` reads
 * `display`/`generated`).
 */
export type PreparedMarkdown = PreparedMath

/**
 * Front matter (`---` … `---`, or closed by `...`) at the very top of a document → a fenced `yaml front-matter` block,
 * line for line: the opening line becomes the fence and the closing line closes it, so no line is added or removed.
 * Without this it renders as a rule and a heading made of the YAML. Only when the first line inside is `key: value`
 * (a document that merely starts with a rule is left alone). The fence is one backtick longer than any run of
 * backticks inside, so the YAML cannot close it early.
 */
export function fenceFrontMatter(src: string): string {
  if (!src.startsWith('---')) return src
  const firstEnd = src.indexOf('\n')
  const first = firstEnd === -1 ? src : src.slice(0, firstEnd)
  if (!/^---[ \t]*\r?$/.test(first) || firstEnd === -1) return src
  // The first line with text inside must look like YAML.
  let at = firstEnd + 1
  let lineEnd = src.indexOf('\n', at)
  let closeStart = -1
  let closeEnd = -1
  let sawKey = false
  let firstContent = true
  while (at <= src.length) {
    if (lineEnd === -1) lineEnd = src.length
    const line = src.slice(at, lineEnd)
    if (/^(?:---|\.\.\.)[ \t]*\r?$/.test(line)) {
      closeStart = at
      closeEnd = lineEnd
      break
    }
    if (firstContent && line.trim()) {
      firstContent = false
      sawKey = /^[A-Za-z_][\w .-]{0,60}:(?:[ \t]|\r?$)/.test(line)
      if (!sawKey) return src
    }
    if (lineEnd >= src.length) break
    at = lineEnd + 1
    lineEnd = src.indexOf('\n', at)
  }
  if (closeStart === -1 || !sawKey) return src
  const inside = src.slice(firstEnd + 1, closeStart)
  const ticks = '`'.repeat(Math.max(3, longestRun(inside) + 1))
  const cr = (text: string) => (text.endsWith('\r') ? '\r' : '')
  return `${ticks}yaml front-matter${cr(first)}\n${inside}${ticks}${cr(src.slice(closeStart, closeEnd))}${src.slice(closeEnd)}`
}

/** Length of the longest run of backticks in `text` (0 for none); one pass. */
function longestRun(text: string): number {
  let longest = 0
  let run = 0
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) === 96) {
      run += 1
      if (run > longest) longest = run
    } else run = 0
  }
  return longest
}

/**
 * Source-level rewrites, in a fixed order, none of which may add or remove a line (the preview's `data-line` anchors
 * are source line numbers):
 *   1. front matter → a fenced block                       (`fenceFrontMatter`, only at the start of the document)
 *   2. bare `@startuml … @enduml` → a `plantuml` fence       (md-render task 12, batch M7 -- not yet)
 *   3. maths delimiters as LLMs write them → `$` syntax      (`normalizeMath`)
 * Steps 1–2 must come first: they turn text into fences, and the maths pass leaves fences alone.
 *
 * `atStart` is whether the text is the beginning of the document. Render-by-block prepares each block on its own, and
 * only the first one may hold front matter: a later block that happens to open with `---` and `key: value` is a rule
 * and a paragraph, as in the whole document.
 */
export function prepareMarkdown(source: string, atStart = true): PreparedMarkdown {
  return normalizeMath(atStart ? fenceFrontMatter(source) : source)
}

const blockCache = new Map<string, PreparedMarkdown>()
const BLOCK_CACHE_MAX = 4000

/**
 * `prepareMarkdown` for one block, remembered by the block's text (render-by-block, perf-md task 6). Offsets in the
 * result (`display`, `generated`) are relative to the block; the plugins that read them parse the same block text, so
 * they agree. The concatenation of the per-block `text`s joined by `\n` equals the whole document's (blocks.test.ts).
 */
export function prepareBlock(text: string, first = false): PreparedMarkdown {
  const key = first ? `1|${text}` : `0|${text}`
  const hit = blockCache.get(key)
  if (hit) return hit
  const prepared = prepareMarkdown(text, first)
  blockCache.set(key, prepared)
  if (blockCache.size > BLOCK_CACHE_MAX) {
    let drop = BLOCK_CACHE_MAX / 4
    for (const key of blockCache.keys()) {
      blockCache.delete(key)
      if (--drop <= 0) break
    }
  }
  return prepared
}
