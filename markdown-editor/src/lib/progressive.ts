/**
 * Progressive building of a long document's blocks (perf-md task 9, batch M5). Pure helpers: which blocks to build
 * next and how many fit a time budget. BlockedMarkdownView owns the timers and the DOM.
 */

/** How many blocks around the one being viewed are built before anything else. */
export const RING_BEFORE = 2
export const RING_AFTER = 8

/**
 * The order to build `count` blocks in, given the index of the block being viewed: the ring around it first, then
 * everything below it (people read down), then what is above, nearest first.
 */
export function orderFrom(index: number, count: number): number[] {
  if (count <= 0) return []
  const here = Math.min(Math.max(index, 0), count - 1)
  const order: number[] = []
  const from = Math.max(0, here - RING_BEFORE)
  const to = Math.min(count - 1, here + RING_AFTER)
  for (let at = here; at <= to; at++) order.push(at)
  for (let at = here - 1; at >= from; at--) order.push(at)
  for (let at = to + 1; at < count; at++) order.push(at)
  for (let at = from - 1; at >= 0; at--) order.push(at)
  return order
}

/** The most blocks one slice builds, whatever the budget says (a bad estimate must not freeze the page). */
export const MAX_BATCH = 120

/** How many blocks fit `budgetMs` when one takes about `avgMsPerBlock` (at least one, so progress never stops). */
export function batchSize(budgetMs: number, avgMsPerBlock: number): number {
  if (!(avgMsPerBlock > 0)) return 1
  return Math.min(MAX_BATCH, Math.max(1, Math.floor(budgetMs / avgMsPerBlock)))
}

/**
 * The next slice: the first `batchSize` entries of `order` that are not done yet. `isDone` is asked per index, so the
 * caller keeps its own record of what is built.
 */
export function nextBatch(order: readonly number[], isDone: (index: number) => boolean, budgetMs: number, avgMsPerBlock: number): number[] {
  const size = batchSize(budgetMs, avgMsPerBlock)
  const batch: number[] = []
  for (const index of order) {
    if (isDone(index)) continue
    batch.push(index)
    if (batch.length >= size) break
  }
  return batch
}

/**
 * Which blocks the first paint builds: from the top (or from `focus`), enough to fill a few screens -- about `lines`
 * source lines, at least `minBlocks`, at most `maxBlocks`.
 */
export function initialBlocks(lineCounts: readonly number[], focus = 0, lines = 90, minBlocks = 6, maxBlocks = 40): number[] {
  const picked: number[] = []
  let total = 0
  for (let index = Math.min(Math.max(focus, 0), Math.max(0, lineCounts.length - 1)); index < lineCounts.length; index++) {
    picked.push(index)
    total += lineCounts[index]
    if (picked.length >= maxBlocks || (picked.length >= minBlocks && total >= lines)) break
  }
  return picked
}

/** A placeholder's height before its block exists: source lines at the article's line height. */
export function estimatedHeightEm(lines: number): number {
  return Math.max(1, lines) * 1.4
}
