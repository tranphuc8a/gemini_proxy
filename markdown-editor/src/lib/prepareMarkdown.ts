import { normalizeMath, type PreparedMath } from './mathDelimiters'

/**
 * What the Markdown parser is actually given: the document after the line-preserving rewrites that have to happen
 * before parsing, plus what those rewrites tell the plugins that run after it (`remarkMathPromote` reads
 * `display`/`generated`).
 */
export type PreparedMarkdown = PreparedMath

/**
 * Source-level rewrites, in a fixed order, none of which may add or remove a line (the preview's `data-line` anchors
 * are source line numbers):
 *   1. front matter → a fenced block                       (md-render task 6, batch M6 -- not yet)
 *   2. bare `@startuml … @enduml` → a `plantuml` fence       (md-render task 12, batch M7 -- not yet)
 *   3. maths delimiters as LLMs write them → `$` syntax      (`normalizeMath`)
 * Steps 1–2 must come first: they turn text into fences, and the maths pass leaves fences alone.
 *
 * Render-by-block (perf-md task 6, batch M5) will call this once per block and cache by block text; the result must
 * stay the concatenation of the per-block results, which is why every step works within a block.
 */
export function prepareMarkdown(source: string): PreparedMarkdown {
  return normalizeMath(source)
}

const blockCache = new Map<string, PreparedMarkdown>()
const BLOCK_CACHE_MAX = 4000

/**
 * `prepareMarkdown` for one block, remembered by the block's text (render-by-block, perf-md task 6). Offsets in the
 * result (`display`, `generated`) are relative to the block; the plugins that read them parse the same block text, so
 * they agree. The concatenation of the per-block `text`s joined by `\n` equals the whole document's (blocks.test.ts).
 */
export function prepareBlock(text: string): PreparedMarkdown {
  const hit = blockCache.get(text)
  if (hit) return hit
  const prepared = prepareMarkdown(text)
  blockCache.set(text, prepared)
  if (blockCache.size > BLOCK_CACHE_MAX) {
    let drop = BLOCK_CACHE_MAX / 4
    for (const key of blockCache.keys()) {
      blockCache.delete(key)
      if (--drop <= 0) break
    }
  }
  return prepared
}
