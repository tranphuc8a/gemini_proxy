/**
 * Pure text transforms for the editor. Every command takes the textarea state
 * and returns the next state, so the behaviour is testable without a DOM.
 */
export interface EditorSelection {
  value: string
  start: number
  end: number
}

export const INDENT = '  '

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(\[([ xX])\]\s+)?(.*)$/
const BLOCKQUOTE = /^(\s*)>\s?(.*)$/

function lineBounds(value: string, offset: number): { start: number; end: number } {
  const start = value.lastIndexOf('\n', offset - 1) + 1
  const lineEnd = value.indexOf('\n', offset)
  return { start, end: lineEnd === -1 ? value.length : lineEnd }
}

/** Grows a selection to cover every line it touches. */
export function expandToLines(sel: EditorSelection): { start: number; end: number } {
  const start = lineBounds(sel.value, sel.start).start
  const end = lineBounds(sel.value, sel.end).end
  return { start, end }
}

function splice(value: string, start: number, end: number, insert: string): string {
  return value.slice(0, start) + insert + value.slice(end)
}

/**
 * Wraps or unwraps the selection with an inline marker (bold, italic, code…).
 * Detects markers that already sit just outside the selection so a second
 * press of Ctrl+B on a selected word removes the emphasis it just added.
 */
export function toggleWrap(sel: EditorSelection, before: string, after = before): EditorSelection {
  const { value, start, end } = sel
  const selected = value.slice(start, end)

  const innerWrapped = selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length
  if (innerWrapped) {
    const stripped = selected.slice(before.length, selected.length - after.length)
    return { value: splice(value, start, end, stripped), start, end: start + stripped.length }
  }

  const outerWrapped =
    value.slice(Math.max(0, start - before.length), start) === before && value.slice(end, end + after.length) === after
  if (outerWrapped) {
    const from = start - before.length
    const to = end + after.length
    return { value: splice(value, from, to, selected), start: from, end: from + selected.length }
  }

  const wrapped = before + selected + after
  return {
    value: splice(value, start, end, wrapped),
    start: start + before.length,
    end: start + before.length + selected.length
  }
}

/** Replaces any existing ATX prefix; passing the same level clears it. */
export function toggleHeading(sel: EditorSelection, level: number): EditorSelection {
  const bounds = lineBounds(sel.value, sel.start)
  const line = sel.value.slice(bounds.start, bounds.end)
  const match = /^(#{1,6})\s+/.exec(line)
  const prefix = `${'#'.repeat(level)} `

  let next: string
  if (match && match[1].length === level) next = line.slice(match[0].length)
  else if (match) next = prefix + line.slice(match[0].length)
  else next = prefix + line

  const delta = next.length - line.length
  return {
    value: splice(sel.value, bounds.start, bounds.end, next),
    start: Math.max(bounds.start, sel.start + delta),
    end: Math.max(bounds.start, sel.end + delta)
  }
}

export type LinePrefixKind = 'bullet' | 'ordered' | 'task' | 'quote'

const PREFIX_PATTERN: Record<LinePrefixKind, RegExp> = {
  bullet: /^(\s*)[-*+]\s+/,
  ordered: /^(\s*)\d+[.)]\s+/,
  task: /^(\s*)[-*+]\s+\[[ xX]\]\s+/,
  quote: /^(\s*)>\s?/
}

/** Adds the prefix to every touched line, or strips it when all lines have it. */
export function toggleLinePrefix(sel: EditorSelection, kind: LinePrefixKind): EditorSelection {
  const bounds = expandToLines(sel)
  const block = sel.value.slice(bounds.start, bounds.end)
  const lines = block.split('\n')
  const pattern = PREFIX_PATTERN[kind]
  const meaningful = lines.filter((line) => line.trim().length > 0)
  const allPrefixed = meaningful.length > 0 && meaningful.every((line) => pattern.test(line))

  let counter = 0
  const next = lines
    .map((line) => {
      if (allPrefixed) return line.replace(pattern, '$1')
      if (!line.trim() && lines.length > 1) return line
      const indent = /^(\s*)/.exec(line)?.[1] ?? ''
      const body = line.slice(indent.length).replace(PREFIX_PATTERN.bullet, '').replace(PREFIX_PATTERN.ordered, '')
      counter += 1
      switch (kind) {
        case 'bullet':
          return `${indent}- ${body}`
        case 'ordered':
          return `${indent}${counter}. ${body}`
        case 'task':
          return `${indent}- [ ] ${body}`
        case 'quote':
          return `${indent}> ${line.slice(indent.length)}`
      }
    })
    .join('\n')

  return { value: splice(sel.value, bounds.start, bounds.end, next), start: bounds.start, end: bounds.start + next.length }
}

/** Inserts text at the caret, optionally selecting a placeholder inside it. */
export function insertText(sel: EditorSelection, text: string, selectFrom?: number, selectTo?: number): EditorSelection {
  const value = splice(sel.value, sel.start, sel.end, text)
  const start = selectFrom === undefined ? sel.start + text.length : sel.start + selectFrom
  const end = selectTo === undefined ? start : sel.start + selectTo
  return { value, start, end }
}

export function insertLink(sel: EditorSelection, url = 'https://'): EditorSelection {
  const selected = sel.value.slice(sel.start, sel.end)
  const label = selected || 'link text'
  const text = `[${label}](${url})`
  return selected
    ? insertText(sel, text, text.length - url.length - 1, text.length - 1)
    : insertText(sel, text, 1, 1 + label.length)
}

export function insertImage(sel: EditorSelection, url = 'https://', alt?: string): EditorSelection {
  const selected = sel.value.slice(sel.start, sel.end)
  const label = alt ?? selected ?? ''
  const text = `![${label || 'alt text'}](${url})`
  return insertText(sel, text, text.length - url.length - 1, text.length - 1)
}

export function insertCodeBlock(sel: EditorSelection, language = ''): EditorSelection {
  const selected = sel.value.slice(sel.start, sel.end)
  const prefix = sel.start > 0 && sel.value[sel.start - 1] !== '\n' ? '\n' : ''
  const body = selected || 'code'
  const text = `${prefix}\`\`\`${language}\n${body}\n\`\`\`\n`
  const from = prefix.length + 3 + language.length + 1
  return insertText(sel, text, from, from + body.length)
}

export function insertTable(sel: EditorSelection, rows = 2, columns = 3): EditorSelection {
  const header = `| ${Array.from({ length: columns }, (_, i) => `Column ${i + 1}`).join(' | ')} |`
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  const body = Array.from({ length: rows }, () => `| ${Array.from({ length: columns }, () => ' ').join(' | ')} |`)
  const prefix = sel.start > 0 && sel.value[sel.start - 1] !== '\n' ? '\n' : ''
  return insertText(sel, `${prefix}${[header, divider, ...body].join('\n')}\n`)
}

export function insertHorizontalRule(sel: EditorSelection): EditorSelection {
  const prefix = sel.start > 0 && sel.value[sel.start - 1] !== '\n' ? '\n' : ''
  return insertText(sel, `${prefix}\n---\n\n`)
}

/** Tab / Shift+Tab over one or many lines. */
export function indentSelection(sel: EditorSelection, unit = INDENT): EditorSelection {
  if (sel.start === sel.end) return insertText(sel, unit)

  const bounds = expandToLines(sel)
  const block = sel.value.slice(bounds.start, bounds.end)
  const next = block
    .split('\n')
    .map((line) => (line.trim() ? unit + line : line))
    .join('\n')
  return { value: splice(sel.value, bounds.start, bounds.end, next), start: bounds.start, end: bounds.start + next.length }
}

export function outdentSelection(sel: EditorSelection, unit = INDENT): EditorSelection {
  const bounds = expandToLines(sel)
  const block = sel.value.slice(bounds.start, bounds.end)
  const stripper = new RegExp(`^(${unit}|\\t| {1,${unit.length}})`)

  let firstLineRemoved = 0
  let totalRemoved = 0
  const next = block
    .split('\n')
    .map((line, index) => {
      const match = stripper.exec(line)
      if (!match) return line
      if (index === 0) firstLineRemoved = match[0].length
      totalRemoved += match[0].length
      return line.slice(match[0].length)
    })
    .join('\n')

  if (totalRemoved === 0) return sel
  const value = splice(sel.value, bounds.start, bounds.end, next)
  return sel.start === sel.end
    ? { value, start: Math.max(bounds.start, sel.start - firstLineRemoved), end: Math.max(bounds.start, sel.end - firstLineRemoved) }
    : { value, start: bounds.start, end: bounds.start + next.length }
}

/**
 * Enter inside a list continues it; Enter on an empty item ends the list.
 * Returns null when the caret is not in a list or quote so the caller can let
 * the browser insert a plain newline.
 */
export function continueList(sel: EditorSelection): EditorSelection | null {
  if (sel.start !== sel.end) return null

  const bounds = lineBounds(sel.value, sel.start)
  const line = sel.value.slice(bounds.start, sel.start)

  const listMatch = LIST_ITEM.exec(line)
  if (listMatch) {
    const [, indent, marker, spacing, taskBox, , content] = listMatch
    if (!content.trim()) {
      // Enter on an empty item outdents one level, then leaves the list.
      const outdented = indent.length >= INDENT.length
        ? `${indent.slice(INDENT.length)}${marker}${spacing}${taskBox ? '[ ] ' : ''}`
        : ''
      const caret = bounds.start + outdented.length
      return { value: splice(sel.value, bounds.start, sel.start, outdented), start: caret, end: caret }
    }
    const nextMarker = /^\d+[.)]$/.test(marker)
      ? `${parseInt(marker, 10) + 1}${marker.slice(-1)}`
      : marker
    const insertion = `\n${indent}${nextMarker}${spacing}${taskBox ? '[ ] ' : ''}`
    return insertText(sel, insertion)
  }

  const quoteMatch = BLOCKQUOTE.exec(line)
  if (quoteMatch) {
    const [, indent, content] = quoteMatch
    if (!content.trim()) {
      return { value: splice(sel.value, bounds.start, sel.start, ''), start: bounds.start, end: bounds.start }
    }
    return insertText(sel, `\n${indent}> `)
  }

  return null
}

/** Flips `- [ ]` and `- [x]` on the line holding the caret. */
export function toggleTaskAtCaret(sel: EditorSelection): EditorSelection | null {
  const bounds = lineBounds(sel.value, sel.start)
  const line = sel.value.slice(bounds.start, bounds.end)
  const match = /^(\s*[-*+]\s+\[)([ xX])(\]\s*)/.exec(line)
  if (!match) return null
  const flipped = match[2] === ' ' ? 'x' : ' '
  const next = match[1] + flipped + match[3] + line.slice(match[0].length)
  return { value: splice(sel.value, bounds.start, bounds.end, next), start: sel.start, end: sel.end }
}

/** Flips the nth `- [ ]` of the document, used by preview checkbox clicks. */
export function toggleTaskAtIndex(value: string, index: number): string {
  let seen = -1
  return value.replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/gm, (match, head: string, state: string, tail: string) => {
    seen += 1
    if (seen !== index) return match
    return head + (state === ' ' ? 'x' : ' ') + tail
  })
}

/** Wrapping a selection in a bracket pair instead of replacing it. */
export const AUTO_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
  '*': '*',
  '_': '_'
}

export function wrapSelectionWithPair(sel: EditorSelection, opening: string): EditorSelection | null {
  const closing = AUTO_PAIRS[opening]
  if (!closing || sel.start === sel.end) return null
  return toggleWrap(sel, opening, closing)
}

/** Ctrl+D: copies the touched lines directly below themselves. */
export function duplicateLines(sel: EditorSelection): EditorSelection {
  const bounds = expandToLines(sel)
  const block = sel.value.slice(bounds.start, bounds.end)
  const value = splice(sel.value, bounds.end, bounds.end, `\n${block}`)
  const shift = block.length + 1
  return { value, start: sel.start + shift, end: sel.end + shift }
}

/** Alt+Up / Alt+Down: swaps the touched lines with the neighbouring line. */
export function moveLines(sel: EditorSelection, direction: -1 | 1): EditorSelection {
  const lines = sel.value.split('\n')
  const bounds = expandToLines(sel)
  const firstIndex = sel.value.slice(0, bounds.start).split('\n').length - 1
  const lastIndex = firstIndex + sel.value.slice(bounds.start, bounds.end).split('\n').length - 1

  const targetIndex = direction === -1 ? firstIndex - 1 : lastIndex + 1
  if (targetIndex < 0 || targetIndex >= lines.length) return sel

  const block = lines.slice(firstIndex, lastIndex + 1)
  const rest = [...lines.slice(0, firstIndex), ...lines.slice(lastIndex + 1)]
  const insertAt = direction === -1 ? firstIndex - 1 : firstIndex + 1
  rest.splice(insertAt, 0, ...block)

  const value = rest.join('\n')
  const shift = direction === -1 ? -(lines[targetIndex].length + 1) : lines[targetIndex].length + 1
  return { value, start: sel.start + shift, end: sel.end + shift }
}

/** Ctrl+Shift+K: removes the touched lines entirely. */
export function deleteLines(sel: EditorSelection): EditorSelection {
  const bounds = expandToLines(sel)
  const hasFollowing = bounds.end < sel.value.length
  const from = hasFollowing ? bounds.start : Math.max(0, bounds.start - 1)
  const to = hasFollowing ? bounds.end + 1 : bounds.end
  const value = splice(sel.value, from, to, '')
  const caret = Math.min(from, value.length)
  return { value, start: caret, end: caret }
}
