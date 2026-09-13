import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadText, pushHistory, storage, stripPassword } from '../lib/storage'
import type { QueryHistoryEntry } from '../types'

function entry(text: string, namespace = 'shop.orders'): QueryHistoryEntry {
  return { id: `${text}-${namespace}`, text, kind: 'find', namespace, at: '2026-09-13T00:00:00Z' }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('token', () => {
  it('round-trips', () => {
    expect(storage.getToken()).toBeNull()
    storage.setToken('tok-1')
    expect(storage.getToken()).toBe('tok-1')
    storage.clearToken()
    expect(storage.getToken()).toBeNull()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => storage.setToken('tok-1')).not.toThrow()
    expect(storage.getToken()).toBeNull()
  })
})

describe('profile', () => {
  const profile = {
    mode: 'fields' as const,
    host: 'db.local',
    port: 27017,
    username: 'root',
    database: 'shop',
    authSource: 'admin',
    tls: false,
    srv: false,
    uri: '',
  }

  it('round-trips', () => {
    storage.setProfile(profile)
    expect(storage.getProfile()).toEqual(profile)
  })

  it('never stores a password', () => {
    storage.setProfile({ ...profile, mode: 'uri', uri: 'mongodb://root:s3cr3t@db.local:27017/' })
    const stored = storage.getProfile()
    expect(stored?.uri).toBe('mongodb://root@db.local:27017/')
    expect(JSON.stringify(stored)).not.toContain('s3cr3t')
  })

  it('returns null when nothing is stored', () => {
    expect(storage.getProfile()).toBeNull()
  })

  it('returns null for a corrupt value', () => {
    window.localStorage.setItem('mongoadmin.lastProfile', '{not json')
    expect(storage.getProfile()).toBeNull()
  })
})

describe('stripPassword', () => {
  it('removes the password from a URI', () => {
    expect(stripPassword('mongodb://u:p@h:27017/')).toBe('mongodb://u@h:27017/')
  })

  it('leaves an anonymous URI alone', () => {
    expect(stripPassword('mongodb://h:27017/')).toBe('mongodb://h:27017/')
  })

  it('handles an encoded at-sign inside the password', () => {
    expect(stripPassword('mongodb://u:a%40b@h:27017/')).toBe('mongodb://u@h:27017/')
  })

  it('tolerates junk', () => {
    expect(stripPassword('')).toBe('')
    expect(stripPassword('not a uri')).toBe('not a uri')
  })
})

describe('theme', () => {
  it('round-trips a valid theme', () => {
    storage.setTheme('light')
    expect(storage.getTheme()).toBe('light')
  })

  it('ignores an unknown value', () => {
    window.localStorage.setItem('mongoadmin.theme', 'neon')
    expect(storage.getTheme()).toBeNull()
  })
})

describe('history', () => {
  it('round-trips', () => {
    storage.setHistory([entry('{a: 1}')])
    expect(storage.getHistory()).toHaveLength(1)
    storage.clearHistory()
    expect(storage.getHistory()).toEqual([])
  })

  it('pushes newest first', () => {
    const list = pushHistory([entry('{a: 1}')], entry('{b: 2}'))
    expect(list.map((item) => item.text)).toEqual(['{b: 2}', '{a: 1}'])
  })

  it('moves a repeat to the top instead of duplicating it', () => {
    const list = pushHistory([entry('{a: 1}'), entry('{b: 2}')], entry('{b: 2}'))
    expect(list.map((item) => item.text)).toEqual(['{b: 2}', '{a: 1}'])
    expect(list).toHaveLength(2)
  })

  it('keeps the same text under a different namespace', () => {
    const list = pushHistory([entry('{a: 1}', 'shop.orders')], entry('{a: 1}', 'shop.users'))
    expect(list).toHaveLength(2)
  })

  it('caps the list', () => {
    const many = Array.from({ length: 60 }, (_, index) => entry(`{n: ${index}}`))
    expect(pushHistory(many, entry('{n: new}'))).toHaveLength(50)
  })
})

describe('downloadText', () => {
  it('clicks an anchor and revokes the object URL', () => {
    const click = vi.fn()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)

    downloadText('{}', 'shop.orders.json', 'application/json')

    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:mock')
    expect(document.querySelector('a')).toBeNull() // the anchor is cleaned up
  })
})
