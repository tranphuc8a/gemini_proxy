/**
 * Classic graph algorithms, recorded step by step.
 *
 * The point of this app is studying data structures, so an algorithm that only
 * returns an answer is half useless. Each one here returns a list of `Step`s —
 * what it was looking at, what it had settled, and a sentence saying why — and
 * the canvas replays them. The final answer is just the last step.
 *
 * Every algorithm is iterative. A DFS drawn as a thousand-node path would blow
 * the call stack, and the whole point of this editor is that such drawings are
 * easy to make.
 */

import type { GraphDocument } from '../types'
import { nodeMap } from './graph'

export interface Step {
  /** Nodes to highlight as "being looked at right now". */
  active: string[]
  /** Nodes already settled: visited, finalised, in the tree. */
  settled: string[]
  /** Edges that are part of the answer so far. */
  edges: string[]
  /** One sentence for the step log. */
  message: string
  /** Optional per-node numbers to draw: distances, discovery order, ranks. */
  labels?: Record<string, string>
}

export interface AlgorithmResult {
  steps: Step[]
  summary: string
  /** Set when the algorithm cannot run on this document, with the reason. */
  error?: string
}

export type AlgorithmId =
  | 'bfs' | 'dfs' | 'topological' | 'dijkstra' | 'mst' | 'components' | 'bipartite' | 'cycle'

export interface AlgorithmSpec {
  id: AlgorithmId
  label: string
  note: string
  /** Does it need a start node chosen? */
  needsStart: boolean
}

export const ALGORITHMS: AlgorithmSpec[] = [
  { id: 'bfs', label: 'BFS — duyệt theo chiều rộng', note: 'Thăm theo từng lớp; trên đồ thị không trọng số đây chính là đường đi ngắn nhất.', needsStart: true },
  { id: 'dfs', label: 'DFS — duyệt theo chiều sâu', note: 'Đi sâu hết mức rồi mới quay lui.', needsStart: true },
  { id: 'dijkstra', label: 'Dijkstra — đường đi ngắn nhất', note: 'Cần trọng số không âm.', needsStart: true },
  { id: 'topological', label: 'Sắp xếp tô-pô', note: 'Chỉ áp dụng cho DAG; báo lỗi nếu có chu trình.', needsStart: false },
  { id: 'mst', label: 'Cây khung nhỏ nhất (Kruskal)', note: 'Đồ thị vô hướng có trọng số.', needsStart: false },
  { id: 'components', label: 'Thành phần liên thông', note: 'Tô màu từng mảnh rời nhau.', needsStart: false },
  { id: 'bipartite', label: 'Kiểm tra 2-phân', note: 'Tô 2 màu; thất bại đúng khi có chu trình lẻ.', needsStart: false },
  { id: 'cycle', label: 'Tìm chu trình', note: 'Chỉ ra một chu trình cụ thể nếu có.', needsStart: false }
]

interface Arc {
  to: string
  edgeId: string
  weight: number
}

/** Outgoing arcs, with undirected edges appearing in both directions. */
function arcs(document: GraphDocument): Map<string, Arc[]> {
  const out = new Map<string, Arc[]>()
  for (const node of document.nodes) out.set(node.id, [])
  for (const edge of document.edges) {
    // An unweighted edge is weight 1, which is what makes BFS and Dijkstra
    // agree on a graph nobody has put numbers on.
    const weight = edge.weight ?? 1
    out.get(edge.source)?.push({ to: edge.target, edgeId: edge.id, weight })
    if (!document.directed) out.get(edge.target)?.push({ to: edge.source, edgeId: edge.id, weight })
  }
  return out
}

function label(document: GraphDocument, id: string): string {
  const node = document.nodes.find((candidate) => candidate.id === id)
  return node && node.label ? node.label : id.slice(0, 6)
}

// ------------------------------------------------------------------- walks

function bfs(document: GraphDocument, start: string): AlgorithmResult {
  const next = arcs(document)
  const steps: Step[] = []
  const settled: string[] = []
  const treeEdges: string[] = []
  const distance = new Map<string, number>([[start, 0]])
  const queue: string[] = [start]
  const seen = new Set([start])

  steps.push({ active: [start], settled: [], edges: [], message: `Bắt đầu từ ${label(document, start)}, khoảng cách 0.`, labels: { [start]: '0' } })

  while (queue.length) {
    const current = queue.shift() as string
    settled.push(current)
    const discovered: string[] = []

    for (const arc of next.get(current) ?? []) {
      if (seen.has(arc.to)) continue
      seen.add(arc.to)
      distance.set(arc.to, (distance.get(current) ?? 0) + 1)
      treeEdges.push(arc.edgeId)
      queue.push(arc.to)
      discovered.push(arc.to)
    }

    steps.push({
      active: discovered,
      settled: [...settled],
      edges: [...treeEdges],
      message: discovered.length
        ? `Thăm ${label(document, current)}, phát hiện ${discovered.map((id) => label(document, id)).join(', ')}.`
        : `Thăm ${label(document, current)} — không còn đỉnh mới.`,
      labels: Object.fromEntries([...distance].map(([id, value]) => [id, String(value)]))
    })
  }

  const unreached = document.nodes.length - settled.length
  return {
    steps,
    summary: `Đã thăm ${settled.length}/${document.nodes.length} đỉnh.` + (unreached ? ` ${unreached} đỉnh không tới được từ đỉnh xuất phát.` : '')
  }
}

function dfs(document: GraphDocument, start: string): AlgorithmResult {
  const next = arcs(document)
  const steps: Step[] = []
  const settled: string[] = []
  const treeEdges: string[] = []
  const seen = new Set<string>()
  const order = new Map<string, number>()
  // Explicit stack: a deep drawing would overflow the call stack.
  const stack: { id: string; via?: string }[] = [{ id: start }]

  while (stack.length) {
    const frame = stack.pop() as { id: string; via?: string }
    if (seen.has(frame.id)) continue
    seen.add(frame.id)
    order.set(frame.id, order.size + 1)
    settled.push(frame.id)
    if (frame.via) treeEdges.push(frame.via)

    steps.push({
      active: [frame.id],
      settled: [...settled],
      edges: [...treeEdges],
      message: `Thăm ${label(document, frame.id)} (thứ tự ${order.get(frame.id)}).`,
      labels: Object.fromEntries([...order].map(([id, value]) => [id, String(value)]))
    })

    const neighbours = [...(next.get(frame.id) ?? [])].reverse()
    for (const arc of neighbours) {
      if (!seen.has(arc.to)) stack.push({ id: arc.to, via: arc.edgeId })
    }
  }

  return { steps, summary: `Duyệt sâu qua ${settled.length}/${document.nodes.length} đỉnh.` }
}

// -------------------------------------------------------------- shortest path

function dijkstra(document: GraphDocument, start: string): AlgorithmResult {
  const negative = document.edges.find((edge) => (edge.weight ?? 1) < 0)
  if (negative) {
    return { steps: [], summary: '', error: 'Dijkstra không chạy được khi có cạnh trọng số âm — hãy dùng Bellman–Ford.' }
  }

  const next = arcs(document)
  const distance = new Map<string, number>()
  const via = new Map<string, string>()
  const settled: string[] = []
  const treeEdges: string[] = []
  const steps: Step[] = []
  for (const node of document.nodes) distance.set(node.id, Infinity)
  distance.set(start, 0)

  const remaining = new Set(document.nodes.map((node) => node.id))
  const format = () =>
    Object.fromEntries(
      [...distance].map(([id, value]) => [id, Number.isFinite(value) ? String(value) : '∞'])
    )

  steps.push({ active: [start], settled: [], edges: [], message: `d(${label(document, start)}) = 0, mọi đỉnh khác = ∞.`, labels: format() })

  while (remaining.size) {
    // A linear scan rather than a heap: these graphs are drawn by hand, and the
    // scan is what makes "pick the nearest unsettled vertex" visible in the log.
    let current: string | null = null
    let best = Infinity
    for (const id of remaining) {
      const value = distance.get(id) ?? Infinity
      if (value < best) { best = value; current = id }
    }
    if (current === null) break // everything left is unreachable

    remaining.delete(current)
    settled.push(current)
    const relaxed: string[] = []

    for (const arc of next.get(current) ?? []) {
      if (!remaining.has(arc.to)) continue
      const candidate = best + arc.weight
      if (candidate < (distance.get(arc.to) ?? Infinity)) {
        distance.set(arc.to, candidate)
        via.set(arc.to, arc.edgeId)
        relaxed.push(arc.to)
      }
    }

    treeEdges.length = 0
    for (const edgeId of via.values()) treeEdges.push(edgeId)

    steps.push({
      active: relaxed,
      settled: [...settled],
      edges: [...treeEdges],
      message: relaxed.length
        ? `Chốt ${label(document, current)} ở khoảng cách ${best}; cập nhật ${relaxed.map((id) => label(document, id)).join(', ')}.`
        : `Chốt ${label(document, current)} ở khoảng cách ${Number.isFinite(best) ? best : '∞'}.`,
      labels: format()
    })
  }

  const reached = [...distance.values()].filter((value) => Number.isFinite(value)).length
  return { steps, summary: `Tới được ${reached}/${document.nodes.length} đỉnh từ ${label(document, start)}.` }
}

// --------------------------------------------------------------- structure

function topological(document: GraphDocument): AlgorithmResult {
  if (!document.directed) {
    return { steps: [], summary: '', error: 'Sắp xếp tô-pô chỉ có nghĩa với đồ thị có hướng.' }
  }

  const indegree = new Map<string, number>()
  for (const node of document.nodes) indegree.set(node.id, 0)
  for (const edge of document.edges) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)

  const next = arcs(document)
  const queue = document.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const order: string[] = []
  const steps: Step[] = []

  steps.push({
    active: [...queue],
    settled: [],
    edges: [],
    message: queue.length ? `Bắt đầu với ${queue.length} đỉnh không có cạnh vào.` : 'Không có đỉnh nào bậc vào bằng 0 — chắc chắn có chu trình.'
  })

  while (queue.length) {
    const current = queue.shift() as string
    order.push(current)
    const freed: string[] = []
    for (const arc of next.get(current) ?? []) {
      const left = (indegree.get(arc.to) ?? 0) - 1
      indegree.set(arc.to, left)
      if (left === 0) { queue.push(arc.to); freed.push(arc.to) }
    }
    steps.push({
      active: freed,
      settled: [...order],
      edges: [],
      message: `Lấy ${label(document, current)} (vị trí ${order.length}).`,
      labels: Object.fromEntries(order.map((id, index) => [id, String(index + 1)]))
    })
  }

  if (order.length !== document.nodes.length) {
    return {
      steps,
      summary: '',
      error: `Chỉ xếp được ${order.length}/${document.nodes.length} đỉnh — phần còn lại nằm trên chu trình, nên đồ thị không phải DAG.`
    }
  }
  return { steps, summary: `Thứ tự tô-pô: ${order.map((id) => label(document, id)).join(' → ')}` }
}

function mst(document: GraphDocument): AlgorithmResult {
  if (document.directed) {
    return { steps: [], summary: '', error: 'Cây khung nhỏ nhất định nghĩa trên đồ thị vô hướng.' }
  }

  // Union–find with path compression. Kruskal is the algorithm worth showing
  // here because each step is a decision a reader can check by eye: take the
  // cheapest edge that does not close a cycle.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root) as string
    let walk = id
    while (parent.get(walk) !== root) {
      const up = parent.get(walk) as string
      parent.set(walk, root)
      walk = up
    }
    return root
  }
  for (const node of document.nodes) parent.set(node.id, node.id)

  const sorted = [...document.edges].sort((a, b) => (a.weight ?? 1) - (b.weight ?? 1))
  const chosen: string[] = []
  const settled: string[] = []
  const steps: Step[] = []
  let total = 0

  for (const edge of sorted) {
    const rootA = find(edge.source)
    const rootB = find(edge.target)
    const weight = edge.weight ?? 1
    if (rootA === rootB) {
      steps.push({
        active: [edge.source, edge.target],
        settled: [...settled],
        edges: [...chosen],
        message: `Bỏ cạnh ${label(document, edge.source)}–${label(document, edge.target)} (${weight}): sẽ tạo chu trình.`
      })
      continue
    }
    parent.set(rootA, rootB)
    chosen.push(edge.id)
    total += weight
    for (const id of [edge.source, edge.target]) {
      if (!settled.includes(id)) settled.push(id)
    }
    steps.push({
      active: [edge.source, edge.target],
      settled: [...settled],
      edges: [...chosen],
      message: `Chọn cạnh ${label(document, edge.source)}–${label(document, edge.target)} trọng số ${weight}. Tổng = ${total}.`
    })
  }

  const spanning = chosen.length === document.nodes.length - 1
  return {
    steps,
    summary: spanning
      ? `Cây khung nhỏ nhất gồm ${chosen.length} cạnh, tổng trọng số ${total}.`
      : `Đồ thị không liên thông: được rừng khung ${chosen.length} cạnh, tổng trọng số ${total}.`
  }
}

function connectedComponents(document: GraphDocument): AlgorithmResult {
  const undirected = new Map<string, { to: string; edgeId: string }[]>()
  for (const node of document.nodes) undirected.set(node.id, [])
  for (const edge of document.edges) {
    undirected.get(edge.source)?.push({ to: edge.target, edgeId: edge.id })
    undirected.get(edge.target)?.push({ to: edge.source, edgeId: edge.id })
  }

  const seen = new Set<string>()
  const steps: Step[] = []
  const settled: string[] = []
  const labels: Record<string, string> = {}
  let group = 0

  for (const node of document.nodes) {
    if (seen.has(node.id)) continue
    group += 1
    const members: string[] = []
    const queue = [node.id]
    seen.add(node.id)
    while (queue.length) {
      const current = queue.shift() as string
      members.push(current)
      settled.push(current)
      labels[current] = String(group)
      for (const arc of undirected.get(current) ?? []) {
        if (seen.has(arc.to)) continue
        seen.add(arc.to)
        queue.push(arc.to)
      }
    }
    steps.push({
      active: members,
      settled: [...settled],
      edges: [],
      message: `Thành phần ${group}: ${members.length} đỉnh.`,
      labels: { ...labels }
    })
  }

  return { steps, summary: `${group} thành phần liên thông.` }
}

function bipartite(document: GraphDocument): AlgorithmResult {
  const undirected = new Map<string, { to: string; edgeId: string }[]>()
  for (const node of document.nodes) undirected.set(node.id, [])
  for (const edge of document.edges) {
    undirected.get(edge.source)?.push({ to: edge.target, edgeId: edge.id })
    undirected.get(edge.target)?.push({ to: edge.source, edgeId: edge.id })
  }

  const colour = new Map<string, 0 | 1>()
  const steps: Step[] = []
  const settled: string[] = []
  let conflict: { edgeId: string; a: string; b: string } | null = null

  for (const node of document.nodes) {
    if (colour.has(node.id)) continue
    colour.set(node.id, 0)
    const queue = [node.id]
    while (queue.length) {
      const current = queue.shift() as string
      settled.push(current)
      const own = colour.get(current) as 0 | 1
      for (const arc of undirected.get(current) ?? []) {
        if (!colour.has(arc.to)) {
          colour.set(arc.to, own === 0 ? 1 : 0)
          queue.push(arc.to)
        } else if (colour.get(arc.to) === own && !conflict) {
          conflict = { edgeId: arc.edgeId, a: current, b: arc.to }
        }
      }
      steps.push({
        active: [current],
        settled: [...settled],
        edges: conflict ? [conflict.edgeId] : [],
        message: conflict
          ? `Xung đột: ${label(document, conflict.a)} và ${label(document, conflict.b)} kề nhau nhưng cùng màu.`
          : `Tô ${label(document, current)} màu ${own === 0 ? 'A' : 'B'}.`,
        labels: Object.fromEntries([...colour].map(([id, value]) => [id, value === 0 ? 'A' : 'B']))
      })
      if (conflict) break
    }
    if (conflict) break
  }

  return {
    steps,
    summary: conflict
      ? 'Không phải đồ thị 2-phân: tồn tại chu trình độ dài lẻ.'
      : 'Đồ thị 2-phân — tô được bằng đúng 2 màu.'
  }
}

function findCycleSteps(document: GraphDocument): AlgorithmResult {
  // Re-implemented here rather than reusing lib/graph's findCycle because this
  // one has to narrate: the steps are the deliverable, not the boolean.
  const next = arcs(document)
  const state = new Map<string, 0 | 1 | 2>()
  const steps: Step[] = []
  const settled: string[] = []

  for (const start of document.nodes) {
    if (state.get(start.id)) continue
    const stack: { id: string; index: number; via?: string }[] = [{ id: start.id, index: 0 }]
    state.set(start.id, 1)

    while (stack.length) {
      const frame = stack[stack.length - 1]
      const neighbours = next.get(frame.id) ?? []
      if (frame.index >= neighbours.length) {
        state.set(frame.id, 2)
        settled.push(frame.id)
        stack.pop()
        continue
      }
      const arc = neighbours[frame.index++]
      if (!document.directed && frame.via === arc.edgeId) continue

      if (state.get(arc.to) === 1) {
        const path: string[] = []
        const edges: string[] = [arc.edgeId]
        for (let i = stack.length - 1; i >= 0; i--) {
          path.push(stack[i].id)
          if (stack[i].via) edges.push(stack[i].via as string)
          if (stack[i].id === arc.to) break
        }
        path.reverse()
        steps.push({
          active: path,
          settled: [...settled],
          edges,
          message: `Tìm thấy chu trình: ${path.map((id) => label(document, id)).join(' → ')} → ${label(document, arc.to)}.`
        })
        return { steps, summary: `Có chu trình độ dài ${path.length}.` }
      }

      if (!state.get(arc.to)) {
        state.set(arc.to, 1)
        stack.push({ id: arc.to, index: 0, via: arc.edgeId })
        steps.push({
          active: [arc.to],
          settled: [...settled],
          edges: stack.map((item) => item.via).filter(Boolean) as string[],
          message: `Đi sâu tới ${label(document, arc.to)}.`
        })
      }
    }
  }

  return { steps, summary: document.directed ? 'Không có chu trình — đây là một DAG.' : 'Không có chu trình — đây là một rừng.' }
}

// ------------------------------------------------------------------- entry

export function runAlgorithm(document: GraphDocument, id: AlgorithmId, start?: string): AlgorithmResult {
  if (!document.nodes.length) return { steps: [], summary: '', error: 'Đồ thị chưa có đỉnh nào.' }

  const spec = ALGORITHMS.find((candidate) => candidate.id === id)
  if (spec?.needsStart) {
    const chosen = start && nodeMap(document).has(start) ? start : document.nodes[0].id
    switch (id) {
      case 'bfs': return bfs(document, chosen)
      case 'dfs': return dfs(document, chosen)
      case 'dijkstra': return dijkstra(document, chosen)
      default: break
    }
  }

  switch (id) {
    case 'topological': return topological(document)
    case 'mst': return mst(document)
    case 'components': return connectedComponents(document)
    case 'bipartite': return bipartite(document)
    case 'cycle': return findCycleSteps(document)
    default: return { steps: [], summary: '', error: 'Thuật toán không tồn tại.' }
  }
}
