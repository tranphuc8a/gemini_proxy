import { describe, expect, it } from 'vitest'
import type { EditorSelection } from '../editorCommands'
import {
  continueList,
  deleteLines,
  duplicateLines,
  moveLines,
  expandToLines,
  indentSelection,
  insertCodeBlock,
  insertLink,
  insertTable,
  outdentSelection,
  toggleHeading,
  toggleLinePrefix,
  toggleTaskAtCaret,
  toggleTaskAtIndex,
  toggleWrap,
  wrapSelectionWithPair
} from '../editorCommands'

/** Builds a selection from a string: | is the caret, «» delimit a range. */
function sel(marked: string): EditorSelection {
  if (marked.includes('«')) {
    const start = marked.indexOf('«')
    const end = marked.indexOf('»') - 1
    return { value: marked.replace('«', '').replace('»', ''), start, end }
  }
  return { value: marked.replace('|', ''), start: marked.indexOf('|'), end: marked.indexOf('|') }
}

/** Renders a result back into the same notation for readable assertions. */
function show(result: EditorSelection): string {
  if (result.start === result.end) {
    return result.value.slice(0, result.start) + '|' + result.value.slice(result.start)
  }
  return result.value.slice(0, result.start) + '«' + result.value.slice(result.start, result.end) + '»' + result.value.slice(result.end)
}

describe('toggleWrap', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(show(toggleWrap(sel('say «hello» there'), '**'))).toBe('say **«hello»** there')
  })

  it('unwraps when the markers are inside the selection', () => {
    expect(show(toggleWrap(sel('say «**hello**» there'), '**'))).toBe('say «hello» there')
  })

  it('unwraps when the markers sit just outside the selection', () => {
    expect(show(toggleWrap(sel('say **«hello»** there'), '**'))).toBe('say «hello» there')
  })

  it('inserts an empty pair at a caret with the caret between markers', () => {
    expect(show(toggleWrap(sel('a|b'), '**'))).toBe('a**|**b')
  })

  it('supports asymmetric markers', () => {
    expect(show(toggleWrap(sel('«x»'), '<sub>', '</sub>'))).toBe('<sub>«x»</sub>')
  })
})

describe('toggleHeading', () => {
  it('adds a heading prefix', () => {
    expect(toggleHeading(sel('Title|'), 2).value).toBe('## Title')
  })

  it('replaces a different level', () => {
    expect(toggleHeading(sel('# Title|'), 3).value).toBe('### Title')
  })

  it('removes the prefix when the level matches', () => {
    expect(toggleHeading(sel('## Title|'), 2).value).toBe('Title')
  })

  it('only touches the caret line', () => {
    const result = toggleHeading({ value: 'one\ntwo\nthree', start: 5, end: 5 }, 1)
    expect(result.value).toBe('one\n# two\nthree')
  })

  it('keeps the caret on the line after the prefix changes', () => {
    const result = toggleHeading({ value: 'Title', start: 5, end: 5 }, 1)
    expect(result.start).toBe(7)
  })
})

describe('toggleLinePrefix', () => {
  it('bullets every selected line', () => {
    const result = toggleLinePrefix({ value: 'a\nb\nc', start: 0, end: 5 }, 'bullet')
    expect(result.value).toBe('- a\n- b\n- c')
  })

  it('removes bullets when all lines already have them', () => {
    const result = toggleLinePrefix({ value: '- a\n- b', start: 0, end: 7 }, 'bullet')
    expect(result.value).toBe('a\nb')
  })

  it('numbers an ordered list from one', () => {
    const result = toggleLinePrefix({ value: 'a\nb\nc', start: 0, end: 5 }, 'ordered')
    expect(result.value).toBe('1. a\n2. b\n3. c')
  })

  it('converts bullets to an ordered list without doubling markers', () => {
    const result = toggleLinePrefix({ value: '- a\n- b', start: 0, end: 7 }, 'ordered')
    expect(result.value).toBe('1. a\n2. b')
  })

  it('creates task list items', () => {
    const result = toggleLinePrefix({ value: 'buy milk', start: 0, end: 8 }, 'task')
    expect(result.value).toBe('- [ ] buy milk')
  })

  it('toggles quotes off again', () => {
    const quoted = toggleLinePrefix({ value: 'a\nb', start: 0, end: 3 }, 'quote')
    expect(quoted.value).toBe('> a\n> b')
    expect(toggleLinePrefix({ ...quoted }, 'quote').value).toBe('a\nb')
  })

  it('preserves indentation', () => {
    const result = toggleLinePrefix({ value: '  nested', start: 0, end: 8 }, 'bullet')
    expect(result.value).toBe('  - nested')
  })
})

describe('indent and outdent', () => {
  it('inserts two spaces at a caret', () => {
    expect(show(indentSelection(sel('ab|cd')))).toBe('ab  |cd')
  })

  it('indents every non-empty selected line', () => {
    const result = indentSelection({ value: 'a\n\nb', start: 0, end: 4 })
    expect(result.value).toBe('  a\n\n  b')
  })

  it('outdents by one level', () => {
    const result = outdentSelection({ value: '    a\n    b', start: 0, end: 11 })
    expect(result.value).toBe('  a\n  b')
  })

  it('outdents partial indentation without going negative', () => {
    const result = outdentSelection({ value: ' a', start: 0, end: 2 })
    expect(result.value).toBe('a')
  })

  it('returns the selection unchanged when there is nothing to remove', () => {
    const input = { value: 'a\nb', start: 0, end: 3 }
    expect(outdentSelection(input)).toBe(input)
  })

  it('round-trips indent then outdent', () => {
    const start = { value: 'a\nb\nc', start: 0, end: 5 }
    expect(outdentSelection(indentSelection(start)).value).toBe('a\nb\nc')
  })
})

describe('continueList', () => {
  it('continues a bullet list', () => {
    expect(continueList(sel('- item|'))?.value).toBe('- item\n- ')
  })

  it('increments an ordered list', () => {
    expect(continueList(sel('3. item|'))?.value).toBe('3. item\n4. ')
  })

  it('keeps the ) delimiter style', () => {
    expect(continueList(sel('1) item|'))?.value).toBe('1) item\n2) ')
  })

  it('resets a checked task to unchecked', () => {
    expect(continueList(sel('- [x] done|'))?.value).toBe('- [x] done\n- [ ] ')
  })

  it('preserves nesting indentation', () => {
    expect(continueList(sel('  - item|'))?.value).toBe('  - item\n  - ')
  })

  it('outdents an empty nested item', () => {
    expect(continueList(sel('  - |'))?.value).toBe('- ')
  })

  it('clears an empty top-level item to leave the list', () => {
    expect(continueList(sel('- |'))?.value).toBe('')
  })

  it('continues a blockquote', () => {
    expect(continueList(sel('> quoted|'))?.value).toBe('> quoted\n> ')
  })

  it('returns null outside a list so Enter stays native', () => {
    expect(continueList(sel('plain text|'))).toBeNull()
  })

  it('returns null when text is selected', () => {
    expect(continueList(sel('- «item»'))).toBeNull()
  })
})

describe('task toggles', () => {
  it('checks and unchecks the caret line', () => {
    const checked = toggleTaskAtCaret(sel('- [ ] task|'))!
    expect(checked.value).toBe('- [x] task')
    expect(toggleTaskAtCaret({ ...checked })!.value).toBe('- [ ] task')
  })

  it('ignores lines that are not tasks', () => {
    expect(toggleTaskAtCaret(sel('- plain|'))).toBeNull()
  })

  it('toggles the nth task of a document', () => {
    const doc = '- [ ] one\n- [ ] two\n- [ ] three'
    expect(toggleTaskAtIndex(doc, 1)).toBe('- [ ] one\n- [x] two\n- [ ] three')
  })

  it('leaves the document alone for an out-of-range index', () => {
    const doc = '- [ ] one'
    expect(toggleTaskAtIndex(doc, 5)).toBe(doc)
  })

  it('counts tasks in ordered lists too', () => {
    expect(toggleTaskAtIndex('1. [ ] a\n2. [ ] b', 0)).toBe('1. [x] a\n2. [ ] b')
  })
})

describe('insertions', () => {
  it('selects the url placeholder of a link built from a selection', () => {
    const result = insertLink(sel('see «docs» now'))
    expect(result.value).toBe('see [docs](https://) now')
    expect(result.value.slice(result.start, result.end)).toBe('https://')
  })

  it('selects the label when there is no selection', () => {
    const result = insertLink(sel('|'))
    expect(result.value.slice(result.start, result.end)).toBe('link text')
  })

  it('selects the language slot of a code block', () => {
    const result = insertCodeBlock(sel('|'))
    expect(result.value).toBe('```\ncode\n```\n')
    expect(result.value.slice(result.start, result.end)).toBe('code')
  })

  it('starts a code block on its own line', () => {
    expect(insertCodeBlock(sel('text|')).value.startsWith('text\n```')).toBe(true)
  })

  it('builds a table with a header and divider', () => {
    const lines = insertTable(sel('|'), 2, 2).value.trim().split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe('| --- | --- |')
  })

  it('wraps a selection in a bracket pair instead of replacing it', () => {
    expect(show(wrapSelectionWithPair(sel('a «b» c'), '(')!)).toBe('a («b») c')
    expect(wrapSelectionWithPair(sel('a|b'), '(')).toBeNull()
    expect(wrapSelectionWithPair(sel('«a»'), 'z')).toBeNull()
  })
})

describe('expandToLines', () => {
  it('grows a partial selection to whole lines', () => {
    expect(expandToLines({ value: 'alpha\nbeta', start: 2, end: 8 })).toEqual({ start: 0, end: 10 })
  })
})

describe('line operations', () => {
  it('duplicates the caret line below itself', () => {
    const result = duplicateLines({ value: 'a\nb\nc', start: 2, end: 2 })
    expect(result.value).toBe('a\nb\nb\nc')
  })

  it('duplicates a multi-line selection as a block', () => {
    const result = duplicateLines({ value: 'a\nb\nc', start: 0, end: 3 })
    expect(result.value).toBe('a\nb\na\nb\nc')
  })

  it('keeps the caret on the copy', () => {
    const result = duplicateLines({ value: 'abc', start: 1, end: 1 })
    expect(result.value).toBe('abc\nabc')
    expect(result.value[result.start]).toBe('b')
  })

  it('moves a line up and back down', () => {
    const down = moveLines({ value: 'a\nb\nc', start: 0, end: 0 }, 1)
    expect(down.value).toBe('b\na\nc')
    expect(moveLines(down, -1).value).toBe('a\nb\nc')
  })

  it('refuses to move past the document edges', () => {
    const top = { value: 'a\nb', start: 0, end: 0 }
    expect(moveLines(top, -1)).toBe(top)
    const bottom = { value: 'a\nb', start: 2, end: 2 }
    expect(moveLines(bottom, 1)).toBe(bottom)
  })

  it('moves a multi-line block together', () => {
    const result = moveLines({ value: 'a\nb\nc\nd', start: 0, end: 3 }, 1)
    expect(result.value).toBe('c\na\nb\nd')
  })

  it('deletes the caret line', () => {
    expect(deleteLines({ value: 'a\nb\nc', start: 2, end: 2 }).value).toBe('a\nc')
  })

  it('deletes the last line without leaving a trailing newline', () => {
    expect(deleteLines({ value: 'a\nb', start: 2, end: 2 }).value).toBe('a')
  })

  it('deletes every touched line', () => {
    expect(deleteLines({ value: 'a\nb\nc', start: 0, end: 3 }).value).toBe('c')
  })
})
