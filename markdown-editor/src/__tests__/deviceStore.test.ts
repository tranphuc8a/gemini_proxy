import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDocStoreOpener, useEditorStore } from '../store'
import { FILES_KEY, SNAPSHOT_TEXT_MAX } from '../lib/persistence'
import { WELCOME } from '../lib/welcome'
import { MemoryDocStore, type DocCommit, type LoadedStore } from '../sync/docStore'
import type { LocalDoc } from '../sync/records'
import { findNode } from '../lib/tree'

/**
 * The editor on a device store that is not localStorage (IndexedDB in a browser, `MemoryDocStore` here; the real thing is
 * exercised by scripts/kiem-dong-bo.py and kiem-pwa.py): start-up from the boot snapshot, the copy out of the v2 key, what
 * happens when the store refuses, and that nothing is edited before the documents have loaded.
 */
vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => []),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  adminSessionHeaders: vi.fn(() => ({}))
}))

const store = () => useEditorStore.getState()

const doc = (id: string, content: string | null, parentId: string | null = 'root', name = `${id}.md`): LocalDoc => ({
  id, kind: content === null ? 'folder' : 'file', parentId, name, content, updatedAt: 1
})
const ROOT = doc('root', null, null, 'Docs')

function initial() {
  useEditorStore.setState({
    files: [{ id: 'root', name: 'My Documents', type: 'folder', children: [{ id: 'welcome', name: 'welcome.md', type: 'file', parentId: 'root', content: WELCOME }] }],
    currentFileId: 'welcome',
    currentContent: WELCOME,
    selectedFolderId: 'root',
    expandedFolders: ['root'],
    history: [WELCOME],
    historyIndex: 0,
    isAdmin: true,
    toasts: [],
    saveState: 'idle',
    lastSavedAt: null,
    storageFailure: null,
    storageFailureScope: null,
    docsReady: true,
    backendStorage: false
  })
}

beforeEach(() => {
  localStorage.clear()
  initial()
})

afterEach(() => {
  setDocStoreOpener(null)
  vi.restoreAllMocks()
})

async function boot(memory: MemoryDocStore) {
  setDocStoreOpener(async () => memory)
  act(() => {
    void store().hydrate()
  })
  await vi.waitFor(() => expect(store().docsReady).toBe(true))
}

const snapshotPayload = () => JSON.parse(localStorage.getItem(FILES_KEY)!)

/** id → text of a v2 payload's tree (the key may be rewritten in another order: the data is what must survive). */
function v2Texts(): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (nodes: { id: string; type: string; content?: string; children?: unknown[] }[]) => {
    for (const node of nodes) {
      if (node.type === 'file') out[node.id] = node.content ?? ''
      walk((node.children ?? []) as typeof nodes)
    }
  }
  walk(snapshotPayload().files)
  return out
}

function seed(memory: MemoryDocStore, docs: LocalDoc[], seq: number) {
  for (const d of docs) memory.docs.set(d.id, d)
  memory.meta.seq = seq
}

function writeSnapshot(seq: number, currentId: string | null, currentContent: string | null) {
  localStorage.setItem(
    FILES_KEY,
    JSON.stringify({
      version: 3,
      seq,
      tree: [{ id: 'root', name: 'Docs', type: 'folder', children: [{ id: 'a', name: 'a.md', type: 'file' }, { id: 'b', name: 'b.md', type: 'file' }] }],
      currentFileId: currentId,
      expandedFolders: ['root'],
      current: currentId ? { id: currentId, content: currentContent } : null
    })
  )
}

describe('a fresh install on a device store', () => {
  it('keeps the welcome tree, writes it to the store, and leaves only a small snapshot in localStorage', async () => {
    const memory = new MemoryDocStore()
    await boot(memory)
    expect(store().files[0].children?.[0].id).toBe('welcome')
    act(() => store().flushPersist())
    await vi.waitFor(() => expect(store().saveState).toBe('saved'))

    expect([...memory.docs.keys()].sort()).toEqual(['root', 'welcome'])
    expect(memory.docs.get('welcome')?.content).toBe(WELCOME)
    const snapshot = snapshotPayload()
    expect(snapshot.version).toBe(3)
    expect(snapshot.files).toBeUndefined() // not the v2 shape: an old build reading it finds no workspace to overwrite
    expect(snapshot.tree[0].children[0]).toEqual({ id: 'welcome', name: 'welcome.md', type: 'file' })
    expect(snapshot.current).toEqual({ id: 'welcome', content: WELCOME })
    expect(snapshot.seq).toBe(memory.meta.seq)
  })

  it('writes only the documents that changed, and the open one is the only text in localStorage', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text'), doc('b', 'B text, not the open one')], 3)
    writeSnapshot(3, 'a', 'A text')
    await boot(memory)
    memory.commits.length = 0

    act(() => store().setContent('A text, edited'))
    act(() => store().flushPersist())
    await vi.waitFor(() => expect(store().saveState).toBe('saved'))
    expect(memory.commits).toHaveLength(1)
    expect(memory.commits[0].docs?.put?.map((d) => d.id)).toEqual(['a'])
    expect(memory.docs.get('b')?.content).toBe('B text, not the open one')
    expect(localStorage.getItem(FILES_KEY)).not.toContain('B text')
    expect(snapshotPayload().current.content).toBe('A text, edited')
    expect(snapshotPayload().seq).toBe(4)
    expect(memory.meta.seq).toBe(4)
  })

  it('does not put a very large open document into the snapshot (it waits for the store)', async () => {
    const memory = new MemoryDocStore()
    const huge = 'x'.repeat(SNAPSHOT_TEXT_MAX + 10)
    seed(memory, [ROOT, doc('a', huge)], 1)
    writeSnapshot(1, 'a', 'x')
    await boot(memory)
    act(() => store().flushPersist())
    await vi.waitFor(() => expect(store().saveState).toBe('saved'))
    expect(snapshotPayload().current.content).toBeNull()
    expect(localStorage.getItem(FILES_KEY)!.length).toBeLessThan(2000)
  })
})

describe('the copy out of the v2 localStorage key', () => {
  const v2 = (files: unknown) => localStorage.setItem(FILES_KEY, JSON.stringify({ version: 2, currentFileId: 'a', expandedFolders: ['root'], files }))
  const tree = [
    { id: 'root', name: 'Docs', type: 'folder', children: [
      { id: 'a', name: 'a.md', type: 'file', parentId: 'root', content: 'A text' },
      { id: 'b', name: 'b.md', type: 'file', parentId: 'root', content: 'B text '.repeat(500) },
      { id: 'f', name: 'F', type: 'folder', parentId: 'root', children: [{ id: 'c', name: 'c.md', type: 'file', parentId: 'f', content: 'é ệ 😀' }] }
    ] }
  ]

  it('shows the stored workspace from the first synchronous frame, then copies, reads back and swaps the key for a snapshot', async () => {
    v2(tree)
    const memory = new MemoryDocStore()
    setDocStoreOpener(async () => memory)
    act(() => {
      void store().hydrate()
    })
    // Before anything has been awaited: the whole v2 tree is on screen, and nothing may be edited yet.
    expect(store().currentContent).toBe('A text')
    expect(store().docsReady).toBe(false)
    act(() => store().setContent('typed too early'))
    expect(store().currentContent).toBe('A text')

    await vi.waitFor(() => expect(store().docsReady).toBe(true))
    expect([...memory.docs.keys()].sort()).toEqual(['a', 'b', 'c', 'f', 'root'])
    expect(memory.docs.get('c')?.content).toBe('é ệ 😀')
    expect(memory.docs.get('b')?.content).toBe('B text '.repeat(500))
    expect(memory.meta.migratedFromLocalStorage).toMatchObject({ count: 5 })
    const snapshot = snapshotPayload()
    expect(snapshot.version).toBe(3)
    expect(localStorage.getItem(FILES_KEY)).not.toContain('B text')
    expect(findNode(store().files, 'c')?.content).toBe('é ệ 😀')
  })

  it('keeps the v2 key and keeps working on it when the copy cannot be read back', async () => {
    v2(tree)
    const memory = new MemoryDocStore()
    const original = memory.load.bind(memory)
    memory.load = async (): Promise<LoadedStore> => {
      const loaded = await original()
      return { ...loaded, docs: loaded.docs.slice(0, 2) } // the store gives back less than was written
    }
    setDocStoreOpener(async () => memory)
    act(() => {
      void store().hydrate()
    })
    await vi.waitFor(() => expect(store().docsReady).toBe(true))
    expect(snapshotPayload().version).toBe(2)
    expect(v2Texts()).toEqual({ a: 'A text', b: 'B text '.repeat(500), c: 'é ệ 😀' })
    expect(store().currentContent).toBe('A text')

    act(() => store().setContent('A text, edited'))
    act(() => store().flushPersist())
    expect(snapshotPayload().version).toBe(2)
    expect(v2Texts()).toEqual({ a: 'A text, edited', b: 'B text '.repeat(500), c: 'é ệ 😀' })
  })

  it('keeps the v2 key when the store refuses the copy', async () => {
    v2(tree)
    const memory = new MemoryDocStore()
    memory.failWith = new DOMException('full', 'QuotaExceededError')
    setDocStoreOpener(async () => memory)
    act(() => {
      void store().hydrate()
    })
    await vi.waitFor(() => expect(store().docsReady).toBe(true))
    expect(snapshotPayload().version).toBe(2)
    expect(v2Texts()).toEqual({ a: 'A text', b: 'B text '.repeat(500), c: 'é ệ 😀' })
    expect(store().currentContent).toBe('A text')
  })
})

describe('start-up from a snapshot and a store', () => {
  it('the first frame is the open document; the other texts arrive with the store', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text'), doc('b', 'B text')], 5)
    writeSnapshot(5, 'a', 'A text')
    setDocStoreOpener(async () => memory)
    act(() => {
      void store().hydrate()
    })
    expect(store().currentContent).toBe('A text')
    expect(findNode(store().files, 'b')?.content).toBeUndefined()
    expect(store().docsReady).toBe(false)

    await vi.waitFor(() => expect(store().docsReady).toBe(true))
    expect(findNode(store().files, 'b')?.content).toBe('B text')
    expect(store().currentContent).toBe('A text')
  })

  it('a file picked before the store answered is opened as soon as it has', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text'), doc('b', 'B text')], 5)
    writeSnapshot(5, 'a', 'A text')
    setDocStoreOpener(async () => memory)
    act(() => {
      void store().hydrate()
    })
    act(() => store().setCurrentFile('b'))
    expect(store().currentFileId).toBe('a')
    await vi.waitFor(() => expect(store().currentFileId).toBe('b'))
    expect(store().currentContent).toBe('B text')
  })

  it('the snapshot wins when it counts more saves than the store: the last writes never reached it', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text'), doc('b', 'B text')], 5)
    writeSnapshot(6, 'a', 'A text typed just before the tab closed')
    await boot(memory)
    expect(store().currentContent).toBe('A text typed just before the tab closed')
    await vi.waitFor(() => expect(memory.docs.get('a')?.content).toBe('A text typed just before the tab closed'))
    expect(memory.docs.get('b')?.content).toBe('B text')
    expect(memory.meta.seq).toBe(6)
  })

  it('refuses edits until the documents are in (the tree is a skeleton, a write now would replace real texts)', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text'), doc('b', 'B text')], 5)
    writeSnapshot(5, 'a', 'A text')
    setDocStoreOpener(async () => memory)
    act(() => {
      void store().hydrate()
    })
    act(() => store().setContent('too early'))
    act(() => store().deleteNode('b'))
    act(() => store().renameNode('b', 'x.md'))
    expect(store().createFile('root', 'new.md')).toBeNull()
    await vi.waitFor(() => expect(store().docsReady).toBe(true))
    expect(findNode(store().files, 'b')?.name).toBe('b.md')
    expect(store().currentContent).toBe('A text')
  })
})

describe('a store that cannot be opened', () => {
  it('without a snapshot the editor falls back to localStorage and goes on', async () => {
    setDocStoreOpener(async () => {
      throw new Error('blocked')
    })
    act(() => {
      void store().hydrate()
    })
    await vi.waitFor(() => expect(store().docsReady).toBe(true))
    act(() => store().setContent('typed'))
    act(() => store().flushPersist())
    expect(snapshotPayload().version).toBe(2)
    expect(JSON.stringify(snapshotPayload().files)).toContain('typed')
  })

  it('with a snapshot (the documents are in the store) it does not write over anything and says why', async () => {
    writeSnapshot(5, 'a', 'A text')
    const before = localStorage.getItem(FILES_KEY)
    setDocStoreOpener(async () => {
      throw new Error('blocked')
    })
    act(() => {
      void store().hydrate()
    })
    await vi.waitFor(() => expect(store().toasts.length).toBeGreaterThan(0))
    expect(store().docsReady).toBe(false)
    expect(store().storageFailure).toBe('unavailable')
    expect(store().toasts[0].message).toMatch(/cannot be opened right now/)
    act(() => store().flushPersist())
    expect(localStorage.getItem(FILES_KEY)).toBe(before)
  })
})

describe('a browser with no IndexedDB at all', () => {
  it('does not write over a snapshot that says the documents are kept in IndexedDB', () => {
    writeSnapshot(5, 'a', 'A text')
    const before = localStorage.getItem(FILES_KEY)
    // No opener installed and jsdom has no indexedDB: exactly a browser whose storage is switched off.
    act(() => {
      void store().hydrate()
    })
    expect(store().docsReady).toBe(false)
    expect(store().storageFailure).toBe('unavailable')
    act(() => store().flushPersist())
    expect(localStorage.getItem(FILES_KEY)).toBe(before)
  })
})

describe('a store that refuses a write', () => {
  it('shows the failure, keeps the edit, and saves it when asked again', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text')], 1)
    writeSnapshot(1, 'a', 'A text')
    await boot(memory)

    memory.failWith = new DOMException('full', 'QuotaExceededError')
    act(() => store().setContent('edit while the store is full'))
    act(() => store().flushPersist())
    await vi.waitFor(() => expect(store().storageFailure).toBe('quota'))
    expect(store().saveState).toBe('error')
    expect(store().storageFailureScope).toBe('documents')

    memory.failWith = null
    act(() => store().flushPersist())
    await vi.waitFor(() => expect(store().saveState).toBe('saved'))
    expect(store().storageFailure).toBeNull()
    expect(memory.docs.get('a')?.content).toBe('edit while the store is full')
  })

  it('a saving indicator is not settled by a commit that finished while the person is still typing', async () => {
    const memory = new MemoryDocStore()
    seed(memory, [ROOT, doc('a', 'A text')], 1)
    writeSnapshot(1, 'a', 'A text')
    await boot(memory)
    act(() => store().setContent('typing'))
    expect(store().saveState).toBe('saving')
    const commits: DocCommit[] = []
    memory.commits = commits
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(store().saveState).toBe('saving')
  })
})
