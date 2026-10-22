import { describe, expect, it } from 'vitest'
import { lineForOffset, offsetForLine, type LineAnchor } from '../paneSync'
import { activeHeadingIndex, activeHeadingIndexSorted, isAscending } from '../reading'
import { addNode, moveNode, renameNode, setNodeContent, treeShape } from '../tree'
import type { FileNode } from '../../types'

/**
 * M1 replaced linear scans that ran on every scroll event with binary searches. The former linear
 * versions are kept here, verbatim, as the reference the new ones must agree with.
 */
function linearOffsetForLine(anchors: LineAnchor[], line: number): number {
  if (anchors.length === 0) return 0
  if (line <= anchors[0].line) return anchors[0].top
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index]
    const next = anchors[index + 1]
    if (line >= current.line && line <= next.line) {
      const span = next.line - current.line
      if (span === 0) return current.top
      const ratio = (line - current.line) / span
      return current.top + ratio * (next.top - current.top)
    }
  }
  return anchors[anchors.length - 1].top
}

function linearLineForOffset(anchors: LineAnchor[], top: number): number {
  if (anchors.length === 0) return 1
  if (top <= anchors[0].top) return anchors[0].line
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index]
    const next = anchors[index + 1]
    if (top >= current.top && top <= next.top) {
      const span = next.top - current.top
      if (span === 0) return current.line
      const ratio = (top - current.top) / span
      return Math.round(current.line + ratio * (next.line - current.line))
    }
  }
  return anchors[anchors.length - 1].line
}

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

/** Sorted by line and by top, as collectPreviewAnchors and the editor's metrics produce them; ties included. */
function randomAnchors(r: () => number, count: number): LineAnchor[] {
  const anchors: LineAnchor[] = []
  let line = 1 + Math.floor(r() * 3)
  let top = Math.floor(r() * 20)
  for (let index = 0; index < count; index += 1) {
    anchors.push({ line, top })
    line += r() < 0.05 ? 0 : 1 + Math.floor(r() * 4)
    top += r() < 0.08 ? 0 : r() * 90
  }
  return anchors
}

describe('paneSync binary search', () => {
  it('agrees with the linear scan on 10,000 random anchors', () => {
    const r = rng(42)
    const anchors = randomAnchors(r, 10_000)
    const lastLine = anchors[anchors.length - 1].line
    const lastTop = anchors[anchors.length - 1].top
    for (let probe = 0; probe < 5_000; probe += 1) {
      const line = Math.floor(r() * (lastLine + 20)) - 5
      expect(offsetForLine(anchors, line)).toBe(linearOffsetForLine(anchors, line))
      const top = r() * (lastTop + 400) - 100
      expect(lineForOffset(anchors, top)).toBe(linearLineForOffset(anchors, top))
    }
    // Exactly on every anchor, where segment choice matters most.
    for (const anchor of anchors.slice(0, 2_000)) {
      expect(offsetForLine(anchors, anchor.line)).toBe(linearOffsetForLine(anchors, anchor.line))
      expect(lineForOffset(anchors, anchor.top)).toBe(linearLineForOffset(anchors, anchor.top))
    }
  })

  it('agrees on tiny inputs', () => {
    const r = rng(9)
    for (let round = 0; round < 500; round += 1) {
      const anchors = randomAnchors(r, Math.floor(r() * 4))
      for (const value of [-1, 0, 1, 2, 3, 5, 8, 50, 400]) {
        expect(offsetForLine(anchors, value)).toBe(linearOffsetForLine(anchors, value))
        expect(lineForOffset(anchors, value)).toBe(linearLineForOffset(anchors, value))
      }
    }
  })
})

describe('reading mode active heading', () => {
  it('binary search agrees with the linear scan on ascending tops', () => {
    const r = rng(5)
    for (let round = 0; round < 300; round += 1) {
      const tops: number[] = []
      let top = r() * 50
      const count = Math.floor(r() * 60)
      for (let index = 0; index < count; index += 1) {
        tops.push(top)
        top += r() < 0.1 ? 0 : r() * 300
      }
      if (r() < 0.2) tops.push(Number.POSITIVE_INFINITY)
      expect(isAscending(tops)).toBe(true)
      for (let probe = 0; probe < 40; probe += 1) {
        const position = r() * (top + 200) - 50
        expect(activeHeadingIndexSorted(tops, position)).toBe(activeHeadingIndex(tops, position))
      }
      expect(activeHeadingIndexSorted(tops, 0, true)).toBe(activeHeadingIndex(tops, 0, true))
    }
  })

  it('tells when the tops are not in order (a heading not found mid-document)', () => {
    expect(isAscending([0, 10, Number.POSITIVE_INFINITY, 30])).toBe(false)
    expect(isAscending([0, 10, 10, 30, Number.POSITIVE_INFINITY])).toBe(true)
    expect(isAscending([5, 3])).toBe(false)
    expect(isAscending([])).toBe(true)
  })
})

describe('treeShape', () => {
  const tree = (): FileNode[] => [
    {
      id: 'root',
      name: 'Docs',
      type: 'folder',
      children: [
        { id: 'a', name: 'a.md', type: 'file', parentId: 'root', content: 'A' },
        { id: 'sub', name: 'Sub', type: 'folder', parentId: 'root', children: [{ id: 'b', name: 'b.md', type: 'file', parentId: 'sub', content: 'B' }] }
      ]
    }
  ]

  it('drops contents and keeps names, kinds and nesting', () => {
    const shape = treeShape(tree())
    expect(shape).toEqual([
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        parentId: undefined,
        children: [
          { id: 'a', name: 'a.md', type: 'file', parentId: 'root', children: undefined },
          { id: 'sub', name: 'Sub', type: 'folder', parentId: 'root', children: [{ id: 'b', name: 'b.md', type: 'file', parentId: 'sub', children: undefined }] }
        ]
      }
    ])
    expect(JSON.stringify(shape)).not.toContain('content')
  })

  it('returns the very same array while only contents change (typing)', () => {
    let files = tree()
    const first = treeShape(files)
    for (const text of ['A1', 'A12', 'A123']) {
      files = setNodeContent(files, 'a', text)
      expect(treeShape(files)).toBe(first)
    }
    files = setNodeContent(files, 'b', 'deep edit')
    expect(treeShape(files)).toBe(first)
  })

  it('changes as soon as the structure does: rename, add, move', () => {
    let files = tree()
    const original = treeShape(files)

    files = renameNode(files, 'b', 'renamed.md')
    const renamed = treeShape(files)
    expect(renamed).not.toBe(original)
    expect(renamed[0].children![1].children![0].name).toBe('renamed.md')
    // The untouched branch is shared.
    expect(renamed[0].children![0]).toBe(original[0].children![0])

    files = addNode(files, { id: 'c', name: 'c.md', type: 'file', content: '' }, 'sub')
    const added = treeShape(files)
    expect(added).not.toBe(renamed)
    expect(added[0].children![1].children!.map((node) => node.id)).toEqual(['b', 'c'])

    files = moveNode(files, 'a', 'sub')
    const moved = treeShape(files)
    expect(moved).not.toBe(added)
    expect(moved[0].children!.map((node) => node.id)).toEqual(['sub'])
  })
})
