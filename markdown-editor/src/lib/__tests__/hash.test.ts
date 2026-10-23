import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sha256Hex, sha256HexSync } from '../hash'

const node = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

const CASES = ['', 'abc', 'Đồng bộ tài liệu — phiên bản 2', 'x'.repeat(1000), 'ệ'.repeat(70000), 'a\r\nb\n', '😀 emoji', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64)]

describe('sha256Hex', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('the pure-JS digest matches node:crypto (and the backend) on every case', () => {
    for (const text of CASES) expect(sha256HexSync(text)).toBe(node(text))
  })

  it('known vectors', () => {
    expect(sha256HexSync('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256HexSync('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('uses crypto.subtle when present and gives the same answer', async () => {
    for (const text of CASES.slice(0, 4)) expect(await sha256Hex(text)).toBe(node(text))
  })

  it('falls back to pure JS where crypto.subtle is missing (plain http)', async () => {
    vi.stubGlobal('crypto', {})
    expect(await sha256Hex('abc')).toBe(node('abc'))
  })

  it('falls back when subtle refuses the call', async () => {
    vi.stubGlobal('crypto', { subtle: { digest: () => Promise.reject(new Error('nope')) } })
    expect(await sha256Hex('Tiếng Việt')).toBe(node('Tiếng Việt'))
  })
})
