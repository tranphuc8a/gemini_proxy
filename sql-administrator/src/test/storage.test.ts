import { beforeEach, describe, expect, it, vi } from 'vitest'

import { pushHistory, storage } from '../lib/storage'
import type { QueryHistoryEntry } from '../types'

function entry(overrides: Partial<QueryHistoryEntry> = {}): QueryHistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    sql: 'SELECT 1',
    database: 'shop',
    ranAt: '2026-09-12T00:00:00.000Z',
    ok: true,
    durationMs: 5,
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('token', () => {
  it('round-trips and clears', () => {
    storage.setToken('tok-123')
    expect(storage.getToken()).toBe('tok-123')
    storage.clearToken()
    expect(storage.getToken()).toBeNull()
  })

  it('returns null before anything is stored', () => {
    expect(storage.getToken()).toBeNull()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(storage.getToken()).toBeNull()
  })

  it('does not throw when writing is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => storage.setToken('tok')).not.toThrow()
  })
})

describe('profile', () => {
  it('remembers the connection form without the password', () => {
    storage.setProfile({ host: 'db', port: 3307, username: 'app', database: 'shop' })
    expect(storage.getProfile()).toEqual({ host: 'db', port: 3307, username: 'app', database: 'shop' })
    expect(window.localStorage.getItem('sqladmin.lastProfile')).not.toContain('password')
  })

  it('returns null for corrupt JSON', () => {
    window.localStorage.setItem('sqladmin.lastProfile', '{not json')
    expect(storage.getProfile()).toBeNull()
  })
})

describe('history', () => {
  it('round-trips entries', () => {
    const entries = [entry({ sql: 'SELECT 1' })]
    storage.setHistory(entries)
    expect(storage.getHistory()).toHaveLength(1)
  })

  it('starts empty', () => {
    expect(storage.getHistory()).toEqual([])
  })

  it('caps what it writes at 50 entries', () => {
    storage.setHistory(Array.from({ length: 80 }, (_, index) => entry({ sql: `SELECT ${index}` })))
    expect(storage.getHistory()).toHaveLength(50)
  })

  it('clears', () => {
    storage.setHistory([entry()])
    storage.clearHistory()
    expect(storage.getHistory()).toEqual([])
  })
})

describe('pushHistory', () => {
  it('puts the newest entry first', () => {
    const result = pushHistory([entry({ sql: 'SELECT 1' })], entry({ sql: 'SELECT 2' }))
    expect(result[0].sql).toBe('SELECT 2')
    expect(result).toHaveLength(2)
  })

  it('moves a repeated statement up instead of duplicating it', () => {
    const existing = [entry({ sql: 'SELECT 1' }), entry({ sql: 'SELECT 2' })]
    const result = pushHistory(existing, entry({ sql: 'SELECT 2' }))
    expect(result.map((item) => item.sql)).toEqual(['SELECT 2', 'SELECT 1'])
  })

  it('caps the list at 50', () => {
    const existing = Array.from({ length: 50 }, (_, index) => entry({ sql: `SELECT ${index}` }))
    expect(pushHistory(existing, entry({ sql: 'SELECT new' }))).toHaveLength(50)
  })
})

describe('theme', () => {
  it('round-trips a valid theme', () => {
    storage.setTheme('light')
    expect(storage.getTheme()).toBe('light')
  })

  it('ignores a value that is not a theme', () => {
    window.localStorage.setItem('sqladmin.theme', 'rainbow')
    expect(storage.getTheme()).toBeNull()
  })
})
