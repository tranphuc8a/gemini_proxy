import type { LocalDoc, OutboxEntry, Shadow } from './records'
import { buildTree, treeToDocs } from './records'
import { loadFiles, saveFiles, type StorageFailure, isQuotaError } from '../lib/persistence'

/**
 * Where this device keeps its workspace (md-sync F3): the documents, the *shadows* (the text last agreed with the
 * server: the base of every patch and merge), the outbox (what still has to go up) and a few cursors.
 *
 * Three implementations behind one interface:
 *  - `IdbDocStore`  IndexedDB, the default: the workspace no longer has to fit the ~5.24 M characters localStorage takes
 *    on Edge (measured; the sample workspace of 7.4 MB needs 6.4 M);
 *  - `MemoryDocStore`  tests;
 *  - `LocalStorageDocStore`  the fallback when IndexedDB is missing or blocked (a private window): the documents stay in
 *    the v2 key the editor always used, synchronously, and the sync bookkeeping goes to a second key.
 */

export interface ViewState {
  currentFileId: string | null
  expandedFolders: string[]
}

/** One atomic change. `meta` values: a value sets the key, `null` deletes it. */
export interface DocCommit {
  docs?: { put?: LocalDoc[]; delete?: string[] }
  shadows?: { put?: Shadow[]; delete?: string[] }
  outbox?: { put?: OutboxEntry[]; delete?: string[] }
  meta?: Record<string, unknown>
  /** What the localStorage fallback writes beside the documents; the other stores ignore it. */
  view?: ViewState
}

export interface LoadedStore {
  docs: LocalDoc[]
  outbox: OutboxEntry[]
  meta: Record<string, unknown>
}

export interface DocStore {
  readonly kind: 'idb' | 'memory' | 'localstorage'
  load(): Promise<LoadedStore>
  /** The shadows of these ids (those that exist), or of every node when `ids` is null. */
  getShadows(ids: string[] | null): Promise<Map<string, Shadow>>
  getMeta(key: string): Promise<unknown>
  commit(change: DocCommit): Promise<void>
  /** Only the synchronous stores: the same as `commit`, answering at once (the editor reports a failed save in the same tick). */
  commitSync?(change: DocCommit): StorageFailure | null
  /** Forgets shadows, outbox and every `cursor:*` / `reconciled:*` key: the next sync starts from a reconcile. */
  wipeSync(): Promise<void>
  close(): void
}

export const SYNC_META_PREFIXES = ['cursor:', 'reconciled:'] as const
const isSyncMetaKey = (key: string) => SYNC_META_PREFIXES.some((prefix) => key.startsWith(prefix))

/** A failure of a store write, as the editor classifies it. */
export function failureOf(error: unknown): StorageFailure {
  return isQuotaError(error) ? 'quota' : 'unavailable'
}

function applyMeta(meta: Record<string, unknown>, change: Record<string, unknown> | undefined) {
  if (!change) return
  for (const [key, value] of Object.entries(change)) {
    if (value === null || value === undefined) delete meta[key]
    else meta[key] = value
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------------------------------------------------

export class MemoryDocStore implements DocStore {
  readonly kind = 'memory' as const
  docs = new Map<string, LocalDoc>()
  shadows = new Map<string, Shadow>()
  outbox = new Map<string, OutboxEntry>()
  meta: Record<string, unknown> = {}
  /** Tests: make the next commits fail with this error. */
  failWith: unknown = null
  /** Tests: every commit, in order. */
  commits: DocCommit[] = []

  async load(): Promise<LoadedStore> {
    return { docs: [...this.docs.values()], outbox: [...this.outbox.values()], meta: { ...this.meta } }
  }

  async getShadows(ids: string[] | null): Promise<Map<string, Shadow>> {
    if (ids === null) return new Map(this.shadows)
    const out = new Map<string, Shadow>()
    for (const id of ids) {
      const shadow = this.shadows.get(id)
      if (shadow) out.set(id, shadow)
    }
    return out
  }

  async getMeta(key: string): Promise<unknown> {
    return this.meta[key]
  }

  async commit(change: DocCommit): Promise<void> {
    if (this.failWith) throw this.failWith
    this.commits.push(change)
    for (const doc of change.docs?.put ?? []) this.docs.set(doc.id, doc)
    for (const id of change.docs?.delete ?? []) this.docs.delete(id)
    for (const shadow of change.shadows?.put ?? []) this.shadows.set(shadow.id, shadow)
    for (const id of change.shadows?.delete ?? []) this.shadows.delete(id)
    for (const entry of change.outbox?.put ?? []) this.outbox.set(entry.id, entry)
    for (const id of change.outbox?.delete ?? []) this.outbox.delete(id)
    applyMeta(this.meta, change.meta)
  }

  async wipeSync(): Promise<void> {
    this.shadows.clear()
    this.outbox.clear()
    for (const key of Object.keys(this.meta)) if (isSyncMetaKey(key)) delete this.meta[key]
  }

  close(): void {}
}

// ---------------------------------------------------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------------------------------------------------

const DB_NAME = 'markdown-editor'
const DB_VERSION = 1
const OPEN_TIMEOUT_MS = 5000

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new DOMException('The transaction was aborted', 'AbortError'))
  })
}

export class IdbDocStore implements DocStore {
  readonly kind = 'idb' as const

  constructor(private readonly db: IDBDatabase) {}

  async load(): Promise<LoadedStore> {
    const tx = this.db.transaction(['docs', 'outbox', 'meta'], 'readonly')
    const [docs, outbox, rows] = await Promise.all([
      request(tx.objectStore('docs').getAll() as IDBRequest<LocalDoc[]>),
      request(tx.objectStore('outbox').getAll() as IDBRequest<OutboxEntry[]>),
      request(tx.objectStore('meta').getAll() as IDBRequest<{ k: string; v: unknown }[]>)
    ])
    const meta: Record<string, unknown> = {}
    for (const row of rows) meta[row.k] = row.v
    return { docs, outbox, meta }
  }

  async getShadows(ids: string[] | null): Promise<Map<string, Shadow>> {
    const tx = this.db.transaction('shadows', 'readonly')
    const store = tx.objectStore('shadows')
    const out = new Map<string, Shadow>()
    if (ids === null) {
      for (const shadow of await request(store.getAll() as IDBRequest<Shadow[]>)) out.set(shadow.id, shadow)
      return out
    }
    const found = await Promise.all(ids.map((id) => request(store.get(id) as IDBRequest<Shadow | undefined>)))
    for (const shadow of found) if (shadow) out.set(shadow.id, shadow)
    return out
  }

  async getMeta(key: string): Promise<unknown> {
    const row = await request(this.db.transaction('meta', 'readonly').objectStore('meta').get(key) as IDBRequest<{ k: string; v: unknown } | undefined>)
    return row?.v
  }

  async commit(change: DocCommit): Promise<void> {
    const names: string[] = []
    if (change.docs) names.push('docs')
    if (change.shadows) names.push('shadows')
    if (change.outbox) names.push('outbox')
    if (change.meta) names.push('meta')
    if (!names.length) return
    const tx = this.db.transaction(names, 'readwrite')
    const done = finished(tx)
    if (change.docs) {
      const store = tx.objectStore('docs')
      for (const doc of change.docs.put ?? []) store.put(doc)
      for (const id of change.docs.delete ?? []) store.delete(id)
    }
    if (change.shadows) {
      const store = tx.objectStore('shadows')
      for (const shadow of change.shadows.put ?? []) store.put(shadow)
      for (const id of change.shadows.delete ?? []) store.delete(id)
    }
    if (change.outbox) {
      const store = tx.objectStore('outbox')
      for (const entry of change.outbox.put ?? []) store.put(entry)
      for (const id of change.outbox.delete ?? []) store.delete(id)
    }
    if (change.meta) {
      const store = tx.objectStore('meta')
      for (const [key, value] of Object.entries(change.meta)) {
        if (value === null || value === undefined) store.delete(key)
        else store.put({ k: key, v: value })
      }
    }
    await done
  }

  async wipeSync(): Promise<void> {
    const tx = this.db.transaction(['shadows', 'outbox', 'meta'], 'readwrite')
    const done = finished(tx)
    tx.objectStore('shadows').clear()
    tx.objectStore('outbox').clear()
    const meta = tx.objectStore('meta')
    const keys = await request(meta.getAllKeys())
    for (const key of keys) if (typeof key === 'string' && isSyncMetaKey(key)) meta.delete(key)
    await done
  }

  close(): void {
    this.db.close()
  }
}

/** Opens (creating on first use) the editor's IndexedDB; rejects when the browser has none, blocks it, or does not answer. */
export function openIdbDocStore(name: string = DB_NAME): Promise<IdbDocStore> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const timer = setTimeout(() => reject(new Error('IndexedDB did not answer')), OPEN_TIMEOUT_MS)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(name, DB_VERSION)
    } catch (error) {
      clearTimeout(timer)
      reject(error)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('docs', { keyPath: 'id' })
      db.createObjectStore('shadows', { keyPath: 'id' })
      db.createObjectStore('outbox', { keyPath: 'id' })
      db.createObjectStore('meta', { keyPath: 'k' })
    }
    req.onsuccess = () => {
      clearTimeout(timer)
      const db = req.result
      // Another tab upgrading the schema must not be held up by this one.
      db.onversionchange = () => db.close()
      resolve(new IdbDocStore(db))
    }
    req.onerror = () => {
      clearTimeout(timer)
      reject(req.error)
    }
    req.onblocked = () => {
      clearTimeout(timer)
      reject(new Error('IndexedDB is blocked by another tab'))
    }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// localStorage fallback
// ---------------------------------------------------------------------------------------------------------------------

/** The sync bookkeeping of the fallback; the documents themselves stay in `FILES_KEY` (v2). */
export const SYNC_KEY = 'markdown-editor:sync'
/** Over this a shadow keeps its hash but not its text in the fallback (the quota is small); with no text there is no base. */
export const FALLBACK_SHADOW_TEXT_MAX = 32 * 1024

interface SyncPayload {
  version: 1
  shadows: Record<string, Shadow>
  outbox: Record<string, OutboxEntry>
  meta: Record<string, unknown>
}

function readSyncPayload(): SyncPayload {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<SyncPayload>) : null
    if (parsed && parsed.version === 1 && parsed.shadows && parsed.outbox && parsed.meta) return parsed as SyncPayload
  } catch {
    /* unreadable: start over, a reconcile repairs it */
  }
  return { version: 1, shadows: {}, outbox: {}, meta: {} }
}

export class LocalStorageDocStore implements DocStore {
  readonly kind = 'localstorage' as const
  private docs = new Map<string, LocalDoc>()
  private view: ViewState = { currentFileId: null, expandedFolders: [] }
  private sync: SyncPayload

  constructor(preloaded?: ReturnType<typeof loadFiles>) {
    const stored = preloaded === undefined ? loadFiles() : preloaded
    if (stored && !stored.partial) {
      for (const doc of treeToDocs(stored.files, 0)) this.docs.set(doc.id, doc)
      this.view = { currentFileId: stored.currentFileId, expandedFolders: stored.expandedFolders }
    }
    this.sync = readSyncPayload()
  }

  async load(): Promise<LoadedStore> {
    return this.loadSync()
  }

  /** `load` without the promise: the fallback is synchronous end to end, which keeps the editor's start-up synchronous too. */
  loadSync(): LoadedStore {
    return { docs: [...this.docs.values()], outbox: Object.values(this.sync.outbox), meta: { ...this.sync.meta } }
  }

  async getShadows(ids: string[] | null): Promise<Map<string, Shadow>> {
    const out = new Map<string, Shadow>()
    for (const [id, shadow] of Object.entries(this.sync.shadows)) if (ids === null || ids.includes(id)) out.set(id, shadow)
    return out
  }

  async getMeta(key: string): Promise<unknown> {
    return this.sync.meta[key]
  }

  async commit(change: DocCommit): Promise<void> {
    const failure = this.commitSync(change)
    if (failure) throw Object.assign(new Error('localStorage refused the write'), failure === 'quota' ? { name: 'QuotaExceededError' } : {})
  }

  commitSync(change: DocCommit): StorageFailure | null {
    let failure: StorageFailure | null = null
    if (change.docs) {
      for (const doc of change.docs.put ?? []) this.docs.set(doc.id, doc)
      for (const id of change.docs.delete ?? []) this.docs.delete(id)
      if (change.view) this.view = change.view
      failure = saveFiles({ files: buildTree(this.docs.values()), currentFileId: this.view.currentFileId, expandedFolders: this.view.expandedFolders })
    }
    if (change.shadows || change.outbox || change.meta) {
      for (const shadow of change.shadows?.put ?? []) {
        this.sync.shadows[shadow.id] = shadow.content !== null && shadow.content.length > FALLBACK_SHADOW_TEXT_MAX ? { ...shadow, content: null } : shadow
      }
      for (const id of change.shadows?.delete ?? []) delete this.sync.shadows[id]
      for (const entry of change.outbox?.put ?? []) this.sync.outbox[entry.id] = entry
      for (const id of change.outbox?.delete ?? []) delete this.sync.outbox[id]
      applyMeta(this.sync.meta, change.meta)
      failure = this.writeSync() ?? failure
    }
    return failure
  }

  async wipeSync(): Promise<void> {
    this.sync.shadows = {}
    this.sync.outbox = {}
    for (const key of Object.keys(this.sync.meta)) if (isSyncMetaKey(key)) delete this.sync.meta[key]
    this.writeSync()
  }

  private writeSync(): StorageFailure | null {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify(this.sync))
      return null
    } catch (error) {
      return failureOf(error)
    }
  }

  close(): void {}
}

