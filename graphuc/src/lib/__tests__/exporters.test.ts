/**
 * The text-producing exporters.
 *
 * PNG and PDF need a real canvas and an image decoder, which jsdom does not
 * have; what is testable without them is the DOT source and the adjacency
 * matrix, and those are the two formats a reader is most likely to feed
 * straight into another tool.
 */

import { describe, expect, it } from 'vitest'
import { toAdjacencyCsv, toDot } from '../exporters'
import { emptyDocument, makeEdge } from '../graph'
import type { GraphDocument, GraphKind } from '../../types'

function build(kind: GraphKind, ids: string[], edges: [string, string, number?][]): GraphDocument {
  const base = emptyDocument(kind)
  return {
    ...base,
    title: 'Thử',
    nodes: ids.map((id, index) => ({ id, label: id.toUpperCase(), x: index * 40, y: 0 })),
    edges: edges.map(([source, target, weight]) => makeEdge(source, target, weight === undefined ? {} : { weight }))
  }
}

describe('DOT', () => {
  it('uses graph/-- for an undirected document', () => {
    const dot = toDot(build('graph', ['a', 'b'], [['a', 'b']]))
    expect(dot.startsWith('graph')).toBe(true)
    expect(dot).toContain('"a" -- "b"')
  })

  it('uses digraph/-> for a directed document', () => {
    const dot = toDot(build('digraph', ['a', 'b'], [['a', 'b']]))
    expect(dot.startsWith('digraph')).toBe(true)
    expect(dot).toContain('"a" -> "b"')
  })

  it('carries the weight across as a label', () => {
    expect(toDot(build('graph', ['a', 'b'], [['a', 'b', 7]]))).toContain('label="7"')
  })

  it('escapes a quote in a label instead of breaking the file', () => {
    const graph = build('graph', ['a'], [])
    graph.nodes[0].label = 'he said "hi"'
    expect(toDot(graph)).toContain('\\"hi\\"')
  })
})

describe('adjacency matrix', () => {
  it('is symmetric for an undirected graph', () => {
    const csv = toAdjacencyCsv(build('graph', ['a', 'b'], [['a', 'b']]))
    const rows = csv.split('\n')
    expect(rows[0]).toBe(',A,B')
    expect(rows[1]).toBe('A,0,1')
    expect(rows[2]).toBe('B,1,0')
  })

  it('is one-sided for a directed graph', () => {
    const rows = toAdjacencyCsv(build('digraph', ['a', 'b'], [['a', 'b']])).split('\n')
    expect(rows[1]).toBe('A,0,1')
    expect(rows[2]).toBe('B,0,0')
  })

  it('records the weight rather than a plain 1', () => {
    expect(toAdjacencyCsv(build('graph', ['a', 'b'], [['a', 'b', 5]]))).toContain('A,0,5')
  })

  it('handles a graph with no edges', () => {
    const rows = toAdjacencyCsv(build('graph', ['a', 'b'], [])).split('\n')
    expect(rows[1]).toBe('A,0,0')
  })
})
