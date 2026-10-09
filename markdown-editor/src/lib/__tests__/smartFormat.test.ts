import { describe, expect, it } from 'vitest'
import { applyResult, chooseTarget, countWords } from '../smartFormat'

const DOC = 'Title line\n\nraw notes about the deploy\nstep one then step two\n\nTail paragraph.\n'

describe('chooseTarget', () => {
  it('takes the selection when there is something in it', () => {
    const start = DOC.indexOf('raw')
    const end = DOC.indexOf('\n\nTail')
    expect(chooseTarget(DOC, start, end)).toEqual({ scope: 'selection', from: start, to: end, text: DOC.slice(start, end) })
  })

  it('takes the whole document for a caret or a selection of whitespace', () => {
    expect(chooseTarget(DOC, 5, 5)).toMatchObject({ scope: 'document', from: 0, to: DOC.length, text: DOC })
    const gap = DOC.indexOf('\n\n')
    expect(chooseTarget(DOC, gap, gap + 2).scope).toBe('document')
  })

  it('lets the caller insist on the whole document, but not on an empty selection', () => {
    expect(chooseTarget(DOC, 11, 30, 'document').scope).toBe('document')
    expect(chooseTarget(DOC, 3, 3, 'selection').scope).toBe('document')
  })

  it('copes with reversed and out-of-range offsets', () => {
    expect(chooseTarget('abcdef', 4, 1)).toMatchObject({ scope: 'selection', from: 1, to: 4, text: 'bcd' })
    expect(chooseTarget('abc', 1, 99)).toMatchObject({ scope: 'selection', from: 1, to: 3, text: 'bc' })
    expect(chooseTarget('', 0, 0)).toMatchObject({ scope: 'document', text: '' })
  })
})

describe('applyResult', () => {
  it('replaces the selection and keeps the whitespace around it', () => {
    const target = chooseTarget(DOC, DOC.indexOf('\nraw'), DOC.indexOf('\n\nTail'))
    const next = applyResult(DOC, target, '## Deploy\n\n1. step one\n2. step two\n')
    expect(next).toBe('Title line\n\n## Deploy\n\n1. step one\n2. step two\n\nTail paragraph.\n')
  })

  it('replaces the whole document, keeping a final newline', () => {
    const target = chooseTarget(DOC, 0, 0)
    expect(applyResult(DOC, target, '# New\n\nBody\n\n')).toBe('# New\n\nBody\n')
    const noNewline = chooseTarget('raw', 0, 0)
    expect(applyResult('raw', noNewline, '# New')).toBe('# New')
  })

  it('refuses when the text under the target changed since it was sent', () => {
    const target = chooseTarget(DOC, DOC.indexOf('raw'), DOC.indexOf('\n\nTail'))
    expect(applyResult(DOC.replace('raw', 'RAW'), target, '## x')).toBeNull()
    expect(applyResult('Added a line first\n' + DOC, target, '## x')).toBeNull()
  })
})

describe('countWords', () => {
  it('counts words in any script, not punctuation', () => {
    expect(countWords('## Cài đặt — chạy lệnh `pip install`!')).toBe(6)
    expect(countWords('')).toBe(0)
    expect(countWords('a_b c-d')).toBe(3)
  })
})
