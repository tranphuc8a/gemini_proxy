/**
 * Layouts: every one must place every node, honour pins, and survive the shapes
 * that break a naive implementation (a cycle, an empty document, a forest).
 */

import { describe, expect, it } from 'vitest'
import { LAYOUTS, bipartiteLayout, componentCount, runLayout, treeLayout } from '../layout'
import { emptyDocument, makeEdge } from '../graph'
import type { GraphDocument, GraphKind } from '../../types'

function build(kind: GraphKind, ids: string[], edges: [string, string][], pinned: string[] = []): GraphDocument {
  const base = emptyDocument(kind)
  return {
    ...base,
    nodes: ids.map((id, index) => ({ id, label: id, x: index * 7, y: index * 11, pinned: pinned.includes(id) })),
    edges: edges.map(([source, target]) => makeEdge(source, target))
  }
}

const TREE = build('tree', ['r', 'a', 'b', 'c', 'd'], [['r', 'a'], ['r', 'b'], ['a', 'c'], ['a', 'd']])

describe('every layout', () => {
  it.each(LAYOUTS.map((layout) => layout.id))('%s places every node', (id) => {
    const { positions } = runLayout(TREE, id)
    for (const node of TREE.nodes) {
      const position = positions.get(node.id)
      expect(position).toBeDefined()
      expect(Number.isFinite(position!.x)).toBe(true)
      expect(Number.isFinite(position!.y)).toBe(true)
    }
  })

  it.each(LAYOUTS.map((layout) => layout.id))('%s leaves pinned nodes alone', (id) => {
    const graph = build('graph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c']], ['b'])
    const pinned = graph.nodes.find((node) => node.id === 'b')!
    const { positions } = runLayout(graph, id)
    expect(positions.get('b')).toEqual({ x: pinned.x, y: pinned.y })
  })

  it.each(LAYOUTS.map((layout) => layout.id))('%s survives an empty document', (id) => {
    expect(() => runLayout(emptyDocument('graph'), id)).not.toThrow()
  })

  it.each(LAYOUTS.map((layout) => layout.id))('%s survives a cycle', (id) => {
    const graph = build('digraph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    const { positions } = runLayout(graph, id)
    expect(positions.size).toBe(3)
  })
})

describe('tree layout', () => {
  it('puts each level one row below the last', () => {
    const positions = treeLayout(TREE)
    const root = positions.get('r')!
    const child = positions.get('a')!
    const grandchild = positions.get('c')!
    expect(child.y).toBeGreaterThan(root.y)
    expect(grandchild.y).toBeGreaterThan(child.y)
  })

  it('centres a parent over its children', () => {
    const positions = treeLayout(TREE)
    const parent = positions.get('a')!
    const left = positions.get('c')!
    const right = positions.get('d')!
    expect(parent.x).toBeCloseTo((left.x + right.x) / 2, 5)
  })

  it('lays out a forest without overlapping the trees', () => {
    const forest = build('tree', ['r1', 'c1', 'r2', 'c2'], [['r1', 'c1'], ['r2', 'c2']])
    const positions = treeLayout(forest)
    expect(positions.get('r1')!.x).not.toBe(positions.get('r2')!.x)
  })

  it('places a node no root can reach', () => {
    // Every node having a parent means `roots()` is empty; a layout that only
    // walks from roots would silently drop the whole drawing.
    const cyclic = build('digraph', ['a', 'b'], [['a', 'b'], ['b', 'a']])
    expect(treeLayout(cyclic).size).toBe(2)
  })
})

describe('bipartite layout', () => {
  it('reports a two-colourable graph as bipartite', () => {
    const graph = build('graph', ['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']])
    expect(bipartiteLayout(graph).bipartite).toBe(true)
  })

  it('reports an odd cycle as not bipartite, and still lays it out', () => {
    const graph = build('graph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    const result = bipartiteLayout(graph)
    expect(result.bipartite).toBe(false)
    expect(result.positions.size).toBe(3)
  })

  it('warns through runLayout when the graph is not bipartite', () => {
    const graph = build('graph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    expect(runLayout(graph, 'bipartite').note).toContain('không 2-phân')
  })
})

describe('componentCount', () => {
  it('counts the separate pieces', () => {
    expect(componentCount(build('graph', ['a', 'b', 'c'], [['a', 'b']]))).toBe(2)
  })
})
