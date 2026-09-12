/**
 * Subsequence matching for the command palette, so "tsb" finds "Toggle
 * sidebar". A literal substring always outranks a scattered match, and among
 * scattered matches the tightest clustering wins.
 */
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1
  const text = haystack.toLowerCase()
  const query = needle.toLowerCase()

  const direct = text.indexOf(query)
  if (direct !== -1) return 10000 - direct

  let score = 0
  let position = -1
  let streak = 0

  for (const char of query) {
    const next = text.indexOf(char, position + 1)
    if (next === -1) return 0
    streak = next === position + 1 ? streak + 1 : 0
    score += 10 + streak * 5
    position = next
  }

  return score
}

export interface Searchable {
  label: string
  hint?: string
}

/** Filters and ranks by score, keeping the original order among equal scores. */
export function rankBySearch<T extends Searchable>(items: T[], query: string): T[] {
  const needle = query.trim()
  if (!needle) return items

  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(`${item.label} ${item.hint ?? ''}`, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}
