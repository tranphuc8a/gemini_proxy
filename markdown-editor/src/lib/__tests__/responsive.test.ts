import { describe, expect, it } from 'vitest'
import { isSinglePane, resolveHeaderTier, resolveLayout, resolvePhonePane, showsInline } from '../responsive'

describe('resolveLayout', () => {
  it('reads phone first, then the compact width, else desktop', () => {
    expect(resolveLayout(true, true)).toBe('phone')
    expect(resolveLayout(false, true)).toBe('tablet')
    expect(resolveLayout(false, false)).toBe('desktop')
  })

  it('falls back to desktop when no query matches (no matchMedia)', () => {
    expect(resolveLayout(false, false)).toBe('desktop')
    expect(resolveHeaderTier(false, false)).toBe('full')
  })
})

describe('header tiers', () => {
  it('orders compact < medium < full', () => {
    expect(resolveHeaderTier(true, true)).toBe('compact')
    expect(resolveHeaderTier(false, true)).toBe('medium')
  })

  it('keeps a control inline from its own tier upwards', () => {
    expect(showsInline('full', 'full')).toBe(true)
    expect(showsInline('medium', 'full')).toBe(false)
    expect(showsInline('compact', 'compact')).toBe(true)
    expect(showsInline('full', 'compact')).toBe(true)
    expect(showsInline('compact', 'medium')).toBe(false)
  })
})

describe('the phone split view', () => {
  it('collapses to one pane only on a phone in the split view', () => {
    expect(isSinglePane('phone', 'split')).toBe(true)
    expect(isSinglePane('phone', 'editor')).toBe(false)
    expect(isSinglePane('tablet', 'split')).toBe(false)
    expect(isSinglePane('desktop', 'split')).toBe(false)
  })

  it('opens visitors on the preview and admins on the editor until they choose', () => {
    expect(resolvePhonePane(null, false)).toBe('preview')
    expect(resolvePhonePane(null, true)).toBe('editor')
    expect(resolvePhonePane('editor', false)).toBe('editor')
    expect(resolvePhonePane('preview', true)).toBe('preview')
  })
})
