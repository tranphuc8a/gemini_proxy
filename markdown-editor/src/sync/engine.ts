import { sha256Hex } from '../lib/hash'
import { createId } from '../lib/id'
import { KNOWN_WELCOME_SHA256 } from '../lib/welcome'
import { SyncError, type PushOp, type PushResult, type SyncApi } from '../services/markdownSync'
import { PATCH_MIN_CHARS, makePatch, merge3 } from './lineDiff'
import { ROOT_ID, type LocalDoc, type OutboxEntry, type ServerRecord, type Shadow } from './records'
import { utf8Length, wellFormed } from './text'
import type { Workspace } from './workspace'

/**
 * The sync loop (md-sync F6, F7): push what changed here, pull what changed elsewhere, merge what both changed.
 *
 * Vocabulary: L = this device's node (the workspace baseline), S = its *shadow* (the node as last agreed with the server:
 * the base of every patch and merge), R = a record from the server, "dirty" = the node is in the outbox.
 *
 * Rules (md-sync §3.4, §3.7.3):
 *  - a push op carries `baseRev = S.rev`; the server applies it only to that revision, or merges parts that do not clash;
 *  - nothing is "newest wins": a clash comes back as a conflict record and is merged here, line by line against S;
 *    the same lines changed two ways wait for the person (Sync → Conflicts);
 *  - an edit beats a delete, on either side; a rename or a move needs no tombstone (the id is the identity);
 *  - what the server tells us twice (`R.rev <= S.rev`) is ignored, so the cursor's lag and echoes of our own writes are harmless.
 * Every write to the workspace goes through `Workspace` (commitRemote / apply), which refuses a change made against a
 * node the person has edited since it was read: the cycle then simply reads again.
 */

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'offline' | 'error' | 'private' | 'reconcile'

export interface ConflictInfo {
  id: string
  name: string
}

export interface BlockedInfo {
  id: string
  name: string
  code: string
  message: string
}

/** The first meeting of this device with this server's documents, laid out for the person to look at. */
export interface ReconcilePlan {
  reason: 'first' | 'reset'
  same: number
  /** Only here: they will be uploaded. */
  uploads: { id: string; name: string }[]
  /** Only on the server: they will be downloaded. */
  downloads: { id: string; name: string }[]
  /** On both, with different texts and no common base. */
  differ: { id: string; name: string }[]
}

export type ReconcileChoice = { differ: 'both' | 'server' | 'local'; deleteServerOnly: boolean } | 'cancel'

export interface SyncState {
  phase: SyncPhase
  /** Nodes still to push (not counting conflicts and blocked ones). */
  pending: number
  lastSync: number | null
  error: string | null
  conflicts: ConflictInfo[]
  blocked: BlockedInfo[]
  reconcile: ReconcilePlan | null
  /** This device cannot write to the server (not an administrator): it only pulls. */
  readOnly: boolean
}

export interface EngineDeps {
  api: SyncApi
  ws: Workspace
  /** Names the cursor: every storage backend of the server is a separate place. */
  backend: string
  deviceId: string
  canWrite(): boolean
  now?(): number
  onState?(state: SyncState): void
  /** A sentence for the person (a toast). */
  notify?(message: string, tone: 'info' | 'error'): void
  /** The person cancelled the first reconcile: sync should be switched off. */
  onCancel?(): void
  /** The server refused our credentials: the host may want to re-check the admin session. */
  onAuthProblem?(): void
  newId?(prefix: string): string
  hash?(text: string): Promise<string>
  /** Test hooks: connectivity, and `manual` = no timers, no listeners (a test drives every cycle with `syncNow`). */
  isOnline?(): boolean
  manual?: boolean
}

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/
const MAX_NAME = 255
/** Nodes per push: a far database costs a few round trips per op, and a serverless function has a time limit. */
const MAX_OPS = 50
const MAX_PUSH_BYTES = 3_500_000
const MAX_DOC_BYTES = 3_500_000
const MAX_ROUNDS = 40
const MAX_PAGES = 1000
const PAGE_LIMIT = 200
const SETTLE_MS = 3000
const POLL_MS = 90_000
const STALE_MS = 60_000
const BACKOFF_START_MS = 15_000
const BACKOFF_MAX_MS = 300_000

const cursorKey = (backend: string) => `cursor:${backend}`
const reconciledKey = (backend: string) => `reconciled:${backend}`

interface Note {
  message: string
  tone: 'info' | 'error'
}

interface Plan {
  docsPut: Map<string, LocalDoc>
  docsDelete: Set<string>
  shadowsPut: Map<string, Shadow>
  shadowsDelete: Set<string>
  outboxPut: Map<string, OutboxEntry>
  outboxDelete: Set<string>
  /** What the plan read of each node: the commit only goes through if the workspace still holds exactly that. */
  expect: Map<string, LocalDoc | null>
  versions: Map<string, number>
  notes: Note[]
}

const emptyPlan = (): Plan => ({
  docsPut: new Map(),
  docsDelete: new Set(),
  shadowsPut: new Map(),
  shadowsDelete: new Set(),
  outboxPut: new Map(),
  outboxDelete: new Set(),
  expect: new Map(),
  versions: new Map(),
  notes: []
})

function shadowFromRecord(record: ServerRecord, text: string | null): Shadow {
  return {
    id: record.id,
    kind: record.kind,
    parentId: record.parentId,
    name: record.name,
    content: record.kind === 'file' ? text ?? '' : null,
    hash: record.kind === 'file' ? record.hash : '',
    rev: record.rev,
    contentRev: record.contentRev,
    metaRev: record.metaRev,
    deleted: false
  }
}

function tombstoneOf(record: ServerRecord): Shadow {
  return {
    id: record.id,
    kind: record.kind,
    parentId: record.parentId,
    name: record.name,
    content: null,
    hash: '',
    rev: record.rev,
    contentRev: record.contentRev,
    metaRev: record.metaRev,
    deleted: true
  }
}

function docFromRecord(record: ServerRecord, text: string | null, now: number): LocalDoc {
  return {
    id: record.id,
    kind: record.kind,
    parentId: record.parentId,
    name: record.name,
    content: record.kind === 'file' ? text ?? '' : null,
    updatedAt: record.updatedAt || now
  }
}

/** True when the shadow already holds everything the record says (a duplicate or an echo of our own write). */
function knows(shadow: Shadow, record: ServerRecord): boolean {
  return record.rev <= shadow.rev && record.contentRev <= shadow.contentRev && record.metaRev <= shadow.metaRev && record.deleted === shadow.deleted
}

function badName(name: string): boolean {
  // eslint-disable-next-line no-control-regex
  return !name.trim() || name.length > MAX_NAME || name.includes('/') || /[\u0000-\u001f\u007f]/.test(name)
}

/** "notes (this device).md" for "notes.md" -- the copy a first meeting or a conflict keeps beside the server's version. */
export function copyName(name: string, label: string): string {
  const match = /^(.*?)(\.[^.]+)?$/.exec(name)
  const base = match?.[1] || name
  return `${base} (${label})${match?.[2] ?? ''}`
}

export class SyncEngine {
  private readonly deps: EngineDeps
  private readonly now: () => number
  private readonly hashText: (text: string) => Promise<string>
  private readonly newId: (prefix: string) => string
  private current: SyncState = {
    phase: 'off', pending: 0, lastSync: null, error: null, conflicts: [], blocked: [], reconcile: null, readOnly: false
  }
  private active = false
  private running: Promise<void> | null = null
  private again = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private poll: ReturnType<typeof setInterval> | null = null
  private failures = 0
  private reconcileAnswer: ((choice: ReconcileChoice) => void) | null = null
  private cache = new Map<string, string>()
  private listeners: (() => void)[] = []

  constructor(deps: EngineDeps) {
    this.deps = deps
    this.now = deps.now ?? (() => Date.now())
    this.hashText = deps.hash ?? sha256Hex
    this.newId = deps.newId ?? createId
  }

  get state(): SyncState {
    return this.current
  }

  private get ws(): Workspace {
    return this.deps.ws
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------------------------------------------------

  start(): void {
    if (this.active) return
    this.active = true
    this.publish({ phase: 'idle', error: null })
    if (this.deps.manual) return
    if (typeof window !== 'undefined') {
      const onOnline = () => this.schedule(500)
      const onVisible = () => {
        if (document.visibilityState === 'visible' && (this.current.lastSync === null || this.now() - this.current.lastSync > STALE_MS)) this.schedule(200)
      }
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onVisible)
      this.listeners.push(
        () => window.removeEventListener('online', onOnline),
        () => document.removeEventListener('visibilitychange', onVisible)
      )
    }
    this.poll = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') this.schedule(0)
    }, POLL_MS)
    this.schedule(0)
  }

  stop(): void {
    this.active = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    for (const off of this.listeners) off()
    this.listeners = []
    this.reconcileAnswer?.('cancel')
    this.publish({ phase: 'off', reconcile: null, error: null })
  }

  /** A change was saved here: sync shortly after typing settles. */
  poke(delayMs: number = SETTLE_MS): void {
    if (this.active) this.schedule(delayMs)
  }

  /** "Sync now": resolves when a cycle that began after this call -- and any follow-up it asked for -- has finished. */
  async syncNow(): Promise<void> {
    for (let turn = 0; turn < 6 && this.active; turn += 1) {
      this.again = false
      await this.runNow()
      if (!this.again) return
    }
  }

  private schedule(delayMs: number): void {
    if (!this.active || this.deps.manual) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.syncNow()
    }, delayMs)
  }

  /** The admin session changed under a running engine (it may now push, or must stop). */
  refresh(): void {
    this.schedule(0)
  }

  private runNow(): Promise<void> {
    if (!this.active) return Promise.resolve()
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.cycle().finally(() => {
      this.running = null
    })
    return this.running
  }

  private publish(patch: Partial<SyncState>): void {
    this.current = { ...this.current, ...patch }
    this.deps.onState?.(this.current)
  }

  private refreshCounts(): void {
    const entries = this.deps.ws.outboxEntries()
    const pending = entries.filter((entry) => !entry.conflict && !entry.blocked).length
    const conflicts = entries.filter((entry) => entry.conflict).map((entry) => ({ id: entry.id, name: this.deps.ws.docs.get(entry.id)?.name ?? entry.conflict?.name ?? entry.id }))
    const blocked = entries
      .filter((entry) => entry.blocked && !entry.conflict)
      .map((entry) => ({ id: entry.id, name: this.deps.ws.docs.get(entry.id)?.name ?? entry.id, code: entry.blocked!, message: blockedMessage(entry.blocked!) }))
    this.publish({ pending, conflicts, blocked, readOnly: !this.deps.canWrite() })
  }

  // -------------------------------------------------------------------------------------------------------------------
  // One cycle
  // -------------------------------------------------------------------------------------------------------------------

  private async cycle(): Promise<void> {
    const { ws, deps } = this
    if (this.current.phase === 'reconcile') return
    this.publish({ phase: 'syncing', error: null })
    try {
      await ws.flush()
      const cursor = await ws.store.getMeta(cursorKey(deps.backend))
      if (typeof cursor !== 'number') {
        await this.reconcile('first')
      } else {
        for (let round = 0; round < 6; round += 1) {
          if (deps.canWrite()) await this.pushAll()
          const moved = await this.pullAll()
          if (!moved) break
        }
      }
      this.failures = 0
      this.refreshCounts()
      this.publish({ phase: 'idle', lastSync: this.now(), error: null })
    } catch (error) {
      this.refreshCounts()
      this.fail(error)
    }
  }

  private fail(error: unknown): void {
    if (error instanceof ReconcileCancelled) {
      this.stop()
      this.deps.onCancel?.()
      return
    }
    const sync = error instanceof SyncError ? error : null
    const message = error instanceof Error ? error.message : 'Sync failed'
    if (sync?.code === 'markdown_private' || (sync?.status === 403 && !this.deps.canWrite())) {
      // Nobody to blame and nothing to retry until the person unlocks admin mode (`refresh`).
      this.publish({ phase: 'private', error: message })
      return
    }
    if (sync && (sync.status === 401 || sync.status === 403)) this.deps.onAuthProblem?.()
    const offline = sync?.offline === true || this.deps.isOnline?.() === false
    this.publish({ phase: offline ? 'offline' : 'error', error: message })
    this.failures += 1
    if (offline && typeof navigator !== 'undefined' && navigator.onLine === false) return // the `online` event wakes it
    const backoff = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** Math.min(this.failures - 1, 5))
    const waitMs = Math.max(backoff, (sync?.retryAfter ?? 0) * 1000)
    if (sync?.code === 'md_migrating' || sync?.code === 'md_busy') this.schedule(Math.max((sync.retryAfter ?? 2) * 1000, 1000))
    else this.schedule(waitMs)
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Hashing
  // -------------------------------------------------------------------------------------------------------------------

  /** SHA-256 of the text the way it is sent (well-formed UTF-8); a few recent ones are remembered. */
  private async hashOf(text: string): Promise<string> {
    const clean = wellFormed(text)
    const known = this.cache.get(clean)
    if (known) return known
    const hash = await this.hashText(clean)
    if (this.cache.size > 24) this.cache.clear()
    this.cache.set(clean, hash)
    return hash
  }

  private async textDirty(doc: LocalDoc, shadow: Shadow | null): Promise<boolean> {
    if (doc.kind === 'folder') return false
    if (!shadow || shadow.deleted) return true
    return (await this.hashOf(doc.content ?? '')) !== shadow.hash
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Push
  // -------------------------------------------------------------------------------------------------------------------

  private async shadowsOf(ids: string[]): Promise<Map<string, Shadow>> {
    await this.deps.ws.drain()
    return this.deps.ws.store.getShadows(ids)
  }

  /** Pushes the outbox, a batch at a time, until nothing is left that can go. */
  private async pushAll(): Promise<void> {
    const { ws, deps } = this
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      ws.capture()
      const entries = ws.outboxEntries().filter((entry) => !entry.conflict && !entry.blocked)
      if (!entries.length) return

      const shadows = await this.shadowsOf(entries.map((entry) => entry.id))
      const batch = await this.buildOps(entries, shadows)
      if (batch.drop.length || batch.block.length) {
        await ws.apply(
          { outbox: { delete: batch.drop.map((entry) => entry.id), put: batch.block.map(({ entry, code }) => ({ ...entry, blocked: code })) } },
          new Map(batch.drop.map((entry) => [entry.id, entry.version]))
        )
      }
      if (!batch.ops.length) {
        if (batch.more) continue
        return
      }

      const response = await deps.api.push({ device: deps.deviceId, ops: batch.ops.map((sent) => sent.op) })
      const results = response.results
      const shadowPut: Shadow[] = []
      const outboxDelete: string[] = []
      const versions = new Map<string, number>()
      const outboxPut: OutboxEntry[] = []
      const conflicted: ServerRecord[] = []
      let resend = false

      batch.ops.forEach((sent, index) => {
        const result: PushResult | undefined = results[index]
        if (!result || result.id !== sent.op.id) return
        if (result.status === 'ok') {
          shadowPut.push(this.shadowAfterPush(sent, result))
          outboxDelete.push(sent.entry.id)
          versions.set(sent.entry.id, sent.entry.version)
        } else if (result.status === 'conflict') {
          conflicted.push({ ...result.record, ...(result.contentOmitted ? { contentOmitted: true } : {}) })
        } else if (result.code === 'md_patch_mismatch' || result.code === 'md_hash_mismatch') {
          // The base moved under us (or a patch misfired): the whole text, next time.
          outboxPut.push({ ...sent.entry, forceFull: true })
          resend = true
        } else {
          outboxPut.push({ ...sent.entry, blocked: result.code })
        }
      })
      if (shadowPut.length || outboxDelete.length || outboxPut.length) {
        await ws.apply({ shadows: { put: shadowPut }, outbox: { put: outboxPut, delete: outboxDelete } }, versions)
      }
      if (conflicted.length) await this.applyRecords(conflicted)
      this.refreshCounts()
      if (!resend && !batch.more && !conflicted.length) return
    }
  }

  /**
   * The shadow after the server accepted an op: what the op said is now agreed, what it did not say is NOT (the server may
   * have merged another device's rename or edit meanwhile, and never echoes it). So the text, name and place keep their old
   * base and revision unless this op carried them -- the next pull then still counts the other device's change as news.
   */
  private shadowAfterPush(sent: SentOp, result: Extract<PushResult, { status: 'ok' }>): Shadow {
    const { doc, shadow, text, hash, deleting, op } = sent
    if (deleting) {
      const kind = shadow?.kind ?? doc?.kind ?? 'file'
      return { id: op.id, kind, parentId: shadow?.parentId ?? null, name: shadow?.name ?? '', content: null, hash: '', rev: result.rev, contentRev: result.contentRev, metaRev: result.metaRev, deleted: true }
    }
    const node = doc as LocalDoc
    const fresh = !shadow || shadow.deleted
    const setName = fresh || op.set?.name !== undefined
    const setParent = fresh || op.set?.parentId !== undefined
    const sentText = op.content !== undefined || op.patch !== undefined
    const keepText = node.kind === 'file' && !fresh && !sentText
    return {
      id: node.id,
      kind: node.kind,
      parentId: setParent ? node.parentId : shadow!.parentId,
      name: setName ? node.name : shadow!.name,
      content: node.kind === 'file' ? (keepText ? shadow!.content : text) : null,
      hash: node.kind === 'file' ? (keepText ? shadow!.hash : hash) : '',
      rev: result.rev,
      contentRev: node.kind === 'file' && keepText ? shadow!.contentRev : result.contentRev,
      metaRev: setName || setParent ? result.metaRev : shadow!.metaRev,
      deleted: false
    }
  }

  private async buildOps(entries: OutboxEntry[], shadows: Map<string, Shadow>): Promise<BuiltOps> {
    const { ws } = this
    const built: BuiltOps = { ops: [], drop: [], block: [], more: false }
    let bytes = 0
    for (const entry of entries) {
      if (built.ops.length >= MAX_OPS || bytes >= MAX_PUSH_BYTES) {
        built.more = true
        break
      }
      const doc = ws.docs.get(entry.id) ?? null
      const shadow = shadows.get(entry.id) ?? null

      if (!doc) {
        // Deleted here. Never reached the server, or already deleted there: nothing to say.
        if (!shadow || shadow.deleted) {
          built.drop.push(entry)
          continue
        }
        built.ops.push({
          op: { id: entry.id, kind: shadow.kind, baseRev: shadow.contentRev, deleted: true, updatedAt: this.now() },
          entry, doc: null, shadow, text: null, hash: '', deleting: true
        })
        continue
      }

      if (!ID_PATTERN.test(doc.id) || (doc.parentId !== null && !ID_PATTERN.test(doc.parentId))) {
        built.block.push({ entry, code: 'md_bad_id' })
        continue
      }
      if (badName(doc.name)) {
        built.block.push({ entry, code: 'md_bad_name' })
        continue
      }

      const revive = Boolean(shadow?.deleted)
      const set: { name?: string; parentId?: string | null } = {}
      if (!shadow || revive || shadow.name !== doc.name) set.name = doc.name
      if (!shadow || revive || shadow.parentId !== doc.parentId) set.parentId = doc.parentId
      const op: PushOp = { id: doc.id, kind: doc.kind, baseRev: 0, updatedAt: doc.updatedAt }
      let text: string | null = null
      let hash = ''

      if (doc.kind === 'file') {
        text = wellFormed(doc.content ?? '')
        if (utf8Length(text) > MAX_DOC_BYTES) {
          built.block.push({ entry, code: 'md_doc_too_large' })
          continue
        }
        hash = await this.hashOf(text)
        if (!shadow || revive || shadow.hash !== hash) {
          const patch =
            !entry.forceFull && shadow && !revive && shadow.content !== null && text.length > PATCH_MIN_CHARS ? makePatch(shadow.content, text) : null
          if (patch) {
            op.patch = patch
            op.baseHash = shadow!.hash
          } else {
            op.content = text
          }
          op.hash = hash
          bytes += patch ? JSON.stringify(patch).length : text.length
        }
      }
      if (revive) op.deleted = false
      const changesText = op.content !== undefined || op.patch !== undefined
      const changesMeta = Object.keys(set).length > 0
      if (!changesText && !changesMeta && !revive) {
        built.drop.push(entry)
        continue
      }
      if (changesMeta) op.set = set
      // The server judges the text against `contentRev` and the name/place against `metaRev`: say how far we know each,
      // for the parts this op touches (an unrelated change on the server then merges instead of clashing).
      if (shadow) op.baseRev = Math.max(changesText || revive ? shadow.contentRev : 0, changesMeta ? shadow.metaRev : 0)
      built.ops.push({ op, entry, doc, shadow, text, hash, deleting: false })
    }
    return built
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Pull
  // -------------------------------------------------------------------------------------------------------------------

  /** Pulls every page after the cursor. Returns whether a merge left something to push again. */
  private async pullAll(): Promise<boolean> {
    const { ws, deps } = this
    let since = (await ws.store.getMeta(cursorKey(deps.backend))) as number
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await deps.api.changes({ since, limit: PAGE_LIMIT, device: deps.deviceId })
      if (response.reset) {
        await this.reconcile('reset')
        return false
      }
      if (response.items.length) await this.applyRecords(response.items)
      since = Math.max(since, response.cursor)
      await ws.apply({ meta: { [cursorKey(deps.backend)]: since } })
      if (!response.more) break
    }
    ws.capture()
    return ws.outboxEntries().some((entry) => !entry.conflict && !entry.blocked) && deps.canWrite()
  }

  /** The record with its text in hand (fetched with `GET /docs/{id}` when the server left it out); null if it vanished meanwhile. */
  private async complete(record: ServerRecord, shadow: Shadow | null): Promise<ServerRecord | null> {
    if (record.deleted || record.kind === 'folder') return record
    if (typeof record.content === 'string' && !record.contentOmitted) return record
    if (shadow && !shadow.deleted && shadow.content !== null && shadow.hash === record.hash) return { ...record, content: shadow.content, contentOmitted: false }
    try {
      const full = await this.deps.api.getDoc(record.id)
      return typeof full.content === 'string' ? full : { ...full, content: '' }
    } catch (error) {
      if (error instanceof SyncError && error.status === 404) return null
      throw error
    }
  }

  /** Applies a batch of server records (a pull page, or the conflicts of a push) to the workspace as one commit. */
  private async applyRecords(records: ServerRecord[]): Promise<void> {
    const { ws } = this
    for (let attempt = 0; attempt < 4; attempt += 1) {
      ws.capture()
      const shadows = await this.shadowsOf(records.map((record) => record.id))
      const plan = emptyPlan()
      for (const original of records) {
        const shadow = shadows.get(original.id) ?? null
        if (shadow && knows(shadow, original)) continue
        const record = await this.complete(original, shadow)
        if (!record) continue
        const doc = ws.docs.get(record.id) ?? null
        const entry = ws.outboxEntry(record.id) ?? null
        plan.expect.set(record.id, doc)
        if (entry) plan.versions.set(record.id, entry.version)
        await this.planOne(plan, record, shadow, doc, entry)
      }
      if (!plan.expect.size || (await this.commitPlan(plan))) {
        for (const note of plan.notes) this.deps.notify?.(note.message, note.tone)
        this.refreshCounts()
        return
      }
    }
    // The person kept typing into the very nodes this batch touches: the next cycle reads them again.
    this.again = true
  }

  private async commitPlan(plan: Plan): Promise<boolean> {
    return this.deps.ws.commitRemote(
      {
        docs: { put: [...plan.docsPut.values()], delete: [...plan.docsDelete] },
        shadows: { put: [...plan.shadowsPut.values()], delete: [...plan.shadowsDelete] },
        outbox: { put: [...plan.outboxPut.values()], delete: [...plan.outboxDelete] }
      },
      plan.expect,
      plan.versions
    )
  }

  /** What one server record does to this device's node. See the rules at the top of the file. */
  private async planOne(plan: Plan, record: ServerRecord, shadow: Shadow | null, doc: LocalDoc | null, entry: OutboxEntry | null): Promise<void> {
    const id = record.id
    const now = this.now()
    const text = record.kind === 'file' ? record.content ?? '' : null
    const label = doc?.name ?? record.name

    if (doc && doc.kind !== record.kind) {
      // The same id as a file here and a folder there: the server's word stands.
      plan.docsPut.set(id, docFromRecord(record, text, now))
      plan.shadowsPut.set(id, record.deleted ? tombstoneOf(record) : shadowFromRecord(record, text))
      plan.outboxDelete.add(id)
      return
    }

    if (record.deleted) {
      if (!doc) {
        plan.shadowsPut.set(id, tombstoneOf(record))
        plan.outboxDelete.add(id)
        return
      }
      if (!entry || !(await this.textDirty(doc, shadow))) {
        plan.docsDelete.add(id)
        plan.shadowsPut.set(id, tombstoneOf(record))
        plan.outboxDelete.add(id)
        return
      }
      // Deleted over there, edited here: the edit wins. The tombstone becomes the base, the node is sent again to revive it.
      plan.shadowsPut.set(id, tombstoneOf(record))
      plan.outboxPut.set(id, { id, version: entry.version })
      plan.notes.push({ message: `“${label}” was deleted on another device, but you changed it here — it was kept.`, tone: 'info' })
      return
    }

    if (!doc) {
      if (entry && shadow && !shadow.deleted && record.contentRev <= shadow.contentRev) {
        // Deleted here, only renamed or moved over there: the delete stands, sent again on top of their revision.
        plan.shadowsPut.set(id, shadowFromRecord(record, shadow.content))
        return
      }
      plan.docsPut.set(id, docFromRecord(record, text, now))
      plan.shadowsPut.set(id, shadowFromRecord(record, text))
      plan.outboxDelete.add(id)
      return
    }

    if (!entry) {
      const next = docFromRecord(record, text, now)
      if (doc.name !== next.name || doc.parentId !== next.parentId || doc.content !== next.content) plan.docsPut.set(id, next)
      plan.shadowsPut.set(id, shadowFromRecord(record, text))
      return
    }

    // Changed here too. The name and the place are judged field by field against the shadow: what this device did not change
    // follows the server, what it did change is mine (and the shadow moves up to the server's revision, so it is sent again).
    const agreed = shadow && !shadow.deleted ? shadow : null
    const name = agreed && doc.name === agreed.name ? record.name : doc.name
    const parentId = agreed && doc.parentId === agreed.parentId ? record.parentId : doc.parentId
    const settled = (content: string | null): LocalDoc => ({ ...doc, name, parentId, content, updatedAt: now })
    const put = (next: LocalDoc) => {
      if (next.name !== doc.name || next.parentId !== doc.parentId || next.content !== doc.content) plan.docsPut.set(id, next)
    }

    if (record.kind === 'folder') {
      put(settled(null))
      plan.shadowsPut.set(id, shadowFromRecord(record, null))
      return
    }
    const textMoved = !shadow || shadow.deleted || record.contentRev > shadow.contentRev
    if (!textMoved) {
      put(settled(doc.content))
      plan.shadowsPut.set(id, shadowFromRecord(record, shadow!.content))
      return
    }
    const mine = doc.content ?? ''
    const mineHash = await this.hashOf(mine)
    if (mineHash === record.hash) {
      put(settled(doc.content))
      plan.shadowsPut.set(id, shadowFromRecord(record, text))
      return
    }
    if (shadow && !shadow.deleted && shadow.hash === mineHash) {
      // Only the name or the place is mine; the text is theirs.
      put(settled(text))
      plan.shadowsPut.set(id, shadowFromRecord(record, text))
      return
    }
    if (shadow && !shadow.deleted && shadow.content !== null) {
      const merged = merge3(shadow.content, mine, text ?? '')
      if (merged && merged.conflicts === 0) {
        put(settled(merged.text))
        plan.shadowsPut.set(id, shadowFromRecord(record, text))
        plan.outboxPut.set(id, { id, version: entry.version + 1 })
        plan.notes.push({ message: `Merged changes from another device into “${name}”.`, tone: 'info' })
        return
      }
    }
    plan.outboxPut.set(id, { ...entry, conflict: { ...record, content: text, contentOmitted: false } })
    plan.notes.push({ message: `“${name}” changed on two devices in the same place. Choose which to keep under Sync → Conflicts.`, tone: 'error' })
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Conflicts
  // -------------------------------------------------------------------------------------------------------------------

  /** The person's answer to a conflict: keep this device's text, take the server's, or keep both. */
  async resolveConflict(id: string, choice: 'mine' | 'server' | 'both'): Promise<void> {
    const { ws } = this
    for (let attempt = 0; attempt < 4; attempt += 1) {
      ws.capture()
      const entry = ws.outboxEntry(id)
      const record = entry?.conflict
      if (!entry || !record) return
      const doc = ws.docs.get(id) ?? null
      const now = this.now()
      const text = record.kind === 'file' ? record.content ?? '' : null
      const base: ServerRecord = { ...record, contentOmitted: false }

      if (choice === 'mine') {
        const shadow = record.deleted ? tombstoneOf(base) : shadowFromRecord(base, text)
        await ws.apply({ shadows: { put: [shadow] }, outbox: { put: [{ id, version: entry.version + 1 }] } })
        this.schedule(0)
        this.refreshCounts()
        return
      }

      const plan = emptyPlan()
      plan.expect.set(id, doc)
      plan.outboxDelete.add(id)
      plan.versions.set(id, entry.version)
      if (record.deleted) {
        plan.docsDelete.add(id)
        plan.shadowsPut.set(id, tombstoneOf(base))
      } else {
        plan.docsPut.set(id, docFromRecord(base, text, now))
        plan.shadowsPut.set(id, shadowFromRecord(base, text))
      }
      if (choice === 'both' && doc) {
        const copyId = this.newId(doc.kind)
        const stamp = new Date(now).toISOString().slice(0, 16).replace('T', ' ')
        plan.docsPut.set(copyId, { ...doc, id: copyId, name: copyName(doc.name, `conflict ${stamp}`), updatedAt: now })
        plan.outboxPut.set(copyId, { id: copyId, version: 1 })
        plan.expect.set(copyId, null)
      }
      if (await this.commitPlan(plan)) {
        this.schedule(0)
        this.refreshCounts()
        return
      }
    }
    throw new Error('The document kept changing while it was being resolved. Try again.')
  }

  /** Lets a node the server refused go again (after the name or text was fixed, or just to try once more). */
  async retryBlocked(id?: string): Promise<void> {
    const { ws } = this
    const entries = ws.outboxEntries().filter((entry) => entry.blocked && (!id || entry.id === id))
    if (!entries.length) return
    await ws.apply({ outbox: { put: entries.map((entry) => ({ id: entry.id, version: entry.version + 1, ...(entry.conflict ? { conflict: entry.conflict } : {}) })) } })
    this.schedule(0)
    this.refreshCounts()
  }

  // -------------------------------------------------------------------------------------------------------------------
  // First meeting with a server (reconcile) and "replace this device's copy"
  // -------------------------------------------------------------------------------------------------------------------

  /** Every live record of the server with its text, and the cursor to continue from. */
  private async pullEverything(): Promise<{ records: ServerRecord[]; cursor: number }> {
    const { deps } = this
    const records: ServerRecord[] = []
    let since = 0
    let cursor = 0
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await deps.api.changes({ since, limit: PAGE_LIMIT, device: deps.deviceId })
      for (const record of response.items) {
        if (record.deleted) continue
        records.push(record.kind === 'file' && (typeof record.content !== 'string' || record.contentOmitted) ? (await this.complete(record, null)) ?? record : record)
      }
      cursor = Math.max(cursor, response.cursor)
      since = response.cursor
      if (!response.more) break
    }
    return { records, cursor }
  }

  private async isPristineWelcome(doc: LocalDoc): Promise<boolean> {
    return doc.id === 'welcome' && doc.kind === 'file' && KNOWN_WELCOME_SHA256.includes(await this.hashOf(doc.content ?? ''))
  }

  private async reconcile(reason: 'first' | 'reset'): Promise<void> {
    const { ws, deps } = this
    const writer = deps.canWrite()
    const { records, cursor } = await this.pullEverything()
    const byId = new Map(records.map((record) => [record.id, record]))
    /** One question is enough: a retry after the person typed meanwhile reuses the answer. */
    let answered: Exclude<ReconcileChoice, 'cancel'> | null = null

    for (let attempt = 0; attempt < 4; attempt += 1) {
      ws.capture()
      await ws.drain()
      const local = new Map(ws.docs)
      const shadows = await ws.store.getShadows(null)
      const now = this.now()

      const plan = emptyPlan()
      const same: string[] = []
      const differ: LocalDoc[] = []
      const uploads: LocalDoc[] = []
      const downloads: ServerRecord[] = []
      const pristine = new Set<string>()
      let localUserDocs = 0

      for (const doc of local.values()) {
        if (doc.kind === 'file' && (await this.isPristineWelcome(doc))) pristine.add(doc.id)
        else if (doc.id !== ROOT_ID) localUserDocs += 1
      }

      for (const doc of local.values()) {
        plan.expect.set(doc.id, doc)
        const record = byId.get(doc.id)
        if (!record) {
          const known = shadows.get(doc.id)
          if (reason === 'reset' && known && !known.deleted && !ws.outboxEntry(doc.id)) {
            // It was synced once and is gone from the server (deleted there while this device was away): gone here too.
            plan.docsDelete.add(doc.id)
            plan.shadowsDelete.add(doc.id)
            continue
          }
          if (pristine.has(doc.id)) {
            // The stock welcome page is nobody's writing: it is not sent (it was marked like any new node).
            plan.outboxDelete.add(doc.id)
            continue
          }
          uploads.push(doc)
          continue
        }
        if (doc.kind !== record.kind) {
          differ.push(doc)
          continue
        }
        if (doc.kind === 'folder') {
          same.push(doc.id)
          continue
        }
        const hash = await this.hashOf(doc.content ?? '')
        if (hash === record.hash || pristine.has(doc.id)) same.push(doc.id)
        else differ.push(doc)
      }
      for (const record of records) {
        if (!local.has(record.id)) downloads.push(record)
      }

      const askable = writer && (differ.length > 0 || (downloads.length > 0 && localUserDocs > 0 && reason === 'reset'))
      let choice: Exclude<ReconcileChoice, 'cancel'> = { differ: writer ? 'both' : 'server', deleteServerOnly: false }
      if (answered) {
        choice = answered
      } else if (askable) {
        const answer = await this.askReconcile({
          reason,
          same: same.length,
          uploads: uploads.map((doc) => ({ id: doc.id, name: doc.name })),
          downloads: downloads.map((record) => ({ id: record.id, name: record.name })),
          differ: differ.map((doc) => ({ id: doc.id, name: doc.name }))
        })
        if (answer === 'cancel') throw new ReconcileCancelled()
        choice = answered = answer
      }

      // Apply: same → shadow = record; differ → by choice; only here → upload; only there → download.
      for (const id of same) {
        const doc = local.get(id)!
        const record = byId.get(id)!
        const next = docFromRecord(record, record.kind === 'file' ? record.content ?? '' : null, now)
        if (doc.name !== next.name || doc.parentId !== next.parentId) plan.docsPut.set(id, { ...doc, name: next.name, parentId: next.parentId })
        if (pristine.has(id) && doc.content !== next.content) plan.docsPut.set(id, next)
        plan.shadowsPut.set(id, shadowFromRecord(record, record.kind === 'file' ? record.content ?? '' : null))
        plan.outboxDelete.add(id)
      }
      for (const doc of differ) {
        const record = byId.get(doc.id)!
        const text = record.kind === 'file' ? record.content ?? '' : null
        const takeServer = () => {
          plan.docsPut.set(doc.id, docFromRecord(record, text, now))
          plan.shadowsPut.set(doc.id, shadowFromRecord(record, text))
          plan.outboxDelete.add(doc.id)
        }
        if (doc.kind !== record.kind || choice.differ === 'server') {
          takeServer()
        } else if (choice.differ === 'local') {
          plan.shadowsPut.set(doc.id, shadowFromRecord(record, text))
          plan.outboxPut.set(doc.id, { id: doc.id, version: (ws.outboxEntry(doc.id)?.version ?? 0) + 1 })
        } else {
          takeServer()
          const copyId = this.newId('file')
          plan.docsPut.set(copyId, { ...doc, id: copyId, name: copyName(doc.name, 'this device'), updatedAt: now })
          plan.outboxPut.set(copyId, { id: copyId, version: 1 })
          plan.expect.set(copyId, null)
        }
      }
      if (writer) {
        for (const doc of uploads) {
          plan.outboxPut.set(doc.id, { id: doc.id, version: (ws.outboxEntry(doc.id)?.version ?? 0) + 1 })
          // The server does not have it (any more): whatever was agreed before is void, it goes up as a new node.
          if (shadows.has(doc.id)) plan.shadowsDelete.add(doc.id)
        }
      }
      for (const record of downloads) {
        const text = record.kind === 'file' ? record.content ?? '' : null
        plan.shadowsPut.set(record.id, shadowFromRecord(record, text))
        if (choice.deleteServerOnly && writer) {
          // Not brought here: it goes away on the server instead (an outbox entry for a node that is not here is a delete).
          plan.outboxPut.set(record.id, { id: record.id, version: 1 })
        } else {
          plan.docsPut.set(record.id, docFromRecord(record, text, now))
          plan.expect.set(record.id, null)
        }
      }

      const committed = await this.deps.ws.commitRemote(
        {
          docs: { put: [...plan.docsPut.values()], delete: [...plan.docsDelete] },
          shadows: { put: [...plan.shadowsPut.values()], delete: [...plan.shadowsDelete] },
          outbox: { put: [...plan.outboxPut.values()], delete: [...plan.outboxDelete] },
          meta: { [cursorKey(deps.backend)]: cursor, [reconciledKey(deps.backend)]: { at: now, reason } }
        },
        plan.expect
      )
      if (committed) {
        this.publish({ reconcile: null })
        if (differ.length && choice.differ === 'both') {
          deps.notify?.(`${differ.length} document${differ.length === 1 ? '' : 's'} differed from the server's copy: both were kept (yours is named “… (this device)”).`, 'info')
        }
        if (writer) await this.pushAll()
        // The cursor is where the full pull ended: one more (cheap) cycle settles whatever arrived meanwhile.
        this.again = true
        return
      }
    }
    this.again = true
  }

  private askReconcile(plan: ReconcilePlan): Promise<ReconcileChoice> {
    return new Promise<ReconcileChoice>((resolve) => {
      this.reconcileAnswer = (choice) => {
        this.reconcileAnswer = null
        resolve(choice)
      }
      this.publish({ phase: 'reconcile', reconcile: plan })
    })
  }

  /** The person's answer to the first-meeting dialog. */
  resolveReconcile(choice: ReconcileChoice): void {
    this.reconcileAnswer?.(choice)
  }

  /**
   * "Replace this device's copy with the server's": the server's documents become the workspace, everything here that the
   * server does not have -- unsent edits included -- is gone, the outbox is emptied. The server is asked first, and
   * `confirm` sees what would be lost before anything changes (false = do nothing). Works for a viewer too.
   */
  async replaceFromServer(confirm?: (info: { documents: number; unsent: number }) => boolean | Promise<boolean>): Promise<boolean> {
    const { ws, deps } = this
    const before = this.current.phase
    this.publish({ phase: 'syncing', error: null })
    try {
      const { records, cursor } = await this.pullEverything()
      ws.capture()
      await ws.drain()
      const unsent = ws.outboxEntries().filter((entry) => !entry.blocked).length
      if (confirm && !(await confirm({ documents: records.filter((record) => record.kind === 'file').length, unsent }))) {
        this.publish({ phase: before === 'syncing' ? 'idle' : before })
        return false
      }
      ws.capture()
      const now = this.now()
      const keep = new Set(records.map((record) => record.id))
      const stale = [...ws.docs.keys()].filter((id) => !keep.has(id))
      const shadows = await ws.store.getShadows(null)
      await ws.commitRemote(
        {
          docs: { put: records.map((record) => docFromRecord(record, record.kind === 'file' ? record.content ?? '' : null, now)), delete: stale },
          shadows: { put: records.map((record) => shadowFromRecord(record, record.kind === 'file' ? record.content ?? '' : null)), delete: [...shadows.keys()].filter((id) => !keep.has(id)) },
          outbox: { delete: ws.outboxEntries().map((entry) => entry.id) },
          meta: { [cursorKey(deps.backend)]: cursor, [reconciledKey(deps.backend)]: { at: now, reason: 'replace' } }
        },
        new Map()
      )
      this.failures = 0
      this.refreshCounts()
      this.publish({ phase: this.active ? 'idle' : 'off', lastSync: now, error: null })
      return true
    } catch (error) {
      this.refreshCounts()
      this.fail(error)
      throw error
    }
  }

  /** Forgets everything agreed with the server (shadows, outbox, cursors): the next cycle starts with a reconcile. */
  async forget(): Promise<void> {
    await this.deps.ws.wipeSync()
  }
}

class ReconcileCancelled extends Error {}

interface SentOp {
  op: PushOp
  entry: OutboxEntry
  doc: LocalDoc | null
  shadow: Shadow | null
  text: string | null
  hash: string
  deleting: boolean
}

interface BuiltOps {
  ops: SentOp[]
  /** Entries with nothing to send (clean, or deleted before they ever reached the server). */
  drop: OutboxEntry[]
  /** Entries the server would refuse, caught here. */
  block: { entry: OutboxEntry; code: string }[]
  /** More entries wait than one request holds. */
  more: boolean
}

function blockedMessage(code: string): string {
  switch (code) {
    case 'md_bad_id':
      return 'The identifier of this document is not accepted by the server.'
    case 'md_bad_name':
      return 'The server does not accept this name (empty, over 255 characters, or containing “/”).'
    case 'md_doc_too_large':
      return 'This document is too large to sync (limit 3.5 MB).'
    case 'md_space_full':
      return 'The server is full (too many documents).'
    case 'md_bad_clock':
      return "This device's clock is more than a day ahead of the server's."
    case 'md_kind_changed':
      return 'The server holds a folder where this is a file (or the other way round).'
    default:
      return `The server refused this document (${code}).`
  }
}
