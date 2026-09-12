import type { FileNode } from '../types'
import { createId } from './id'

/** Depth-first lookup by id. */
export function findNode(nodes: FileNode[], id: string | null | undefined): FileNode | null {
  if (!id) return null
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** The folder that directly contains `id`, or null when `id` lives at the root. */
export function findParent(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.children?.some((child) => child.id === id)) return node
    if (node.children) {
      const found = findParent(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** Ancestor chain from the root down to (and including) `id`. */
export function getPath(nodes: FileNode[], id: string): FileNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node]
    if (node.children) {
      const sub = getPath(node.children, id)
      if (sub.length) return [node, ...sub]
    }
  }
  return []
}

/** Siblings living under `parentId` (root level when null). */
export function getSiblings(nodes: FileNode[], parentId: string | null): FileNode[] {
  if (!parentId) return nodes
  const parent = findNode(nodes, parentId)
  return parent?.children ?? []
}

export function addNode(nodes: FileNode[], newNode: FileNode, parentId: string | null): FileNode[] {
  if (!parentId) return [...nodes, { ...newNode, parentId: undefined }]

  return nodes.map((node) => {
    if (node.id === parentId && node.type === 'folder') {
      return { ...node, children: [...(node.children ?? []), { ...newNode, parentId }] }
    }
    if (node.children) {
      return { ...node, children: addNode(node.children, newNode, parentId) }
    }
    return node
  })
}

export function removeNode(nodes: FileNode[], id: string): FileNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeNode(node.children, id) } : node))
}

export function renameNode(nodes: FileNode[], id: string, name: string): FileNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, name }
    if (node.children) return { ...node, children: renameNode(node.children, id, name) }
    return node
  })
}

export function setNodeContent(nodes: FileNode[], id: string, content: string): FileNode[] {
  return nodes.map((node) => {
    if (node.id === id && node.type === 'file') return { ...node, content }
    if (node.children) return { ...node, children: setNodeContent(node.children, id, content) }
    return node
  })
}

/** True when `candidateId` sits anywhere inside `ancestorId`'s subtree, or is it. */
export function isSelfOrDescendant(nodes: FileNode[], ancestorId: string, candidateId: string | null): boolean {
  if (!candidateId) return false
  if (ancestorId === candidateId) return true
  const ancestor = findNode(nodes, ancestorId)
  if (!ancestor?.children) return false
  return Boolean(findNode(ancestor.children, candidateId))
}

/**
 * A drop is legal when the target is a real folder that is neither the node
 * itself nor one of its descendants, and is not already its parent.
 */
export function canMove(nodes: FileNode[], nodeId: string, targetParentId: string | null): boolean {
  if (nodeId === targetParentId) return false
  if (isSelfOrDescendant(nodes, nodeId, targetParentId)) return false
  if (targetParentId) {
    const target = findNode(nodes, targetParentId)
    if (!target || target.type !== 'folder') return false
  }
  const currentParent = findParent(nodes, nodeId)
  return (currentParent?.id ?? null) !== targetParentId
}

export function moveNode(nodes: FileNode[], nodeId: string, targetParentId: string | null): FileNode[] {
  if (!canMove(nodes, nodeId, targetParentId)) return nodes
  const node = findNode(nodes, nodeId)
  if (!node) return nodes
  const detached = removeNode(nodes, nodeId)
  const name = uniqueName(getSiblings(detached, targetParentId), node.name)
  return addNode(detached, { ...node, name }, targetParentId)
}

export function cloneSubtree(node: FileNode, parentId?: string): FileNode {
  const id = createId(node.type)
  return {
    ...node,
    id,
    parentId,
    children: node.children?.map((child) => cloneSubtree(child, id))
  }
}

export function copyNode(nodes: FileNode[], nodeId: string, targetParentId: string | null): FileNode[] {
  const node = findNode(nodes, nodeId)
  if (!node) return nodes
  // Copying a folder into its own subtree duplicates the branch being read.
  if (isSelfOrDescendant(nodes, nodeId, targetParentId)) return nodes
  const clone = cloneSubtree(node, targetParentId ?? undefined)
  clone.name = uniqueName(getSiblings(nodes, targetParentId), node.name)
  return addNode(nodes, clone, targetParentId)
}

/** Appends " (2)", " (3)", … before the extension until the name is free. */
export function uniqueName(siblings: FileNode[], desired: string): string {
  const taken = new Set(siblings.map((node) => node.name.toLowerCase()))
  if (!taken.has(desired.toLowerCase())) return desired

  const match = /^(.*?)(\.[^.]+)?$/.exec(desired)
  const base = match?.[1] || desired
  const ext = match?.[2] ?? ''

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} (${index})${ext}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${base} (${Date.now()})${ext}`
}

/** Folders first, then case-insensitive natural order, applied recursively. */
export function sortTree(nodes: FileNode[]): FileNode[] {
  return [...nodes]
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    .map((node) => (node.children ? { ...node, children: sortTree(node.children) } : node))
}

export function flatten(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])])
}

export function countNodes(nodes: FileNode[]): { files: number; folders: number } {
  return flatten(nodes).reduce(
    (acc, node) => {
      if (node.type === 'file') acc.files += 1
      else acc.folders += 1
      return acc
    },
    { files: 0, folders: 0 }
  )
}

/** Ids of every folder that must be open for `id` to be visible. */
export function ancestorIds(nodes: FileNode[], id: string): string[] {
  return getPath(nodes, id)
    .slice(0, -1)
    .map((node) => node.id)
}

/** Case-insensitive name filter that keeps the ancestors of every match. */
export function filterTree(nodes: FileNode[], query: string): FileNode[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return nodes

  const walk = (list: FileNode[]): FileNode[] =>
    list.flatMap((node) => {
      const children = node.children ? walk(node.children) : []
      const hit = node.name.toLowerCase().includes(needle)
      if (!hit && children.length === 0) return []
      return [{ ...node, children: node.children ? children : undefined }]
    })

  return walk(nodes)
}

/** Repairs parentId links, and keeps `children`/`content` on the right node kind. */
export function normalizeTree(nodes: FileNode[], parentId?: string): FileNode[] {
  return nodes.map((node) => {
    const normalized: FileNode = { ...node, parentId }
    if (node.type === 'folder') {
      normalized.children = normalizeTree(node.children ?? [], node.id)
      delete normalized.content
    } else {
      delete normalized.children
      normalized.content = node.content ?? ''
    }
    return normalized
  })
}
