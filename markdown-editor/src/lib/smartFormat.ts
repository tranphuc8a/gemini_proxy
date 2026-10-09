/**
 * Pure helpers for "smart format": which text goes to the AI, and how its answer
 * goes back into the document. No DOM, no store — testable alone.
 */

export type Scope = 'selection' | 'document'

export interface Target {
  scope: Scope
  /** Offsets of the text in the document the target was taken from. */
  from: number
  to: number
  text: string
}

/** The selection when there is one worth sending, otherwise the whole document. */
export function chooseTarget(value: string, start: number, end: number, scope?: Scope): Target {
  const a = Math.max(0, Math.min(start, end, value.length))
  const b = Math.max(0, Math.min(Math.max(start, end), value.length))
  const hasSelection = value.slice(a, b).trim().length > 0
  const wanted: Scope = scope ?? (hasSelection ? 'selection' : 'document')
  if (wanted === 'selection' && hasSelection) return { scope: 'selection', from: a, to: b, text: value.slice(a, b) }
  return { scope: 'document', from: 0, to: value.length, text: value }
}

/**
 * The document with `markdown` in place of the target's text.
 *
 * Returns null when the document changed under the target since it was taken (the
 * text at those offsets is no longer the text that was sent): replacing blindly
 * would overwrite something the AI never saw.
 */
export function applyResult(current: string, target: Target, markdown: string): string | null {
  if (current.slice(target.from, target.to) !== target.text) return null
  let insert = markdown.replace(/\s+$/, '')
  if (target.scope === 'selection') {
    // Keep the whitespace the selection had around its content, so lists and paragraphs around it stay apart.
    const lead = /^\s*/.exec(target.text)?.[0] ?? ''
    const trail = /\s*$/.exec(target.text)?.[0] ?? ''
    insert = lead + insert.replace(/^\s+/, '') + trail
  } else if (target.text.endsWith('\n')) {
    insert += '\n'
  }
  return current.slice(0, target.from) + insert + current.slice(target.to)
}

/** Words, the way the server counts them: runs of letters, digits and underscores. */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}_]+/gu) ?? []).length
}

export const MODE_LABELS: Record<'smart' | 'tidy' | 'summary', { label: string; hint: string }> = {
  smart: { label: 'Smart format', hint: 'Headings, lists, tables and code fences from raw text — wording unchanged' },
  tidy: { label: 'Tidy only', hint: 'Keep the structure; fix markdown syntax, spacing, list markers and fence languages' },
  summary: { label: 'Format + summary', hint: 'Smart format, with a short summary of the main ideas on top' }
}
