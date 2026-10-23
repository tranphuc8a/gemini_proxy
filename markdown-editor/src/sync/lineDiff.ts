/**
 * Line diff, line patch and three-way merge for the document sync (md-sync F1).
 *
 * A text is `text.split('\n')` (a `\r` stays on its line, a trailing newline is an empty last line), so this module and
 * the server's `application/utils/line_patch.py` agree on every byte. A patch is `{ v: 1, h: [[offset, removed, [lines]], ...] }`:
 * replace `removed` lines of the base, starting at 0-based line `offset`, with the inserted lines. Hunks ascend and do
 * not overlap. The shared fixture `backend/fastapi/tests/fixtures/markdown_patches.json` is applied by both sides.
 *
 * The diff is Myers' O((N+M)·D) after trimming the common head and tail. Past `MAX_D` edits it gives up (null): a rewrite
 * that large is cheaper to send whole than to describe. No dependency (prototype: tasks/.../nhap/md-sync/proto-diff.mjs).
 */

export type Hunk = [offset: number, removed: number, inserted: string[]]
export interface LinePatch {
  v: 1
  h: Hunk[]
}

/** More edit operations than this and the diff is abandoned (the caller sends the text whole). */
export const MAX_D = 2000
/** A merge may look further than a patch (it never leaves the machine), within a memory bound of D² ints. */
export const MERGE_MAX_D = 3000
/** A text this small is sent whole: the patch would not be smaller. */
export const PATCH_MIN_CHARS = 4096
/** A patch bigger than this share of the text is not worth sending. */
export const PATCH_MAX_SHARE = 0.6

function intern(left: string[], right: string[]): [Int32Array, Int32Array] {
  const ids = new Map<string, number>()
  const map = (lines: string[]) => {
    const out = new Int32Array(lines.length)
    for (let index = 0; index < lines.length; index += 1) {
      let id = ids.get(lines[index])
      if (id === undefined) {
        id = ids.size
        ids.set(lines[index], id)
      }
      out[index] = id
    }
    return out
  }
  return [map(left), map(right)]
}

type Op = 'e' | 'd' | 'i'

/** Myers with a trace of V per step for the walk back. Returns the edit script, or null when more than `maxD` edits are needed. */
function myers(a: Int32Array, b: Int32Array, maxD: number): Op[] | null {
  const n = a.length
  const m = b.length
  const max = n + m
  const off = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  const limit = Math.min(max, maxD)
  for (let d = 0; d <= limit; d += 1) {
    trace.push(v.slice(off - d - 1, off + d + 2))
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x += 1
        y += 1
      }
      v[off + k] = x
      if (x >= n && y >= m) return backtrack(trace, n, m)
    }
  }
  return null
}

function backtrack(trace: Int32Array[], n: number, m: number): Op[] {
  const ops: Op[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const snapshot = trace[d]
    const at = (k: number) => snapshot[k + d + 1]
    const k = x - y
    let previousK: number
    if (d === 0) previousK = 0
    else previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1
    const previousX = d === 0 ? 0 : at(previousK)
    const previousY = previousX - previousK
    while (x > previousX && y > previousY) {
      ops.push('e')
      x -= 1
      y -= 1
    }
    if (d > 0) {
      if (x === previousX) {
        ops.push('i')
        y -= 1
      } else {
        ops.push('d')
        x -= 1
      }
    }
  }
  return ops.reverse()
}

/** The hunks that turn `oldText` into `newText`, or null when that takes more than `maxD` line edits. */
export function diffLines(oldText: string, newText: string, maxD: number = MAX_D): Hunk[] | null {
  if (oldText === newText) return []
  const left = oldText.split('\n')
  const right = newText.split('\n')
  let head = 0
  while (head < left.length && head < right.length && left[head] === right[head]) head += 1
  let tail = 0
  while (tail < left.length - head && tail < right.length - head && left[left.length - 1 - tail] === right[right.length - 1 - tail]) tail += 1
  const leftMid = left.slice(head, left.length - tail)
  const rightMid = right.slice(head, right.length - tail)
  const [a, b] = intern(leftMid, rightMid)
  const ops = myers(a, b, maxD)
  if (!ops) return null

  const hunks: Hunk[] = []
  let x = 0
  let y = 0
  let current: Hunk | null = null
  for (const op of ops) {
    if (op === 'e') {
      if (current) {
        hunks.push(current)
        current = null
      }
      x += 1
      y += 1
      continue
    }
    if (!current) current = [head + x, 0, []]
    if (op === 'd') {
      current[1] += 1
      x += 1
    } else {
      current[2].push(rightMid[y])
      y += 1
    }
  }
  if (current) hunks.push(current)
  return hunks
}

/**
 * A patch for `oldText` → `newText`, or null when the text should be sent whole instead: the diff gave up, or the
 * patch would not be much smaller than the text it produces.
 */
export function makePatch(oldText: string, newText: string): LinePatch | null {
  const hunks = diffLines(oldText, newText)
  if (!hunks) return null
  const patch: LinePatch = { v: 1, h: hunks }
  if (JSON.stringify(patch).length > newText.length * PATCH_MAX_SHARE) return null
  return patch
}

/** Applies a patch to the text it was made against. Throws when a hunk does not fit (a stale or corrupt patch). */
export function applyPatch(text: string, patch: LinePatch): string {
  if (!patch || patch.v !== 1 || !Array.isArray(patch.h)) throw new Error('Unsupported patch')
  const lines = text.split('\n')
  let previousEnd = -1
  for (const [offset, removed] of patch.h) {
    if (!Number.isInteger(offset) || !Number.isInteger(removed) || offset < 0 || removed < 0 || offset + removed > lines.length) {
      throw new Error('The patch does not fit the text')
    }
    if (offset < previousEnd) throw new Error('Overlapping hunks')
    previousEnd = offset + removed
  }
  for (let index = patch.h.length - 1; index >= 0; index -= 1) {
    const [offset, removed, inserted] = patch.h[index]
    lines.splice(offset, removed, ...inserted)
  }
  return lines.join('\n')
}

export interface MergeResult {
  text: string
  /** Clusters where both sides changed the same lines differently; their text is `ours` between markers. */
  conflicts: number
}

/** Hunks of the two sides, ordered, then folded into clusters that touch the same stretch of the base. */
interface Cluster {
  lo: number
  hi: number
  items: { side: 'o' | 't'; h: Hunk }[]
}

function overlaps(lo: number, hi: number, [offset, removed]: Hunk): boolean {
  if (offset === lo) return true
  return (offset < hi && lo < offset + removed) || (removed === 0 && offset > lo && offset < hi)
}

/**
 * Three-way merge by line. Two edits that touch different stretches of the base both stand; the same edit made on both
 * sides counts once; edits that touch the same stretch differently are a conflict (counted, and the text then holds
 * `ours` -- the caller does not use it, it asks the person). Returns null when either side differs from the base by
 * more than `maxD` line edits: such a pair is not merged, it is a conflict.
 */
export function merge3(base: string, ours: string, theirs: string, maxD: number = MERGE_MAX_D): MergeResult | null {
  if (ours === theirs) return { text: ours, conflicts: 0 }
  if (ours === base) return { text: theirs, conflicts: 0 }
  if (theirs === base) return { text: ours, conflicts: 0 }
  const ourHunks = diffLines(base, ours, maxD)
  const theirHunks = diffLines(base, theirs, maxD)
  if (!ourHunks || !theirHunks) return null

  const baseLines = base.split('\n')
  const all = [...ourHunks.map((h) => ({ side: 'o' as const, h })), ...theirHunks.map((h) => ({ side: 't' as const, h }))].sort(
    (p, q) => p.h[0] - q.h[0] || p.h[1] - q.h[1]
  )
  const clusters: Cluster[] = []
  for (const item of all) {
    const last = clusters[clusters.length - 1]
    if (last && overlaps(last.lo, last.hi, item.h)) {
      last.items.push(item)
      last.hi = Math.max(last.hi, item.h[0] + item.h[1])
    } else {
      clusters.push({ lo: item.h[0], hi: item.h[0] + item.h[1], items: [item] })
    }
  }

  const sideLines = (cluster: Cluster, side: 'o' | 't'): string[] => {
    const segment = baseLines.slice(cluster.lo, cluster.hi)
    const hunks = cluster.items
      .filter((item) => item.side === side)
      .map((item) => item.h)
      .sort((p, q) => q[0] - p[0])
    for (const [offset, removed, inserted] of hunks) segment.splice(offset - cluster.lo, removed, ...inserted)
    return segment
  }

  const out: string[] = []
  let position = 0
  let conflicts = 0
  for (const cluster of clusters) {
    for (let index = position; index < cluster.lo; index += 1) out.push(baseLines[index])
    const hasOurs = cluster.items.some((item) => item.side === 'o')
    const hasTheirs = cluster.items.some((item) => item.side === 't')
    const o = sideLines(cluster, 'o')
    const t = sideLines(cluster, 't')
    if (!hasTheirs) out.push(...o)
    else if (!hasOurs) out.push(...t)
    else if (o.length === t.length && o.every((line, index) => line === t[index])) out.push(...o)
    else {
      conflicts += 1
      out.push(...o)
    }
    position = cluster.hi
  }
  for (let index = position; index < baseLines.length; index += 1) out.push(baseLines[index])
  return { text: out.join('\n'), conflicts }
}
