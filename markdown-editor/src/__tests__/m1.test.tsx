import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import type { ReplaceInfo } from '../sync/engine'
import Header from '../components/Header'
import StatusBar from '../components/StatusBar'
import StorageBanner from '../components/StorageBanner'
import CommandPalette from '../components/CommandPalette'
import FindReplace from '../components/FindReplace'
import Preview from '../components/Preview'

/**
 * M1: the red banner when the storage quota is full and the components taken off the keystroke path; the Sync menu
 * (M1's confirm-before-load and overwrite warning were replaced by md-sync F8: no whole-tree save, a confirmed replace).
 */
vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => [{ id: 'json', available: true }]),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn()
}))

const DOC = '# Title\n\ntext one\n\n## Section\n\nmore text\n'

beforeEach(() => {
  useEditorStore.setState({
    files: [
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        children: [
          { id: 'a', name: 'alpha.md', type: 'file', parentId: 'root', content: DOC },
          { id: 'b', name: 'beta.md', type: 'file', parentId: 'root', content: 'beta' }
        ]
      }
    ],
    currentFileId: 'a',
    currentContent: DOC,
    selectedFolderId: 'root',
    expandedFolders: ['root'],
    isAdmin: true,
    toasts: [],
    saveState: 'idle',
    lastSavedAt: null,
    storageFailure: null,
    storageFailureScope: null,
    backendStorage: true,
    backendStorageType: 'json'
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const renderHeader = () =>
  render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={() => {}} />)

describe('Sync menu (md-sync F8: no whole-tree save, no unasked replace)', () => {
  const openSync = async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
  }

  it('has no "Save to backend" and no "Load from backend" any more (the old whole-tree calls are gone)', async () => {
    await openSync()
    expect(screen.queryByRole('button', { name: /Save to backend/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Load from backend/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/overwrites the whole server copy/)).not.toBeInTheDocument()
  })

  it('"Replace this device\'s copy…" says what would be lost and a cancel changes nothing', async () => {
    const replaceFromServer = vi.fn(async (confirm?: (info: ReplaceInfo) => boolean | Promise<boolean>) => (await confirm?.({ documents: 5, unsent: 2, refused: [] })) ?? true)
    useEditorStore.setState({ replaceFromServer })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await openSync()
    await userEvent.click(screen.getByRole('button', { name: /Replace this device/ }))

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(confirm.mock.calls[0][0]).toMatch(/exactly the 5 documents on the server/)
    expect(confirm.mock.calls[0][0]).toMatch(/2 changes made here and not synced yet will be lost/)
    expect(confirm.mock.calls[0][0]).toMatch(/cannot be undone/)
    expect(useEditorStore.getState().currentContent).toBe(DOC)
    expect(useEditorStore.getState().toasts).toEqual([])
  })

  it('"Replace this device\'s copy…" also names the documents the server refused: this device holds their only copy', async () => {
    const replaceFromServer = vi.fn(async (confirm?: (info: ReplaceInfo) => boolean | Promise<boolean>) => (await confirm?.({ documents: 2, unsent: 0, refused: ['huge.md', 'b.md', 'c.md', 'd.md', 'e.md'] })) ?? true)
    useEditorStore.setState({ replaceFromServer })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await openSync()
    await userEvent.click(screen.getByRole('button', { name: /Replace this device/ }))

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    const message = confirm.mock.calls[0][0]
    expect(message).toMatch(/5 documents the server refused/)
    expect(message).toContain('“huge.md”, “b.md”, “c.md” and 2 more')
    expect(message).toMatch(/exist only on this device and will be lost for good/)
    expect(message).not.toMatch(/Nothing waiting to sync here is lost/)
  })

  it('"Sync now" runs a cycle of the engine', async () => {
    const syncNow = vi.fn(async () => undefined)
    useEditorStore.setState({ syncNow })
    await openSync()
    await userEvent.click(screen.getByRole('button', { name: /^Sync now/ }))
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('offers the conflicts and the refused documents when there are some, and opens the panel from them', async () => {
    const onOpenSync = vi.fn()
    useEditorStore.setState({
      sync: {
        phase: 'idle', pending: 0, lastSync: Date.now(), error: null, reconcile: null, readOnly: false,
        conflicts: [{ id: 'a', name: 'alpha.md' }], blocked: [{ id: 'b', name: 'beta.md', code: 'md_bad_name', message: 'no' }]
      }
    })
    render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={() => {}} onOpenSync={onOpenSync} />)
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    await userEvent.click(screen.getByRole('button', { name: /Conflicts \(1\)/ }))
    expect(onOpenSync).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    expect(screen.getByRole('button', { name: /Refused by the server \(1\)/ })).toBeInTheDocument()
  })

  it('a refused replace reports the reason', async () => {
    useEditorStore.setState({ replaceFromServer: vi.fn().mockRejectedValue(new Error('Cannot reach the server.')) })
    await openSync()
    await userEvent.click(screen.getByRole('button', { name: /Replace this device/ }))
    await waitFor(() => expect(useEditorStore.getState().toasts.map((toast) => toast.message)).toContain('Cannot reach the server.'))
  })
})

describe('StorageBanner', () => {
  it('stays hidden while saving works, and for storage that is merely unavailable', () => {
    const { container, rerender } = render(<StorageBanner />)
    expect(container).toBeEmptyDOMElement()
    act(() => useEditorStore.setState({ storageFailure: 'unavailable' }))
    rerender(<StorageBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('raises a red alert when the quota is full, and drops it once a save works', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    render(<StorageBanner />)
    act(() => useEditorStore.getState().flushPersist())
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/Browser storage is full/)
    expect(alert).toHaveTextContent(/not saved/)

    setItem.mockRestore()
    await userEvent.click(within(alert).getByRole('button', { name: 'Try saving again' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useEditorStore.getState().saveState).toBe('saved')
  })

  it('offers to export the document it could not save', async () => {
    useEditorStore.setState({ storageFailure: 'quota' })
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<StorageBanner />)
    await userEvent.click(screen.getByRole('button', { name: 'Export open document' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    // And it says the other changed documents are at risk too, not only the open one.
    expect(screen.getByRole('alert')).toHaveTextContent(/every document changed since/)
  })

  it('says only the settings are unsaved when the documents went in', () => {
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.includes('settings')) throw new DOMException('full', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    render(<StorageBanner />)
    act(() => useEditorStore.getState().flushPersist())
    expect(useEditorStore.getState().storageFailureScope).toBe('settings')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/your settings are not saved/)
    expect(alert).not.toHaveTextContent(/latest changes/)
    expect(within(alert).queryByRole('button', { name: 'Export open document' })).not.toBeInTheDocument()
  })
})

describe('StatusBar on the keystroke path', () => {
  it('recounts once typing pauses, not on every keystroke', () => {
    vi.useFakeTimers()
    render(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText(/^8 words/)).toBeInTheDocument()
    act(() => useEditorStore.getState().setContent(DOC + 'four more words here\n'))
    expect(screen.getByText(/^8 words/)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(450))
    expect(screen.getByText(/^12 words/)).toBeInTheDocument()
  })

  it("shows the counts of a newly opened file at once, never the previous file's", () => {
    vi.useFakeTimers()
    render(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText(/^8 words/)).toBeInTheDocument()
    act(() => useEditorStore.getState().setCurrentFile('b'))
    expect(screen.getByText('beta.md')).toBeInTheDocument()
    expect(screen.getByText(/^1 words?/)).toBeInTheDocument()
  })

  it('follows a rename of the open file (it selects the name, not the tree)', () => {
    render(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText('alpha.md')).toBeInTheDocument()
    act(() => useEditorStore.getState().renameNode('a', 'renamed.md'))
    expect(screen.getByText('renamed.md')).toBeInTheDocument()
  })
})

describe('CommandPalette', () => {
  it('builds nothing while closed and lists the headings once opened', () => {
    const { container, rerender } = render(<CommandPalette open={false} onClose={vi.fn()} onOpenHelp={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<CommandPalette open onClose={vi.fn()} onOpenHelp={vi.fn()} />)
    expect(screen.getByText('Headings')).toBeInTheDocument()
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByText('beta.md')).toBeInTheDocument()
  })
})

describe('FindReplace with a settled document', () => {
  it('acts on the live text even when the match list has not caught up yet', () => {
    vi.useFakeTimers()
    const onReplace = vi.fn()
    const props = {
      showReplace: true,
      canEdit: true,
      onClose: vi.fn(),
      onSelectMatch: vi.fn(),
      onReplace,
      onReplaceAll: vi.fn()
    }
    const { rerender } = render(<FindReplace value="cat dog cat" {...props} />)
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'cat' } })
    expect(screen.getByText('1 of 2')).toBeInTheDocument()

    // The editor inserted text before the first match; the list still shows the old offsets.
    rerender(<FindReplace value="a big cat dog cat" {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(onReplace).toHaveBeenCalledWith({ start: 6, end: 9 }, '')
  })
})

describe('Preview of a long document', () => {
  it('lets the editor paint first, then renders the stored document (never the welcome text)', async () => {
    const long = '# Long document\n\n' + 'Paragraph of text that goes on.\n\n'.repeat(900)
    useEditorStore.setState({ currentContent: long, viewMode: 'split' })
    render(<Preview />)
    expect(screen.getByText('Rendering preview…')).toBeInTheDocument()
    expect(screen.queryByText(/Welcome to Markdown Editor/)).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Long document' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByText('Rendering preview…')).not.toBeInTheDocument()
  })

  it('renders a short document at once', () => {
    render(<Preview />)
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
  })
})
