import { describe, expect, it } from 'vitest'
import type { FileNode } from '../../types'
import { MemoryDocStore, type DocCommit } from '../docStore'
import { buildTree, treeToDocs, type LocalDoc } from '../records'
import { Workspace, reconcileBoot, sameDoc, type WorkspaceHost } from '../workspace'

const file = (id: string, name: string, content: string | undefined, parentId = 'root'): FileNode => ({ id, name, type: 'file', content, parentId })
const treeOf = (...children: FileNode[]): FileNode[] => [{ id: 'root', name: 'Docs', type: 'folder', children }]

function setup(initial: FileNode[] = treeOf(), store = new MemoryDocStore()) {
  const state = { files: initial, applied: [] as Set<string>[], writes: [] as (string | null)[], clock: 100 }
  const host: WorkspaceHost = {
    files: () => state.files,
    view: () => ({ currentFileId: 'a', expandedFolders: ['root'] }),
    applyRemote: (docs, changed) => {
      state.files = buildTree(docs.values())
      state.applied.push(new Set(changed))
    },
    onWrite: (failure) => state.writes.push(failure),
    now: () => ++state.clock
  }
  const ws = new Workspace(store, host, [], [], 0)
  return { ws, store, state }
}

describe('capture', () => {
  it('writes only what changed and marks each node in the outbox in the same commit', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A'), file('b', 'b.md', 'B')))
    expect(ws.capture()).toBe(true)
    await ws.drain()
    expect([...store.docs.keys()].sort()).toEqual(['a', 'b', 'root'])
    expect([...store.outbox.keys()].sort()).toEqual(['a', 'b', 'root'])
    expect(store.commits[0].meta).toEqual({ seq: 1 })

    expect(ws.capture()).toBe(false)
    state.files = treeOf(file('a', 'a.md', 'A!'), file('b', 'b.md', 'B'))
    expect(ws.capture()).toBe(true)
    await ws.drain()
    expect(store.commits[1].docs?.put?.map((d) => d.id)).toEqual(['a'])
    expect(store.commits[1].outbox?.put).toEqual([{ id: 'a', version: 2 }])
  })

  it('marks a deleted node too, and keeps a pending conflict across edits', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A'), file('b', 'b.md', 'B')))
    ws.capture()
    await ws.drain()
    await ws.apply({ outbox: { put: [{ id: 'a', version: 1, conflict: { id: 'a', kind: 'file', parentId: 'root', name: 'a.md', hash: 'h', rev: 2, contentRev: 2, metaRev: 1, deleted: false, serverUpdatedAt: 1 } }] } })
    state.files = treeOf(file('a', 'a.md', 'edited'))
    ws.capture()
    await ws.drain()
    expect(store.docs.has('b')).toBe(false)
    expect(store.outbox.get('b')?.version).toBe(2)
    expect(store.outbox.get('a')?.conflict?.rev).toBe(2)
    expect(store.outbox.get('a')?.version).toBe(2)
  })

  it('a node being typed into keeps a rising version, so a push in flight can tell it is stale', async () => {
    const { ws, state } = setup(treeOf(file('a', 'a.md', 'one')))
    ws.capture()
    const first = ws.outboxEntry('a')!.version
    state.files = treeOf(file('a', 'a.md', 'one two'))
    ws.capture()
    expect(ws.outboxEntry('a')!.version).toBe(first + 1)
    await ws.drain()
  })

  it('treats a text that has not been loaded yet as unchanged', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A')))
    ws.capture()
    await ws.drain()
    state.files = treeOf(file('a', 'a.md', undefined))
    expect(ws.capture()).toBe(false)
    expect(store.docs.get('a')?.content).toBe('A')
  })
})

describe('commitRemote', () => {
  const remote = (id: string, content: string): LocalDoc => ({ id, kind: 'file', parentId: 'root', name: `${id}.md`, content, updatedAt: 9 })

  it('applies a remote change the person did not race, and tells the editor', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A')))
    ws.capture()
    const before = ws.docs.get('a')!
    const ok = await ws.commitRemote({ docs: { put: [remote('a', 'from elsewhere')] } }, new Map([['a', before]]))
    expect(ok).toBe(true)
    expect(store.docs.get('a')?.content).toBe('from elsewhere')
    expect(state.applied).toEqual([new Set(['a'])])
    expect(state.files[0].children?.[0].content).toBe('from elsewhere')
  })

  it('refuses it when the person typed into the node after the engine read it (and writes the typing)', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A')))
    ws.capture()
    const read = ws.docs.get('a')!
    state.files = treeOf(file('a', 'a.md', 'typed meanwhile'))
    const ok = await ws.commitRemote({ docs: { put: [remote('a', 'from elsewhere')] } }, new Map([['a', read]]))
    expect(ok).toBe(false)
    await ws.drain()
    expect(store.docs.get('a')?.content).toBe('typed meanwhile')
    expect(state.applied).toEqual([])
  })

  it('applies the outbox changes with the documents, and leaves an entry that was edited since', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A'), file('b', 'b.md', 'B')))
    ws.capture()
    await ws.drain()
    const sentVersion = new Map([['a', ws.outboxEntry('a')!.version], ['b', ws.outboxEntry('b')!.version]])
    state.files = treeOf(file('a', 'a.md', 'A edited after the push'), file('b', 'b.md', 'B'))
    await ws.apply({ outbox: { delete: ['a', 'b'] } }, sentVersion)
    expect(store.outbox.has('a')).toBe(true) // edited since: still to be sent
    expect(store.outbox.has('b')).toBe(false)
  })

  it('does not put a mark (refused, send whole) on an entry that was edited since the version it was made for', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'A'), file('b', 'b.md', 'B')))
    ws.capture()
    await ws.drain()
    const sentVersion = new Map([['a', ws.outboxEntry('a')!.version], ['b', ws.outboxEntry('b')!.version]])
    state.files = treeOf(file('a', 'a.md', 'A edited after the push'), file('b', 'b.md', 'B'))
    await ws.apply(
      { outbox: { put: [{ id: 'a', version: sentVersion.get('a')!, blocked: 'md_bad_clock' }, { id: 'b', version: sentVersion.get('b')!, forceFull: true }] } },
      sentVersion
    )
    expect(store.outbox.get('a')).toEqual({ id: 'a', version: 2 }) // the newer entry is untouched: its text was never judged
    expect(store.outbox.get('b')).toEqual({ id: 'b', version: 1, forceFull: true })
    expect(ws.outboxEntry('a')).toEqual({ id: 'a', version: 2 })
  })

  it('counts every remote write in the sequence number stored with the documents', async () => {
    const { ws, store } = setup(treeOf(file('a', 'a.md', 'A')))
    ws.capture()
    await ws.commitRemote({ docs: { put: [remote('a', 'x')] } }, new Map())
    expect(store.meta.seq).toBe(2)
    expect(ws.seq).toBe(2)
  })
})

describe('a store that refuses', () => {
  it('rewrites from the CURRENT state, never from the refused commit', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'one')))
    ws.capture()
    await ws.drain()
    store.failWith = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    state.files = treeOf(file('a', 'a.md', 'two'))
    ws.capture()
    await ws.drain()
    expect(state.writes[state.writes.length - 1]).toBe('quota')
    expect(ws.dirty).toBe(true)

    // The person goes on typing; the store comes back; what is written is the latest text, once.
    state.files = treeOf(file('a', 'a.md', 'three'))
    store.failWith = null
    await ws.flush()
    expect(store.docs.get('a')?.content).toBe('three')
    expect(ws.dirty).toBe(false)
    expect(state.writes[state.writes.length - 1]).toBeNull()
  })

  it('also rewrites a node that was deleted while the store refused', async () => {
    const { ws, store, state } = setup(treeOf(file('a', 'a.md', 'one'), file('b', 'b.md', 'two')))
    ws.capture()
    await ws.drain()
    store.failWith = new Error('no')
    state.files = treeOf(file('a', 'a.md', 'one'))
    ws.capture()
    await ws.drain()
    store.failWith = null
    await ws.flush()
    expect(store.docs.has('b')).toBe(false)
    expect(store.outbox.get('b')?.version).toBe(2)
  })
})

describe('a store that answers at once (the localStorage fallback)', () => {
  it('reports the failure in the same tick through onWrite', () => {
    class SyncMemoryStore extends MemoryDocStore {
      commitSync(change: DocCommit): 'quota' | null {
        this.commits.push(change)
        return this.failWith ? 'quota' : null
      }
    }
    const store = new SyncMemoryStore()
    const { ws, state } = setup(treeOf(file('a', 'a.md', 'one')), store)
    store.failWith = new Error('x')
    ws.capture()
    expect(state.writes).toEqual(['quota'])
    expect(ws.dirty).toBe(true)
    store.failWith = null
    ws.persistNow()
    expect(state.writes).toEqual(['quota', null])
    expect(ws.dirty).toBe(false)
  })
})

describe('sameDoc', () => {
  it('compares what the person sees, not the stamp', () => {
    const a: LocalDoc = { id: 'a', kind: 'file', parentId: 'root', name: 'a.md', content: 'x', updatedAt: 1 }
    expect(sameDoc(a, { ...a, updatedAt: 9 })).toBe(true)
    expect(sameDoc(a, { ...a, content: 'y' })).toBe(false)
    expect(sameDoc(a, { ...a, parentId: null })).toBe(false)
    expect(sameDoc(null, undefined)).toBe(true)
    expect(sameDoc(a, null)).toBe(false)
  })
})

describe('reconcileBoot (IndexedDB against the boot snapshot)', () => {
  const stored = treeToDocs(treeOf(file('a', 'a.md', 'stored A'), file('b', 'b.md', 'stored B')), 1)
  const snapshot = (seq: number, files: FileNode[], current: { id: string; content: string | null } | null = null) => ({ files, seq, current })

  it('trusts IndexedDB when it is as new as the snapshot or newer', () => {
    expect(reconcileBoot(stored, 5, snapshot(5, treeOf(file('a', 'a.md', undefined))), 9)).toEqual({ docs: stored, rewrite: false })
    expect(reconcileBoot(stored, 6, snapshot(5, treeOf()), 9).rewrite).toBe(false)
    expect(reconcileBoot(stored, 5, null, 9).rewrite).toBe(false)
  })

  it('takes the snapshot\'s tree and the open document\'s text when IndexedDB lost its last writes', () => {
    const result = reconcileBoot(
      stored,
      3,
      snapshot(4, treeOf(file('a', 'renamed.md', undefined), file('new', 'new.md', undefined)), { id: 'a', content: 'typed just before closing' }),
      9
    )
    expect(result.rewrite).toBe(true)
    const byId = new Map(result.docs.map((d) => [d.id, d]))
    expect(byId.get('a')).toMatchObject({ name: 'renamed.md', content: 'typed just before closing' })
    expect(byId.get('new')).toMatchObject({ content: '' })
    expect(byId.has('b')).toBe(false) // deleted in the newer snapshot
    expect(byId.get('root')?.kind).toBe('folder')
  })

  it('keeps the stored text of a document the snapshot has no text for', () => {
    const result = reconcileBoot(stored, 1, snapshot(2, treeOf(file('a', 'a.md', undefined), file('b', 'b.md', undefined)), { id: 'a', content: null }), 9)
    expect(result.docs.find((d) => d.id === 'b')?.content).toBe('stored B')
    expect(result.docs.find((d) => d.id === 'a')?.content).toBe('stored A')
  })
})
