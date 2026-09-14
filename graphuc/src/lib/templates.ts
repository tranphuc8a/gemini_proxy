/**
 * Starting points.
 *
 * Every template is a complete, valid document of its kind. They exist because
 * the hardest part of drawing a binary tree is the first six nodes: once the
 * shape is on the canvas the editing is obvious, and a student can start from
 * "here is a BST" rather than from an empty page.
 *
 * Positions are computed by the layout functions rather than written out, so a
 * template stays right when the spacing constants change.
 */

import type { GraphDocument, GraphEdge, GraphKind, GraphNode } from '../types'
import { emptyDocument, makeEdge } from './graph'
import { circularLayout, treeLayout } from './layout'

export interface Template {
  id: string
  label: string
  kind: GraphKind
  note: string
  build: () => GraphDocument
}

function node(id: string, label: string, extra: Partial<GraphNode> = {}): GraphNode {
  return { id, label, x: 0, y: 0, ...extra }
}

function applyLayout(document: GraphDocument, positions: Map<string, { x: number; y: number }>): GraphDocument {
  return {
    ...document,
    nodes: document.nodes.map((item) => ({ ...item, ...(positions.get(item.id) ?? {}) }))
  }
}

function assemble(kind: GraphKind, title: string, nodes: GraphNode[], edges: GraphEdge[], layout: 'tree' | 'circle' = 'tree'): GraphDocument {
  const base: GraphDocument = { ...emptyDocument(kind), title, nodes, edges }
  const positions = layout === 'tree' ? treeLayout(base) : circularLayout(base)
  return applyLayout(base, positions)
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    label: 'Trang trắng',
    kind: 'graph',
    note: 'Bắt đầu từ con số không.',
    build: () => emptyDocument('graph')
  },

  {
    id: 'undirected',
    label: 'Đơn đồ thị 6 đỉnh',
    kind: 'graph',
    note: 'Đồ thị vô hướng nhỏ để thử BFS, DFS và thành phần liên thông.',
    build: () => {
      const ids = ['A', 'B', 'C', 'D', 'E', 'F']
      const nodes = ids.map((id) => node(id, id))
      const pairs: [string, string][] = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['C', 'F']]
      return assemble('graph', 'Đơn đồ thị 6 đỉnh', nodes, pairs.map(([a, b]) => makeEdge(a, b)), 'circle')
    }
  },

  {
    id: 'weighted',
    label: 'Đồ thị có trọng số',
    kind: 'graph',
    note: 'Dùng cho Dijkstra và cây khung nhỏ nhất.',
    build: () => {
      const ids = ['S', 'A', 'B', 'C', 'D', 'T']
      const nodes = ids.map((id) => node(id, id))
      const spec: [string, string, number][] = [
        ['S', 'A', 4], ['S', 'B', 2], ['A', 'B', 1], ['A', 'C', 5],
        ['B', 'D', 8], ['C', 'D', 2], ['C', 'T', 6], ['D', 'T', 3]
      ]
      const document = assemble('graph', 'Đồ thị có trọng số', nodes, spec.map(([a, b, w]) => makeEdge(a, b, { weight: w, label: String(w) })), 'circle')
      return { ...document, weighted: true }
    }
  },

  {
    id: 'dag',
    label: 'DAG — lịch môn học',
    kind: 'dag',
    note: 'Đồ thị phụ thuộc: sắp xếp tô-pô cho ra một thứ tự học hợp lệ.',
    build: () => {
      const nodes = [
        node('gt1', 'Giải tích 1'), node('gt2', 'Giải tích 2'), node('dstt', 'ĐS tuyến tính'),
        node('ctdl', 'CTDL & GT'), node('ltc', 'Lập trình C'), node('ml', 'Học máy'), node('db', 'CSDL')
      ]
      const edges = [
        makeEdge('gt1', 'gt2'), makeEdge('gt2', 'ml'), makeEdge('dstt', 'ml'),
        makeEdge('ltc', 'ctdl'), makeEdge('ctdl', 'ml'), makeEdge('ctdl', 'db')
      ]
      return assemble('dag', 'DAG — lịch môn học', nodes, edges)
    }
  },

  {
    id: 'flow',
    label: 'Mạng luồng',
    kind: 'flow',
    note: 'Nguồn S, đích T, cạnh ghi luồng/sức chứa.',
    build: () => {
      const nodes = [node('S', 'S'), node('A', 'A'), node('B', 'B'), node('C', 'C'), node('D', 'D'), node('T', 'T')]
      const spec: [string, string, number][] = [
        ['S', 'A', 10], ['S', 'B', 8], ['A', 'B', 2], ['A', 'C', 5],
        ['B', 'D', 10], ['C', 'T', 7], ['D', 'C', 6], ['D', 'T', 10]
      ]
      const edges = spec.map(([a, b, capacity]) => makeEdge(a, b, { capacity, flow: 0, label: `0/${capacity}` }))
      const document = assemble('flow', 'Mạng luồng', nodes, edges)
      return { ...document, weighted: true }
    }
  },

  {
    id: 'binary-tree',
    label: 'Cây nhị phân',
    kind: 'binary-tree',
    note: 'Bảy nút, đầy đủ ba mức.',
    build: () => {
      const values = [1, 2, 3, 4, 5, 6, 7]
      const nodes = values.map((value) => node('t' + value, String(value)))
      const edges: GraphEdge[] = []
      for (let i = 0; i < values.length; i++) {
        const left = 2 * i + 1
        const right = 2 * i + 2
        if (left < values.length) edges.push(makeEdge('t' + values[i], 't' + values[left], { data: { side: 'left' } }))
        if (right < values.length) edges.push(makeEdge('t' + values[i], 't' + values[right], { data: { side: 'right' } }))
      }
      return assemble('binary-tree', 'Cây nhị phân', nodes, edges)
    }
  },

  {
    id: 'bst',
    label: 'Cây tìm kiếm nhị phân',
    kind: 'bst',
    note: 'Trái < gốc < phải. Trình kiểm tra dùng phương pháp khoảng, không chỉ so với con trực tiếp.',
    build: () => {
      // Inserted in this order into an initially empty BST.
      const inserts = [50, 30, 70, 20, 40, 60, 80]
      const nodes: GraphNode[] = []
      const edges: GraphEdge[] = []
      const children = new Map<number, { left?: number; right?: number }>()

      for (const value of inserts) {
        nodes.push(node('k' + value, String(value), { data: { key: value } }))
        if (nodes.length === 1) continue
        let current = inserts[0]
        for (;;) {
          const slot = children.get(current) ?? {}
          const side = value < current ? 'left' : 'right'
          const existing = side === 'left' ? slot.left : slot.right
          if (existing === undefined) {
            children.set(current, { ...slot, [side]: value })
            edges.push(makeEdge('k' + current, 'k' + value, { data: { side } }))
            break
          }
          current = existing
        }
      }
      return assemble('bst', 'Cây tìm kiếm nhị phân', nodes, edges)
    }
  },

  {
    id: 'heap',
    label: 'Min-heap',
    kind: 'heap',
    note: 'Cây nhị phân hoàn chỉnh, cha luôn ≤ con.',
    build: () => {
      const values = [1, 3, 6, 5, 9, 8, 7]
      const nodes = values.map((value, index) => node('h' + index, String(value), { data: { key: value } }))
      const edges: GraphEdge[] = []
      for (let i = 0; i < values.length; i++) {
        if (2 * i + 1 < values.length) edges.push(makeEdge('h' + i, 'h' + (2 * i + 1), { data: { side: 'left' } }))
        if (2 * i + 2 < values.length) edges.push(makeEdge('h' + i, 'h' + (2 * i + 2), { data: { side: 'right' } }))
      }
      return assemble('heap', 'Min-heap', nodes, edges)
    }
  },

  {
    id: 'linked-list',
    label: 'Danh sách liên kết đơn',
    kind: 'linked-list',
    note: 'head → … → null. Mỗi nút một con trỏ next.',
    build: () => {
      const values = ['head', '12', '7', '41', '5']
      const nodes = values.map((value, index) => node('l' + index, value, { shape: 'rect', width: 78, height: 44 }))
      const edges = nodes.slice(0, -1).map((item, index) => makeEdge(item.id, nodes[index + 1].id, { label: 'next' }))
      const document: GraphDocument = { ...emptyDocument('linked-list'), title: 'Danh sách liên kết đơn', nodes, edges }
      // A horizontal run rather than a layout: a list is a line, and the tree
      // layout would stack it vertically.
      return {
        ...document,
        nodes: document.nodes.map((item, index) => ({ ...item, x: 100 + index * 140, y: 220 }))
      }
    }
  },

  {
    id: 'trie',
    label: 'Trie — "to, tea, ted, ten, a, i, in, inn"',
    kind: 'trie',
    note: 'Cạnh mang ký tự; nút kết thúc từ được đánh dấu ★.',
    build: () => {
      const words = ['to', 'tea', 'ted', 'ten', 'a', 'i', 'in', 'inn']
      const nodes: GraphNode[] = [node('root', '·')]
      const edges: GraphEdge[] = []
      const children = new Map<string, Map<string, string>>()

      for (const word of words) {
        let current = 'root'
        for (const character of word) {
          const level = children.get(current) ?? new Map<string, string>()
          let nextId = level.get(character)
          if (!nextId) {
            nextId = `${current}-${character}`
            level.set(character, nextId)
            children.set(current, level)
            nodes.push(node(nextId, character))
            edges.push(makeEdge(current, nextId, { label: character }))
          }
          current = nextId
        }
        const terminal = nodes.find((item) => item.id === current)
        if (terminal) terminal.badge = '★'
      }
      return assemble('trie', 'Trie', nodes, edges)
    }
  },

  {
    id: 'state-machine',
    label: 'Máy trạng thái — đèn giao thông',
    kind: 'state-machine',
    note: 'Ba trạng thái, chuyển theo sự kiện hẹn giờ.',
    build: () => {
      const nodes = [
        node('red', 'Đỏ', { shape: 'stadium', fill: '#7f1d1d' }),
        node('green', 'Xanh', { shape: 'stadium', fill: '#14532d' }),
        node('amber', 'Vàng', { shape: 'stadium', fill: '#78350f' })
      ]
      const edges = [
        makeEdge('red', 'green', { label: 'hết 30s' }),
        makeEdge('green', 'amber', { label: 'hết 25s' }),
        makeEdge('amber', 'red', { label: 'hết 5s' })
      ]
      return assemble('state-machine', 'Máy trạng thái — đèn giao thông', nodes, edges, 'circle')
    }
  },

  {
    id: 'activity',
    label: 'Sơ đồ hoạt động — đăng nhập',
    kind: 'activity',
    note: 'Bắt đầu, hành động, quyết định, kết thúc.',
    build: () => {
      const nodes = [
        node('start', 'Bắt đầu', { shape: 'stadium', width: 96, height: 40 }),
        node('form', 'Nhập tài khoản', { shape: 'rounded', width: 130, height: 48 }),
        node('check', 'Hợp lệ?', { shape: 'diamond', width: 110, height: 70 }),
        node('ok', 'Vào trang chủ', { shape: 'rounded', width: 130, height: 48 }),
        node('fail', 'Báo lỗi', { shape: 'rounded', width: 110, height: 48 }),
        node('end', 'Kết thúc', { shape: 'stadium', width: 96, height: 40 })
      ]
      const edges = [
        makeEdge('start', 'form'),
        makeEdge('form', 'check'),
        makeEdge('check', 'ok', { label: 'đúng' }),
        makeEdge('check', 'fail', { label: 'sai' }),
        makeEdge('fail', 'form', { label: 'thử lại', shape: 'curved', curvature: 60 }),
        makeEdge('ok', 'end')
      ]
      return assemble('activity', 'Sơ đồ hoạt động — đăng nhập', nodes, edges)
    }
  },

  {
    id: 'complete',
    label: 'Đồ thị đầy đủ K₆',
    kind: 'graph',
    note: 'Mọi cặp đỉnh đều có cạnh — 15 cạnh trên 6 đỉnh.',
    build: () => {
      const ids = ['1', '2', '3', '4', '5', '6']
      const nodes = ids.map((id) => node('k' + id, id))
      const edges: GraphEdge[] = []
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) edges.push(makeEdge('k' + ids[a], 'k' + ids[b]))
      }
      return assemble('graph', 'Đồ thị đầy đủ K₆', nodes, edges, 'circle')
    }
  },

  {
    id: 'bipartite',
    label: 'Đồ thị 2-phân K₃,₃',
    kind: 'graph',
    note: 'Đồ thị 2-phân đầy đủ nhỏ nhất không phẳng.',
    build: () => {
      const left = ['u1', 'u2', 'u3']
      const right = ['v1', 'v2', 'v3']
      const nodes = [...left, ...right].map((id) => node(id, id))
      const edges: GraphEdge[] = []
      for (const a of left) {
        for (const b of right) edges.push(makeEdge(a, b))
      }
      const document: GraphDocument = { ...emptyDocument('graph'), title: 'Đồ thị 2-phân K₃,₃', nodes, edges }
      return {
        ...document,
        nodes: document.nodes.map((item, index) => ({
          ...item,
          x: index < 3 ? 180 : 520,
          y: 120 + (index % 3) * 120
        }))
      }
    }
  },

  {
    id: 'multigraph',
    label: 'Đa đồ thị có khuyên',
    kind: 'multigraph',
    note: 'Cạnh song song và khuyên — để thấy cách trình vẽ tách chúng ra.',
    build: () => {
      const nodes = ['P', 'Q', 'R'].map((id) => node(id, id))
      const edges = [
        makeEdge('P', 'Q'), makeEdge('P', 'Q'), makeEdge('P', 'Q'),
        makeEdge('Q', 'R'), makeEdge('R', 'R'), makeEdge('P', 'P')
      ]
      return assemble('multigraph', 'Đa đồ thị có khuyên', nodes, edges, 'circle')
    }
  }
]

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id)
}
