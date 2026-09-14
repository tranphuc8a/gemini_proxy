/**
 * Identifiers for nodes, edges and documents.
 *
 * `crypto.randomUUID` where it exists; a counter-plus-random fallback where it
 * does not (it needs a secure context, and this app is opened from `file://`
 * and plain-HTTP dev servers often enough to matter). Uniqueness only has to
 * hold inside one document, which either scheme gives comfortably.
 */

let counter = 0

function random(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}

export function createId(prefix = 'n'): string {
  counter += 1
  return `${prefix}${counter.toString(36)}-${random()}`
}

/**
 * An id safe to use in a URL path and as a database key.
 *
 * The backend refuses anything that is not alphanumeric plus `-` and `_`, so
 * document ids are generated to that alphabet rather than sanitised later.
 */
export function createDocumentId(): string {
  return `g${Date.now().toString(36)}${random()}`.replace(/[^A-Za-z0-9_-]/g, '')
}

/** Reset the counter. Only for tests that assert on generated ids. */
export function resetIdCounter(): void {
  counter = 0
}
