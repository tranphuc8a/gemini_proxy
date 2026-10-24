import { sha256HexSync } from '../../lib/hash'
import { SyncError, type ChangesPage, type PushOp, type PushResponse, type PushResult, type SyncApi } from '../../services/markdownSync'
import type { FileNode } from '../../types'
import { MemoryDocStore, type LoadedStore } from '../docStore'
import { applyPatch } from '../lineDiff'
import { SyncEngine, type EngineDeps, type SyncState } from '../engine'
import { buildTree, type LocalDoc, type ServerRecord } from '../records'
import { Workspace, type WorkspaceHost } from '../workspace'

/**
 * An in-memory server that follows the delta-sync rules of the real one (use case `MarkdownDocsUseCase`, tasks/.../md-sync.md §3.4):
 * one record per node, compare-and-set on `rev`, `contentRev`/`metaRev` judged apart, an edit beats a delete, a replayed op is
 * `ok`, a patch only applies to the text it was made against, own writes come back without text on an incremental pull.
 * Plus the switches a test needs: offline, a response budget, a reset horizon.
 */

const encoder = new TextEncoder()
const utf8Bytes = (text: string) => encoder.encode(text).length

/**
 * What the real server counts for one op (`MarkdownDocsUseCase._op_weight`): the UTF-8 bytes of the text, or of the lines of a
 * patch (+4 each, +16 a hunk). Every op is then charged 200 more (`push`).
 */
export function opWeight(op: PushOp): number {
  if (op.content !== undefined && op.content !== null) return utf8Bytes(op.content)
  if (op.patch) return op.patch.h.reduce((sum, [, , lines]) => sum + 16 + lines.reduce((inner, line) => inner + utf8Bytes(line) + 4, 0), 0)
  return 0
}

/** The size the real server judges a push request by: the weights of its ops plus 200 bytes an op. */
export const requestWeight = (ops: PushOp[]): number => ops.reduce((sum, op) => sum + opWeight(op) + 200, 0)

export class FakeServer implements SyncApi {
  records = new Map<string, ServerRecord>()
  private counter = 0
  clock = 1_000_000
  offline = false
  /** The next push answers with this error instead. */
  failNext: SyncError | null = null
  horizon = 0
  /** The real server's `MARKDOWN_PUSH_MAX_BYTES`: a request weighing more is refused whole with 400 `md_push_too_large`. */
  maxPushBytes = 4_000_000
  /** Requests the server refused for their size (op count and weight), in order. */
  refusedPushes: { ops: number; weight: number }[] = []
  /** Runs while a push is "in flight": after the server wrote it, before the answer is back (a person typing meanwhile). */
  duringPush: (() => void | Promise<void>) | null = null
  /** Texts of conflicts in one push answer: this many characters, then `contentOmitted` (the real server's PAGE_BYTES). */
  conflictTextBudget = Infinity
  pushes: { device: string; ops: PushOp[]; bytes: number }[] = []
  pulls: { since: number; device: string }[] = []
  gets: string[] = []

  private stamp(): number {
    this.counter += 1
    this.clock += 1
    return this.clock
  }

  private guard() {
    if (this.offline) throw new SyncError('Cannot reach the server.', { offline: true })
  }

  /** The text of a node, for assertions. */
  text(id: string): string | null | undefined {
    return this.records.get(id)?.content
  }

  /** A node put there directly, as if another client (or the lazy migration) had made it. */
  seed(record: Partial<ServerRecord> & { id: string; kind: 'file' | 'folder' }): ServerRecord {
    const content = record.kind === 'file' ? record.content ?? '' : null
    const full: ServerRecord = {
      parentId: null, name: record.id, hash: content === null ? '' : sha256HexSync(content), rev: 1, contentRev: 1, metaRev: 1, deleted: false,
      createdAt: this.clock, updatedAt: this.clock, serverUpdatedAt: this.stamp(), device: 'legacy', ...record, content
    }
    this.records.set(full.id, full)
    return full
  }

  async changes({ since, limit, device }: { since: number; limit?: number; device: string }): Promise<ChangesPage> {
    this.guard()
    this.pulls.push({ since, device })
    const reset = since > 0 && since < this.horizon
    let items = [...this.records.values()].filter((record) => record.serverUpdatedAt > since).sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt || (a.id < b.id ? -1 : 1))
    if (since === 0) items = items.filter((record) => !record.deleted)
    const page = items.slice(0, Math.min(limit ?? 200, 200))
    const out = page.map((record) => {
      const copy: ServerRecord = { ...record }
      if (since > 0 && record.device === device && !record.deleted) copy.content = null
      return copy
    })
    return { items: out, cursor: page.length ? page[page.length - 1].serverUpdatedAt : since, more: items.length > page.length, horizon: this.horizon, reset }
  }

  async getDoc(id: string): Promise<ServerRecord> {
    this.guard()
    this.gets.push(id)
    const record = this.records.get(id)
    if (!record || record.deleted) throw new SyncError('Không có tài liệu', { status: 404, code: 'md_doc_not_found' })
    return { ...record }
  }

  async push({ device, ops }: { device: string; ops: PushOp[] }): Promise<PushResponse> {
    this.guard()
    if (this.failNext) {
      const error = this.failNext
      this.failNext = null
      throw error
    }
    const weight = requestWeight(ops)
    if (weight > this.maxPushBytes) {
      this.refusedPushes.push({ ops: ops.length, weight })
      throw new SyncError('The changes were too large for one request.', { status: 400, code: 'md_push_too_large' })
    }
    this.pushes.push({ device, ops, bytes: JSON.stringify(ops).length })
    let budget = this.conflictTextBudget
    const results: PushResult[] = ops.map((op) => this.one(op, device, () => {
      const room = budget
      return { take: (size: number) => { if (size + 400 > room) return false; budget -= size + 400; return true } }
    }))
    await this.duringPush?.()
    return { results, serverTime: this.clock }
  }

  private conflict(parts: ('content' | 'meta' | 'deleted')[], cur: ServerRecord, budget: () => { take(size: number): boolean }): PushResult {
    if (parts.length === 1 && parts[0] === 'meta') return { id: cur.id, status: 'conflict', parts, record: { ...cur, content: null } }
    const room = budget()
    const fits = room.take((cur.content ?? '').length)
    return fits
      ? { id: cur.id, status: 'conflict', parts, record: { ...cur } }
      : { id: cur.id, status: 'conflict', parts, record: { ...cur, content: null }, contentOmitted: true }
  }

  private one(op: PushOp, device: string, budget: () => { take(size: number): boolean }): PushResult {
    const cur = this.records.get(op.id)
    const ok = (record: ServerRecord): PushResult => ({ id: record.id, status: 'ok', rev: record.rev, contentRev: record.contentRev, metaRev: record.metaRev, hash: record.hash, serverUpdatedAt: record.serverUpdatedAt })
    const reject = (code: string): PushResult => ({ id: op.id, status: 'rejected', code, message: code })
    if (op.updatedAt > this.clock + 86_400_000) return reject('md_bad_clock')
    const name = op.set && 'name' in op.set ? op.set.name : undefined
    if (name !== undefined && (!name.trim() || name.length > 255 || name.includes('/'))) return reject('md_bad_name')
    const parent = op.set && 'parentId' in op.set ? op.set.parentId : undefined

    if (!cur) {
      if (op.patch) return reject('md_patch_mismatch')
      if (name === undefined && op.deleted !== true) return reject('md_bad_name')
      const deleting = op.deleted === true
      const content = op.kind === 'file' && !deleting ? op.content ?? '' : null
      if (content !== null && sha256HexSync(content) !== (op.hash ?? sha256HexSync(content))) return reject('md_hash_mismatch')
      const record: ServerRecord = {
        id: op.id, kind: op.kind, parentId: parent ?? null, name: name ?? '', content, hash: content === null ? '' : sha256HexSync(content), size: content?.length ?? 0,
        rev: 1, contentRev: 1, metaRev: 1, deleted: deleting, createdAt: op.updatedAt, updatedAt: op.updatedAt, serverUpdatedAt: this.stamp(), device
      }
      this.records.set(op.id, record)
      return ok(record)
    }
    if (cur.kind !== op.kind) return reject('md_kind_changed')

    const metaChanges: { name?: string; parentId?: string | null } = {}
    if (name !== undefined && name !== cur.name) metaChanges.name = name
    if (parent !== undefined && parent !== cur.parentId) metaChanges.parentId = parent
    const intent = op.content !== undefined || op.patch !== undefined

    if (cur.deleted) {
      if (op.deleted === true) return ok(cur)
      if (op.deleted === false) {
        if (op.baseRev < cur.contentRev) return this.conflict(['deleted'], cur, budget)
        if (cur.kind === 'file' && op.content === undefined) return reject(op.patch ? 'md_patch_mismatch' : 'md_content_required')
        const rev = cur.rev + 1
        const next: ServerRecord = { ...cur, ...metaChanges, deleted: false, rev, contentRev: rev, updatedAt: op.updatedAt, serverUpdatedAt: this.stamp(), device }
        if (metaChanges.name !== undefined || metaChanges.parentId !== undefined) next.metaRev = rev
        if (cur.kind === 'file') {
          if (sha256HexSync(op.content!) !== op.hash) return reject('md_hash_mismatch')
          next.content = op.content!
          next.hash = op.hash!
          next.size = op.content!.length
        }
        this.records.set(op.id, next)
        return ok(next)
      }
      return intent || Object.keys(metaChanges).length ? this.conflict(['deleted'], cur, budget) : ok(cur)
    }

    if (op.deleted === true) {
      if (cur.contentRev > op.baseRev) return this.conflict(['deleted'], cur, budget)
      const rev = cur.rev + 1
      const tomb: ServerRecord = { ...cur, deleted: true, content: null, hash: '', size: 0, rev, contentRev: rev, updatedAt: op.updatedAt, serverUpdatedAt: this.stamp(), device }
      this.records.set(op.id, tomb)
      return ok(tomb)
    }

    if (op.content !== undefined && op.hash === cur.hash && sha256HexSync(op.content) !== op.hash) return reject('md_hash_mismatch')
    const contentChanges = intent && op.hash !== cur.hash
    const parts: ('content' | 'meta')[] = []
    if (contentChanges && cur.contentRev > op.baseRev) parts.push('content')
    if (Object.keys(metaChanges).length && cur.metaRev > op.baseRev) parts.push('meta')
    if (parts.length) return this.conflict(parts, cur, budget)
    if (!contentChanges && !Object.keys(metaChanges).length) return ok(cur)

    const rev = cur.rev + 1
    const next: ServerRecord = { ...cur, ...metaChanges, rev, updatedAt: op.updatedAt, serverUpdatedAt: this.stamp(), device }
    if (Object.keys(metaChanges).length) next.metaRev = rev
    if (contentChanges) {
      let text: string
      if (op.content !== undefined) {
        text = op.content
        if (sha256HexSync(text) !== op.hash) return reject('md_hash_mismatch')
      } else {
        if (cur.content === null || cur.content === undefined || cur.hash !== op.baseHash) return reject('md_patch_mismatch')
        try {
          text = applyPatch(cur.content, op.patch!)
        } catch {
          return reject('md_patch_mismatch')
        }
        if (sha256HexSync(text) !== op.hash) return reject('md_patch_mismatch')
      }
      next.content = text
      next.hash = op.hash!
      next.size = text.length
      next.contentRev = rev
    }
    this.records.set(op.id, next)
    return ok(next)
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// A device: an editor tree, a store, a workspace and an engine, wired the way store.ts wires them.
// ---------------------------------------------------------------------------------------------------------------------

export interface DeviceOptions {
  deviceId: string
  backend?: string
  canWrite?: boolean
  store?: MemoryDocStore
  /** What a reload read back from the store: the device starts from it instead of from an empty workspace. */
  loaded?: LoadedStore
  notify?: EngineDeps['notify']
  isOnline?: () => boolean
}

export class Device {
  files: FileNode[]
  store: MemoryDocStore
  ws: Workspace
  engine: SyncEngine
  canWrite: boolean
  states: SyncState[] = []
  notes: string[] = []
  writes: (string | null)[] = []
  remote: Set<string>[] = []
  now = 5_000_000

  constructor(readonly server: FakeServer, options: DeviceOptions) {
    this.files = options.loaded ? buildTree(options.loaded.docs) : [{ id: 'root', name: 'My Documents', type: 'folder', children: [] }]
    this.store = options.store ?? new MemoryDocStore()
    this.canWrite = options.canWrite ?? true
    const host: WorkspaceHost = {
      files: () => this.files,
      view: () => ({ currentFileId: null, expandedFolders: [] }),
      applyRemote: (docs, changed) => {
        this.files = buildTree(docs.values())
        this.remote.push(new Set(changed))
      },
      onWrite: (failure) => this.writes.push(failure),
      now: () => this.now
    }
    this.ws = new Workspace(this.store, host, options.loaded?.docs ?? [], options.loaded?.outbox ?? [], Number(options.loaded?.meta.seq ?? 0))
    this.engine = new SyncEngine({
      api: server,
      ws: this.ws,
      backend: options.backend ?? 'json',
      deviceId: options.deviceId,
      canWrite: () => this.canWrite,
      now: () => this.now,
      hash: async (text) => sha256HexSync(text),
      onState: (state) => this.states.push(state),
      notify: options.notify ?? ((message) => this.notes.push(message)),
      isOnline: options.isOnline,
      newId: (prefix) => `${prefix}-${options.deviceId}-${++Device.ids}`,
      manual: true
    })
    this.engine.start()
    // A fresh device starts with its `root` folder as an edit of its own; a reloaded one already has its records.
    if (!options.loaded) this.ws.capture()
  }

  private static ids = 0

  /** A device that starts from a store another one wrote (a page reload): the documents and the outbox come back. */
  static async reload(server: FakeServer, options: DeviceOptions & { store: MemoryDocStore }): Promise<Device> {
    return new Device(server, { ...options, loaded: await options.store.load() })
  }

  // ---- the editor's actions (what store.ts would do to `files`)

  private map(nodes: FileNode[], fn: (node: FileNode) => FileNode | null): FileNode[] {
    return nodes.flatMap((node) => {
      const next = fn(node)
      if (!next) return []
      return [next.children ? { ...next, children: this.map(next.children, fn) } : next]
    })
  }

  addFile(parentId: string, name: string, content: string, id?: string): string {
    const fileId = id ?? `file-${Math.random().toString(36).slice(2, 10)}`
    this.files = this.map(this.files, (node) => (node.id === parentId ? { ...node, children: [...(node.children ?? []), { id: fileId, name, type: 'file', content, parentId }] } : node))
    return fileId
  }

  addFolder(parentId: string, name: string, id?: string): string {
    const folderId = id ?? `folder-${Math.random().toString(36).slice(2, 10)}`
    this.files = this.map(this.files, (node) => (node.id === parentId ? { ...node, children: [...(node.children ?? []), { id: folderId, name, type: 'folder', children: [], parentId }] } : node))
    return folderId
  }

  edit(id: string, content: string): void {
    this.files = this.map(this.files, (node) => (node.id === id ? { ...node, content } : node))
  }

  rename(id: string, name: string): void {
    this.files = this.map(this.files, (node) => (node.id === id ? { ...node, name } : node))
  }

  remove(id: string): void {
    this.files = this.map(this.files, (node) => (node.id === id ? null : node))
  }

  move(id: string, parentId: string): void {
    let moved: FileNode | null = null
    const find = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.id === id) moved = node
        if (node.children) find(node.children)
      }
    }
    find(this.files)
    if (!moved) return
    const node: FileNode = moved
    const without = this.map(this.files, (current) => (current.id === id ? null : current))
    this.files = this.map(without, (current) => (current.id === parentId ? { ...current, children: [...(current.children ?? []), { ...node, parentId }] } : current))
  }

  text(id: string): string | undefined {
    let found: string | undefined
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.id === id) found = node.content
        if (node.children) walk(node.children)
      }
    }
    walk(this.files)
    return found
  }

  has(id: string): boolean {
    return this.ws.docs.has(id) || this.text(id) !== undefined
  }

  name(id: string): string | undefined {
    return this.ws.docs.get(id)?.name
  }

  get doc(): ReadonlyMap<string, LocalDoc> {
    this.ws.capture()
    return this.ws.docs
  }

  async sync(): Promise<SyncState> {
    await this.engine.syncNow()
    return this.engine.state
  }
}
