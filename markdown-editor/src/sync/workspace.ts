import type { FileNode } from '../types'
import type { StorageFailure } from '../lib/persistence'
import { buildTree, diffTrees, type LocalDoc, type OutboxEntry } from './records'
import { failureOf, type DocCommit, type DocStore, type ViewState } from './docStore'

/**
 * The bridge between the editor's tree in memory and the device store (md-sync F4).
 *
 * It owns the *baseline* -- the flat records as last written -- and compares the live tree against it (`capture`): only the
 * nodes that changed are written, and each lands in the outbox in the same commit, so an edit never exists without its mark.
 * Every write to the store goes through here, one at a time and in order, so the editor and the sync engine cannot overwrite
 * each other: the engine applies a remote change with `commitRemote`, which first captures what the person typed and refuses
 * (returns false) when the node is no longer what the engine read.
 */

export interface WorkspaceHost {
  /** The tree the editor shows right now. */
  files(): FileNode[]
  /** Which document is open and which folders are expanded (the localStorage fallback writes them beside the tree). */
  view(): ViewState
  /** The committed records now describe the workspace: show them. `changed` = the ids a remote change touched. */
  applyRemote(docs: ReadonlyMap<string, LocalDoc>, changed: ReadonlySet<string>): void
  /** A write finished: null on success, or why it failed (an asynchronous store reports here, not by returning). */
  onWrite(failure: StorageFailure | null): void
  now(): number
}

export function sameDoc(a: LocalDoc | null | undefined, b: LocalDoc | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return a.kind === b.kind && a.parentId === b.parentId && a.name === b.name && a.content === b.content
}

export interface RemoteChange extends DocCommit {
  docs: { put?: LocalDoc[]; delete?: string[] }
}

export class Workspace {
  private baseline: Map<string, LocalDoc>
  private outbox: Map<string, OutboxEntry>
  private queue: Promise<void> = Promise.resolve()
  private pendingWrites = 0
  /**
   * The nodes of a commit the store refused. They are rewritten from the CURRENT baseline before the next commit -- never
   * from the refused commit, which may be stale by then -- so "try saving again" saves what the editor shows now.
   */
  private failed = new Set<string>()
  seq: number

  constructor(
    readonly store: DocStore,
    private readonly host: WorkspaceHost,
    docs: Iterable<LocalDoc>,
    outbox: Iterable<OutboxEntry>,
    seq: number
  ) {
    this.baseline = new Map()
    for (const doc of docs) this.baseline.set(doc.id, doc)
    this.outbox = new Map()
    for (const entry of outbox) this.outbox.set(entry.id, entry)
    this.seq = seq
  }

  /** The records as last written (the live tree once `capture` has run). */
  get docs(): ReadonlyMap<string, LocalDoc> {
    return this.baseline
  }

  outboxEntries(): OutboxEntry[] {
    return [...this.outbox.values()]
  }

  outboxEntry(id: string): OutboxEntry | undefined {
    return this.outbox.get(id)
  }

  /** True while a write has not reached the store (or one failed and waits for a retry). */
  get dirty(): boolean {
    return this.pendingWrites > 0 || this.failed.size > 0
  }

  /**
   * Compares the live tree with the baseline and writes what differs, marking those nodes in the outbox. Synchronous: when it
   * returns, the baseline equals the live tree and the write is queued. Returns whether anything changed.
   */
  capture(): boolean {
    const { next, puts, deletes } = diffTrees(this.baseline, this.host.files(), this.host.now())
    if (!puts.length && !deletes.length) return false
    this.baseline = next
    this.seq += 1
    const marks: OutboxEntry[] = []
    for (const id of [...puts.map((doc) => doc.id), ...deletes]) {
      const before = this.outbox.get(id)
      // A change starts a new version (a push in flight sees it moved on); `blocked`/`forceFull` belong to the old text,
      // the person's conflict stays until they answer it.
      const entry: OutboxEntry = { id, version: (before?.version ?? 0) + 1, ...(before?.conflict ? { conflict: before.conflict } : {}) }
      this.outbox.set(id, entry)
      marks.push(entry)
    }
    void this.enqueue({ docs: { put: puts, delete: deletes }, outbox: { put: marks }, meta: { seq: this.seq }, view: this.host.view() }).catch(noop)
    return true
  }

  /**
   * The synchronous half of `flush`: capture, and rewrite what an earlier refused write left over. With `forceView` a store that
   * keeps the whole tree in one key (the localStorage fallback) is rewritten even when no document changed, because the
   * open document or the expanded folders did -- those live in the same payload.
   */
  persistNow(forceView = false): boolean {
    const changed = this.capture()
    if (changed) return true
    if (this.failed.size || (forceView && this.store.commitSync)) {
      void this.enqueue({ docs: { put: [], delete: [] }, meta: { seq: this.seq }, view: this.host.view() }).catch(noop)
    }
    return false
  }

  /** Writes whatever the person typed, then waits until the store has it. */
  async flush(): Promise<void> {
    this.capture()
    if (this.failed.size) void this.enqueue({}).catch(noop)
    await this.drain()
  }

  /** Resolves once every queued write has been tried. */
  drain(): Promise<void> {
    return this.queue
  }

  /**
   * An outbox / shadow / meta change from the sync engine (no document changes). `ifVersion`: the outbox entries named in
   * `change.outbox.delete` are only deleted when their version still is the one the engine sent -- a node edited since stays marked.
   */
  async apply(change: DocCommit, ifVersion?: ReadonlyMap<string, number>): Promise<void> {
    this.capture()
    const outbox = change.outbox ? { ...change.outbox } : undefined
    if (outbox?.delete) {
      outbox.delete = outbox.delete.filter((id) => {
        const wanted = ifVersion?.get(id)
        return wanted === undefined || this.outbox.get(id)?.version === wanted
      })
    }
    for (const entry of outbox?.put ?? []) this.outbox.set(entry.id, entry)
    for (const id of outbox?.delete ?? []) this.outbox.delete(id)
    await this.enqueue({ ...change, ...(outbox ? { outbox } : {}) })
  }

  /**
   * A remote change that touches documents. `expect` is what the engine believes the baseline holds for each node it is about to
   * replace; if the person typed since (after a capture here) a node differs, nothing is written and false comes back: the
   * engine reads again and retries. Otherwise the baseline, the outbox mirror and the store move together and the editor is told.
   */
  async commitRemote(change: RemoteChange, expect: ReadonlyMap<string, LocalDoc | null>, ifVersion?: ReadonlyMap<string, number>): Promise<boolean> {
    this.capture()
    for (const [id, expected] of expect) {
      if (!sameDoc(this.baseline.get(id) ?? null, expected)) return false
    }
    const changed = new Set<string>()
    for (const doc of change.docs.put ?? []) {
      this.baseline.set(doc.id, doc)
      changed.add(doc.id)
    }
    for (const id of change.docs.delete ?? []) {
      this.baseline.delete(id)
      changed.add(id)
    }
    const outbox = change.outbox ? { ...change.outbox } : undefined
    if (outbox?.delete) {
      outbox.delete = outbox.delete.filter((id) => {
        const wanted = ifVersion?.get(id)
        return wanted === undefined || this.outbox.get(id)?.version === wanted
      })
    }
    for (const entry of outbox?.put ?? []) this.outbox.set(entry.id, entry)
    for (const id of outbox?.delete ?? []) this.outbox.delete(id)
    this.seq += 1
    const written = this.enqueue({ ...change, ...(outbox ? { outbox } : {}), meta: { ...change.meta, seq: this.seq }, view: this.host.view() })
    if (changed.size) this.host.applyRemote(this.baseline, changed)
    await written
    return true
  }

  /** Forgets shadows, outbox and cursors (a store or a server change): the next sync reconciles from scratch. */
  async wipeSync(): Promise<void> {
    this.capture()
    await this.drain()
    await this.store.wipeSync()
    this.outbox.clear()
  }

  private idsOf(change: DocCommit): string[] {
    return [
      ...(change.docs?.put ?? []).map((doc) => doc.id),
      ...(change.docs?.delete ?? []),
      ...(change.outbox?.put ?? []).map((entry) => entry.id),
      ...(change.outbox?.delete ?? [])
    ]
  }

  /** What to write again for the nodes of earlier refused commits: their state in the baseline and the outbox now. */
  private retryCommit(): DocCommit | null {
    if (!this.failed.size) return null
    const docs = { put: [] as LocalDoc[], delete: [] as string[] }
    const outbox = { put: [] as OutboxEntry[], delete: [] as string[] }
    for (const id of this.failed) {
      const doc = this.baseline.get(id)
      if (doc) docs.put.push(doc)
      else docs.delete.push(id)
      const entry = this.outbox.get(id)
      if (entry) outbox.put.push(entry)
      else outbox.delete.push(id)
    }
    return { docs, outbox, meta: { seq: this.seq }, view: this.host.view() }
  }

  /** Writes `change` (after any retry) in order; the promise rejects when the store refused it, `onWrite` says why. */
  private enqueue(change: DocCommit): Promise<void> {
    const sync = this.store.commitSync
    if (sync) {
      const retry = this.retryCommit()
      let failure: StorageFailure | null = null
      if (retry) failure = sync.call(this.store, retry)
      if (!failure) failure = sync.call(this.store, change)
      if (failure) {
        for (const id of this.idsOf(change)) this.failed.add(id)
        this.host.onWrite(failure)
        return Promise.reject(Object.assign(new Error('The browser refused the write'), failure === 'quota' ? { name: 'QuotaExceededError' } : {}))
      }
      this.failed.clear()
      this.host.onWrite(null)
      return Promise.resolve()
    }
    this.pendingWrites += 1
    const attempt = this.queue.then(async () => {
      try {
        const retry = this.retryCommit()
        if (retry) await this.store.commit(retry)
        await this.store.commit(change)
        this.failed.clear()
        this.host.onWrite(null)
      } catch (error) {
        for (const id of this.idsOf(change)) this.failed.add(id)
        this.host.onWrite(failureOf(error))
        throw error
      } finally {
        this.pendingWrites -= 1
      }
    })
    this.queue = attempt.catch(noop)
    return attempt
  }
}

function noop(): void {}

// ---------------------------------------------------------------------------------------------------------------------

export interface BootSnapshot {
  files: FileNode[]
  seq: number
  current: { id: string; content: string | null } | null
}

/**
 * The records to start from when both IndexedDB and a boot snapshot exist. Normally IndexedDB wins. When the snapshot counts
 * more saves than IndexedDB the last writes never reached it (the tab closed while a transaction was open): the snapshot's
 * tree (names, places, new and removed nodes) and the open document's text are the newer truth, laid over the stored texts.
 * `rewrite` tells the caller the result differs from the store (it will be written by the first capture).
 */
export function reconcileBoot(stored: LocalDoc[], storedSeq: number, snapshot: BootSnapshot | null, now: number): { docs: LocalDoc[]; rewrite: boolean } {
  if (!snapshot || snapshot.seq <= storedSeq) return { docs: stored, rewrite: false }
  const byId = new Map(stored.map((doc) => [doc.id, doc]))
  const out = new Map<string, LocalDoc>()
  const walk = (nodes: FileNode[], parentId: string | null) => {
    for (const node of nodes) {
      const kind = node.type === 'folder' ? 'folder' : 'file'
      const before = byId.get(node.id)
      const typed = snapshot.current && snapshot.current.id === node.id && snapshot.current.content !== null ? snapshot.current.content : null
      const content = kind === 'folder' ? null : typed ?? (before?.kind === 'file' ? before.content : '') ?? ''
      out.set(node.id, { id: node.id, kind, parentId, name: node.name, content, updatedAt: before?.updatedAt ?? now })
      if (node.children) walk(node.children, node.id)
    }
  }
  walk(snapshot.files, null)
  return { docs: [...out.values()], rewrite: true }
}

/** The editor's tree from records (see `buildTree`), re-exported for the store. */
export { buildTree }
