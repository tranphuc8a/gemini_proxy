/**
 * The graph document.
 *
 * One structure has to cover every drawing this editor makes: a plain
 * undirected graph, a DAG, a binary tree, a linked list, a heap, a trie, a
 * state machine. They differ in the *constraints* they are drawn under, not in
 * what they are made of — all of them are nodes with positions and edges
 * between them. So there is one node type and one edge type, and a `kind` on
 * the document that says which rules the editor enforces while drawing.
 *
 * That choice is what lets an activity diagram be exported, re-imported and
 * edited as a graph, and a tree be turned into a general graph without a
 * conversion step. The cost is that the constraints live in `lib/graph.ts`
 * rather than in the type system, which is the right trade when a user is
 * allowed to change a drawing's kind halfway through.
 */

/** Which family of diagram a document belongs to. */
export type GraphKind =
  | 'graph'          // simple undirected graph
  | 'multigraph'     // parallel edges and self-loops allowed
  | 'digraph'        // directed
  | 'dag'            // directed, cycles refused
  | 'flow'           // directed with capacities on the edges
  | 'tree'           // one parent per node, no cycles
  | 'binary-tree'    // at most two children, ordered left/right
  | 'bst'            // binary tree with the ordering invariant checked
  | 'heap'           // complete binary tree with the heap invariant checked
  | 'linked-list'    // at most one successor per node
  | 'trie'           // tree whose edges carry characters
  | 'state-machine'  // directed, edges carry transitions, nodes can be final
  | 'activity'       // flowchart: start/end/decision/action nodes
  | 'free'           // no constraints at all

export type NodeShape =
  | 'circle'
  | 'rounded'
  | 'rect'
  | 'diamond'
  | 'stadium'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'doubleCircle'

export type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'double'
export type EdgeShape = 'straight' | 'curved' | 'orthogonal' | 'loop'
export type ArrowHead = 'none' | 'arrow' | 'hollow' | 'dot' | 'diamond'

export interface GraphNode {
  id: string
  label: string
  /** Free text shown in the inspector and, optionally, under the node. */
  note?: string
  x: number
  y: number
  /** Unset means "use the document default", so a theme change moves everything. */
  width?: number
  height?: number
  shape?: NodeShape
  fill?: string
  stroke?: string
  textColor?: string
  /** Extra marks: a double border for an accepting state, a dashed outline, … */
  badge?: string
  pinned?: boolean
  /** Arbitrary per-kind data: heap priority, trie character, BST key. */
  data?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  note?: string
  /** Unweighted edges leave this undefined rather than storing a fake 1. */
  weight?: number
  /** Flow networks: capacity and current flow. */
  capacity?: number
  flow?: number
  style?: EdgeStyle
  shape?: EdgeShape
  arrowHead?: ArrowHead
  arrowTail?: ArrowHead
  color?: string
  /** How far a curved edge bows out; also separates parallel edges. */
  curvature?: number
  data?: Record<string, unknown>
}

/** A free-floating caption, not attached to any node. */
export interface GraphAnnotation {
  id: string
  text: string
  x: number
  y: number
  color?: string
}

export interface GraphDefaults {
  nodeShape: NodeShape
  nodeFill: string
  nodeStroke: string
  nodeTextColor: string
  nodeWidth: number
  nodeHeight: number
  edgeStyle: EdgeStyle
  edgeShape: EdgeShape
  edgeColor: string
}

export interface GraphDocument {
  version: 1
  id: string
  title: string
  kind: GraphKind
  directed: boolean
  weighted: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
  annotations: GraphAnnotation[]
  defaults: GraphDefaults
  /** Canvas viewport, so reopening a drawing shows what was last looked at. */
  view: { x: number; y: number; zoom: number }
  updatedAt: string
}

/** What a selection can point at. */
export type Selection =
  | { type: 'none' }
  | { type: 'node'; ids: string[] }
  | { type: 'edge'; ids: string[] }
  | { type: 'annotation'; ids: string[] }

export type Tool = 'select' | 'node' | 'edge' | 'annotation' | 'pan' | 'erase'

export type StorageBackend = 'json' | 'mysql' | 'mongo'

export interface BackendInfo {
  id: StorageBackend
  available: boolean
  reason?: string | null
}

export interface GraphSummary {
  id: string
  title: string
  kind: string
  nodes: number
  edges: number
  revision: number
  created_at: string
  updated_at: string
}

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'success' | 'warn' | 'error'
}

/** A rule the current kind imposes, and whether the drawing currently breaks it. */
export interface Violation {
  rule: string
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}
