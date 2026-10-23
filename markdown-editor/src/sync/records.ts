import type { FileNode } from '../types'

/**
 * The flat records of the document sync (md-sync F2). The editor works on a nested tree (`FileNode`); the device store
 * and the server hold one record per node, so a rename or a move is a change of a field of the same id and never a
 * delete plus an insert.
 */

export type NodeKind = 'file' | 'folder'

/** A node as this device stores it. `content` is null for a folder. */
export interface LocalDoc {
  id: string
  kind: NodeKind
  /** null = the top level (the `root` folder, and anything moved out of it). */
  parentId: string | null
  name: string
  content: string | null
  /** Device clock, ms: shown to people, never used to decide who wins. */
  updatedAt: number
}

/**
 * What the server and this device last agreed on for a node: the base of the three-way merge and of a line patch.
 * Absent = the server has never seen the node (or this device never learnt it).
 */
export interface Shadow {
  id: string
  kind: NodeKind
  parentId: string | null
  name: string
  /** The agreed text; null for a folder, a tombstone, or when this device chose not to keep a big text (then there is no base). */
  content: string | null
  hash: string
  rev: number
  contentRev: number
  metaRev: number
  deleted: boolean
}

/** A server record (the API's `DocRecord`). */
export interface ServerRecord {
  id: string
  kind: NodeKind
  parentId: string | null
  name: string
  content?: string | null
  hash: string
  size?: number
  rev: number
  contentRev: number
  metaRev: number
  deleted: boolean
  createdAt?: number
  updatedAt?: number
  serverUpdatedAt: number
  device?: string
  /** On a push conflict: the text did not fit the response budget; fetch it with `GET /docs/{id}`. */
  contentOmitted?: boolean
}

/** A node waiting to go to the server. `version` rises on every local change, so a push can tell it is stale. */
export interface OutboxEntry {
  id: string
  version: number
  /** After `md_patch_mismatch`: send the whole text, not a patch. */
  forceFull?: boolean
  /** The server refused it for good (an op code): shown in the sync panel, not retried until the node changes again. */
  blocked?: string
  /** The server changed the same lines: waits for the person to choose. The record is the server's side. */
  conflict?: ServerRecord
}

export const ROOT_ID = 'root'

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export interface TreeDiff {
  /** Every node of the new tree (unchanged ones keep the very same object). */
  next: Map<string, LocalDoc>
  puts: LocalDoc[]
  deletes: string[]
}

/**
 * What changed between the records last written and the tree now: new and edited nodes (`puts`) and the ids that are gone.
 * A file whose `content` is undefined is "not loaded yet" (the boot snapshot) and keeps what was stored -- never an edit.
 */
export function diffTrees(prev: ReadonlyMap<string, LocalDoc>, files: FileNode[], now: number): TreeDiff {
  const next = new Map<string, LocalDoc>()
  const puts: LocalDoc[] = []

  const walk = (nodes: FileNode[], parentId: string | null) => {
    for (const node of nodes) {
      if (next.has(node.id)) continue
      const before = prev.get(node.id)
      const kind: NodeKind = node.type === 'folder' ? 'folder' : 'file'
      const content = kind === 'folder' ? null : node.content ?? (before?.kind === 'file' ? before.content : '') ?? ''
      if (before && before.kind === kind && before.parentId === parentId && before.name === node.name && before.content === content) {
        next.set(node.id, before)
      } else {
        const doc: LocalDoc = { id: node.id, kind, parentId, name: node.name, content, updatedAt: now }
        next.set(node.id, doc)
        puts.push(doc)
      }
      if (node.children) walk(node.children, node.id)
    }
  }
  walk(files, null)

  const deletes: string[] = []
  for (const id of prev.keys()) if (!next.has(id)) deletes.push(id)
  return { next, puts, deletes }
}

/** The flat records of a tree, as they would be written from scratch. */
export function treeToDocs(files: FileNode[], now: number): LocalDoc[] {
  return diffTrees(new Map(), files, now).puts
}

/**
 * The editor's tree from flat records. An orphan (its parent is gone, or is not a folder) goes to the top level; a cycle (two
 * devices moved folders into each other) is cut at its smallest id, as the server does. `root` comes first, the rest by name.
 */
export function buildTree(docs: Iterable<LocalDoc>): FileNode[] {
  const byId = new Map<string, LocalDoc>()
  for (const doc of docs) byId.set(doc.id, doc)

  const parentOf = new Map<string, string | null>()
  for (const doc of byId.values()) {
    const parent = doc.parentId !== null ? byId.get(doc.parentId) : undefined
    parentOf.set(doc.id, parent && parent.kind === 'folder' && parent.id !== doc.id ? parent.id : null)
  }

  // 0 unseen, 1 on the current walk, 2 settled
  const state = new Map<string, 1 | 2>()
  for (const start of [...byId.keys()].sort()) {
    const path: string[] = []
    let node: string | null = start
    while (node !== null && state.get(node) !== 2) {
      if (state.get(node) === 1) {
        const cycle = path.slice(path.indexOf(node))
        parentOf.set(cycle.reduce((least, id) => (id < least ? id : least)), null)
        break
      }
      state.set(node, 1)
      path.push(node)
      node = parentOf.get(node) ?? null
    }
    for (const id of path) state.set(id, 2)
  }

  const children = new Map<string | null, LocalDoc[]>()
  for (const doc of byId.values()) {
    const key = parentOf.get(doc.id) ?? null
    const list = children.get(key)
    if (list) list.push(doc)
    else children.set(key, [doc])
  }

  const order = (list: LocalDoc[]): LocalDoc[] =>
    list.sort((a, b) => {
      if (a.id === ROOT_ID || b.id === ROOT_ID) return a.id === ROOT_ID ? -1 : 1
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return compareNames(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })

  const build = (doc: LocalDoc, parentId: string | null): FileNode => {
    const node: FileNode = { id: doc.id, name: doc.name, type: doc.kind, parentId: parentId ?? undefined }
    if (doc.kind === 'folder') node.children = order(children.get(doc.id) ?? []).map((child) => build(child, doc.id))
    else node.content = doc.content ?? ''
    return node
  }
  return order(children.get(null) ?? []).map((doc) => build(doc, null))
}

/** The doc of one node, with the folder it sits in. */
export function docsById(files: FileNode[], now = 0): Map<string, LocalDoc> {
  return new Map(treeToDocs(files, now).map((doc) => [doc.id, doc]))
}

/** Every id below `id` in the tree (children, grandchildren…), not `id` itself. */
export function descendantIds(docs: Iterable<LocalDoc>, id: string): string[] {
  const kids = new Map<string, string[]>()
  for (const doc of docs) {
    if (doc.parentId === null) continue
    const list = kids.get(doc.parentId)
    if (list) list.push(doc.id)
    else kids.set(doc.parentId, [doc.id])
  }
  const out: string[] = []
  const seen = new Set<string>([id])
  const stack = [id]
  while (stack.length) {
    for (const child of kids.get(stack.pop()!) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      out.push(child)
      stack.push(child)
    }
  }
  return out
}
