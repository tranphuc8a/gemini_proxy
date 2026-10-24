import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import { SyncError } from '../services/markdownSync'
import { recheckAdminSession } from '../services/markdownStorage'
import { WELCOME } from '../lib/welcome'
import { findNode } from '../lib/tree'
import { FakeServer } from '../sync/__tests__/fakeServer'

/**
 * The editor store wired to the sync engine over HTTP: Backend sync switched on, a (fake) server answering `fetch`, the
 * open document changed from another device, the viewer, switching storage. The engine's rules themselves are tested in
 * src/sync/__tests__/engine.test.ts; this is the glue (store ⇄ workspace ⇄ engine ⇄ client).
 */
vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => []),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  adminSessionHeaders: vi.fn(() => ({ 'X-Admin-Session': 'tok' }))
}))

const store = () => useEditorStore.getState()

/** A `fetch` that answers from a FakeServer (the three routes the client uses). */
function serve(server: FakeServer, seen: { url: string; headers: Record<string, string> }[] = []) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    seen.push({ url: url.pathname + url.search, headers: (init?.headers ?? {}) as Record<string, string> })
    try {
      if (url.pathname === '/markdown/sync/changes') {
        const page = await server.changes({ since: Number(url.searchParams.get('since')), limit: Number(url.searchParams.get('limit')) || undefined, device: url.searchParams.get('device') ?? '' })
        return new Response(JSON.stringify(page), { status: 200 })
      }
      if (url.pathname === '/markdown/sync/push') {
        const body = JSON.parse(String(init?.body))
        return new Response(JSON.stringify(await server.push(body)), { status: 200 })
      }
      if (url.pathname.startsWith('/markdown/docs/')) {
        return new Response(JSON.stringify(await server.getDoc(decodeURIComponent(url.pathname.slice('/markdown/docs/'.length)))), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    } catch (error) {
      if (error instanceof SyncError) {
        return new Response(JSON.stringify({ message: error.message, data: { code: error.code } }), { status: error.status || 503 })
      }
      throw new TypeError('network down')
    }
  })
}

function reset() {
  localStorage.clear()
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
    backendStorage: false,
    backendStorageType: 'json'
  })
}

let server: FakeServer
let seen: { url: string; headers: Record<string, string> }[]

beforeEach(() => {
  reset()
  server = new FakeServer()
  server.clock = Date.now() // the device clock is the real one: the server refuses a device a day ahead of it
  seen = []
  vi.stubGlobal('fetch', serve(server, seen))
  // Hydrates the way the app does at start-up (jsdom has no IndexedDB: the localStorage fallback).
  act(() => {
    void store().hydrate()
  })
})

afterEach(() => {
  act(() => store().stopSync())
  vi.unstubAllGlobals()
  vi.mocked(recheckAdminSession).mockReset()
  vi.mocked(recheckAdminSession).mockResolvedValue('valid')
})

async function syncUntilIdle() {
  await vi.waitFor(() => expect(store().sync.phase).toBe('idle'), { timeout: 5000 })
  await vi.waitFor(() => expect(store().sync.lastSync).not.toBeNull(), { timeout: 5000 })
}

function create(name: string, text: string) {
  const id = store().createFile('root', name)!
  act(() => store().setContent(text))
  act(() => store().flushPersist())
  return id
}

describe('switching Backend sync on', () => {
  it('meets the server: sends this device\'s documents (not the stock welcome page), brings the server\'s', async () => {
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'there', kind: 'file', name: 'there.md', parentId: 'root', content: 'written on the server' })
    const id = create('mine.md', 'written here')

    act(() => store().toggleBackendStorage())
    await syncUntilIdle()

    expect(server.text(id)).toBe('written here')
    expect(server.records.has('welcome')).toBe(false)
    expect(findNode(store().files, 'there')?.content).toBe('written on the server')
    expect(store().sync.pending).toBe(0)
    expect(seen.every((call) => call.headers['X-Admin-Session'] === 'tok')).toBe(true)
    expect(seen.some((call) => call.url.includes('backend=json'))).toBe(true)
    // One device id for the whole session, in the form the server accepts.
    const device = new URL(seen[0].url, 'http://localhost').searchParams.get('device')
    expect(device).toMatch(/^md-[a-z0-9]{10}$/)
    expect(localStorage.getItem('markdown-editor:device')).toBe(device)
  })

  it('the person\'s later edits go up on "Sync now", as a patch of what changed', async () => {
    const id = create('notes.md', Array.from({ length: 300 }, (_, i) => `line ${i} ${'padding '.repeat(8)}`).join('\n'))
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    server.pushes.length = 0

    const text = store().currentContent.replace('line 150 ', 'line 150 EDITED ')
    act(() => store().setContent(text))
    await act(async () => {
      await store().syncNow()
    })
    expect(server.text(id)).toBe(text)
    expect(server.pushes).toHaveLength(1)
    expect(server.pushes[0].ops[0].patch).toBeDefined()
    expect(server.pushes[0].bytes).toBeLessThan(1500)
  })

  it('switching it off stops the engine', async () => {
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    act(() => store().toggleBackendStorage())
    expect(store().sync.phase).toBe('off')
    const calls = seen.length
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(seen.length).toBe(calls)
  })

  it('a viewer receives and sends nothing of its own', async () => {
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'there', kind: 'file', name: 'there.md', parentId: 'root', content: 'public text' })
    useEditorStore.setState({ isAdmin: false })
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    expect(store().sync.readOnly).toBe(true)
    expect(findNode(store().files, 'there')?.content).toBe('public text')
    expect(server.pushes).toEqual([])
  })

  it('a private server asks a guest to unlock admin mode, and syncs once it is unlocked', async () => {
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    const original = server.changes.bind(server)
    server.changes = async () => {
      throw new SyncError("This server's documents are private.", { status: 403, code: 'markdown_private' })
    }
    useEditorStore.setState({ isAdmin: false })
    act(() => store().toggleBackendStorage())
    await vi.waitFor(() => expect(store().sync.phase).toBe('private'))
    expect(store().sync.error).toMatch(/private/)

    server.changes = original
    useEditorStore.setState({ isAdmin: true })
    act(() => {
      void store().syncNow()
    })
    await syncUntilIdle()
  })
})

describe('what other devices do to the open document', () => {
  async function openSynced(text = 'one\ntwo\nthree') {
    const id = create('doc.md', text)
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    return id
  }

  it('shows a change made elsewhere, resets the undo stack to it, and says so', async () => {
    const id = await openSynced()
    const record = server.records.get(id)!
    server.records.set(id, { ...record, content: 'one\nTWO\nthree', hash: (await import('../lib/hash')).sha256HexSync('one\nTWO\nthree'), rev: record.rev + 1, contentRev: record.rev + 1, serverUpdatedAt: server.clock + 5, device: 'md-other' })
    server.clock += 10
    await act(async () => {
      await store().syncNow()
    })
    expect(store().currentContent).toBe('one\nTWO\nthree')
    expect(store().history).toEqual(['one\nTWO\nthree'])
    expect(store().toasts.map((toast) => toast.message)).toContain('Updated from another device')
  })

  it('merges a change made elsewhere into what was typed here, without a prompt', async () => {
    const id = await openSynced('one\ntwo\nthree\nfour\nfive\nsix\nseven')
    const record = server.records.get(id)!
    const theirs = 'one\ntwo\nthree\nfour\nfive\nsix\nSEVEN'
    server.records.set(id, { ...record, content: theirs, hash: (await import('../lib/hash')).sha256HexSync(theirs), rev: record.rev + 1, contentRev: record.rev + 1, serverUpdatedAt: server.clock + 5, device: 'md-other' })
    server.clock += 10
    act(() => store().setContent('ONE\ntwo\nthree\nfour\nfive\nsix\nseven'))
    await act(async () => {
      await store().syncNow()
    })
    expect(store().currentContent).toBe('ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
    expect(store().sync.conflicts).toEqual([])
    await act(async () => {
      await store().syncNow()
    })
    expect(server.text(id)).toBe('ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
  })

  it('clears the editor when another device deleted the open document', async () => {
    const id = await openSynced()
    const record = server.records.get(id)!
    server.records.set(id, { ...record, deleted: true, content: null, hash: '', rev: record.rev + 1, contentRev: record.rev + 1, serverUpdatedAt: server.clock + 5, device: 'md-other' })
    server.clock += 10
    await act(async () => {
      await store().syncNow()
    })
    expect(store().currentFileId).toBeNull()
    expect(store().currentContent).toBe('')
    expect(findNode(store().files, id)).toBeNull()
    expect(store().toasts.map((toast) => toast.message)).toContain('The open document was deleted on another device')
  })

  it('a clash on the same lines waits in the store for the person, who answers it from the panel\'s actions', async () => {
    const id = await openSynced('one\ntwo\nthree')
    const record = server.records.get(id)!
    server.records.set(id, { ...record, content: 'one\nTWO elsewhere\nthree', hash: (await import('../lib/hash')).sha256HexSync('one\nTWO elsewhere\nthree'), rev: record.rev + 1, contentRev: record.rev + 1, serverUpdatedAt: server.clock + 5, device: 'md-other' })
    server.clock += 10
    act(() => store().setContent('one\nTWO here\nthree'))
    await act(async () => {
      await store().syncNow()
    })
    expect(store().sync.conflicts).toEqual([{ id, name: 'doc.md' }])
    expect(store().currentContent).toBe('one\nTWO here\nthree')

    await act(async () => {
      await store().resolveConflict(id, 'server')
    })
    expect(store().currentContent).toBe('one\nTWO elsewhere\nthree')
    await vi.waitFor(() => expect(store().sync.conflicts).toEqual([]))
  })
})

describe('storage and the session', () => {
  it('a different storage backend starts from a first meeting of its own', async () => {
    create('doc.md', 'text')
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    server.pulls.length = 0
    act(() => store().setBackendStorageType('mysql'))
    await vi.waitFor(() => expect(seen.some((call) => call.url.includes('backend=mysql'))).toBe(true))
    await syncUntilIdle()
    expect(store().backendStorageType).toBe('mysql')
    expect(server.pulls[0]?.since).toBe(0) // a full pull: the cursor of the other storage was not reused
  })

  it('re-checks the admin session when the server refuses the credentials, and drops to view-only if it is spent', async () => {
    vi.mocked(recheckAdminSession).mockResolvedValue('rejected')
    create('doc.md', 'text')
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    server.failNext = new SyncError('Admin access is needed.', { status: 403, code: 'markdown_admin_required' })
    act(() => store().setContent('text, edited'))
    await act(async () => {
      await store().syncNow()
    })
    await vi.waitFor(() => expect(store().isAdmin).toBe(false))
    expect(store().toasts.map((toast) => toast.message)).toContain('Admin session expired — switched to view-only mode')
  })

  it('"Replace this device\'s copy" shows the server\'s documents, after the person agrees', async () => {
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'there', kind: 'file', name: 'there.md', parentId: 'root', content: 'server text' })
    create('mine.md', 'unsent')
    act(() => store().toggleBackendStorage())
    await syncUntilIdle()
    act(() => store().setContent('unsent edit after the sync'))
    act(() => store().flushPersist())

    const declined = await store().replaceFromServer(() => false)
    expect(declined).toBe(false)
    expect(store().currentContent).toBe('unsent edit after the sync')

    const confirm = vi.fn(() => true)
    await act(async () => {
      expect(await store().replaceFromServer(confirm)).toBe(true)
    })
    // Two documents on the server (the one sent earlier and the one made there); one change waits here.
    expect(confirm).toHaveBeenCalledWith({ documents: 2, unsent: 1 })
    expect(findNode(store().files, 'there')?.content).toBe('server text')
    expect(store().currentContent).toBe('unsent') // the text the server holds: the edit made after the sync is gone
  })

  it('refuses "Replace" while Backend sync is off', async () => {
    await expect(store().replaceFromServer()).rejects.toThrow(/Backend sync/)
  })
})
