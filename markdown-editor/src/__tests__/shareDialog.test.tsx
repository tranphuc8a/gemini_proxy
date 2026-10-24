import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import ShareDialog from '../components/ShareDialog'
import Header from '../components/Header'
import CommandPalette from '../components/CommandPalette'
import { useEditorStore } from '../store'
import { createShare, listShares, revokeShare, type ShareListing, type ShareSummary } from '../services/shareClient'
import { SyncError } from '../services/markdownSync'

vi.mock('../services/shareClient', async () => {
  const actual = await vi.importActual<typeof import('../services/shareClient')>('../services/shareClient')
  return { ...actual, createShare: vi.fn(), listShares: vi.fn(), revokeShare: vi.fn() }
})
vi.mock('../services/markdownStorage', async () => {
  const actual = await vi.importActual<typeof import('../services/markdownStorage')>('../services/markdownStorage')
  return {
    ...actual,
    listBackends: vi.fn(async () => [{ id: 'json', available: true }]),
    restoreAdminSession: vi.fn(async () => false),
    recheckAdminSession: vi.fn(async () => 'valid')
  }
})

const DOC = '# Plan\n\nSee [budget](budget.md) and ![chart](./chart.png).\n'
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

function summary(overrides: Partial<ShareSummary> = {}): ShareSummary {
  return {
    token: 'AbCdEfGhIjKlMnOpQrStUv',
    docId: 'file-plan',
    title: 'Plan',
    mode: 'snapshot',
    sharedAt: Date.UTC(2026, 9, 1),
    updatedAt: Date.UTC(2026, 9, 2),
    expiresAt: null,
    bytes: 40,
    contentHash: sha(DOC),
    expired: false,
    ...overrides
  }
}

function listing(shares: ShareSummary[], extra: Partial<ShareListing> = {}): ShareListing {
  return { shares, limits: { maxShares: 50, maxBytes: 2_000_000 }, persistent: true, ...extra }
}

const onClose = vi.fn()
const onOpenAuth = vi.fn()
const renderDialog = () => render(<ShareDialog open onClose={onClose} onOpenAuth={onOpenAuth} />)

beforeEach(() => {
  window.history.replaceState(null, '', '/webapp/tranphuc8a/markdown-editor-pro/index.html?source=pwa')
  useEditorStore.setState({
    files: [
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        children: [
          { id: 'file-plan', name: 'Plan.md', type: 'file', parentId: 'root', content: DOC },
          { id: 'file-other', name: 'Other.md', type: 'file', parentId: 'root', content: 'x' }
        ]
      }
    ],
    currentFileId: 'file-plan',
    currentContent: DOC,
    isAdmin: true,
    backendStorageType: 'json',
    backendStorage: true,
    toasts: []
  })
  vi.mocked(createShare).mockReset()
  vi.mocked(listShares).mockReset()
  vi.mocked(revokeShare).mockReset()
  onClose.mockReset()
  onOpenAuth.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('ShareDialog', () => {
  it('a guest is invited to unlock admin mode instead', async () => {
    useEditorStore.setState({ isAdmin: false })
    renderDialog()
    expect(screen.getByText(/needs admin access/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Unlock admin mode…' }))
    expect(onClose).toHaveBeenCalled()
    expect(onOpenAuth).toHaveBeenCalled()
    expect(listShares).not.toHaveBeenCalled()
  })

  it('with no document open it says so', () => {
    useEditorStore.setState({ currentFileId: null })
    vi.mocked(listShares).mockResolvedValue(listing([]))
    renderDialog()
    expect(screen.getByText(/Open a document first/)).toBeInTheDocument()
  })

  it('the root folder and odd ids cannot be shared', async () => {
    useEditorStore.setState({
      files: [{ id: 'bad id', name: 'odd.md', type: 'file', content: 'x' }],
      currentFileId: 'bad id'
    })
    vi.mocked(listShares).mockResolvedValue(listing([]))
    renderDialog()
    expect(await screen.findByRole('note')).toHaveTextContent(/can't be shared/)
    expect(screen.queryByRole('button', { name: /Create link/ })).toBeNull()
  })

  it('creates a link from the open document and then shows it, ready to copy', async () => {
    vi.mocked(listShares).mockResolvedValueOnce(listing([])).mockResolvedValueOnce(listing([summary()]))
    vi.mocked(createShare).mockResolvedValue({ created: true, share: summary() })
    renderDialog()
    await waitFor(() => expect(listShares).toHaveBeenCalledWith('json'))
    const title = screen.getByLabelText('Title') as HTMLInputElement
    expect(title.value).toBe('Plan')
    await userEvent.selectOptions(screen.getByLabelText('Expires'), '7')
    await userEvent.click(screen.getByRole('button', { name: /Create link/ }))
    expect(createShare).toHaveBeenCalledWith({ docId: 'file-plan', title: 'Plan', content: DOC, expiresInDays: 7 }, 'json')
    const url = (await screen.findByLabelText('Read-only link')) as HTMLInputElement
    // The folder, never index.html or the current query (ke-hoach §1.4).
    expect(url.value).toBe(`${window.location.origin}/webapp/tranphuc8a/markdown-editor-pro/#share=AbCdEfGhIjKlMnOpQrStUv&backend=json`)
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await userEvent.click(screen.getByRole('button', { name: /^Copy$/ }))
    expect(writeText).toHaveBeenCalledWith(url.value)
    expect(useEditorStore.getState().toasts.map((toast) => toast.message)).toEqual(expect.arrayContaining(['Read-only link created', 'Link copied']))
  })

  it('an existing link: Update snapshot keeps it; Revoke asks first', async () => {
    vi.mocked(listShares).mockResolvedValue(listing([summary({ expiresAt: Date.UTC(2026, 9, 9) })]))
    vi.mocked(createShare).mockResolvedValue({ created: false, share: summary() })
    renderDialog()
    expect(await screen.findByRole('button', { name: /Update snapshot/ })).toBeInTheDocument()
    expect((screen.getByLabelText('Expires') as HTMLSelectElement).value).toBe('7')
    await userEvent.click(screen.getByRole('button', { name: /Update snapshot/ }))
    expect(createShare).toHaveBeenCalledWith(expect.objectContaining({ docId: 'file-plan', expiresInDays: 7 }), 'json')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await userEvent.click(screen.getByRole('button', { name: /Revoke link/ }))
    expect(confirm.mock.calls[0][0]).toMatch(/lose access.*different link/s)
    expect(revokeShare).not.toHaveBeenCalled()
    confirm.mockReturnValueOnce(true)
    vi.mocked(revokeShare).mockResolvedValue()
    await userEvent.click(screen.getByRole('button', { name: /Revoke link/ }))
    await waitFor(() => expect(revokeShare).toHaveBeenCalledWith('file-plan', 'json'))
  })

  it('refreshing the list does not erase the title being typed (the list is a new object each time)', async () => {
    const fresh = () =>
      listing([summary(), summary({ token: 'BbCdEfGhIjKlMnOpQrStUv', docId: 'file-gone', title: 'Old notes' })])
    vi.mocked(listShares).mockImplementation(async () => fresh())
    vi.mocked(revokeShare).mockResolvedValue()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderDialog()
    const title = (await screen.findByLabelText('Title')) as HTMLInputElement
    await waitFor(() => expect(title.value).toBe('Plan'))
    await userEvent.clear(title)
    await userEvent.type(title, 'Draft title in progress')
    await userEvent.selectOptions(screen.getByLabelText('Expires'), '30')

    // Any action that re-reads the list: here, revoking ANOTHER document's link.
    await userEvent.click(await screen.findByText(/Other shared documents \(1\)/))
    await userEvent.click(screen.getByRole('button', { name: 'Revoke the link to Old notes' }))
    await waitFor(() => expect(listShares).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(revokeShare).toHaveBeenCalledWith('file-gone', 'json'))
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Draft title in progress')
    expect((screen.getByLabelText('Expires') as HTMLSelectElement).value).toBe('30')
  })

  it('after Update snapshot the title field shows what the server now holds; another document gets its own name', async () => {
    vi.mocked(listShares)
      .mockResolvedValueOnce(listing([summary()]))
      .mockResolvedValue(listing([summary({ title: 'Renamed', updatedAt: Date.UTC(2026, 9, 5) })]))
    vi.mocked(createShare).mockResolvedValue({ created: false, share: summary({ title: 'Renamed' }) })
    renderDialog()
    const title = (await screen.findByLabelText('Title')) as HTMLInputElement
    await waitFor(() => expect(title.value).toBe('Plan'))
    await userEvent.clear(title)
    await userEvent.type(title, 'Renamed')
    await userEvent.click(screen.getByRole('button', { name: /Update snapshot/ }))
    await waitFor(() => expect(createShare).toHaveBeenCalledWith(expect.objectContaining({ title: 'Renamed' }), 'json'))
    await waitFor(() => expect(listShares).toHaveBeenCalledTimes(2))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Renamed')

    act(() => useEditorStore.setState({ currentFileId: 'file-other', currentContent: 'x' }))
    await waitFor(() => expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Other'))
  })

  it('an EXPIRED link says so: updating makes a new link, and the old address stays dead', async () => {
    const dead = summary({ expiresAt: Date.UTC(2026, 9, 3), expired: true })
    const renewed = summary({ token: 'ZzCdEfGhIjKlMnOpQrStUv', sharedAt: Date.UTC(2026, 9, 20), updatedAt: Date.UTC(2026, 9, 20) })
    vi.mocked(listShares).mockResolvedValueOnce(listing([dead])).mockResolvedValue(listing([renewed]))
    vi.mocked(createShare).mockResolvedValue({ created: true, share: renewed })
    renderDialog()
    expect(await screen.findByText(/has expired and no longer opens/)).toBeInTheDocument()
    expect(screen.getByText(/old address stays dead/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Update snapshot/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Create new link/ }))
    await waitFor(() => expect(createShare).toHaveBeenCalled())
    const url = (await screen.findByLabelText('Read-only link')) as HTMLInputElement
    await waitFor(() => expect(url.value).toContain('ZzCdEfGhIjKlMnOpQrStUv'))
    expect(screen.queryByText(/has expired and no longer opens/)).toBeNull()
    expect(useEditorStore.getState().toasts.map((toast) => toast.message)).toContain('Read-only link created')
  })

  it('says when the document changed since the snapshot', async () => {
    useEditorStore.setState({ currentContent: `${DOC}\nmore` })
    vi.mocked(listShares).mockResolvedValue(listing([summary()]))
    renderDialog()
    expect(await screen.findByText(/changed since this snapshot/)).toBeInTheDocument()
  })

  it('does not claim a change when the text is the snapshot', async () => {
    vi.mocked(listShares).mockResolvedValue(listing([summary()]))
    renderDialog()
    await screen.findByRole('button', { name: /Update snapshot/ })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText(/changed since this snapshot/)).toBeNull()
  })

  it('a document over the size limit cannot be shared', async () => {
    vi.mocked(listShares).mockResolvedValue(listing([], { limits: { maxShares: 50, maxBytes: 10 } }))
    renderDialog()
    await waitFor(() => expect(screen.getByTestId('share-size')).toHaveTextContent(/too large/))
    expect(screen.getByTestId('share-size')).toHaveClass('is-over')
    expect(screen.getByRole('button', { name: /Create link/ })).toBeDisabled()
  })

  it('warns about links to other documents and relative images', async () => {
    vi.mocked(listShares).mockResolvedValue(listing([]))
    renderDialog()
    expect(await screen.findByText(/1 link points to other documents/)).toBeInTheDocument()
    expect(screen.getByText(/1 image has a relative address/)).toBeInTheDocument()
  })

  it('lists the other links and marks orphans', async () => {
    vi.mocked(listShares).mockResolvedValue(
      listing([summary(), summary({ token: 'BbCdEfGhIjKlMnOpQrStUv', docId: 'file-gone', title: 'Old notes' })])
    )
    renderDialog()
    const others = await screen.findByText(/Other shared documents \(1\)/)
    await userEvent.click(others)
    const item = screen.getByText('Old notes').closest('li')!
    expect(within(item).getByText('not in this editor')).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Revoke the link to Old notes' })).toBeInTheDocument()
  })

  it('Escape closes it wherever focus is', async () => {
    vi.mocked(listShares).mockResolvedValue(listing([]))
    renderDialog()
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('warns when the server keeps links in a temporary file', async () => {
    vi.mocked(listShares).mockResolvedValue(listing([], { persistent: false }))
    renderDialog()
    expect(await screen.findByText(/temporary file/)).toBeInTheDocument()
  })

  it('shows a server refusal', async () => {
    const { ShareError } = await vi.importActual<typeof import('../services/shareClient')>('../services/shareClient')
    vi.mocked(listShares).mockRejectedValue(new ShareError('Admin access is needed. Unlock admin mode again.', { status: 403 }))
    renderDialog()
    expect(await screen.findByRole('alert')).toHaveTextContent(/Admin access is needed/)
  })
})

describe('wiring', () => {
  const header = (extra: Partial<Parameters<typeof Header>[0]> = {}) =>
    render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={onOpenAuth} {...extra} />)

  it('File → "Share read-only link…" opens the dialog', async () => {
    const onOpenShare = vi.fn()
    header({ onOpenShare })
    await userEvent.click(screen.getByRole('button', { name: /^File/ }))
    await userEvent.click(screen.getByRole('button', { name: /Share read-only link/ }))
    expect(onOpenShare).toHaveBeenCalled()
  })

  it('the command palette offers it while a document is open', async () => {
    const onOpenShare = vi.fn()
    render(<CommandPalette open onClose={() => {}} onOpenHelp={() => {}} onOpenShare={onOpenShare} />)
    await userEvent.type(screen.getByLabelText('Search commands'), 'share read')
    await userEvent.keyboard('{Enter}')
    expect(onOpenShare).toHaveBeenCalled()
  })

  it('a guest replacing from a private server is told to unlock, and nothing is replaced', async () => {
    const replaceFromServer = vi.fn().mockRejectedValue(new SyncError("This server's documents are private.", { status: 403, code: 'markdown_private' }))
    useEditorStore.setState({ isAdmin: false, replaceFromServer })
    const confirm = vi.spyOn(window, 'confirm')
    header()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    await userEvent.click(screen.getByRole('button', { name: /Replace this device/ }))
    await waitFor(() => expect(onOpenAuth).toHaveBeenCalled())
    expect(confirm).not.toHaveBeenCalled()
    expect(useEditorStore.getState().toasts.map((toast) => toast.message)).toContain(
      "This server's documents are private. Unlock admin mode to load them."
    )
    expect(useEditorStore.getState().currentFileId).toBe('file-plan')
  })

  it('a guest replacing from a public server confirms after the server answered', async () => {
    const replaceFromServer = vi.fn(async (confirm?: (info: { documents: number; unsent: number }) => boolean | Promise<boolean>) => {
      // The store asks the server first, then hands what it found to the person.
      return (await confirm?.({ documents: 3, unsent: 0 })) ?? true
    })
    useEditorStore.setState({ isAdmin: false, replaceFromServer })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    header()
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    await userEvent.click(screen.getByRole('button', { name: /Replace this device/ }))
    await waitFor(() => expect(replaceFromServer).toHaveBeenCalledTimes(1))
    expect(confirm.mock.calls[0][0]).toMatch(/exactly the 3 documents on the server/)
    expect(confirm.mock.calls[0][0]).toMatch(/Nothing waiting to sync here is lost/)
  })
})
