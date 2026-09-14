/**
 * The graph model: structure queries, the per-kind rules, and parsing.
 *
 * The validators get most of the attention because they are what the editor
 * shows the user, and because the cheap version of each check (compare a node
 * only with its immediate children, treat any repeated pair as parallel) is
 * wrong in a way nobody notices until a real drawing hits it.
 */

import { describe, expect, it } from 'vitest'
import {
  KINDS,
  adjacency,
  components,
  emptyDocument,
  findCycle,
  inDegree,
  makeEdge,
  outDegree,
  parallelIndex,
  parseDocument,
  roots,
  validate
} from '../graph'
import type { GraphDocument, GraphKind, GraphNode } from '../../types'

function build(kind: GraphKind, nodes: [string, number?][], edges: [string, string][]): GraphDocument {
  const base = emptyDocument(kind)
  return {
    ...base,
    nodes: nodes.map(([id, key], index): GraphNode => ({
      id,
      label: key !== undefined ? String(key) : id,
      x: index * 50,
      y: 0,
      ...(key !== undefined ? { data: { key } } : {})
    })),
    edges: edges.map(([source, target]) => makeEdge(source, target))
  }
}

describe('structure', () => {
  it('counts degrees in both directions for an undirected document', () => {
    const graph = build('graph', [['a'], ['b'], ['c']], [['a', 'b'], ['b', 'c']])
    expect(inDegree(graph).get('b')).toBe(2)
    expect(outDegree(graph).get('b')).toBe(2)
  })

  it('counts degrees one way for a directed document', () => {
    const graph = build('digraph', [['a'], ['b'], ['c']], [['a', 'b'], ['b', 'c']])
    expect(inDegree(graph).get('b')).toBe(1)
    expect(outDegree(graph).get('b')).toBe(1)
  })

  it('lists both directions in the adjacency of an undirected document', () => {
    const graph = build('graph', [['a'], ['b']], [['a', 'b']])
    expect(adjacency(graph).get('b')).toEqual(['a'])
  })

  it('finds a directed cycle', () => {
    const graph = build('digraph', [['a'], ['b'], ['c']], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    expect(findCycle(graph).length).toBeGreaterThan(0)
  })

  it('does not mistake a single undirected edge for a cycle', () => {
    // Walking back along the edge you arrived by is not a cycle; missing that
    // check reports every undirected edge as one.
    expect(findCycle(build('graph', [['a'], ['b']], [['a', 'b']]))).toEqual([])
  })

  it('finds an undirected cycle of length three', () => {
    const graph = build('graph', [['a'], ['b'], ['c']], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    expect(findCycle(graph).length).toBeGreaterThan(0)
  })

  it('groups disconnected pieces', () => {
    const graph = build('graph', [['a'], ['b'], ['c'], ['d']], [['a', 'b'], ['c', 'd']])
    expect(components(graph)).toHaveLength(2)
  })

  it('treats nodes with no incoming edge as roots', () => {
    const graph = build('tree', [['r'], ['a'], ['b']], [['r', 'a'], ['r', 'b']])
    expect(roots(graph)).toEqual(['r'])
  })

  it('numbers parallel edges so the renderer can separate them', () => {
    const graph = build('multigraph', [['a'], ['b']], [['a', 'b'], ['a', 'b'], ['a', 'b']])
    const indices = graph.edges.map((edge) => parallelIndex(graph, edge))
    expect(indices.map((item) => item.index)).toEqual([0, 1, 2])
    expect(indices.every((item) => item.total === 3)).toBe(true)
  })

  it('treats an undirected pair as the same edge whichever way it is drawn', () => {
    const graph = build('multigraph', [['a'], ['b']], [['a', 'b'], ['b', 'a']])
    expect(parallelIndex(graph, graph.edges[0]).total).toBe(2)
  })
})

describe('kind rules', () => {
  it('reports parallel edges in a simple graph', () => {
    const graph = build('graph', [['a'], ['b']], [['a', 'b'], ['b', 'a']])
    expect(validate(graph).map((item) => item.rule)).toContain('parallel')
  })

  it('allows parallel edges in a multigraph', () => {
    const graph = build('multigraph', [['a'], ['b']], [['a', 'b'], ['a', 'b']])
    expect(validate(graph)).toEqual([])
  })

  it('reports a cycle in a DAG', () => {
    const graph = build('dag', [['a'], ['b']], [['a', 'b'], ['b', 'a']])
    expect(validate(graph).map((item) => item.rule)).toContain('acyclic')
  })

  it('reports two parents in a tree', () => {
    const graph = build('tree', [['r'], ['s'], ['x']], [['r', 'x'], ['s', 'x']])
    const rules = validate(graph).map((item) => item.rule)
    expect(rules).toContain('single-parent')
  })

  it('reports a third child in a binary tree', () => {
    const graph = build('binary-tree', [['r'], ['a'], ['b'], ['c']], [['r', 'a'], ['r', 'b'], ['r', 'c']])
    expect(validate(graph).map((item) => item.rule)).toContain('degree')
  })

  it('accepts a correct BST', () => {
    const graph = build('bst', [['n50', 50], ['n30', 30], ['n70', 70]], [['n50', 'n30'], ['n50', 'n70']])
    expect(validate(graph).filter((item) => item.rule === 'bst')).toEqual([])
  })

  it('catches a BST violation only a grandparent can see', () => {
    // 60 is a left descendant of 50 but larger than it. Comparing each node
    // with its own children alone accepts this; carrying the interval down
    // catches it, which is the whole point of the interval method.
    const graph = build(
      'bst',
      [['n50', 50], ['n30', 30], ['n70', 70], ['n60', 60]],
      [['n50', 'n30'], ['n50', 'n70'], ['n30', 'n60']]
    )
    expect(validate(graph).map((item) => item.rule)).toContain('bst')
  })

  it('reports a child smaller than its parent in a min-heap', () => {
    const graph = build('heap', [['p', 5], ['c', 2]], [['p', 'c']])
    expect(validate(graph).map((item) => item.rule)).toContain('heap')
  })

  it('ignores nodes with no numeric key when checking a heap', () => {
    // Labels are not data: "root" being alphabetically after "child" says
    // nothing about the heap property.
    const graph = build('heap', [['p'], ['c']], [['p', 'c']])
    expect(validate(graph).filter((item) => item.rule === 'heap')).toEqual([])
  })

  it('reports a second successor in a linked list', () => {
    const graph = build('linked-list', [['a'], ['b'], ['c']], [['a', 'b'], ['a', 'c']])
    expect(validate(graph).map((item) => item.rule)).toContain('degree')
  })

  it('reports two edges with the same character at one trie node', () => {
    const base = emptyDocument('trie')
    const graph: GraphDocument = {
      ...base,
      nodes: [
        { id: 'root', label: '·', x: 0, y: 0 },
        { id: 'a', label: 'a', x: 0, y: 50 },
        { id: 'b', label: 'a', x: 50, y: 50 }
      ],
      edges: [makeEdge('root', 'a', { label: 'a' }), makeEdge('root', 'b', { label: 'a' })]
    }
    expect(validate(graph).map((item) => item.rule)).toContain('trie')
  })

  it('reports an unlabelled transition in a state machine', () => {
    const graph = build('state-machine', [['a'], ['b']], [['a', 'b']])
    expect(validate(graph).map((item) => item.rule)).toContain('transition')
  })

  it('reports a decision node with only one branch', () => {
    const base = emptyDocument('activity')
    const graph: GraphDocument = {
      ...base,
      nodes: [
        { id: 'd', label: '?', x: 0, y: 0, shape: 'diamond' },
        { id: 'n', label: 'next', x: 0, y: 60 }
      ],
      edges: [makeEdge('d', 'n', { label: 'yes' })]
    }
    expect(validate(graph).map((item) => item.rule)).toContain('decision')
  })

  it('accepts anything in the free kind', () => {
    const graph = build('free', [['a']], [['a', 'a']])
    expect(validate(graph)).toEqual([])
  })

  it('every kind declares the direction its spec claims', () => {
    for (const kind of Object.values(KINDS)) {
      expect(typeof kind.directed).toBe('boolean')
      expect(emptyDocument(kind.id).directed).toBe(kind.directed)
    }
  })
})

describe('parsing untrusted documents', () => {
  it('rejects anything without a node list', () => {
    expect(parseDocument(null)).toBeNull()
    expect(parseDocument({ nodes: 'no' })).toBeNull()
  })

  it('drops edges pointing at missing nodes', () => {
    // A dangling edge breaks every layout and traversal downstream, and the
    // user has no way to repair one.
    const parsed = parseDocument({
      nodes: [{ id: 'a' }],
      edges: [{ id: 'e', source: 'a', target: 'ghost' }]
    })
    expect(parsed?.edges).toEqual([])
  })

  it('drops duplicate node ids', () => {
    const parsed = parseDocument({ nodes: [{ id: 'a' }, { id: 'a' }] })
    expect(parsed?.nodes).toHaveLength(1)
  })

  it('falls back to a known kind when the file names an unknown one', () => {
    expect(parseDocument({ nodes: [], kind: 'hypergraph' })?.kind).toBe('graph')
  })

  it('keeps a weight of zero rather than reading it as unweighted', () => {
    const parsed = parseDocument({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b', weight: 0 }]
    })
    expect(parsed?.edges[0].weight).toBe(0)
  })

  it('leaves an absent weight undefined', () => {
    const parsed = parseDocument({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }]
    })
    expect(parsed?.edges[0].weight).toBeUndefined()
  })

  it('round-trips a document through JSON unchanged in substance', () => {
    const original = build('dag', [['a'], ['b']], [['a', 'b']])
    const parsed = parseDocument(JSON.parse(JSON.stringify(original)))
    expect(parsed?.nodes.map((node) => node.id)).toEqual(['a', 'b'])
    expect(parsed?.edges).toHaveLength(1)
    expect(parsed?.kind).toBe('dag')
    expect(parsed?.directed).toBe(true)
  })
})
