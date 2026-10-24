import { describe, expect, it, vi } from 'vitest'
import { SyncError } from '../../services/markdownSync'
import { WELCOME } from '../../lib/welcome'
import { sha256HexSync } from '../../lib/hash'
import { MemoryDocStore } from '../docStore'
import { SyncEngine } from '../engine'
import { Device, FakeServer } from './fakeServer'

/** Two devices and a server that follows the real one's rules; every cycle is driven by `sync()`, no timers. */
function pair() {
  const server = new FakeServer()
  const a = new Device(server, { deviceId: 'dev-a' })
  const b = new Device(server, { deviceId: 'dev-b' })
  return { server, a, b }
}

const BIG = Array.from({ length: 400 }, (_, i) => `line ${i}: ${'the quick brown fox jumps over the lazy dog '.repeat(2)}`).join('\n')

/** Both devices know the document `doc` with the same text and have synced it. */
async function withSharedDoc(text = 'one\ntwo\nthree\nfour\nfive\nsix\nseven') {
  const { server, a, b } = pair()
  a.addFile('root', 'doc.md', text, 'doc')
  await a.sync()
  await b.sync()
  return { server, a, b }
}

describe('first sync and the two-device round trip', () => {
  it('a document made on A shows up on B', async () => {
    const { server, a, b } = pair()
    a.addFile('root', 'notes.md', '# Notes\n\nhello', 'notes')
    expect((await a.sync()).phase).toBe('idle')
    expect(server.text('notes')).toBe('# Notes\n\nhello')

    await b.sync()
    expect(b.text('notes')).toBe('# Notes\n\nhello')
    expect(b.name('notes')).toBe('notes.md')
  })

  it('an edit made on A reaches B, and B edits back', async () => {
    const { a, b } = await withSharedDoc()
    a.edit('doc', 'one\nTWO\nthree\nfour\nfive\nsix\nseven')
    await a.sync()
    await b.sync()
    expect(b.text('doc')).toBe('one\nTWO\nthree\nfour\nfive\nsix\nseven')

    b.edit('doc', 'one\nTWO\nthree\nfour\nfive\nsix\nSEVEN')
    await b.sync()
    await a.sync()
    expect(a.text('doc')).toBe('one\nTWO\nthree\nfour\nfive\nsix\nSEVEN')
  })

  it('does not fetch or re-apply what the device just pushed', async () => {
    const { server, a } = await withSharedDoc()
    a.edit('doc', 'edited here')
    await a.sync()
    server.gets.length = 0
    a.remote.length = 0
    await a.sync()
    expect(server.gets).toEqual([])
    expect(a.remote).toEqual([])
    expect(a.text('doc')).toBe('edited here')
  })

  it('renames and moves are one op of metadata, with no text', async () => {
    const { server, a, b } = await withSharedDoc()
    const folder = a.addFolder('root', 'Projects', 'projects')
    await a.sync()
    a.move('doc', folder)
    a.rename('doc', 'renamed.md')
    server.pushes.length = 0
    await a.sync()
    expect(server.pushes).toHaveLength(1)
    expect(server.pushes[0].ops).toHaveLength(1)
    expect(server.pushes[0].ops[0]).toMatchObject({ id: 'doc', set: { name: 'renamed.md', parentId: 'projects' } })
    expect(server.pushes[0].ops[0].content).toBeUndefined()
    expect(server.pushes[0].ops[0].patch).toBeUndefined()

    await b.sync()
    expect(b.name('doc')).toBe('renamed.md')
    expect(b.doc.get('doc')?.parentId).toBe('projects')
    expect(b.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven')
  })

  it('deleting a folder deletes everything below it on the other device', async () => {
    const { a, b } = pair()
    const folder = a.addFolder('root', 'Old', 'old')
    a.addFile(folder, 'x.md', 'x', 'x')
    a.addFile(folder, 'y.md', 'y', 'y')
    await a.sync()
    await b.sync()
    expect(b.text('x')).toBe('x')

    a.remove('old')
    await a.sync()
    await b.sync()
    expect(b.has('old')).toBe(false)
    expect(b.has('x')).toBe(false)
    expect(b.has('y')).toBe(false)
  })
})

describe('what goes over the wire', () => {
  it('sends a one-line patch for a big document, and the whole text for a small one', async () => {
    const { server, a } = await withSharedDoc(BIG)
    server.pushes.length = 0
    a.edit('doc', BIG.replace('line 200:', 'line 200 EDITED:'))
    await a.sync()
    const op = server.pushes[0].ops[0]
    expect(op.patch).toBeDefined()
    expect(op.content).toBeUndefined()
    expect(server.pushes[0].bytes).toBeLessThan(2000)
    expect(server.text('doc')).toBe(BIG.replace('line 200:', 'line 200 EDITED:'))

    a.edit('doc', 'tiny')
    a.edit('doc', 'tiny and small')
    server.pushes.length = 0
    await a.sync()
    expect(server.pushes[0].ops[0].content).toBe('tiny and small')
    expect(server.pushes[0].ops[0].patch).toBeUndefined()
  })

  it('resends the whole text after the server says the patch does not fit', async () => {
    const { server, a } = await withSharedDoc(BIG)
    // The base the server holds drifts away from the one this device remembers, without a new revision.
    const record = server.records.get('doc')!
    record.content = BIG + '\nsurprise'
    record.hash = (await import('../../lib/hash')).sha256HexSync(record.content)
    server.pushes.length = 0
    a.edit('doc', BIG.replace('line 7:', 'line 7 EDITED:'))
    await a.sync()
    expect(server.pushes.length).toBeGreaterThanOrEqual(2)
    expect(server.pushes[0].ops[0].patch).toBeDefined()
    expect(server.pushes[1].ops[0].content).toBe(BIG.replace('line 7:', 'line 7 EDITED:'))
    expect(server.text('doc')).toBe(BIG.replace('line 7:', 'line 7 EDITED:'))
  })

  it('queues edits while offline and then sends ONE op per document', async () => {
    const { server, a } = await withSharedDoc()
    server.offline = true
    a.edit('doc', 'first')
    expect((await a.sync()).phase).toBe('offline')
    a.edit('doc', 'second')
    a.edit('doc', 'third')
    await a.sync()
    a.addFile('root', 'new.md', 'brand new', 'new')
    expect((await a.sync()).phase).toBe('offline')
    expect(a.engine.state.pending).toBe(2)

    server.offline = false
    server.pushes.length = 0
    expect((await a.sync()).phase).toBe('idle')
    expect(server.pushes).toHaveLength(1)
    expect(server.pushes[0].ops.map((op) => op.id).sort()).toEqual(['doc', 'new'])
    expect(server.text('doc')).toBe('third')
    expect(server.text('new')).toBe('brand new')
    expect(a.engine.state.pending).toBe(0)
  })

  it('keeps the queue across a reload', async () => {
    const { server, a } = await withSharedDoc()
    server.offline = true
    a.edit('doc', 'typed offline')
    await a.sync()
    const reloaded = await Device.reload(server, { deviceId: 'dev-a', store: a.store })
    expect(reloaded.text('doc')).toBe('typed offline')
    server.offline = false
    await reloaded.sync()
    expect(server.text('doc')).toBe('typed offline')
  })

  it('splits a big outbox into several requests', async () => {
    const { server, a } = pair()
    for (let i = 0; i < 120; i += 1) a.addFile('root', `n${i}.md`, `text ${i}`, `n${i}`)
    await a.sync()
    expect(server.pushes.length).toBeGreaterThanOrEqual(3)
    expect(Math.max(...server.pushes.map((push) => push.ops.length))).toBeLessThanOrEqual(50)
    expect([...server.records.values()].filter((r) => r.kind === 'file')).toHaveLength(120)
  })
})

describe('two devices, one document', () => {
  it('merges edits made in different places without asking', async () => {
    const { a, b } = await withSharedDoc()
    a.edit('doc', 'ONE\ntwo\nthree\nfour\nfive\nsix\nseven')
    b.edit('doc', 'one\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
    await a.sync()
    await b.sync()
    expect(b.text('doc')).toBe('ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
    expect(b.notes.some((note) => /Merged changes/.test(note))).toBe(true)
    await a.sync()
    expect(a.text('doc')).toBe('ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
    expect(b.engine.state.conflicts).toEqual([])
  })

  it('stops for a person when the same line was changed both ways', async () => {
    const { server, a, b } = await withSharedDoc()
    a.edit('doc', 'one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    b.edit('doc', 'one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    await a.sync()
    const state = await b.sync()
    expect(state.conflicts).toEqual([{ id: 'doc', name: 'doc.md' }])
    expect(b.text('doc')).toBe('one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    expect(server.text('doc')).toBe('one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    expect(b.notes.some((note) => /Sync → Conflicts/.test(note))).toBe(true)

    // Nothing is pushed for it while it waits.
    server.pushes.length = 0
    await b.sync()
    expect(server.pushes).toEqual([])
    expect(b.engine.state.conflicts).toHaveLength(1)
  })

  it('"Keep mine" sends this device\'s text on top of the server\'s revision', async () => {
    const { server, a, b } = await withSharedDoc()
    a.edit('doc', 'one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    b.edit('doc', 'one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    await a.sync()
    await b.sync()
    await b.engine.resolveConflict('doc', 'mine')
    await b.sync()
    expect(server.text('doc')).toBe('one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    expect(b.engine.state.conflicts).toEqual([])
    await a.sync()
    expect(a.text('doc')).toBe('one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
  })

  it('"Use server\'s" replaces this device\'s text and sends nothing', async () => {
    const { server, a, b } = await withSharedDoc()
    a.edit('doc', 'one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    b.edit('doc', 'one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    await a.sync()
    await b.sync()
    server.pushes.length = 0
    await b.engine.resolveConflict('doc', 'server')
    await b.sync()
    expect(b.text('doc')).toBe('one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    expect(server.pushes).toEqual([])
    expect(b.engine.state.conflicts).toEqual([])
  })

  it('"Keep both" turns this device\'s text into a new document and takes the server\'s for the old one', async () => {
    const { server, a, b } = await withSharedDoc()
    a.edit('doc', 'one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    b.edit('doc', 'one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    await a.sync()
    await b.sync()
    await b.engine.resolveConflict('doc', 'both')
    await b.sync()
    expect(b.text('doc')).toBe('one\nTWO from a\nthree\nfour\nfive\nsix\nseven')
    const copies = [...server.records.values()].filter((record) => /^doc \(conflict .*\)\.md$/.test(record.name))
    expect(copies).toHaveLength(1)
    expect(copies[0].content).toBe('one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
    await a.sync()
    expect(a.text(copies[0].id)).toBe('one\nTWO from b\nthree\nfour\nfive\nsix\nseven')
  })

  it('merges a rename on one device with an edit on the other', async () => {
    const { a, b } = await withSharedDoc()
    a.rename('doc', 'renamed.md')
    b.edit('doc', 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight')
    await a.sync()
    await b.sync()
    await a.sync()
    expect(b.name('doc')).toBe('renamed.md')
    expect(b.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight')
    expect(a.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight')
    expect(a.name('doc')).toBe('renamed.md')
  })

  it('an edit beats a delete made on the other device, both ways round', async () => {
    const first = await withSharedDoc()
    first.a.remove('doc')
    first.b.edit('doc', 'edited')
    await first.a.sync()
    await first.b.sync()
    expect(first.b.text('doc')).toBe('edited')
    expect(first.b.notes.some((note) => /was deleted on another device/.test(note))).toBe(true)
    await first.b.sync()
    expect(first.server.text('doc')).toBe('edited')
    expect(first.server.records.get('doc')?.deleted).toBe(false)
    await first.a.sync()
    expect(first.a.text('doc')).toBe('edited')

    const second = await withSharedDoc()
    second.b.edit('doc', 'edited first')
    await second.b.sync()
    second.a.remove('doc')
    const state = await second.a.sync()
    expect(state.phase).toBe('idle')
    expect(second.a.text('doc')).toBe('edited first')
    expect(second.server.records.get('doc')?.deleted).toBe(false)
  })

  it('a delete on one device deletes an untouched copy on the other', async () => {
    const { a, b } = await withSharedDoc()
    a.remove('doc')
    await a.sync()
    await b.sync()
    expect(b.has('doc')).toBe(false)
  })

  it('a rename on the other device does not undo a delete made here', async () => {
    const { server, a, b } = await withSharedDoc()
    b.rename('doc', 'was renamed.md')
    await b.sync()
    a.remove('doc')
    await a.sync()
    expect(server.records.get('doc')?.deleted).toBe(true)
    await b.sync()
    expect(b.has('doc')).toBe(false)
  })

  it('fetches a text the server left out of a conflict answer, then merges', async () => {
    const { server, a, b } = await withSharedDoc()
    server.conflictTextBudget = 0
    a.edit('doc', 'ONE\ntwo\nthree\nfour\nfive\nsix\nseven')
    b.edit('doc', 'one\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
    await a.sync()
    server.gets.length = 0
    await b.sync()
    expect(server.gets).toContain('doc')
    expect(b.text('doc')).toBe('ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
    await b.sync()
    expect(server.text('doc')).toBe('ONE\ntwo\nthree\nfour\nfive\nsix\nSEVEN')
  })
})

describe('trouble', () => {
  it('a refused node does not hold up the others', async () => {
    const { server, a } = pair()
    a.addFile('root', 'bad/name.md', 'x', 'bad')
    a.addFile('root', 'good.md', 'fine', 'good')
    await a.sync()
    expect(server.text('good')).toBe('fine')
    expect(server.records.has('bad')).toBe(false)
    expect(a.engine.state.blocked).toMatchObject([{ id: 'bad', code: 'md_bad_name' }])
    expect(a.engine.state.pending).toBe(0)

    a.rename('bad', 'fixed.md')
    await a.sync()
    expect(server.text('bad')).toBe('x')
    expect(a.engine.state.blocked).toEqual([])
  })

  it('blocks a document over the size limit of the server without sending it, and the others still go', async () => {
    const { server, a } = pair()
    a.addFile('root', 'huge.md', 'x'.repeat(3_600_000), 'huge')
    a.addFile('root', 'fine.md', 'small', 'fine')
    await a.sync()
    expect(server.records.has('huge')).toBe(false)
    expect(server.text('fine')).toBe('small')
    expect(a.engine.state.blocked).toMatchObject([{ id: 'huge', code: 'md_doc_too_large' }])
    expect(server.pushes.every((push) => push.bytes < 100_000)).toBe(true)
  })

  it('keeps asking again when the server is still copying the old store', async () => {
    const { server, a } = await withSharedDoc()
    server.failNext = new SyncError('The server is still copying the old documents. Retrying…', { status: 503, code: 'md_migrating', retryAfter: 2 })
    a.edit('doc', 'edited while the server migrates')
    expect((await a.sync()).phase).toBe('error')
    expect(a.engine.state.pending).toBe(1)
    expect((await a.sync()).phase).toBe('idle')
    expect(server.text('doc')).toBe('edited while the server migrates')
  })

  it('blocks a name the server would refuse, and an id it would 422 on, without sending them', async () => {
    const { server, a } = pair()
    a.addFile('root', 'ok.md', 'x', 'has space')
    await a.sync()
    expect(server.records.has('has space')).toBe(false)
    expect(a.engine.state.blocked[0]?.code).toBe('md_bad_id')
  })

  it('reports a server that is down, backs off, and recovers', async () => {
    const { server, a } = await withSharedDoc()
    server.failNext = new SyncError('The server did not answer', { status: 503, code: 'md_store_unavailable', retryAfter: 5 })
    a.edit('doc', 'x')
    const state = await a.sync()
    expect(state.phase).toBe('error')
    expect(state.error).toMatch(/did not answer/)
    expect(state.pending).toBe(1)
    const recovered = await a.sync()
    expect(recovered.phase).toBe('idle')
    expect(server.text('doc')).toBe('x')
  })

  it('a private server says so and waits for admin mode', async () => {
    const { server, a } = await withSharedDoc()
    server.failNext = new SyncError("This server's documents are private.", { status: 403, code: 'markdown_private' })
    a.canWrite = false
    server.offline = false
    const guest = new Device(server, { deviceId: 'dev-g', canWrite: false })
    server.pulls.length = 0
    const originalChanges = server.changes.bind(server)
    server.changes = async () => {
      throw new SyncError("This server's documents are private.", { status: 403, code: 'markdown_private' })
    }
    const state = await guest.sync()
    expect(state.phase).toBe('private')
    server.changes = originalChanges
    expect((await guest.sync()).phase).toBe('idle')
  })

  it('asks the host to re-check the admin session when the server refuses the credentials', async () => {
    const server = new FakeServer()
    const device = new Device(server, { deviceId: 'dev-a' })
    const onAuthProblem = vi.fn()
    const engine = new SyncEngine({
      api: server, ws: device.ws, backend: 'json', deviceId: 'dev-a', canWrite: () => true, manual: true, onAuthProblem
    })
    engine.start()
    server.failNext = new SyncError('Admin access is needed.', { status: 403, code: 'markdown_admin_required' })
    device.addFile('root', 'a.md', 'a', 'a')
    await engine.syncNow() // reconcile pulls first (fine), then the push is refused
    expect(onAuthProblem).toHaveBeenCalled()
    expect(engine.state.phase).toBe('error')
  })

  it('a viewer pulls and never pushes', async () => {
    const { server, a } = await withSharedDoc()
    const viewer = new Device(server, { deviceId: 'dev-v', canWrite: false })
    viewer.addFile('root', 'mine.md', 'local only', 'mine')
    server.pushes.length = 0
    await viewer.sync()
    expect(viewer.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven')
    a.edit('doc', 'newer')
    await a.sync()
    await viewer.sync()
    expect(viewer.text('doc')).toBe('newer')
    expect(server.pushes.filter((push) => push.device === 'dev-v')).toEqual([])
    expect(viewer.engine.state.readOnly).toBe(true)
  })

  it('stays out of the way while an answer to the first-sync question is awaited', async () => {
    const server = new FakeServer()
    server.seed({ id: 'root', kind: 'folder', name: 'Server docs' })
    server.seed({ id: 'plan', kind: 'file', name: 'plan.md', parentId: 'root', content: 'server plan' })
    const device = new Device(server, { deviceId: 'dev-a' })
    device.addFile('root', 'plan.md', 'local plan', 'plan')
    const running = device.engine.syncNow()
    await vi.waitFor(() => expect(device.engine.state.phase).toBe('reconcile'))
    expect(device.engine.state.reconcile?.differ).toEqual([{ id: 'plan', name: 'plan.md' }])
    device.engine.resolveReconcile({ differ: 'both', deleteServerOnly: false })
    await running
    expect(device.engine.state.phase).toBe('idle')
  })
})

describe('first meeting with a server (reconcile)', () => {
  it('uploads what is only here, downloads what is only there, and leaves equal documents alone', async () => {
    const server = new FakeServer()
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'both', kind: 'file', name: 'both.md', parentId: 'root', content: 'same text' })
    server.seed({ id: 'there', kind: 'file', name: 'there.md', parentId: 'root', content: 'only on the server' })
    const device = new Device(server, { deviceId: 'dev-a' })
    device.addFile('root', 'both.md', 'same text', 'both')
    device.addFile('root', 'here.md', 'only here', 'here')
    const state = await device.sync()
    expect(state.phase).toBe('idle')
    expect(device.text('there')).toBe('only on the server')
    expect(server.text('here')).toBe('only here')
    expect(server.pushes.flatMap((push) => push.ops.map((op) => op.id))).toEqual(['here'])
    expect(server.records.get('both')?.rev).toBe(1)
  })

  it('never uploads the stock welcome page, and takes the server\'s welcome over it', async () => {
    const server = new FakeServer()
    const fresh = new Device(server, { deviceId: 'dev-a' })
    fresh.addFile('root', 'welcome.md', WELCOME, 'welcome')
    await fresh.sync()
    expect(server.records.has('welcome')).toBe(false)

    const other = new Device(server, { deviceId: 'dev-b' })
    other.addFile('root', 'welcome.md', WELCOME, 'welcome')
    other.edit('welcome', 'my own welcome')
    await other.sync()
    expect(server.text('welcome')).toBe('my own welcome')

    await fresh.sync() // reconcile already happened; a normal pull brings it
    expect(fresh.text('welcome')).toBe('my own welcome')

    const third = new Device(server, { deviceId: 'dev-c' })
    third.addFile('root', 'welcome.md', WELCOME, 'welcome')
    await third.sync()
    expect(third.text('welcome')).toBe('my own welcome')
    expect(third.engine.state.reconcile).toBeNull()
  })

  it('keeps both when the same id holds different texts: the server\'s keeps the name, this device\'s becomes "(this device)"', async () => {
    const server = new FakeServer()
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'plan', kind: 'file', name: 'plan.md', parentId: 'root', content: 'server plan' })
    const device = new Device(server, { deviceId: 'dev-a' })
    device.addFile('root', 'plan.md', 'local plan', 'plan')
    const running = device.engine.syncNow()
    await vi.waitFor(() => expect(device.engine.state.phase).toBe('reconcile'))
    device.engine.resolveReconcile({ differ: 'both', deleteServerOnly: false })
    await running
    expect(device.text('plan')).toBe('server plan')
    const copy = [...device.doc.values()].find((doc) => /\(this device\)/.test(doc.name))
    expect(copy?.name).toBe('plan (this device).md')
    expect(copy?.content).toBe('local plan')
    expect(server.records.get(copy!.id)?.content).toBe('local plan')
  })

  it('"Prefer server" and "Prefer this device" settle every difference one way', async () => {
    const build = () => {
      const server = new FakeServer()
      server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
      server.seed({ id: 'plan', kind: 'file', name: 'plan.md', parentId: 'root', content: 'server plan' })
      const device = new Device(server, { deviceId: 'dev-a' })
      device.addFile('root', 'plan.md', 'local plan', 'plan')
      return { server, device }
    }
    const server = build()
    const running = server.device.engine.syncNow()
    await vi.waitFor(() => expect(server.device.engine.state.phase).toBe('reconcile'))
    server.device.engine.resolveReconcile({ differ: 'server', deleteServerOnly: false })
    await running
    expect(server.device.text('plan')).toBe('server plan')
    expect([...server.device.doc.values()].some((doc) => /\(this device\)/.test(doc.name))).toBe(false)

    const local = build()
    const running2 = local.device.engine.syncNow()
    await vi.waitFor(() => expect(local.device.engine.state.phase).toBe('reconcile'))
    local.device.engine.resolveReconcile({ differ: 'local', deleteServerOnly: false })
    await running2
    expect(local.server.text('plan')).toBe('local plan')
    expect(local.device.text('plan')).toBe('local plan')
  })

  it('can delete what only the server has instead of downloading it, when asked (after a reset)', async () => {
    const { server, a } = await withSharedDoc()
    a.addFile('root', 'extra.md', 'extra', 'extra')
    await a.sync()
    server.horizon = server.clock + 1
    server.seed({ id: 'ghost', kind: 'file', name: 'ghost.md', parentId: 'root', content: 'ghost' })
    a.addFile('root', 'fresh.md', 'new local', 'fresh')
    const running = a.engine.syncNow()
    await vi.waitFor(() => expect(a.engine.state.phase).toBe('reconcile'))
    expect(a.engine.state.reconcile?.reason).toBe('reset')
    expect(a.engine.state.reconcile?.downloads).toEqual([{ id: 'ghost', name: 'ghost.md' }])
    a.engine.resolveReconcile({ differ: 'both', deleteServerOnly: true })
    await running
    expect(a.has('ghost')).toBe(false)
    expect(server.records.get('ghost')?.deleted).toBe(true)
    expect(server.text('fresh')).toBe('new local')
  })

  it('after a reset, a document the server forgot is deleted here unless it was edited', async () => {
    const { server, a } = await withSharedDoc()
    a.addFile('root', 'keep.md', 'keep', 'keep')
    a.addFile('root', 'gone.md', 'gone', 'gone')
    await a.sync()
    server.records.delete('gone')
    server.records.delete('keep')
    server.horizon = server.clock + 10
    a.edit('keep', 'keep, but edited here')
    const running = a.engine.syncNow()
    await vi.waitFor(() => expect(['idle', 'reconcile']).toContain(a.engine.state.phase))
    if (a.engine.state.phase === 'reconcile') a.engine.resolveReconcile({ differ: 'both', deleteServerOnly: false })
    await running
    expect(a.has('gone')).toBe(false)
    expect(a.text('keep')).toBe('keep, but edited here')
    expect(server.text('keep')).toBe('keep, but edited here')
  })

  it('cancelling the question switches sync off', async () => {
    const server = new FakeServer()
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'plan', kind: 'file', name: 'plan.md', parentId: 'root', content: 'server plan' })
    const device = new Device(server, { deviceId: 'dev-a' })
    const onCancel = vi.fn()
    const engine = new SyncEngine({ api: server, ws: device.ws, backend: 'json', deviceId: 'dev-a', canWrite: () => true, manual: true, onCancel })
    engine.start()
    device.addFile('root', 'plan.md', 'local plan', 'plan')
    const running = engine.syncNow()
    await vi.waitFor(() => expect(engine.state.phase).toBe('reconcile'))
    engine.resolveReconcile('cancel')
    await running
    expect(onCancel).toHaveBeenCalled()
    expect(engine.state.phase).toBe('off')
  })

  it('every storage backend has its own cursor and its own first meeting', async () => {
    const server = new FakeServer()
    const device = new Device(server, { deviceId: 'dev-a', backend: 'json' })
    device.addFile('root', 'a.md', 'a', 'a')
    await device.sync()
    expect(await device.store.getMeta('cursor:json')).toBeTypeOf('number')
    expect(await device.store.getMeta('cursor:mysql')).toBeUndefined()
  })
})

describe('replace this device\'s copy with the server\'s', () => {
  it('makes the workspace the server\'s, unsent edits included', async () => {
    const { a, b } = await withSharedDoc()
    a.addFile('root', 'only-a.md', 'a', 'only-a')
    await a.sync()
    b.edit('doc', 'unsent edit')
    b.addFile('root', 'unsent.md', 'u', 'unsent')
    await b.engine.replaceFromServer()
    expect(b.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven')
    expect(b.text('only-a')).toBe('a')
    expect(b.has('unsent')).toBe(false)
    expect(b.engine.state.pending).toBe(0)
  })
})

describe('a store that refuses writes', () => {
  it('keeps the device usable and saves the nodes when it works again', async () => {
    const server = new FakeServer()
    const store = new MemoryDocStore()
    const device = new Device(server, { deviceId: 'dev-a', store })
    device.addFile('root', 'a.md', 'text', 'a')
    store.failWith = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    device.ws.capture()
    await device.ws.drain()
    expect(device.writes[device.writes.length - 1]).toBe('quota')
    expect(device.ws.dirty).toBe(true)
    store.failWith = null
    await device.ws.flush()
    expect(device.ws.dirty).toBe(false)
    expect(store.docs.get('a')?.content).toBe('text')
    expect(store.outbox.has('a')).toBe(true)
  })
})

describe('the stock welcome texts of earlier builds', () => {
  // Kept verbatim: their hashes are LEGACY_WELCOME_SHA256 (lib/welcome.ts, lib/__tests__/welcome.test.ts).
  const FIRST_BUILD = '# Welcome to Markdown Editor\n\nStart typing markdown here...'

  it('are not sent as the person\'s writing either', async () => {
    const server = new FakeServer()
    const device = new Device(server, { deviceId: 'dev-a' })
    device.addFile('root', 'welcome.md', FIRST_BUILD, 'welcome')
    await device.sync()
    expect(server.records.has('welcome')).toBe(false)
    expect(device.has('welcome')).toBe(true)
  })

  it('give way to the server\'s page, silently, on the first meeting', async () => {
    const server = new FakeServer()
    server.seed({ id: 'root', kind: 'folder', name: 'My Documents' })
    server.seed({ id: 'welcome', kind: 'file', name: 'welcome.md', parentId: 'root', content: 'my own welcome page' })
    const device = new Device(server, { deviceId: 'dev-a' })
    device.addFile('root', 'welcome.md', FIRST_BUILD, 'welcome')
    await device.sync()
    expect(device.text('welcome')).toBe('my own welcome page')
    expect(device.engine.state.phase).toBe('idle') // no question was asked
  })

  it('once the person edits it, it is theirs and goes up', async () => {
    const server = new FakeServer()
    const device = new Device(server, { deviceId: 'dev-a' })
    device.addFile('root', 'welcome.md', WELCOME, 'welcome')
    await device.sync()
    device.edit('welcome', WELCOME + '\nMy own line.\n')
    await device.sync()
    expect(server.text('welcome')).toBe(WELCOME + '\nMy own line.\n')
  })
})

describe('what the server did not echo', () => {
  it('a rename made elsewhere still reaches a device whose own edit was accepted on top of it', async () => {
    const { server, a, b } = await withSharedDoc()
    a.rename('doc', 'renamed.md')
    await a.sync()
    b.edit('doc', 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight')
    await b.sync() // its edit is accepted (a rename and a text edit are judged apart); the answer says nothing about the new name
    expect(server.records.get('doc')?.name).toBe('renamed.md')
    expect(b.name('doc')).toBe('renamed.md') // learnt from the next pull, not lost to the shadow
    expect(b.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight')
    await a.sync()
    expect(a.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight')
  })

  it('sends each op the revision of the part it touches: a rename only needs to know the name\'s revision', async () => {
    const { server, a, b } = await withSharedDoc()
    b.edit('doc', 'one\ntwo\nthree\nfour\nfive\nsix\nseven\nnew last line')
    await b.sync()
    server.pushes.length = 0
    a.rename('doc', 'renamed.md') // A has not seen the text edit, and the rename does not care
    await a.sync()
    expect(server.pushes[0].ops[0]).toMatchObject({ id: 'doc', baseRev: 1, set: { name: 'renamed.md' } })
    expect(server.pushes[0].ops[0].content).toBeUndefined()
    expect(server.records.get('doc')?.name).toBe('renamed.md')
    expect(server.text('doc')).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven\nnew last line') // the other device's text is intact
  })

  it('two renames of one node: the later push wins and both devices end up with that name', async () => {
    const { server, a, b } = await withSharedDoc()
    a.rename('doc', 'from-a.md')
    b.rename('doc', 'from-b.md')
    await a.sync()
    await b.sync() // clashes on the name, mine wins on meta and is sent again on top of A's revision
    await a.sync()
    expect(server.records.get('doc')?.name).toBe('from-b.md')
    expect(a.name('doc')).toBe('from-b.md')
    expect(b.name('doc')).toBe('from-b.md')
  })
})

describe('the cursor and echoes', () => {
  it('a record delivered twice is applied once', async () => {
    const { server, a, b } = await withSharedDoc()
    a.edit('doc', 'edited on A')
    await a.sync()
    await b.sync()
    b.remote.length = 0
    // The cursor trails the clock: the same record may come again.
    const cursor = await b.store.getMeta('cursor:json')
    await b.store.commit({ meta: { 'cursor:json': (cursor as number) - 5 } })
    server.pulls.length = 0
    await b.sync()
    expect(server.pulls.length).toBeGreaterThan(0)
    expect(b.remote).toEqual([])
    expect(b.text('doc')).toBe('edited on A')
  })

  it('a push whose answer was lost is not a conflict when it is sent again', async () => {
    const { server, a } = await withSharedDoc()
    a.edit('doc', 'edit whose answer is lost')
    const real = server.push.bind(server)
    let lost = true
    server.push = async (args) => {
      const answer = await real(args)
      if (lost) {
        lost = false
        throw new SyncError('The server did not answer', { offline: true })
      }
      return answer
    }
    expect((await a.sync()).phase).toBe('offline')
    expect(server.text('doc')).toBe('edit whose answer is lost') // the server did apply it
    const state = await a.sync()
    expect(state.phase).toBe('idle')
    expect(state.conflicts).toEqual([])
    expect(a.text('doc')).toBe('edit whose answer is lost')
  })

  it('hashes what it sends the way the server does (SHA-256 of the UTF-8 text)', async () => {
    const { server, a } = pair()
    a.addFile('root', 'u.md', 'Việt ệ — 😀\n', 'u')
    await a.sync()
    const op = server.pushes.flatMap((push) => push.ops).find((o) => o.id === 'u')!
    expect(op.hash).toBe(sha256HexSync('Việt ệ — 😀\n'))
  })

  it('makes a lone surrogate well formed before hashing and sending, and does not loop on it', async () => {
    const { server, a } = pair()
    a.addFile('root', 'lone.md', 'broken \ud83d text', 'lone')
    await a.sync()
    expect(server.text('lone')).toBe('broken � text')
    server.pushes.length = 0
    await a.sync()
    expect(server.pushes).toEqual([]) // clean: nothing is sent again for it
  })
})
