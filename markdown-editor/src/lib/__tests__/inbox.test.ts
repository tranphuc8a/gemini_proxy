import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { INBOX_KEY, INBOX_MAX_AGE_MS, consumeImportFlag, takeInbox } from '../inbox'

const NOW = 1_800_000_000_000

function put(value: unknown) {
  localStorage.setItem(INBOX_KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

describe('takeInbox', () => {
  beforeEach(() => localStorage.clear())

  it('hands the document over once and deletes it', () => {
    put({ name: 'so-tay-khoa.md', content: '# Sổ tay\n\n- ý 1', at: NOW - 1000, from: 'Khoá Heuristic' })
    expect(takeInbox(NOW)).toEqual({ name: 'so-tay-khoa.md', content: '# Sổ tay\n\n- ý 1', from: 'Khoá Heuristic' })
    expect(localStorage.getItem(INBOX_KEY)).toBeNull()
    expect(takeInbox(NOW)).toBeNull()
  })

  it.each([
    ['stale', { name: 'a.md', content: 'x', at: NOW - INBOX_MAX_AGE_MS - 1 }],
    ['from the future', { name: 'a.md', content: 'x', at: NOW + 120_000 }],
    ['undated', { name: 'a.md', content: 'x' }],
    ['not text', { name: 'a.md', content: 42, at: NOW }],
    ['not JSON', '{oops'],
    ['not an object', '"just a string"']
  ])('refuses an inbox that is %s, and still clears it', (_label, value) => {
    put(value)
    expect(takeInbox(NOW)).toBeNull()
    expect(localStorage.getItem(INBOX_KEY)).toBeNull()
  })

  it('makes the name a safe markdown file name', () => {
    const named = (name: unknown) => {
      put({ name, content: '', at: NOW })
      return takeInbox(NOW)?.name
    }
    expect(named('Chat: a/b?')).toBe('Chat- a-b-.md')
    expect(named('notes')).toBe('notes.md')
    expect(named('README.markdown')).toBe('README.markdown')
    expect(named('')).toBe('imported.md')
    expect(named(undefined)).toBe('imported.md')
    expect(named('x'.repeat(300))).toBe('x'.repeat(120) + '.md')
  })
})

describe('consumeImportFlag', () => {
  const original = window.location.href
  afterEach(() => window.history.replaceState(null, '', original))

  it('reports the flag and takes it out of the address bar', () => {
    window.history.replaceState(null, '', '/editor/?import=1&theme=dark#top')
    expect(consumeImportFlag()).toBe(true)
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/editor/?theme=dark#top')
    expect(consumeImportFlag()).toBe(false)
  })

  it('ignores any other value', () => {
    window.history.replaceState(null, '', '/editor/?import=yes')
    expect(consumeImportFlag()).toBe(false)
    expect(window.location.search).toBe('?import=yes')
  })
})
