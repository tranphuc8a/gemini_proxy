/**
 * Graph operations and the rules each document kind is drawn under.
 *
 * Two halves:
 *
 * * **Structure** — adjacency, degrees, reachability, cycle detection. Pure
 *   functions over a document, used by the algorithms, the layouts and the
 *   validator alike.
 * * **Kinds** — what "a tree" or "a heap" means to the editor. Each kind
 *   declares whether it is directed, whether parallel edges are allowed, and a
 *   `validate` that reports what the drawing currently breaks.
 *
 * Validation *reports*, it does not *prevent*. Refusing a click that would make
 * a tree briefly cyclic makes the editor infuriating -- you often have to pass
 * through an invalid state to reach the drawing you want. Showing "hai cha cho
 * nút B" in a panel and letting the user fix it is the version people can
 * actually draw with.
 */

import type {
  GraphDefaults,
  GraphDocument,
  GraphEdge,
  GraphKind,
  GraphNode,
  Violation
} from '../types'
import { createDocumentId, createId } from './id'

export const DEFAULT_DEFAULTS: GraphDefaults = {
  nodeShape: 'circle',
  nodeFill: '#1e293b',
  nodeStroke: '#38bdf8',
  nodeTextColor: '#e2e8f0',
  nodeWidth: 56,
  nodeHeight: 56,
  edgeStyle: 'solid',
  edgeShape: 'straight',
  edgeColor: '#64748b'
}

export interface KindSpec {
  id: GraphKind
  label: string
  /** One line in the picker: what this kind is for. */
  note: string
  directed: boolean
  weighted: boolean
  allowParallel: boolean
  allowSelfLoops: boolean
  /** Default node shape, so a state machine does not start out as circles. */
  nodeShape?: GraphNode['shape']
  validate: (document: GraphDocument) => Violation[]
}

// --------------------------------------------------------------- structure

export function nodeMap(document: GraphDocument): Map<string, GraphNode> {
  return new Map(document.nodes.map((node) => [node.id, node]))
}

/** Outgoing adjacency. For an undirected document every edge appears both ways. */
export function adjacency(document: GraphDocument): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const node of document.nodes) out.set(node.id, [])
  for (const edge of document.edges) {
    out.get(edge.source)?.push(edge.target)
    if (!document.directed) out.get(edge.target)?.push(edge.source)
  }
  return out
}

export function inDegree(document: GraphDocument): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const node of document.nodes) degrees.set(node.id, 0)
  for (const edge of document.edges) {
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
    if (!document.directed) degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
  }
  return degrees
}

export function outDegree(document: GraphDocument): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const node of document.nodes) degrees.set(node.id, 0)
  for (const edge of document.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
    if (!document.directed) degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }
  return degrees
}

/**
 * Nodes on a directed cycle, or [] when the graph is acyclic.
 *
 * Iterative DFS with an explicit stack rather than recursion: a long linked
 * list drawn in this editor is a single path thousands of nodes deep, and the
 * call stack does not survive that.
 */
export function findCycle(document: GraphDocument): string[] {
  const next = adjacency(document)
  const state = new Map<string, 0 | 1 | 2>() // unseen / on the stack / done
  const parent = new Map<string, string>()

  for (const start of document.nodes) {
    if (state.get(start.id)) continue
    const stack: { id: string; index: number }[] = [{ id: start.id, index: 0 }]
    state.set(start.id, 1)

    while (stack.length) {
      const frame = stack[stack.length - 1]
      const neighbours = next.get(frame.id) ?? []
      if (frame.index >= neighbours.length) {
        state.set(frame.id, 2)
        stack.pop()
        continue
      }
      const neighbour = neighbours[frame.index++]
      // In an undirected graph the edge you arrived by is not a cycle.
      if (!document.directed && parent.get(frame.id) === neighbour) continue

      if (state.get(neighbour) === 1) {
        // Walk the stack back to where the cycle closes.
        const cycle: string[] = [neighbour]
        for (let i = stack.length - 1; i >= 0; i--) {
          cycle.push(stack[i].id)
          if (stack[i].id === neighbour) break
        }
        return cycle.reverse()
      }
      if (!state.get(neighbour)) {
        state.set(neighbour, 1)
        parent.set(neighbour, frame.id)
        stack.push({ id: neighbour, index: 0 })
      }
    }
  }
  return []
}

/** Connected components, ignoring direction. */
export function components(document: GraphDocument): string[][] {
  const undirected = new Map<string, string[]>()
  for (const node of document.nodes) undirected.set(node.id, [])
  for (const edge of document.edges) {
    undirected.get(edge.source)?.push(edge.target)
    undirected.get(edge.target)?.push(edge.source)
  }

  const seen = new Set<string>()
  const groups: string[][] = []
  for (const node of document.nodes) {
    if (seen.has(node.id)) continue
    const group: string[] = []
    const queue = [node.id]
    seen.add(node.id)
    while (queue.length) {
      const current = queue.shift() as string
      group.push(current)
      for (const neighbour of undirected.get(current) ?? []) {
        if (seen.has(neighbour)) continue
        seen.add(neighbour)
        queue.push(neighbour)
      }
    }
    groups.push(group)
  }
  return groups
}

/** Nodes with no incoming edge — the roots of a tree or forest. */
export function roots(document: GraphDocument): string[] {
  const incoming = new Set(document.edges.map((edge) => edge.target))
  return document.nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id)
}

export function childrenOf(document: GraphDocument, id: string): string[] {
  return document.edges.filter((edge) => edge.source === id).map((edge) => edge.target)
}

// -------------------------------------------------------------- validation

function duplicateEdges(document: GraphDocument): Violation[] {
  const seen = new Map<string, string>()
  const offenders: string[] = []
  for (const edge of document.edges) {
    // An undirected pair is the same edge whichever way round it is drawn.
    const key = document.directed
      ? `${edge.source}>${edge.target}`
      : [edge.source, edge.target].sort().join('-')
    if (seen.has(key)) offenders.push(edge.id)
    else seen.set(key, edge.id)
  }
  return offenders.length
    ? [{ rule: 'parallel', message: `Có ${offenders.length} cạnh song song — đơn đồ thị không cho phép.`, edgeIds: offenders }]
    : []
}

function selfLoops(document: GraphDocument): Violation[] {
  const offenders = document.edges.filter((edge) => edge.source === edge.target).map((edge) => edge.id)
  return offenders.length
    ? [{ rule: 'self-loop', message: `Có ${offenders.length} khuyên (cạnh nối một đỉnh với chính nó).`, edgeIds: offenders }]
    : []
}

function acyclic(document: GraphDocument): Violation[] {
  const cycle = findCycle(document)
  return cycle.length
    ? [{ rule: 'acyclic', message: `Phát hiện chu trình: ${cycle.join(' → ')}.`, nodeIds: cycle }]
    : []
}

function atMostOneParent(document: GraphDocument): Violation[] {
  const parents = new Map<string, number>()
  for (const edge of document.edges) parents.set(edge.target, (parents.get(edge.target) ?? 0) + 1)
  const offenders = [...parents.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  return offenders.length
    ? [{ rule: 'single-parent', message: `${offenders.length} nút có nhiều hơn một cha.`, nodeIds: offenders }]
    : []
}

function singleRoot(document: GraphDocument): Violation[] {
  if (!document.nodes.length) return []
  const found = roots(document)
  if (found.length === 1) return []
  return [{
    rule: 'root',
    message: found.length === 0 ? 'Không có gốc: mọi nút đều có cha.' : `Có ${found.length} gốc — cây chỉ được có một.`,
    nodeIds: found
  }]
}

function maxChildren(document: GraphDocument, limit: number): Violation[] {
  const counts = new Map<string, number>()
  for (const edge of document.edges) counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1)
  const offenders = [...counts.entries()].filter(([, count]) => count > limit).map(([id]) => id)
  return offenders.length
    ? [{ rule: 'degree', message: `${offenders.length} nút có nhiều hơn ${limit} con.`, nodeIds: offenders }]
    : []
}

/** A node's numeric key, from `data.key` or from a label that parses as a number. */
export function nodeKey(node: GraphNode): number | null {
  const raw = node.data && node.data.key
  if (typeof raw === 'number') return raw
  const parsed = Number(node.label)
  return Number.isFinite(parsed) ? parsed : null
}

function heapProperty(document: GraphDocument, kind: 'min' | 'max'): Violation[] {
  const nodes = nodeMap(document)
  const offenders: string[] = []
  for (const edge of document.edges) {
    const parent = nodes.get(edge.source)
    const child = nodes.get(edge.target)
    if (!parent || !child) continue
    const parentKey = nodeKey(parent)
    const childKey = nodeKey(child)
    // Nodes without a numeric key are labels, not data; they are not evidence
    // of a broken heap.
    if (parentKey === null || childKey === null) continue
    const broken = kind === 'min' ? parentKey > childKey : parentKey < childKey
    if (broken) offenders.push(child.id)
  }
  return offenders.length
    ? [{
        rule: 'heap',
        message: `${offenders.length} nút vi phạm tính chất ${kind === 'min' ? 'min-heap (cha ≤ con)' : 'max-heap (cha ≥ con)'}.`,
        nodeIds: offenders
      }]
    : []
}

/**
 * BST ordering, checked with the interval method.
 *
 * Comparing each node only with its immediate children is the classic wrong
 * check: it accepts a left grandchild larger than the root. Carrying a
 * (low, high) bound down the tree is what makes the check correct.
 */
function bstProperty(document: GraphDocument): Violation[] {
  const nodes = nodeMap(document)
  const offenders: string[] = []

  const orderedChildren = (id: string): string[] => {
    const out = document.edges.filter((edge) => edge.source === id)
    // "left" is whichever child was marked so, else the one drawn further left.
    out.sort((a, b) => {
      const sideA = a.data && a.data.side === 'left' ? -1 : a.data && a.data.side === 'right' ? 1 : 0
      const sideB = b.data && b.data.side === 'left' ? -1 : b.data && b.data.side === 'right' ? 1 : 0
      if (sideA !== sideB) return sideA - sideB
      return (nodes.get(a.target)?.x ?? 0) - (nodes.get(b.target)?.x ?? 0)
    })
    return out.map((edge) => edge.target)
  }

  const walk = (id: string, low: number, high: number, depth: number) => {
    if (depth > 5000) return // a cycle; the acyclic rule reports that separately
    const node = nodes.get(id)
    if (!node) return
    const key = nodeKey(node)
    if (key !== null && (key <= low || key >= high)) offenders.push(id)

    const [left, right] = orderedChildren(id)
    if (left) walk(left, low, key ?? high, depth + 1)
    if (right) walk(right, key ?? low, high, depth + 1)
  }

  for (const root of roots(document)) walk(root, -Infinity, Infinity, 0)
  return offenders.length
    ? [{ rule: 'bst', message: `${offenders.length} nút sai thứ tự BST (trái < gốc < phải).`, nodeIds: offenders }]
    : []
}

function flowCapacities(document: GraphDocument): Violation[] {
  const offenders = document.edges
    .filter((edge) => edge.capacity !== undefined && edge.flow !== undefined && edge.flow > edge.capacity)
    .map((edge) => edge.id)
  return offenders.length
    ? [{ rule: 'capacity', message: `${offenders.length} cạnh có luồng vượt sức chứa.`, edgeIds: offenders }]
    : []
}

function danglingEdges(document: GraphDocument): Violation[] {
  const ids = new Set(document.nodes.map((node) => node.id))
  const offenders = document.edges.filter((edge) => !ids.has(edge.source) || !ids.has(edge.target)).map((edge) => edge.id)
  return offenders.length
    ? [{ rule: 'dangling', message: `${offenders.length} cạnh trỏ tới đỉnh không tồn tại.`, edgeIds: offenders }]
    : []
}

// ------------------------------------------------------------------- kinds

export const KINDS: Record<GraphKind, KindSpec> = {
  graph: {
    id: 'graph', label: 'Đơn đồ thị vô hướng',
    note: 'Không có cạnh song song, không có khuyên.',
    directed: false, weighted: false, allowParallel: false, allowSelfLoops: false,
    validate: (document) => [...duplicateEdges(document), ...selfLoops(document)]
  },
  multigraph: {
    id: 'multigraph', label: 'Đa đồ thị',
    note: 'Cho phép cạnh song song và khuyên.',
    directed: false, weighted: false, allowParallel: true, allowSelfLoops: true,
    validate: () => []
  },
  digraph: {
    id: 'digraph', label: 'Đồ thị có hướng',
    note: 'Cạnh có chiều; chu trình được phép.',
    directed: true, weighted: false, allowParallel: true, allowSelfLoops: true,
    validate: () => []
  },
  dag: {
    id: 'dag', label: 'DAG (có hướng, không chu trình)',
    note: 'Nền tảng của sắp xếp tô-pô, lịch biểu và đồ thị phụ thuộc.',
    directed: true, weighted: false, allowParallel: true, allowSelfLoops: false,
    validate: (document) => [...acyclic(document), ...selfLoops(document)]
  },
  flow: {
    id: 'flow', label: 'Mạng luồng',
    note: 'Cạnh có sức chứa và luồng; dùng cho luồng cực đại / lát cắt cực tiểu.',
    directed: true, weighted: true, allowParallel: false, allowSelfLoops: false,
    validate: (document) => [...flowCapacities(document), ...selfLoops(document)]
  },
  tree: {
    id: 'tree', label: 'Cây',
    note: 'Một gốc, mỗi nút một cha, không chu trình.',
    directed: true, weighted: false, allowParallel: false, allowSelfLoops: false,
    validate: (document) => [...atMostOneParent(document), ...acyclic(document), ...singleRoot(document)]
  },
  'binary-tree': {
    id: 'binary-tree', label: 'Cây nhị phân',
    note: 'Mỗi nút tối đa hai con, phân biệt trái và phải.',
    directed: true, weighted: false, allowParallel: false, allowSelfLoops: false,
    validate: (document) => [
      ...atMostOneParent(document), ...acyclic(document), ...singleRoot(document), ...maxChildren(document, 2)
    ]
  },
  bst: {
    id: 'bst', label: 'Cây tìm kiếm nhị phân',
    note: 'Cây nhị phân có thêm ràng buộc thứ tự — được kiểm bằng phương pháp khoảng.',
    directed: true, weighted: false, allowParallel: false, allowSelfLoops: false,
    validate: (document) => [
      ...atMostOneParent(document), ...acyclic(document), ...singleRoot(document),
      ...maxChildren(document, 2), ...bstProperty(document)
    ]
  },
  heap: {
    id: 'heap', label: 'Heap (đống)',
    note: 'Cây nhị phân có tính chất cha ≤ con (min-heap).',
    directed: true, weighted: false, allowParallel: false, allowSelfLoops: false,
    validate: (document) => [
      ...atMostOneParent(document), ...acyclic(document), ...maxChildren(document, 2), ...heapProperty(document, 'min')
    ]
  },
  'linked-list': {
    id: 'linked-list', label: 'Danh sách liên kết',
    note: 'Mỗi nút trỏ tới tối đa một nút kế tiếp.',
    directed: true, weighted: false, allowParallel: false, allowSelfLoops: false,
    nodeShape: 'rect',
    validate: (document) => [...maxChildren(document, 1), ...atMostOneParent(document)]
  },
  trie: {
    id: 'trie', label: 'Trie (cây tiền tố)',
    note: 'Cây mà mỗi cạnh mang một ký tự; các cạnh ra khỏi một nút phải khác ký tự.',
    directed: true, weighted: false, allowParallel: false, allowSelfLoops: false,
    nodeShape: 'circle',
    validate: (document) => {
      const base = [...atMostOneParent(document), ...acyclic(document), ...singleRoot(document)]
      const bySource = new Map<string, Set<string>>()
      const offenders: string[] = []
      for (const edge of document.edges) {
        const characters = bySource.get(edge.source) ?? new Set<string>()
        const character = (edge.label ?? '').trim()
        if (character && characters.has(character)) offenders.push(edge.id)
        if (character) characters.add(character)
        bySource.set(edge.source, characters)
      }
      if (offenders.length) {
        base.push({ rule: 'trie', message: `${offenders.length} cạnh trùng ký tự tại cùng một nút.`, edgeIds: offenders })
      }
      return base
    }
  },
  'state-machine': {
    id: 'state-machine', label: 'Máy trạng thái',
    note: 'Đồ thị có hướng, cạnh mang sự kiện; trạng thái kết thúc vẽ viền đôi.',
    directed: true, weighted: false, allowParallel: true, allowSelfLoops: true,
    nodeShape: 'stadium',
    validate: (document) => {
      const unlabelled = document.edges.filter((edge) => !edge.label || !edge.label.trim()).map((edge) => edge.id)
      return unlabelled.length
        ? [{ rule: 'transition', message: `${unlabelled.length} chuyển trạng thái chưa ghi sự kiện.`, edgeIds: unlabelled }]
        : []
    }
  },
  activity: {
    id: 'activity', label: 'Sơ đồ hoạt động / flowchart',
    note: 'Bắt đầu, hành động, quyết định, kết thúc. Nút quyết định phải có ≥ 2 nhánh.',
    directed: true, weighted: false, allowParallel: true, allowSelfLoops: false,
    nodeShape: 'rounded',
    validate: (document) => {
      const out = outDegree(document)
      const offenders = document.nodes
        .filter((node) => node.shape === 'diamond' && (out.get(node.id) ?? 0) < 2)
        .map((node) => node.id)
      return offenders.length
        ? [{ rule: 'decision', message: `${offenders.length} nút quyết định có ít hơn 2 nhánh ra.`, nodeIds: offenders }]
        : []
    }
  },
  free: {
    id: 'free', label: 'Tự do',
    note: 'Không ràng buộc gì — dùng để phác thảo.',
    directed: false, weighted: false, allowParallel: true, allowSelfLoops: true,
    validate: () => []
  }
}

/** Every rule the current kind imposes that the drawing currently breaks. */
export function validate(document: GraphDocument): Violation[] {
  const kind = KINDS[document.kind] ?? KINDS.free
  // Dangling edges are checked for every kind: they are corruption, not style.
  return [...danglingEdges(document), ...kind.validate(document)]
}

// --------------------------------------------------------------- documents

export function emptyDocument(kind: GraphKind = 'graph'): GraphDocument {
  const spec = KINDS[kind] ?? KINDS.graph
  return {
    version: 1,
    id: createDocumentId(),
    title: 'Đồ thị chưa đặt tên',
    kind,
    directed: spec.directed,
    weighted: spec.weighted,
    nodes: [],
    edges: [],
    annotations: [],
    defaults: { ...DEFAULT_DEFAULTS, nodeShape: spec.nodeShape ?? DEFAULT_DEFAULTS.nodeShape },
    view: { x: 0, y: 0, zoom: 1 },
    updatedAt: new Date().toISOString()
  }
}

export function makeNode(x: number, y: number, label?: string): GraphNode {
  const id = createId('n')
  return { id, label: label ?? '', x, y }
}

export function makeEdge(source: string, target: string, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return { id: createId('e'), source, target, ...overrides }
}

/**
 * Parallel edges between the same pair, in drawing order.
 *
 * The renderer needs this to bow the second and third edge of a pair out to
 * different sides; drawn on top of each other they look like one edge.
 */
export function parallelIndex(document: GraphDocument, edge: GraphEdge): { index: number; total: number } {
  const key = (candidate: GraphEdge) =>
    document.directed
      ? `${candidate.source}>${candidate.target}`
      : [candidate.source, candidate.target].sort().join('-')
  const siblings = document.edges.filter((candidate) => key(candidate) === key(edge))
  return { index: siblings.findIndex((candidate) => candidate.id === edge.id), total: siblings.length }
}

/**
 * Re-read a document from untrusted JSON.
 *
 * Documents arrive from a pasted file, a URL fragment and localStorage written
 * by an older build, so every field is checked. Edges pointing at nodes that
 * are not in the file are dropped rather than kept: a dangling edge would break
 * every layout and traversal downstream, and the user cannot repair one.
 */
export function parseDocument(raw: unknown): GraphDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, any>
  if (!Array.isArray(input.nodes)) return null

  const kind: GraphKind = KINDS[input.kind as GraphKind] ? input.kind : 'graph'
  const base = emptyDocument(kind)

  const nodes: GraphNode[] = []
  const seen = new Set<string>()
  for (const candidate of input.nodes) {
    if (!candidate || typeof candidate.id !== 'string' || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    nodes.push({
      id: candidate.id,
      label: typeof candidate.label === 'string' ? candidate.label : '',
      note: typeof candidate.note === 'string' ? candidate.note : undefined,
      x: Number(candidate.x) || 0,
      y: Number(candidate.y) || 0,
      width: Number(candidate.width) || undefined,
      height: Number(candidate.height) || undefined,
      shape: candidate.shape,
      fill: typeof candidate.fill === 'string' ? candidate.fill : undefined,
      stroke: typeof candidate.stroke === 'string' ? candidate.stroke : undefined,
      textColor: typeof candidate.textColor === 'string' ? candidate.textColor : undefined,
      badge: typeof candidate.badge === 'string' ? candidate.badge : undefined,
      pinned: Boolean(candidate.pinned),
      data: candidate.data && typeof candidate.data === 'object' ? candidate.data : undefined
    })
  }

  const edges: GraphEdge[] = []
  for (const candidate of Array.isArray(input.edges) ? input.edges : []) {
    if (!candidate || typeof candidate.source !== 'string' || typeof candidate.target !== 'string') continue
    if (!seen.has(candidate.source) || !seen.has(candidate.target)) continue
    edges.push({
      id: typeof candidate.id === 'string' ? candidate.id : createId('e'),
      source: candidate.source,
      target: candidate.target,
      label: typeof candidate.label === 'string' ? candidate.label : undefined,
      note: typeof candidate.note === 'string' ? candidate.note : undefined,
      weight: Number.isFinite(Number(candidate.weight)) && candidate.weight !== null && candidate.weight !== undefined
        ? Number(candidate.weight)
        : undefined,
      capacity: Number.isFinite(Number(candidate.capacity)) && candidate.capacity !== undefined ? Number(candidate.capacity) : undefined,
      flow: Number.isFinite(Number(candidate.flow)) && candidate.flow !== undefined ? Number(candidate.flow) : undefined,
      style: candidate.style,
      shape: candidate.shape,
      arrowHead: candidate.arrowHead,
      arrowTail: candidate.arrowTail,
      color: typeof candidate.color === 'string' ? candidate.color : undefined,
      curvature: Number(candidate.curvature) || undefined,
      data: candidate.data && typeof candidate.data === 'object' ? candidate.data : undefined
    })
  }

  return {
    ...base,
    id: typeof input.id === 'string' && input.id ? input.id : base.id,
    title: typeof input.title === 'string' && input.title ? input.title : base.title,
    directed: typeof input.directed === 'boolean' ? input.directed : base.directed,
    weighted: typeof input.weighted === 'boolean' ? input.weighted : base.weighted,
    nodes,
    edges,
    annotations: Array.isArray(input.annotations)
      ? input.annotations
          .filter((item: any) => item && typeof item.text === 'string')
          .map((item: any) => ({
            id: typeof item.id === 'string' ? item.id : createId('a'),
            text: item.text,
            x: Number(item.x) || 0,
            y: Number(item.y) || 0,
            color: typeof item.color === 'string' ? item.color : undefined
          }))
      : [],
    defaults: { ...base.defaults, ...(input.defaults && typeof input.defaults === 'object' ? input.defaults : {}) },
    view: {
      x: Number(input.view?.x) || 0,
      y: Number(input.view?.y) || 0,
      zoom: Number(input.view?.zoom) || 1
    },
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString()
  }
}
