/** Shaping the flat collection/request lists into the sidebar tree. */

import type { Collection, RequestSpec } from '../types'

export type TreeNode =
  | { kind: 'collection'; data: Collection; children: TreeNode[] }
  | { kind: 'request'; data: RequestSpec }

/**
 * Build the tree, keeping a matching collection's whole subtree.
 *
 * Filtering a folder down to only its matching children would hide exactly what
 * the user searched for whenever the folder name itself is the match.
 */
export function buildTree(collections: Collection[], requests: RequestSpec[], filter: string): TreeNode[] {
  const term = filter.trim().toLowerCase()
  const known = new Set(collections.map((c) => c.id))
  const seen = new Set<string>()

  // A parentId pointing at a deleted collection would strand the whole subtree,
  // so those are treated as roots instead of disappearing.
  const parentOf = (parentId: string | null | undefined) => (parentId && known.has(parentId) ? parentId : null)

  const build = (parentId: string | null): TreeNode[] => {
    const nodes: TreeNode[] = []

    for (const collection of collections.filter((c) => parentOf(c.parentId) === parentId)) {
      if (seen.has(collection.id)) continue // cycle guard
      seen.add(collection.id)
      nodes.push({ kind: 'collection', data: collection, children: build(collection.id) })
    }
    for (const request of requests.filter((r) => parentOf(r.collectionId) === parentId)) {
      nodes.push({ kind: 'request', data: request })
    }
    return nodes
  }

  const full = build(null)
  if (!term) return full

  const match = (node: TreeNode): TreeNode | null => {
    if (node.kind === 'request') {
      const hit = node.data.name.toLowerCase().includes(term) || node.data.url.toLowerCase().includes(term)
      return hit ? node : null
    }
    if (node.data.name.toLowerCase().includes(term)) return node
    const children = node.children.map(match).filter(Boolean) as TreeNode[]
    return children.length ? { ...node, children } : null
  }

  return full.map(match).filter(Boolean) as TreeNode[]
}

/** "Parent / Child / Grandchild" labels so a nested picker stays readable. */
export function collectionPaths(collections: Collection[]): { id: string; path: string }[] {
  const byId = new Map(collections.map((c) => [c.id, c]))
  return collections
    .map((collection) => {
      const parts: string[] = []
      let cursor: Collection | undefined = collection
      const seen = new Set<string>()
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id)
        parts.unshift(cursor.name)
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
      }
      return { id: collection.id, path: parts.join(' / ') }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}
