/**
 * The editor store.
 *
 * The behaviour worth pinning down is the history: every document change has to
 * be undoable, a silent drag frame must not be, and redo has to disappear as
 * soon as new work happens. Those are the rules an editor is judged on, and
 * they are easy to break by adding one action that sets `document` directly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditor } from '../store'
import { emptyDocument } from '../lib/graph'

// The backend is a separate concern; the store's own logic is what is under test.
vi.mock('../services/graphStorage', () => ({
  saveLocal: vi.fn(() => true),
  loadLocal: vi.fn(() => null),
  listLocal: vi.fn(() => []),
  deleteLocal: vi.fn(),
  readSettings: vi.fn((fallback: unknown) => fallback),
  writeSettings: vi.fn(),
  isUnlocked: vi.fn(() => false),
  lock: vi.fn(),
  unlock: vi.fn(async () => true),
  restoreSession: vi.fn(async () => false),
  listBackends: vi.fn(async () => []),
  listRemote: vi.fn(async () => []),
  loadRemote: vi.fn(),
  saveRemote: vi.fn(),
  deleteRemote: vi.fn()
}))

const store = () => useEditor.getState()

beforeEach(() => {
  useEditor.setState({
    document: emptyDocument('graph'),
    past: [],
    future: [],
    selection: { type: 'none' },
    tool: 'select',
    pendingEdgeSource: null,
    violations: [],
    toasts: [],
    algorithm: { id: null, result: null, step: 0, playing: false, startNode: null }
  })
})

describe('nodes and edges', () => {
  it('adds a node and selects it', () => {
    const id = store().addNode(10, 20, 'A')
    expect(store().document.nodes).toHaveLength(1)
    expect(store().selection).toEqual({ type: 'node', ids: [id] })
  })

  it('deletes the edges of a deleted node', () => {
    // A dangling edge would break every layout and traversal downstream.
    const a = store().addNode(0, 0, 'a')
    const b = store().addNode(50, 0, 'b')
    store().addEdge(a, b)
    expect(store().document.edges).toHaveLength(1)

    store().select({ type: 'node', ids: [a] })
    store().deleteSelection()
    expect(store().document.nodes).toHaveLength(1)
    expect(store().document.edges).toHaveLength(0)
  })

  it('refuses a parallel edge in a simple graph and says why', () => {
    const a = store().addNode(0, 0, 'a')
    const b = store().addNode(50, 0, 'b')
    store().addEdge(a, b)
    store().addEdge(a, b)
    expect(store().document.edges).toHaveLength(1)
    expect(store().toasts.at(-1)?.message).toContain('song song')
  })

  it('allows a parallel edge in a multigraph', () => {
    store().setKind('multigraph')
    const a = store().addNode(0, 0, 'a')
    const b = store().addNode(50, 0, 'b')
    store().addEdge(a, b)
    store().addEdge(a, b)
    expect(store().document.edges).toHaveLength(2)
  })

  it('refuses a self-loop where the kind forbids one', () => {
    const a = store().addNode(0, 0, 'a')
    store().addEdge(a, a)
    expect(store().document.edges).toHaveLength(0)
    expect(store().toasts.at(-1)?.message).toContain('khuyên')
  })

  it('gives a new edge a weight when the document is weighted', () => {
    store().setKind('flow')
    const a = store().addNode(0, 0, 'a')
    const b = store().addNode(50, 0, 'b')
    store().addEdge(a, b)
    expect(store().document.edges[0].weight).toBe(1)
  })
})

describe('kinds', () => {
  it('follows the kind for direction', () => {
    store().setKind('dag')
    expect(store().document.directed).toBe(true)
    store().setKind('graph')
    expect(store().document.directed).toBe(false)
  })

  it('keeps everything when a change of kind makes the drawing invalid', () => {
    // Pruning edges to satisfy a constraint would destroy work irrecoverably;
    // reporting the problem lets the user decide.
    store().setKind('digraph')
    const a = store().addNode(0, 0, 'a')
    const b = store().addNode(50, 0, 'b')
    store().addEdge(a, b)
    store().addEdge(b, a)

    store().setKind('dag')
    expect(store().document.edges).toHaveLength(2)
    expect(store().violations.map((item) => item.rule)).toContain('acyclic')
  })

  it('revalidates after every change', () => {
    store().setKind('tree')
    const r = store().addNode(0, 0, 'r')
    const s = store().addNode(50, 0, 's')
    const x = store().addNode(100, 0, 'x')
    store().addEdge(r, x)
    store().addEdge(s, x)
    expect(store().violations.map((item) => item.rule)).toContain('single-parent')
  })
})

describe('history', () => {
  it('undoes and redoes a node', () => {
    store().addNode(0, 0, 'a')
    expect(store().document.nodes).toHaveLength(1)

    store().undo()
    expect(store().document.nodes).toHaveLength(0)

    store().redo()
    expect(store().document.nodes).toHaveLength(1)
  })

  it('drops the redo stack once new work happens', () => {
    store().addNode(0, 0, 'a')
    store().undo()
    expect(store().future).toHaveLength(1)

    store().addNode(10, 10, 'b')
    expect(store().future).toHaveLength(0)
  })

  it('does not checkpoint a silent move', () => {
    // Every frame of a drag is silent; the drag's start is checkpointed once by
    // the canvas, so one undo puts the node back rather than replaying it.
    const id = store().addNode(0, 0, 'a')
    const before = store().past.length
    store().moveNodes([{ id, x: 99, y: 99 }], { silent: true })
    expect(store().past.length).toBe(before)
    expect(store().document.nodes[0].x).toBe(99)
  })

  it('checkpoints a normal move', () => {
    const id = store().addNode(0, 0, 'a')
    const before = store().past.length
    store().moveNodes([{ id, x: 40, y: 40 }])
    expect(store().past.length).toBe(before + 1)
  })

  it('clears history when a document is replaced', () => {
    store().addNode(0, 0, 'a')
    store().replaceDocument(emptyDocument('tree'))
    expect(store().past).toHaveLength(0)
    expect(store().future).toHaveLength(0)
  })

  it('does nothing when there is nothing to undo', () => {
    expect(() => store().undo()).not.toThrow()
    expect(store().document.nodes).toHaveLength(0)
  })

  it('treats panning as not a document change', () => {
    // A pan that ate an undo slot would make undo useless after scrolling around.
    store().addNode(0, 0, 'a')
    const before = store().past.length
    store().setView({ x: 100, y: 100, zoom: 2 })
    expect(store().past.length).toBe(before)
  })
})

describe('layouts and algorithms', () => {
  it('moves every node and can be undone in one step', () => {
    store().addNode(0, 0, 'a')
    store().addNode(0, 0, 'b')
    store().addNode(0, 0, 'c')
    const before = store().document.nodes.map((node) => ({ ...node }))

    store().applyLayout('circular')
    expect(store().document.nodes.some((node, index) => node.x !== before[index].x)).toBe(true)

    store().undo()
    expect(store().document.nodes.map((node) => node.x)).toEqual(before.map((node) => node.x))
  })

  it('says so rather than laying out nothing', () => {
    store().applyLayout('tree')
    expect(store().toasts.at(-1)?.message).toContain('Chưa có đỉnh')
  })

  it('stores an algorithm run and clamps the step cursor', () => {
    const a = store().addNode(0, 0, 'a')
    const b = store().addNode(50, 0, 'b')
    store().addEdge(a, b)

    store().runAlgorithm('bfs')
    const total = store().algorithm.result!.steps.length
    store().setAlgorithmStep(9999)
    expect(store().algorithm.step).toBe(total - 1)
    store().setAlgorithmStep(-5)
    expect(store().algorithm.step).toBe(0)
  })

  it('reports an algorithm that cannot run instead of leaving a stale result', () => {
    store().addNode(0, 0, 'a')
    store().runAlgorithm('topological') // undirected
    expect(store().algorithm.result).toBeNull()
    expect(store().toasts.at(-1)?.message).toContain('có hướng')
  })
})
