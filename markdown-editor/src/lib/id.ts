let counter = 0

/**
 * Collision-free id generator. The previous implementation used `Date.now()`
 * alone, so two nodes created in the same millisecond shared an id and the
 * tree helpers then mutated both of them.
 */
export function createId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function resetIdCounter(): void {
  counter = 0
}
