import { describe, expect, it } from 'vitest'
import { fuzzyScore, rankBySearch } from '../fuzzy'

describe('fuzzyScore', () => {
  it('scores a substring above a scattered match', () => {
    expect(fuzzyScore('Toggle sidebar', 'sidebar')).toBeGreaterThan(fuzzyScore('Toggle sidebar', 'tsb'))
  })

  it('matches initials across words', () => {
    expect(fuzzyScore('Toggle sidebar', 'tsb')).toBeGreaterThan(0)
  })

  it('rejects characters that appear out of order', () => {
    expect(fuzzyScore('Toggle sidebar', 'rabedis')).toBe(0)
  })

  it('is case insensitive', () => {
    expect(fuzzyScore('Toggle Sidebar', 'SIDEBAR')).toBeGreaterThan(0)
  })

  it('prefers an earlier substring hit', () => {
    expect(fuzzyScore('save now', 'save')).toBeGreaterThan(fuzzyScore('quick save', 'save'))
  })

  it('rewards consecutive characters', () => {
    expect(fuzzyScore('abcxyz', 'abc')).toBeGreaterThan(fuzzyScore('axbxcx', 'abc'))
  })

  it('treats an empty query as a trivial match', () => {
    expect(fuzzyScore('anything', '')).toBeGreaterThan(0)
  })
})

describe('rankBySearch', () => {
  const items = [
    { label: 'Toggle sidebar' },
    { label: 'Toggle dark mode' },
    { label: 'Save now' },
    { label: 'notes.md', hint: 'Docs / Drafts' }
  ]

  it('returns everything for an empty query', () => {
    expect(rankBySearch(items, '  ')).toBe(items)
  })

  it('drops non-matches', () => {
    expect(rankBySearch(items, 'toggle').map((i) => i.label)).toEqual(['Toggle sidebar', 'Toggle dark mode'])
  })

  it('searches the hint as well as the label', () => {
    expect(rankBySearch(items, 'drafts').map((i) => i.label)).toEqual(['notes.md'])
  })

  it('puts the strongest match first', () => {
    expect(rankBySearch(items, 'dark')[0].label).toBe('Toggle dark mode')
  })

  it('keeps the original order among equally scored items', () => {
    const equal = [{ label: 'alpha one' }, { label: 'alpha two' }]
    expect(rankBySearch(equal, 'alpha').map((i) => i.label)).toEqual(['alpha one', 'alpha two'])
  })
})
