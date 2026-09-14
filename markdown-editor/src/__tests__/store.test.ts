import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORY_DEBOUNCE_MS, useEditorStore } from '../store'
import { FILES_KEY, LEGACY_KEY, SETTINGS_KEY } from '../lib/persistence'
import { findNode, flatten } from '../lib/tree'
import { clearAdminCredentials, restoreAdminSession, verifyAdminKey } from '../services/markdownStorage'

// The admin key lives on the server now, so unlocking is a network call.
vi.mock('../services/markdownStorage', () => ({
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn()
}))

const store = () => useEditorStore.getState()

/** Put the store in admin mode without going through the backend. */
const unlockAdmin = () => useEditorStore.setState({ isAdmin: true })

function reset() {
  localStorage.clear()
  useEditorStore.setState({
    files: [
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        children: [{ id: 'a', name: 'a.md', type: 'file', parentId: 'root', content: 'A' }]
      }
    ],
    currentFileId: 'a',
    currentContent: 'A',
    selectedFolderId: 'root',
    expandedFolders: ['root'],
    history: ['A'],
    historyIndex: 0,
    isAdmin: false,
    toasts: [],
    saveState: 'idle',
    lastSavedAt: null
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  reset()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('content and history', () => {
  it('updates the open file as you type', () => {
    act(() => store().setContent('Hello'))
    expect(store().currentContent).toBe('Hello')
    expect(findNode(store().files, 'a')?.content).toBe('Hello')
  })

  it('collapses a burst of typing into one undo step', () => {
    act(() => {
      store().setContent('H')
      store().setContent('He')
      store().setContent('Hel')
    })
    // Nothing committed yet: the debounce has not elapsed.
    expect(store().history).toEqual(['A'])

    act(() => vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS + 10))
    expect(store().history).toEqual(['A', 'Hel'])

    act(() => store().undo())
    expect(store().currentContent).toBe('A')
  })

  it('flushes a pending edit before undoing', () => {
    act(() => store().setContent('typed'))
    act(() => store().undo())
    expect(store().currentContent).toBe('A')
    expect(store().history).toEqual(['A', 'typed'])
  })

  it('redoes back to the newer content', () => {
    act(() => store().setContent('typed'))
    act(() => store().undo())
    act(() => store().redo())
    expect(store().currentContent).toBe('typed')
  })

  it('writes undone content back to the file', () => {
    act(() => store().setContent('typed'))
    act(() => store().undo())
    expect(findNode(store().files, 'a')?.content).toBe('A')
  })

  it('drops the redo branch once you type again', () => {
    act(() => store().setContent('one'))
    act(() => vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS + 10))
    act(() => store().setContent('two'))
    act(() => vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS + 10))
    act(() => store().undo())
    act(() => store().setContent('three'))
    act(() => vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS + 10))

    expect(store().canRedo()).toBe(false)
    expect(store().history).toEqual(['A', 'one', 'three'])
  })

  it('ignores a no-op setContent', () => {
    act(() => store().setContent('A'))
    expect(store().history).toEqual(['A'])
  })

  it('does nothing when undoing at the start of history', () => {
    act(() => store().undo())
    expect(store().currentContent).toBe('A')
  })

  it('starts a fresh history when the open file changes', () => {
    unlockAdmin()
    act(() => store().createFile('root', 'b.md'))
    expect(store().history).toEqual([''])
    expect(store().historyIndex).toBe(0)
  })
})

describe('admin gating', () => {
  it('lets the backend decide whether a key is accepted', async () => {
    // Regression: this used to compare against a key compiled into the bundle,
    // which every visitor could read and which proved nothing.
    vi.mocked(verifyAdminKey).mockResolvedValueOnce(false)
    expect(await store().loginAdmin('nope')).toBe(false)
    expect(store().isAdmin).toBe(false)

    vi.mocked(verifyAdminKey).mockResolvedValueOnce(true)
    await act(async () => {
      expect(await store().loginAdmin('right-key')).toBe(true)
    })
    expect(store().isAdmin).toBe(true)
  })

  it('forgets the session on logout', async () => {
    vi.mocked(verifyAdminKey).mockResolvedValueOnce(true)
    await act(async () => {
      await store().loginAdmin('right-key')
    })

    act(() => store().logout())

    expect(store().isAdmin).toBe(false)
    expect(clearAdminCredentials).toHaveBeenCalled()
  })

  it('comes back unlocked when the stored session is still valid', async () => {
    // The reported bug: every reload dropped the user back to view-only and
    // asked for the admin token again.
    vi.mocked(restoreAdminSession).mockResolvedValueOnce(true)
    await act(async () => {
      await store().restoreAdminSession()
    })
    expect(store().isAdmin).toBe(true)
  })

  it('stays view-only when the stored session has expired', async () => {
    vi.mocked(restoreAdminSession).mockResolvedValueOnce(false)
    await act(async () => {
      await store().restoreAdminSession()
    })
    expect(store().isAdmin).toBe(false)
  })

  it('refuses every file mutation while anonymous', () => {
    const before = store().files
    act(() => {
      store().createFile('root', 'new.md')
      store().createFolder('root', 'New')
      store().deleteNode('a')
      store().renameNode('a', 'renamed.md')
      store().moveNode('a', null)
      store().copyNode('a', 'root')
    })
    expect(store().files).toBe(before)
  })

  it('lets an anonymous visitor read an imported file without keeping it', () => {
    act(() => store().importFile('shared.md', '# Shared'))
    expect(store().currentContent).toBe('# Shared')
    expect(store().currentFileId).toBeNull()
    expect(flatten(store().files)).toHaveLength(2)
  })
})

describe('file operations', () => {
  beforeEach(() => {
    unlockAdmin()
  })

  it('creates a file, opens it and expands its folder', () => {
    let id: string | null = null
    act(() => {
      id = store().createFile('root', 'notes')
    })
    const created = findNode(store().files, id)
    expect(created?.name).toBe('notes.md')
    expect(store().currentFileId).toBe(id)
    expect(store().expandedFolders).toContain('root')
  })

  it('only appends .md when an extension is missing', () => {
    act(() => store().createFile('root', 'readme.markdown'))
    expect(flatten(store().files).some((node) => node.name === 'readme.markdown')).toBe(true)
  })

  it('disambiguates duplicate names', () => {
    act(() => {
      store().createFile('root', 'a.md')
    })
    expect(flatten(store().files).some((node) => node.name === 'a (2).md')).toBe(true)
  })

  it('ignores a blank name', () => {
    const before = store().files
    act(() => {
      expect(store().createFile('root', '   ')).toBeNull()
    })
    expect(store().files).toBe(before)
  })

  it('clears the editor when the open file is deleted', () => {
    act(() => store().deleteNode('a'))
    expect(store().currentFileId).toBeNull()
    expect(store().currentContent).toBe('')
  })

  it('clears the editor when a folder containing the open file is deleted', () => {
    act(() => store().deleteNode('root'))
    expect(store().currentFileId).toBeNull()
    expect(store().selectedFolderId).toBeNull()
  })

  it('renames without colliding with a sibling', () => {
    act(() => {
      store().createFile('root', 'b.md')
      store().renameNode('a', 'b.md')
    })
    expect(findNode(store().files, 'a')?.name).toBe('b (2).md')
  })

  it('keeps the same name when renaming to itself', () => {
    act(() => store().renameNode('a', 'a.md'))
    expect(findNode(store().files, 'a')?.name).toBe('a.md')
  })

  it('reports an illegal folder copy instead of silently doing nothing', () => {
    act(() => store().copyNode('root', 'root'))
    expect(store().toasts.some((toast) => toast.tone === 'error')).toBe(true)
  })

  it('moves a file to the root', () => {
    act(() => store().moveNode('a', null))
    expect(store().files).toHaveLength(2)
  })
})

describe('folder expansion', () => {
  it('toggles a folder open and closed', () => {
    act(() => store().toggleFolder('root'))
    expect(store().expandedFolders).not.toContain('root')
    act(() => store().toggleFolder('root'))
    expect(store().expandedFolders).toContain('root')
  })

  it('reveals a node by opening its ancestors', () => {
    useEditorStore.setState({ expandedFolders: [] })
    act(() => store().revealNode('a'))
    expect(store().expandedFolders).toContain('root')
  })
})

describe('persistence', () => {
  it('writes files and settings under separate versioned keys', () => {
    act(() => store().flushPersist())
    expect(JSON.parse(localStorage.getItem(FILES_KEY)!).version).toBe(2)
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).theme).toBeDefined()
    expect(store().saveState).toBe('saved')
  })

  it('never writes the admin flag', () => {
    unlockAdmin()
    act(() => store().flushPersist())
    const dump = localStorage.getItem(FILES_KEY)! + localStorage.getItem(SETTINGS_KEY)!
    expect(dump).not.toMatch(/isAdmin/)
  })

  it('never restores admin from storage', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'dark', isAdmin: true }))
    act(() => store().hydrate())
    expect(store().isAdmin).toBe(false)
    expect(store().theme).toBe('dark')
  })

  it('migrates the legacy single-key payload', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        isDarkMode: true,
        isAdmin: true,
        currentFileId: 'legacy-file',
        files: [
          {
            id: 'legacy-root',
            name: 'Old',
            type: 'folder',
            children: [{ id: 'legacy-file', name: 'old.md', type: 'file', content: 'legacy' }]
          }
        ]
      })
    )
    act(() => store().hydrate())

    expect(store().theme).toBe('dark')
    expect(store().isAdmin).toBe(false)
    expect(store().currentContent).toBe('legacy')
    expect(findNode(store().files, 'legacy-file')?.parentId).toBe('legacy-root')
    // The legacy key is cleared so the migration runs only once.
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('survives unparsable storage', () => {
    localStorage.setItem(FILES_KEY, '{not json')
    localStorage.setItem(SETTINGS_KEY, '{also not json')
    expect(() => act(() => store().hydrate())).not.toThrow()
    expect(store().files.length).toBeGreaterThan(0)
  })

  it('reports an error when storage rejects the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    act(() => store().flushPersist())
    expect(store().saveState).toBe('error')
    spy.mockRestore()
  })

  it('debounces autosave rather than writing on every keystroke', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    act(() => {
      store().setContent('a')
      store().setContent('ab')
      store().setContent('abc')
    })
    expect(spy).not.toHaveBeenCalled()
    expect(store().saveState).toBe('saving')

    act(() => vi.advanceTimersByTime(1000))
    expect(spy).toHaveBeenCalled()
    expect(store().saveState).toBe('saved')
    spy.mockRestore()
  })
})

describe('settings', () => {
  it('clamps the editor width to the resizable range', () => {
    act(() => store().setEditorWidth(5))
    expect(store().editorWidth).toBe(20)
    act(() => store().setEditorWidth(95))
    expect(store().editorWidth).toBe(80)
  })

  it('clamps the sidebar width and font size', () => {
    act(() => store().setSidebarWidth(20))
    expect(store().sidebarWidth).toBe(180)
    act(() => store().setFontSize(99))
    expect(store().fontSize).toBe(24)
  })

  it('resolves a system theme before flipping it', () => {
    useEditorStore.setState({ theme: 'system' })
    act(() => store().toggleTheme())
    expect(['light', 'dark']).toContain(store().theme)
    expect(store().theme).not.toBe('system')
  })

  it('opens the sidebar when a tab is selected', () => {
    useEditorStore.setState({ sidebarCollapsed: true })
    act(() => store().setSidebarTab('outline'))
    expect(store().sidebarCollapsed).toBe(false)
    expect(store().sidebarTab).toBe('outline')
  })
})

describe('toasts', () => {
  it('adds and auto-dismisses a toast', () => {
    act(() => store().pushToast('Hello', 'success'))
    expect(store().toasts).toHaveLength(1)
    act(() => vi.advanceTimersByTime(4000))
    expect(store().toasts).toHaveLength(0)
  })

  it('keeps at most a handful of toasts', () => {
    act(() => {
      for (let index = 0; index < 10; index += 1) store().pushToast(`n${index}`)
    })
    expect(store().toasts.length).toBeLessThanOrEqual(4)
  })
})
