import { describe, expect, it } from 'vitest'
import type { FileNode } from '../../types'
import {
  addNode,
  ancestorIds,
  canMove,
  copyNode,
  countNodes,
  filterTree,
  findNode,
  findParent,
  flatten,
  getPath,
  isSelfOrDescendant,
  moveNode,
  normalizeTree,
  removeNode,
  renameNode,
  setNodeContent,
  sortTree,
  uniqueName
} from '../tree'

const tree = (): FileNode[] => [
  {
    id: 'root',
    name: 'Docs',
    type: 'folder',
    children: [
      { id: 'a', name: 'a.md', type: 'file', parentId: 'root', content: 'A' },
      {
        id: 'sub',
        name: 'Sub',
        type: 'folder',
        parentId: 'root',
        children: [{ id: 'b', name: 'b.md', type: 'file', parentId: 'sub', content: 'B' }]
      }
    ]
  }
]

describe('lookups', () => {
  it('finds nodes at any depth', () => {
    expect(findNode(tree(), 'b')?.name).toBe('b.md')
    expect(findNode(tree(), 'missing')).toBeNull()
    expect(findNode(tree(), null)).toBeNull()
  })

  it('finds the containing folder', () => {
    expect(findParent(tree(), 'b')?.id).toBe('sub')
    expect(findParent(tree(), 'root')).toBeNull()
  })

  it('builds the ancestor path', () => {
    expect(getPath(tree(), 'b').map((node) => node.id)).toEqual(['root', 'sub', 'b'])
    expect(ancestorIds(tree(), 'b')).toEqual(['root', 'sub'])
  })

  it('counts files and folders', () => {
    expect(countNodes(tree())).toEqual({ files: 2, folders: 2 })
    expect(flatten(tree())).toHaveLength(4)
  })
})

describe('mutations', () => {
  it('adds into a folder without touching siblings', () => {
    const next = addNode(tree(), { id: 'c', name: 'c.md', type: 'file' }, 'sub')
    expect(findNode(next, 'c')?.parentId).toBe('sub')
    expect(findNode(next, 'a')).toBeTruthy()
  })

  it('adds at root when parentId is null', () => {
    const next = addNode(tree(), { id: 'c', name: 'c.md', type: 'file' }, null)
    expect(next).toHaveLength(2)
    expect(next[1].parentId).toBeUndefined()
  })

  it('removes a subtree', () => {
    const next = removeNode(tree(), 'sub')
    expect(findNode(next, 'sub')).toBeNull()
    expect(findNode(next, 'b')).toBeNull()
    expect(findNode(next, 'a')).toBeTruthy()
  })

  it('renames and updates content immutably', () => {
    const original = tree()
    const renamed = renameNode(original, 'b', 'renamed.md')
    expect(findNode(renamed, 'b')?.name).toBe('renamed.md')
    expect(findNode(original, 'b')?.name).toBe('b.md')

    const updated = setNodeContent(original, 'b', 'new')
    expect(findNode(updated, 'b')?.content).toBe('new')
    expect(findNode(original, 'b')?.content).toBe('B')
  })

  it('never writes content onto a folder', () => {
    const next = setNodeContent(tree(), 'sub', 'nope')
    expect(findNode(next, 'sub')?.content).toBeUndefined()
  })
})

describe('move and copy guards', () => {
  it('detects descendants', () => {
    expect(isSelfOrDescendant(tree(), 'root', 'b')).toBe(true)
    expect(isSelfOrDescendant(tree(), 'root', 'root')).toBe(true)
    expect(isSelfOrDescendant(tree(), 'sub', 'a')).toBe(false)
  })

  it('refuses to move a folder into itself or its own subtree', () => {
    expect(canMove(tree(), 'root', 'root')).toBe(false)
    expect(canMove(tree(), 'root', 'sub')).toBe(false)
    expect(moveNode(tree(), 'root', 'sub')).toEqual(tree())
  })

  it('refuses to move into a file', () => {
    expect(canMove(tree(), 'b', 'a')).toBe(false)
  })

  it('refuses a no-op move into the current parent', () => {
    expect(canMove(tree(), 'a', 'root')).toBe(false)
  })

  it('moves a file between folders', () => {
    const next = moveNode(tree(), 'a', 'sub')
    expect(findParent(next, 'a')?.id).toBe('sub')
    expect(findNode(next, 'root')?.children).toHaveLength(1)
  })

  it('moves to root', () => {
    const next = moveNode(tree(), 'b', null)
    expect(findParent(next, 'b')).toBeNull()
    expect(next).toHaveLength(2)
  })

  it('copies a folder recursively with fresh ids', () => {
    const next = copyNode(tree(), 'sub', 'root')
    const root = findNode(next, 'root')!
    expect(root.children).toHaveLength(3)
    const clone = root.children!.find((node) => node.id !== 'sub' && node.type === 'folder')!
    expect(clone.id).not.toBe('sub')
    expect(clone.children![0].id).not.toBe('b')
    expect(clone.children![0].content).toBe('B')
    // The source subtree is untouched.
    expect(findNode(next, 'b')?.content).toBe('B')
  })

  it('refuses to copy a folder into its own subtree', () => {
    expect(copyNode(tree(), 'root', 'sub')).toEqual(tree())
    expect(copyNode(tree(), 'sub', 'sub')).toEqual(tree())
  })
})

describe('naming', () => {
  it('keeps a free name as-is', () => {
    expect(uniqueName([{ id: '1', name: 'a.md', type: 'file' }], 'b.md')).toBe('b.md')
  })

  it('suffixes collisions before the extension', () => {
    const siblings: FileNode[] = [
      { id: '1', name: 'notes.md', type: 'file' },
      { id: '2', name: 'notes (2).md', type: 'file' }
    ]
    expect(uniqueName(siblings, 'notes.md')).toBe('notes (3).md')
  })

  it('compares names case-insensitively', () => {
    expect(uniqueName([{ id: '1', name: 'Notes.md', type: 'file' }], 'notes.md')).toBe('notes (2).md')
  })

  it('handles extensionless folder names', () => {
    expect(uniqueName([{ id: '1', name: 'Drafts', type: 'folder' }], 'Drafts')).toBe('Drafts (2)')
  })

  it('gives copies a free name in the destination', () => {
    const next = copyNode(tree(), 'a', 'root')
    const names = findNode(next, 'root')!.children!.map((node) => node.name)
    expect(names).toContain('a (2).md')
  })
})

describe('presentation helpers', () => {
  it('sorts folders before files, naturally', () => {
    const unsorted: FileNode[] = [
      { id: '1', name: 'b.md', type: 'file' },
      { id: '2', name: 'item10.md', type: 'file' },
      { id: '3', name: 'item2.md', type: 'file' },
      { id: '4', name: 'Zed', type: 'folder', children: [] }
    ]
    expect(sortTree(unsorted).map((node) => node.name)).toEqual(['Zed', 'b.md', 'item2.md', 'item10.md'])
  })

  it('filters by name while keeping ancestors', () => {
    const filtered = filterTree(tree(), 'b.md')
    expect(filtered).toHaveLength(1)
    expect(findNode(filtered, 'b')).toBeTruthy()
    expect(findNode(filtered, 'a')).toBeNull()
  })

  it('returns the original tree for an empty query', () => {
    expect(filterTree(tree(), '   ')).toEqual(tree())
  })

  it('repairs parent links and node shape', () => {
    const broken: FileNode[] = [
      {
        id: 'f',
        name: 'F',
        type: 'folder',
        content: 'should be dropped',
        children: [{ id: 'x', name: 'x.md', type: 'file', children: [], parentId: 'wrong' }]
      }
    ]
    const fixed = normalizeTree(broken)
    expect(fixed[0].content).toBeUndefined()
    expect(fixed[0].children![0].parentId).toBe('f')
    expect(fixed[0].children![0].children).toBeUndefined()
    expect(fixed[0].children![0].content).toBe('')
  })
})
