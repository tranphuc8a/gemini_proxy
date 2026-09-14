/**
 * Automatic layouts.
 *
 * Every layout returns new positions rather than mutating the document, so the
 * caller can put one undo checkpoint around the whole rearrangement — a layout
 * that could not be undone would be unusable, because you only find out whether
 * you like it after it has moved everything.
 *
 * Pinned nodes are honoured everywhere: a user who dragged one node exactly
 * where they wanted it should not lose that to "tidy up".
 */

import type { GraphDocument } from '../types'
import { adjacency, childrenOf, components, roots } from './graph'

export type LayoutId = 'tree' | 'layered' | 'circular' | 'grid' | 'force' | 'bipartite' | 'radial'

export interface LayoutSpec {
  id: LayoutId
  label: string
  note: string
}

export const LAYOUTS: LayoutSpec[] = [
  { id: 'tree', label: 'Cây', note: 'Gốc ở trên, con toả xuống. Hợp với cây, heap, trie.' },
  { id: 'layered', label: 'Phân tầng', note: 'Xếp theo thứ tự tô-pô — hợp với DAG và sơ đồ luồng.' },
  { id: 'radial', label: 'Toả tròn', note: 'Gốc ở tâm, mỗi mức là một vòng tròn.' },
  { id: 'circular', label: 'Vòng tròn', note: 'Mọi đỉnh trên một đường tròn — thấy rõ mật độ cạnh.' },
  { id: 'grid', label: 'Lưới', note: 'Xếp đều thành lưới, không quan tâm cấu trúc.' },
  { id: 'bipartite', label: 'Hai phía', note: 'Hai cột, tô màu theo 2-phân — báo ngay nếu đồ thị không 2-phân.' },
  { id: 'force', label: 'Lực hút/đẩy', note: 'Mô phỏng lò xo; đồ thị tổng quát tự tìm hình dạng của nó.' }
]

type Positions = Map<string, { x: number; y: number }>

const H_GAP = 90
const V_GAP = 110

function keepPinned(document: GraphDocument, positions: Positions): Positions {
  for (const node of document.nodes) {
    if (node.pinned) positions.set(node.id, { x: node.x, y: node.y })
  }
  return positions
}

/**
 * Tidy tree layout.
 *
 * Leaves are placed left to right at a fixed pitch; an internal node is centred
 * over its children. That is the classic Reingold–Tilford first pass, and it is
 * enough here: the second pass exists to compact sibling subtrees, which mostly
 * matters for trees far larger than anyone draws by hand.
 */
export function treeLayout(document: GraphDocument, originX = 120, originY = 80): Positions {
  const positions: Positions = new Map()
  const visited = new Set<string>()
  let cursor = 0

  const place = (id: string, depth: number): number => {
    if (visited.has(id)) return cursor * H_GAP // a cycle: stop rather than recurse forever
    visited.add(id)

    const children = childrenOf(document, id).filter((child) => !visited.has(child))
    let x: number
    if (!children.length) {
      x = cursor * H_GAP
      cursor += 1
    } else {
      const childXs = children.map((child) => place(child, depth + 1))
      x = (Math.min(...childXs) + Math.max(...childXs)) / 2
    }
    positions.set(id, { x: originX + x, y: originY + depth * V_GAP })
    return x
  }

  const starts = roots(document)
  // A graph with no root (every node has a parent) still has to be laid out;
  // starting anywhere beats drawing nothing.
  for (const root of starts.length ? starts : document.nodes.slice(0, 1).map((node) => node.id)) {
    place(root, 0)
    cursor += 1 // a gap between separate trees in a forest
  }
  // Anything unreachable from a root goes in a row underneath.
  for (const node of document.nodes) {
    if (positions.has(node.id)) continue
    positions.set(node.id, { x: originX + cursor * H_GAP, y: originY })
    cursor += 1
  }

  return keepPinned(document, positions)
}

/**
 * Layered layout: longest-path layering, then order within each layer.
 *
 * Longest path rather than the topological index: it puts every node as close
 * to its successors as it can, which is what makes a DAG read as stages.
 */
export function layeredLayout(document: GraphDocument, originX = 120, originY = 80): Positions {
  const depth = new Map<string, number>()
  const incoming = new Map<string, string[]>()
  for (const node of document.nodes) incoming.set(node.id, [])
  for (const edge of document.edges) incoming.get(edge.target)?.push(edge.source)

  const resolve = (id: string, guard: Set<string>): number => {
    if (depth.has(id)) return depth.get(id) as number
    if (guard.has(id)) return 0 // a cycle; treat it as a layer boundary
    guard.add(id)
    const parents = incoming.get(id) ?? []
    const value = parents.length ? Math.max(...parents.map((parent) => resolve(parent, guard))) + 1 : 0
    guard.delete(id)
    depth.set(id, value)
    return value
  }
  for (const node of document.nodes) resolve(node.id, new Set())

  const byLayer = new Map<number, string[]>()
  for (const node of document.nodes) {
    const layer = depth.get(node.id) ?? 0
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), node.id])
  }

  const positions: Positions = new Map()
  const widest = Math.max(...[...byLayer.values()].map((layer) => layer.length), 1)
  for (const [layer, ids] of byLayer) {
    // Centre each layer so the drawing is symmetric rather than left-ragged.
    const offset = ((widest - ids.length) * H_GAP) / 2
    ids.forEach((id, index) => {
      positions.set(id, { x: originX + offset + index * H_GAP, y: originY + layer * V_GAP })
    })
  }
  return keepPinned(document, positions)
}

export function circularLayout(document: GraphDocument, centreX = 420, centreY = 320): Positions {
  const positions: Positions = new Map()
  const count = document.nodes.length || 1
  const radius = Math.max(140, (count * 46) / (2 * Math.PI))
  document.nodes.forEach((node, index) => {
    // Start at the top: a circle whose first node sits at 3 o'clock reads oddly.
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    positions.set(node.id, { x: centreX + radius * Math.cos(angle), y: centreY + radius * Math.sin(angle) })
  })
  return keepPinned(document, positions)
}

export function radialLayout(document: GraphDocument, centreX = 420, centreY = 320): Positions {
  const next = adjacency(document)
  const depth = new Map<string, number>()
  const starts = roots(document)
  const queue = [...(starts.length ? starts : document.nodes.slice(0, 1).map((node) => node.id))]
  for (const id of queue) depth.set(id, 0)

  while (queue.length) {
    const current = queue.shift() as string
    for (const neighbour of next.get(current) ?? []) {
      if (depth.has(neighbour)) continue
      depth.set(neighbour, (depth.get(current) ?? 0) + 1)
      queue.push(neighbour)
    }
  }

  const byRing = new Map<number, string[]>()
  for (const node of document.nodes) {
    const ring = depth.get(node.id) ?? 0
    byRing.set(ring, [...(byRing.get(ring) ?? []), node.id])
  }

  const positions: Positions = new Map()
  for (const [ring, ids] of byRing) {
    if (ring === 0 && ids.length === 1) {
      positions.set(ids[0], { x: centreX, y: centreY })
      continue
    }
    const radius = 90 + ring * 110
    ids.forEach((id, index) => {
      const angle = (index / ids.length) * Math.PI * 2 - Math.PI / 2
      positions.set(id, { x: centreX + radius * Math.cos(angle), y: centreY + radius * Math.sin(angle) })
    })
  }
  return keepPinned(document, positions)
}

export function gridLayout(document: GraphDocument, originX = 120, originY = 80): Positions {
  const positions: Positions = new Map()
  const columns = Math.max(1, Math.ceil(Math.sqrt(document.nodes.length)))
  document.nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: originX + (index % columns) * H_GAP,
      y: originY + Math.floor(index / columns) * V_GAP
    })
  })
  return keepPinned(document, positions)
}

/**
 * Two-colour the graph and put each colour in a column.
 *
 * `bipartite` is null when the graph has an odd cycle — the layout still runs,
 * but the caller is told so it can say why the picture looks wrong.
 */
export function bipartiteLayout(
  document: GraphDocument,
  originX = 180,
  originY = 80
): { positions: Positions; bipartite: boolean } {
  const next = adjacency(document)
  const colour = new Map<string, 0 | 1>()
  let bipartite = true

  for (const node of document.nodes) {
    if (colour.has(node.id)) continue
    colour.set(node.id, 0)
    const queue = [node.id]
    while (queue.length) {
      const current = queue.shift() as string
      const own = colour.get(current) as 0 | 1
      for (const neighbour of next.get(current) ?? []) {
        if (!colour.has(neighbour)) {
          colour.set(neighbour, own === 0 ? 1 : 0)
          queue.push(neighbour)
        } else if (colour.get(neighbour) === own) {
          bipartite = false
        }
      }
    }
  }

  const left = document.nodes.filter((node) => colour.get(node.id) === 0)
  const right = document.nodes.filter((node) => colour.get(node.id) === 1)
  const positions: Positions = new Map()
  left.forEach((node, index) => positions.set(node.id, { x: originX, y: originY + index * 80 }))
  right.forEach((node, index) => positions.set(node.id, { x: originX + 360, y: originY + index * 80 }))

  return { positions: keepPinned(document, positions), bipartite }
}

/**
 * Force-directed layout (Fruchterman–Reingold), run to completion in one go.
 *
 * Synchronous rather than animated: the result is what matters, a few hundred
 * iterations on a hand-drawn graph takes milliseconds, and an animated version
 * would need every frame to be undoable.
 */
export function forceLayout(document: GraphDocument, iterations = 300): Positions {
  const nodes = document.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, pinned: node.pinned }))
  if (!nodes.length) return new Map()

  const area = 900 * 700
  const k = Math.sqrt(area / nodes.length)
  const index = new Map(nodes.map((node, at) => [node.id, at]))

  // Nodes stacked at exactly the same point feel no repulsion and never
  // separate, so start anything unplaced with a small jitter.
  for (const node of nodes) {
    if (!node.x && !node.y) {
      node.x = 400 + (Math.random() - 0.5) * 200
      node.y = 320 + (Math.random() - 0.5) * 200
    }
  }

  let temperature = k
  for (let step = 0; step < iterations; step++) {
    const dx = new Float64Array(nodes.length)
    const dy = new Float64Array(nodes.length)

    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        let deltaX = nodes[a].x - nodes[b].x
        let deltaY = nodes[a].y - nodes[b].y
        let distance = Math.hypot(deltaX, deltaY)
        if (distance < 0.01) {
          deltaX = Math.random() - 0.5
          deltaY = Math.random() - 0.5
          distance = 0.01
        }
        const force = (k * k) / distance
        dx[a] += (deltaX / distance) * force
        dy[a] += (deltaY / distance) * force
        dx[b] -= (deltaX / distance) * force
        dy[b] -= (deltaY / distance) * force
      }
    }

    for (const edge of document.edges) {
      const a = index.get(edge.source)
      const b = index.get(edge.target)
      if (a === undefined || b === undefined || a === b) continue
      const deltaX = nodes[a].x - nodes[b].x
      const deltaY = nodes[a].y - nodes[b].y
      const distance = Math.max(0.01, Math.hypot(deltaX, deltaY))
      const force = (distance * distance) / k
      dx[a] -= (deltaX / distance) * force
      dy[a] -= (deltaY / distance) * force
      dx[b] += (deltaX / distance) * force
      dy[b] += (deltaY / distance) * force
    }

    for (let at = 0; at < nodes.length; at++) {
      if (nodes[at].pinned) continue
      const magnitude = Math.max(0.01, Math.hypot(dx[at], dy[at]))
      // Cool: allow a big move early and only small adjustments later, which is
      // what stops the layout oscillating instead of settling.
      nodes[at].x += (dx[at] / magnitude) * Math.min(magnitude, temperature)
      nodes[at].y += (dy[at] / magnitude) * Math.min(magnitude, temperature)
    }
    temperature *= 0.97
  }

  const positions: Positions = new Map()
  for (const node of nodes) positions.set(node.id, { x: Math.round(node.x), y: Math.round(node.y) })
  return keepPinned(document, positions)
}

export function runLayout(document: GraphDocument, layout: LayoutId): { positions: Positions; note?: string } {
  switch (layout) {
    case 'tree':
      return { positions: treeLayout(document) }
    case 'layered':
      return { positions: layeredLayout(document) }
    case 'radial':
      return { positions: radialLayout(document) }
    case 'circular':
      return { positions: circularLayout(document) }
    case 'grid':
      return { positions: gridLayout(document) }
    case 'bipartite': {
      const result = bipartiteLayout(document)
      return {
        positions: result.positions,
        note: result.bipartite ? undefined : 'Đồ thị không 2-phân (có chu trình lẻ), nên hai cột sẽ vẫn còn cạnh nội bộ.'
      }
    }
    case 'force':
    default:
      return { positions: forceLayout(document) }
  }
}

/** How many separate pieces the drawing is in — shown next to the layout picker. */
export function componentCount(document: GraphDocument): number {
  return components(document).length
}
