import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILES_KEY, loadFiles } from '../../lib/persistence'
import { FALLBACK_SHADOW_TEXT_MAX, LocalStorageDocStore, MemoryDocStore, SYNC_KEY, failureOf, openIdbDocStore, type DocStore } from '../docStore'
import type { LocalDoc, OutboxEntry, Shadow } from '../records'

const doc = (id: string, content = 'text', name = `${id}.md`, parentId: string | null = 'root'): LocalDoc => ({ id, kind: 'file', parentId, name, content, updatedAt: 1 })
const root: LocalDoc = { id: 'root', kind: 'folder', parentId: null, name: 'Docs', content: null, updatedAt: 1 }
const shadow = (id: string, content: string | null = 'text', rev = 1): Shadow => ({
  id, kind: 'file', parentId: 'root', name: `${id}.md`, content, hash: 'h'.repeat(64), rev, contentRev: rev, metaRev: rev, deleted: false
})
const entry = (id: string, version = 1): OutboxEntry => ({ id, version })

beforeEach(() => localStorage.clear())

/** The contract every store keeps; IndexedDB is checked in a real browser (scripts/kiem-dong-bo.py, kiem-pwa.py). */
function contract(name: string, make: () => DocStore) {
  describe(`${name}: the DocStore contract`, () => {
    it('starts empty', async () => {
      const store = make()
      expect(await store.load()).toEqual({ docs: [], outbox: [], meta: {} })
      expect([...(await store.getShadows(null)).keys()]).toEqual([])
    })

    it('puts, replaces and deletes documents, outbox entries and shadows in one commit', async () => {
      const store = make()
      await store.commit({ docs: { put: [root, doc('a'), doc('b')] }, outbox: { put: [entry('a'), entry('b')] }, shadows: { put: [shadow('a')] }, meta: { seq: 3, 'cursor:json': 77 } })
      await store.commit({ docs: { put: [doc('a', 'changed')], delete: ['b'] }, outbox: { delete: ['b'] }, shadows: { put: [shadow('a', 'changed', 2)] } })
      const loaded = await store.load()
      expect(loaded.docs.map((d) => [d.id, d.content]).sort()).toEqual([['a', 'changed'], ['root', null]])
      expect(loaded.outbox.map((e) => e.id)).toEqual(['a'])
      expect(loaded.meta).toMatchObject({ seq: 3, 'cursor:json': 77 })
      expect((await store.getShadows(['a', 'zzz'])).get('a')?.rev).toBe(2)
      expect((await store.getShadows(['zzz'])).size).toBe(0)
    })

    it('reads one meta key, and a null deletes it', async () => {
      const store = make()
      await store.commit({ meta: { a: 1, b: { x: 2 } } })
      expect(await store.getMeta('a')).toBe(1)
      expect(await store.getMeta('b')).toEqual({ x: 2 })
      await store.commit({ meta: { a: null } })
      expect(await store.getMeta('a')).toBeUndefined()
    })

    it('wipes the sync bookkeeping (shadows, outbox, cursors) and nothing else', async () => {
      const store = make()
      await store.commit({
        docs: { put: [root, doc('a')] },
        shadows: { put: [shadow('a')] },
        outbox: { put: [entry('a')] },
        meta: { seq: 4, 'cursor:json': 1, 'reconciled:json': { at: 1 }, deviceNote: 'keep' }
      })
      await store.wipeSync()
      const loaded = await store.load()
      expect(loaded.docs).toHaveLength(2)
      expect(loaded.outbox).toEqual([])
      expect((await store.getShadows(null)).size).toBe(0)
      expect(loaded.meta).toMatchObject({ seq: 4, deviceNote: 'keep' })
      expect(loaded.meta['cursor:json']).toBeUndefined()
      expect(loaded.meta['reconciled:json']).toBeUndefined()
    })
  })
}

contract('MemoryDocStore', () => new MemoryDocStore())
contract('LocalStorageDocStore', () => new LocalStorageDocStore(null))

describe('MemoryDocStore failures', () => {
  it('refuses writes while told to', async () => {
    const store = new MemoryDocStore()
    store.failWith = new Error('no')
    await expect(store.commit({ docs: { put: [root] } })).rejects.toThrow('no')
    store.failWith = null
    await store.commit({ docs: { put: [root] } })
    expect((await store.load()).docs).toHaveLength(1)
  })
})

describe('LocalStorageDocStore: the fallback keeps the editor\'s v2 key', () => {
  it('writes the documents as the v2 payload the editor always used (and reads them back)', async () => {
    const store = new LocalStorageDocStore(null)
    store.commitSync({ docs: { put: [root, doc('a', 'A'), doc('f', '', 'F', 'root')] }, view: { currentFileId: 'a', expandedFolders: ['root'] } })
    const payload = JSON.parse(localStorage.getItem(FILES_KEY)!)
    expect(payload.version).toBe(2)
    expect(payload.currentFileId).toBe('a')
    expect(payload.files[0].children.map((n: { id: string }) => n.id).sort()).toEqual(['a', 'f'])

    const again = new LocalStorageDocStore(loadFiles())
    expect((await again.load()).docs.map((d) => d.id).sort()).toEqual(['a', 'f', 'root'])
  })

  it('keeps sync bookkeeping in its own key and shadows of big texts without the text', async () => {
    const store = new LocalStorageDocStore(null)
    const big = 'x'.repeat(FALLBACK_SHADOW_TEXT_MAX + 1)
    store.commitSync({ shadows: { put: [shadow('small', 'tiny'), shadow('big', big)] }, outbox: { put: [entry('small')] }, meta: { 'cursor:json': 5 } })
    expect(JSON.parse(localStorage.getItem(SYNC_KEY)!).outbox.small.version).toBe(1)
    const fresh = new LocalStorageDocStore(null)
    expect((await fresh.getShadows(['small'])).get('small')?.content).toBe('tiny')
    expect((await fresh.getShadows(['big'])).get('big')?.content).toBeNull() // no text, so no base: a clash goes to the person
    expect(await fresh.getMeta('cursor:json')).toBe(5)
  })

  it('answers a refused write with its reason, in the same tick', () => {
    const store = new LocalStorageDocStore(null)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(store.commitSync({ docs: { put: [root] } })).toBe('quota')
    spy.mockImplementation(() => {
      throw new DOMException('no', 'SecurityError')
    })
    expect(store.commitSync({ docs: { put: [root] } })).toBe('unavailable')
    spy.mockRestore()
    expect(store.commitSync({ docs: { put: [root] } })).toBeNull()
  })

  it('throws from the async commit when localStorage refuses', async () => {
    const store = new LocalStorageDocStore(null)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await expect(store.commit({ docs: { put: [root] } })).rejects.toMatchObject({ name: 'QuotaExceededError' })
    spy.mockRestore()
  })

  it('ignores a partial boot snapshot: there are no texts in it to take for the documents', () => {
    localStorage.setItem(FILES_KEY, JSON.stringify({ version: 3, seq: 4, tree: [{ id: 'root', name: 'Docs', type: 'folder', children: [{ id: 'a', name: 'a.md', type: 'file' }] }], currentFileId: 'a', expandedFolders: [], current: null }))
    const stored = loadFiles()
    expect(stored?.partial).toBe(true)
    return new LocalStorageDocStore(stored).load().then((loaded) => expect(loaded.docs).toEqual([]))
  })
})

describe('failureOf', () => {
  it('tells a full quota from storage that is merely unavailable', () => {
    expect(failureOf(new DOMException('x', 'QuotaExceededError'))).toBe('quota')
    expect(failureOf(new DOMException('x', 'SecurityError'))).toBe('unavailable')
    expect(failureOf(new Error('boom'))).toBe('unavailable')
  })
})

describe('openIdbDocStore', () => {
  it('rejects when the browser has no IndexedDB (jsdom): the editor then uses the fallback', async () => {
    await expect(openIdbDocStore()).rejects.toThrow(/not available/)
  })
})
