import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import Header from '../components/Header'
import StatusBar from '../components/StatusBar'
import StorageBanner from '../components/StorageBanner'
import CommandPalette from '../components/CommandPalette'
import FindReplace from '../components/FindReplace'
import Preview from '../components/Preview'
import { loadMarkdownFiles } from '../services/markdownStorage'

/**
 * M1: the safety patches for data loss (confirm before "Load from backend", the warning under "Save to
 * backend", the red banner when the storage quota is full) and the components taken off the keystroke path.
 */
vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => [{ id: 'json', available: true }]),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(async () => [
    { id: 'srv', name: 'Server', type: 'folder', children: [{ id: 'remote', name: 'remote.md', type: 'file', parentId: 'srv', content: 'from server' }] }
  ]),
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
    backendStorage: true,
    backendStorageType: 'json'
  })
  vi.mocked(loadMarkdownFiles).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const renderHeader = () =>
  render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={() => {}} />)

describe('Sync menu safety', () => {
  it('asks before "Load from backend" replaces the local documents, and a cancel changes nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    await userEvent.click(screen.getByRole('button', { name: /Load from backend/ }))

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toMatch(/replaces all 2 documents/)
    expect(confirm.mock.calls[0][0]).toMatch(/will be lost/)
    expect(loadMarkdownFiles).not.toHaveBeenCalled()
    expect(useEditorStore.getState().currentContent).toBe(DOC)
  })

  it('loads once confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    await userEvent.click(screen.getByRole('button', { name: /Load from backend/ }))
    await waitFor(() => expect(loadMarkdownFiles).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useEditorStore.getState().files[0].id).toBe('srv'))
  })

  it('warns under "Save to backend" that it overwrites the whole server copy', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/Save to backend overwrites the whole server copy/)
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
    await userEvent.click(screen.getByRole('button', { name: 'Export this document' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
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
