/**
 * The algorithms, checked against their answers and against their *steps*.
 *
 * The step log is the deliverable here — it is what the canvas replays — so a
 * test that only checks the final answer would miss the failure mode that
 * matters: an algorithm that is right but unwatchable.
 */

import { describe, expect, it } from 'vitest'
import { runAlgorithm } from '../algorithms'
import { emptyDocument, makeEdge } from '../graph'
import type { GraphDocument, GraphKind } from '../../types'

function build(kind: GraphKind, ids: string[], edges: [string, string, number?][]): GraphDocument {
  const base = emptyDocument(kind)
  return {
    ...base,
    nodes: ids.map((id, index) => ({ id, label: id, x: index * 60, y: 0 })),
    edges: edges.map(([source, target, weight]) => makeEdge(source, target, weight === undefined ? {} : { weight }))
  }
}

const lastStep = (result: ReturnType<typeof runAlgorithm>) => result.steps[result.steps.length - 1]

describe('BFS', () => {
  it('visits every reachable node and records a distance for each', () => {
    const graph = build('graph', ['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd']])
    const result = runAlgorithm(graph, 'bfs', 'a')
    expect(lastStep(result).settled).toHaveLength(4)
    expect(lastStep(result).labels).toMatchObject({ a: '0', b: '1', c: '2', d: '3' })
  })

  it('says how many nodes it could not reach', () => {
    const graph = build('graph', ['a', 'b', 'island'], [['a', 'b']])
    expect(runAlgorithm(graph, 'bfs', 'a').summary).toContain('1 đỉnh không tới được')
  })

  it('respects direction', () => {
    const graph = build('digraph', ['a', 'b'], [['b', 'a']])
    expect(lastStep(runAlgorithm(graph, 'bfs', 'a')).settled).toEqual(['a'])
  })
})

describe('DFS', () => {
  it('numbers nodes in discovery order without recursing', () => {
    // A long path is the case that would blow a recursive implementation's stack.
    const ids = Array.from({ length: 2000 }, (_, index) => 'n' + index)
    const edges = ids.slice(0, -1).map((id, index): [string, string] => [id, ids[index + 1]])
    const graph = build('digraph', ids, edges)
    const result = runAlgorithm(graph, 'dfs', 'n0')
    expect(lastStep(result).settled).toHaveLength(2000)
  })
})

describe('Dijkstra', () => {
  it('finds the shortest distances on a weighted graph', () => {
    // The direct S→C edge (9) is beaten by S→A→C (1 + 3).
    const graph = build('graph', ['S', 'A', 'B', 'C'], [
      ['S', 'A', 1], ['S', 'C', 9], ['A', 'C', 3], ['A', 'B', 7], ['C', 'B', 2]
    ])
    const labels = lastStep(runAlgorithm(graph, 'dijkstra', 'S')).labels
    expect(labels).toMatchObject({ S: '0', A: '1', C: '4', B: '6' })
  })

  it('treats an unweighted edge as weight one', () => {
    const graph = build('graph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c']])
    expect(lastStep(runAlgorithm(graph, 'dijkstra', 'a')).labels).toMatchObject({ c: '2' })
  })

  it('refuses negative weights instead of returning a wrong answer', () => {
    const graph = build('digraph', ['a', 'b'], [['a', 'b', -4]])
    expect(runAlgorithm(graph, 'dijkstra', 'a').error).toContain('âm')
  })

  it('leaves unreachable nodes at infinity', () => {
    const graph = build('digraph', ['a', 'b'], [])
    expect(lastStep(runAlgorithm(graph, 'dijkstra', 'a')).labels).toMatchObject({ b: '∞' })
  })
})

describe('topological sort', () => {
  it('orders a DAG so every edge points forwards', () => {
    const graph = build('dag', ['a', 'b', 'c', 'd'], [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']])
    const result = runAlgorithm(graph, 'topological')
    expect(result.error).toBeUndefined()

    const order = lastStep(result).settled
    const position = new Map(order.map((id, index) => [id, index]))
    for (const edge of graph.edges) {
      expect(position.get(edge.source)!).toBeLessThan(position.get(edge.target)!)
    }
  })

  it('reports a cycle rather than emitting a partial order as if it were complete', () => {
    const graph = build('digraph', ['a', 'b'], [['a', 'b'], ['b', 'a']])
    expect(runAlgorithm(graph, 'topological').error).toContain('chu trình')
  })

  it('refuses an undirected graph', () => {
    expect(runAlgorithm(build('graph', ['a'], []), 'topological').error).toContain('có hướng')
  })
})

describe('minimum spanning tree', () => {
  it('picks the cheapest spanning set', () => {
    // Taking the 4 would close a cycle; 1 + 2 + 3 spans everything.
    const graph = build('graph', ['a', 'b', 'c', 'd'], [
      ['a', 'b', 1], ['b', 'c', 2], ['c', 'd', 3], ['a', 'c', 4], ['b', 'd', 5]
    ])
    const result = runAlgorithm(graph, 'mst')
    expect(result.summary).toContain('6')
    expect(lastStep(result).edges).toHaveLength(3)
  })

  it('says so when the graph is not connected', () => {
    const graph = build('graph', ['a', 'b', 'c', 'd'], [['a', 'b', 1], ['c', 'd', 1]])
    expect(runAlgorithm(graph, 'mst').summary).toContain('không liên thông')
  })

  it('refuses a directed graph', () => {
    expect(runAlgorithm(build('digraph', ['a'], []), 'mst').error).toContain('vô hướng')
  })
})

describe('components and colouring', () => {
  it('counts connected pieces', () => {
    const graph = build('graph', ['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['c', 'd']])
    expect(runAlgorithm(graph, 'components').summary).toContain('3 thành phần')
  })

  it('two-colours an even cycle', () => {
    const graph = build('graph', ['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']])
    expect(runAlgorithm(graph, 'bipartite').summary).toContain('2-phân —')
  })

  it('fails on an odd cycle, which is exactly when it should', () => {
    const graph = build('graph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    expect(runAlgorithm(graph, 'bipartite').summary).toContain('Không phải')
  })
})

describe('cycle detection', () => {
  it('names the nodes on the cycle it found', () => {
    const graph = build('digraph', ['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']])
    const result = runAlgorithm(graph, 'cycle')
    expect(result.summary).toContain('Có chu trình')
    expect(lastStep(result).active.length).toBeGreaterThan(1)
  })

  it('calls an acyclic digraph a DAG', () => {
    const graph = build('digraph', ['a', 'b'], [['a', 'b']])
    expect(runAlgorithm(graph, 'cycle').summary).toContain('DAG')
  })
})

describe('guards', () => {
  it('refuses to run on an empty graph', () => {
    expect(runAlgorithm(emptyDocument('graph'), 'bfs').error).toContain('chưa có đỉnh')
  })

  it('falls back to the first node when the chosen start does not exist', () => {
    const graph = build('graph', ['a', 'b'], [['a', 'b']])
    expect(runAlgorithm(graph, 'bfs', 'ghost').steps.length).toBeGreaterThan(0)
  })
})
