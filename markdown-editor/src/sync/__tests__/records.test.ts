import { describe, expect, it } from 'vitest'
import type { FileNode } from '../../types'
import { buildTree, descendantIds, diffTrees, treeToDocs, type LocalDoc } from '../records'

const file = (id: string, name: string, content: string, parentId?: string): FileNode => ({ id, name, type: 'file', content, parentId })
const folder = (id: string, name: string, children: FileNode[] = [], parentId?: string): FileNode => ({ id, name, type: 'folder', children, parentId })

const doc = (id: string, kind: 'file' | 'folder', parentId: string | null, name: string, content: string | null = kind === 'file' ? '' : null): LocalDoc => ({
  id, kind, parentId, name, content, updatedAt: 1
})

describe('treeToDocs', () => {
  it('flattens the tree to one record per node, parents by id', () => {
    const tree = [folder('root', 'Docs', [file('a', 'a.md', 'A', 'root'), folder('sub', 'Sub', [file('b', 'b.md', 'B', 'sub')], 'root')])]
    const docs = treeToDocs(tree, 5)
    expect(docs.map((d) => [d.id, d.kind, d.parentId, d.name, d.content])).toEqual([
      ['root', 'folder', null, 'Docs', null],
      ['a', 'file', 'root', 'a.md', 'A'],
      ['sub', 'folder', 'root', 'Sub', null],
      ['b', 'file', 'sub', 'b.md', 'B']
    ])
    expect(docs.every((d) => d.updatedAt === 5)).toBe(true)
  })

  it('keeps a second top-level node at the top', () => {
    const docs = treeToDocs([folder('root', 'Docs'), file('loose', 'loose.md', 'x')], 0)
    expect(docs.find((d) => d.id === 'loose')?.parentId).toBeNull()
  })
})

describe('buildTree', () => {
  it('rebuilds the nested tree, root first, folders before files, names in natural order', () => {
    const tree = buildTree([
      doc('b', 'file', 'root', 'file 10.md'),
      doc('a', 'file', 'root', 'file 2.md'),
      doc('f', 'folder', 'root', 'Zeta'),
      doc('root', 'folder', null, 'Docs'),
      doc('c', 'file', 'f', 'inside.md', 'text')
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('root')
    expect(tree[0].children?.map((n) => n.id)).toEqual(['f', 'a', 'b'])
    expect(tree[0].children?.[0].children?.[0]).toMatchObject({ id: 'c', content: 'text', parentId: 'f' })
  })

  it('puts an orphan (its parent is gone, or is a file) at the top level', () => {
    const tree = buildTree([doc('root', 'folder', null, 'Docs'), doc('lost', 'file', 'gone', 'lost.md'), doc('f', 'file', 'root', 'f.md'), doc('under-file', 'file', 'f', 'u.md')])
    expect(tree.map((n) => n.id).sort()).toEqual(['lost', 'root', 'under-file'])
  })

  it('breaks a cycle made by two devices moving folders into each other, the same way every time', () => {
    const docs = [doc('root', 'folder', null, 'Docs'), doc('x', 'folder', 'y', 'X'), doc('y', 'folder', 'x', 'Y'), doc('leaf', 'file', 'x', 'leaf.md')]
    const first = buildTree(docs)
    const second = buildTree([...docs].reverse())
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    const ids = (nodes: FileNode[]): string[] => nodes.flatMap((n) => [n.id, ...ids(n.children ?? [])])
    expect(ids(first).sort()).toEqual(['leaf', 'root', 'x', 'y'])
    // the smallest id of the cycle (x) went to the top; y sits under it
    expect(first.some((n) => n.id === 'x')).toBe(true)
  })

  it('survives a node that is its own parent', () => {
    expect(buildTree([doc('self', 'folder', 'self', 'Self')]).map((n) => n.id)).toEqual(['self'])
  })

  it('does not choke on a deep chain', () => {
    const docs = Array.from({ length: 2000 }, (_, i) => doc(`n${i}`, 'folder', i === 0 ? null : `n${i - 1}`, `n${i}`))
    let depth = 0
    for (let node: FileNode | undefined = buildTree(docs)[0]; node; node = node.children?.[0]) depth += 1
    expect(depth).toBe(2000)
  })
})

describe('diffTrees', () => {
  const base = () => new Map(treeToDocs([folder('root', 'Docs', [file('a', 'a.md', 'A', 'root'), file('b', 'b.md', 'B', 'root')])], 1).map((d) => [d.id, d]))

  it('finds nothing when nothing changed, and reuses the very objects', () => {
    const prev = base()
    const diff = diffTrees(prev, [folder('root', 'Docs', [file('a', 'a.md', 'A', 'root'), file('b', 'b.md', 'B', 'root')])], 9)
    expect(diff.puts).toEqual([])
    expect(diff.deletes).toEqual([])
    expect(diff.next.get('a')).toBe(prev.get('a'))
  })

  it('finds an edited text, a rename, a move and a new node, and stamps only those', () => {
    const prev = base()
    const diff = diffTrees(
      prev,
      [folder('root', 'Docs', [file('a', 'a2.md', 'A', 'root'), folder('f', 'F', [file('b', 'b.md', 'B!', 'f'), file('c', 'c.md', 'C', 'f')], 'root')])],
      9
    )
    expect(diff.puts.map((d) => d.id).sort()).toEqual(['a', 'b', 'c', 'f'])
    expect(diff.next.get('a')).toMatchObject({ name: 'a2.md', updatedAt: 9 })
    expect(diff.next.get('b')).toMatchObject({ parentId: 'f', content: 'B!' })
    expect(diff.next.get('root')).toBe(prev.get('root'))
    expect(diff.deletes).toEqual([])
  })

  it('reports every node that left the tree, descendants of a deleted folder included', () => {
    const prev = new Map(treeToDocs([folder('root', 'Docs', [folder('f', 'F', [file('x', 'x.md', 'X', 'f'), file('y', 'y.md', 'Y', 'f')], 'root')])], 1).map((d) => [d.id, d]))
    const diff = diffTrees(prev, [folder('root', 'Docs', [])], 2)
    expect(diff.deletes.sort()).toEqual(['f', 'x', 'y'])
  })

  it('treats a copied folder as new nodes with new ids', () => {
    const prev = base()
    const diff = diffTrees(prev, [folder('root', 'Docs', [file('a', 'a.md', 'A', 'root'), file('b', 'b.md', 'B', 'root'), file('a-copy', 'a (2).md', 'A', 'root')])], 3)
    expect(diff.puts.map((d) => d.id)).toEqual(['a-copy'])
  })

  it('never takes a text that has not been loaded yet for an edit', () => {
    const prev = base()
    const unloaded: FileNode = { id: 'a', name: 'a.md', type: 'file', parentId: 'root' } // content undefined: the boot snapshot
    const diff = diffTrees(prev, [folder('root', 'Docs', [unloaded, file('b', 'b.md', 'B', 'root')])], 4)
    expect(diff.puts).toEqual([])
    expect(diff.next.get('a')?.content).toBe('A')
  })

  it('a new file with no text yet is an empty file', () => {
    const diff = diffTrees(new Map(), [folder('root', 'Docs', [{ id: 'n', name: 'n.md', type: 'file', parentId: 'root' }])], 1)
    expect(diff.next.get('n')?.content).toBe('')
  })
})

describe('descendantIds', () => {
  it('lists everything below a node, not the node', () => {
    const docs = treeToDocs([folder('root', 'D', [folder('f', 'F', [file('x', 'x', '', 'f'), folder('g', 'G', [file('y', 'y', '', 'g')], 'f')], 'root'), file('z', 'z', '', 'root')])], 0)
    expect(descendantIds(docs, 'f').sort()).toEqual(['g', 'x', 'y'])
    expect(descendantIds(docs, 'z')).toEqual([])
  })
})
