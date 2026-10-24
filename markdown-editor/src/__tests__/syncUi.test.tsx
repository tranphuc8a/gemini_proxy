import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import StatusBar from '../components/StatusBar'
import SyncPanel from '../components/SyncPanel'
import ReconcileModal from '../components/ReconcileModal'
import Header from '../components/Header'
import CommandPalette from '../components/CommandPalette'
import { ago, describeSync } from '../sync/describe'
import type { SyncState } from '../sync/engine'

vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => [{ id: 'json', available: true }]),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  adminSessionHeaders: vi.fn(() => ({}))
}))

const NOW = Date.UTC(2026, 9, 24, 10, 0, 0)

const sync = (patch: Partial<SyncState> = {}): SyncState => ({
  phase: 'idle', pending: 0, lastSync: NOW - 120_000, error: null, conflicts: [], blocked: [], reconcile: null, readOnly: false, ...patch
})

beforeEach(() => {
  useEditorStore.setState({
    files: [{ id: 'root', name: 'Docs', type: 'folder', children: [{ id: 'a', name: 'alpha.md', type: 'file', parentId: 'root', content: 'A' }] }],
    currentFileId: 'a',
    currentContent: 'A',
    isAdmin: true,
    backendStorage: true,
    backendStorageType: 'json',
    toasts: [],
    docsReady: true,
    sync: sync()
  })
})

describe('what the status bar says', () => {
  it.each([
    ['synced a while ago', sync(), 'Synced 2 min ago', 'ok'],
    ['syncing with changes queued', sync({ phase: 'syncing', pending: 3 }), 'Syncing… (3)', 'busy'],
    ['offline with changes queued', sync({ phase: 'offline', pending: 5 }), 'Offline — 5 changes queued', 'warn'],
    ['offline, nothing queued', sync({ phase: 'offline' }), 'Offline', 'warn'],
    ['a conflict beats everything else', sync({ phase: 'syncing', conflicts: [{ id: 'a', name: 'a.md' }] }), '⚠ 1 conflict', 'warn'],
    ['two conflicts', sync({ conflicts: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }] }), '⚠ 2 conflicts', 'warn'],
    ['a server problem', sync({ phase: 'error', pending: 1, error: 'Cannot reach the server.' }), 'Sync problem — 1 change waiting', 'error'],
    ['a private server', sync({ phase: 'private' }), 'Unlock admin to sync', 'warn'],
    ['the first-meeting question', sync({ phase: 'reconcile' }), 'Waiting for your answer', 'warn'],
    ['changes about to be sent', sync({ pending: 2 }), '2 changes waiting', 'busy'],
    ['a refused document', sync({ blocked: [{ id: 'x', name: 'x', code: 'md_bad_name', message: 'no' }] }), '⚠ 1 refused', 'warn'],
    ['a viewer', sync({ readOnly: true }), 'Up to date · 2 min ago', 'ok'],
    ['the engine not started yet', sync({ phase: 'off', lastSync: null }), 'Sync starting…', 'busy'],
    ['sync on, never run', sync({ lastSync: null }), 'Sync on', 'ok']
  ] as const)('%s', (_name, state, label, tone) => {
    const description = describeSync(state, NOW)
    expect(description.label).toBe(label)
    expect(description.tone).toBe(tone)
  })

  it('writes elapsed time the way a person would', () => {
    expect(ago(NOW - 5_000, NOW)).toBe('just now')
    expect(ago(NOW - 5 * 60_000, NOW)).toBe('5 min ago')
    expect(ago(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago')
    expect(ago(NOW - 3 * 86_400_000, NOW)).toBe('3 d ago')
  })

  it('the bar shows the state and a click opens the panel; it shows nothing while Backend sync is off', async () => {
    const onOpenSync = vi.fn()
    render(<StatusBar onOpenHelp={() => undefined} onOpenSync={onOpenSync} />)
    const indicator = screen.getByRole('button', { name: /Backend status: / })
    await userEvent.click(indicator)
    expect(onOpenSync).toHaveBeenCalled()
    expect(screen.queryByTitle('Backend sync is enabled')).not.toBeInTheDocument()

    act(() => useEditorStore.setState({ backendStorage: false }))
    expect(screen.queryByRole('button', { name: /Backend status: / })).not.toBeInTheDocument()
  })

  it('follows the state', () => {
    render(<StatusBar onOpenHelp={() => undefined} />)
    act(() => useEditorStore.setState({ sync: sync({ phase: 'offline', pending: 5 }) }))
    expect(screen.getByRole('button', { name: 'Backend status: Offline — 5 changes queued' })).toBeInTheDocument()
    act(() => useEditorStore.setState({ sync: sync({ conflicts: [{ id: 'a', name: 'a.md' }] }) }))
    expect(screen.getByRole('button', { name: 'Backend status: ⚠ 1 conflict' })).toBeInTheDocument()
  })
})

describe('the sync panel', () => {
  it('lists each conflict with its three answers, and sends the one chosen to the engine', async () => {
    const resolveConflict = vi.fn(async () => undefined)
    useEditorStore.setState({ resolveConflict, sync: sync({ conflicts: [{ id: 'a', name: 'alpha.md' }, { id: 'b', name: 'beta.md' }] }) })
    render(<SyncPanel open onClose={() => undefined} />)
    const dialog = screen.getByRole('dialog', { name: 'Sync' })
    const rows = within(dialog).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Keep mine' }))
    await userEvent.click(within(rows[1]).getByRole('button', { name: "Use the server's" }))
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Keep both' }))
    expect(resolveConflict.mock.calls).toEqual([['a', 'mine'], ['b', 'server'], ['a', 'both']])
    expect(dialog).toHaveTextContent(/yours is discarded/)
  })

  it('shows what the server refused, with the reason, and lets the person try again', async () => {
    const retryBlocked = vi.fn(async () => undefined)
    useEditorStore.setState({ retryBlocked, sync: sync({ blocked: [{ id: 'bad', name: 'a/b.md', code: 'md_bad_name', message: 'The server does not accept this name.' }] }) })
    render(<SyncPanel open onClose={() => undefined} />)
    expect(screen.getByText('The server does not accept this name.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retryBlocked).toHaveBeenCalledWith('bad')
  })

  it('reports a failed answer in the panel and keeps it open', async () => {
    useEditorStore.setState({ resolveConflict: vi.fn().mockRejectedValue(new Error('The document kept changing')), sync: sync({ conflicts: [{ id: 'a', name: 'alpha.md' }] }) })
    const onClose = vi.fn()
    render(<SyncPanel open onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The document kept changing')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('runs "Sync now", closes on Esc, and says everything is sent when nothing waits', async () => {
    const syncNow = vi.fn(async () => undefined)
    const onClose = vi.fn()
    useEditorStore.setState({ syncNow })
    render(<SyncPanel open onClose={onClose} />)
    expect(screen.getByText(/Everything on this device has been sent/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(syncNow).toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing while closed', () => {
    const { container } = render(<SyncPanel open={false} onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the first-meeting question', () => {
  const plan = {
    reason: 'first' as const,
    same: 4,
    uploads: [{ id: 'u1', name: 'only-here.md' }],
    downloads: [{ id: 'd1', name: 'only-there.md' }, { id: 'd2', name: 'also-there.md' }],
    differ: [{ id: 'x', name: 'plan.md' }]
  }

  it('is silent until the engine has a question', () => {
    const { container } = render(<ReconcileModal />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lays out the four groups and answers "keep both" by default', async () => {
    const resolveReconcile = vi.fn()
    useEditorStore.setState({ resolveReconcile, sync: sync({ phase: 'reconcile', reconcile: plan }) })
    render(<ReconcileModal />)
    const dialog = screen.getByRole('dialog', { name: 'First sync with this server' })
    expect(dialog).toHaveTextContent('4 documents are the same on both')
    expect(dialog).toHaveTextContent('1 only on this device')
    expect(dialog).toHaveTextContent('2 only on the server')
    expect(dialog).toHaveTextContent('1 differ')
    expect(screen.getByRole('radio', { name: /Keep both/ })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(resolveReconcile).toHaveBeenCalledWith({ differ: 'both', deleteServerOnly: false })
  })

  it('passes the person\'s other choices on, and Cancel switches sync off', async () => {
    const resolveReconcile = vi.fn()
    useEditorStore.setState({ resolveReconcile, sync: sync({ phase: 'reconcile', reconcile: { ...plan, reason: 'reset' } }) })
    render(<ReconcileModal />)
    expect(screen.getByRole('dialog', { name: 'Sync again with the server' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Prefer the server's/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Delete these from the server/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(resolveReconcile).toHaveBeenLastCalledWith({ differ: 'server', deleteServerOnly: true })
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(resolveReconcile).toHaveBeenLastCalledWith('cancel')
  })

  it('offers to delete server-only documents only after a reset, never on a first meeting', () => {
    useEditorStore.setState({ sync: sync({ phase: 'reconcile', reconcile: plan }) })
    render(<ReconcileModal />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('does not ask about differences when there are none', () => {
    useEditorStore.setState({ sync: sync({ phase: 'reconcile', reconcile: { ...plan, differ: [], reason: 'reset' } }) })
    render(<ReconcileModal />)
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Delete these from the server/ })).not.toBeChecked()
  })
})

describe('the menu and the palette', () => {
  it('a viewer is told sending needs admin access, an administrator is not', async () => {
    useEditorStore.setState({ isAdmin: false })
    const { unmount } = render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    expect(screen.getByText(/Sending changes needs admin access/)).toBeInTheDocument()
    unmount()

    useEditorStore.setState({ isAdmin: true })
    render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    expect(screen.queryByText(/Sending changes needs admin access/)).not.toBeInTheDocument()
  })

  it('disables "Sync now" and "Replace…" while Backend sync is off', async () => {
    useEditorStore.setState({ backendStorage: false })
    render(<Header onOpenHelp={() => {}} onOpenInstall={() => {}} onOpenPalette={() => {}} onOpenAuth={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /^Sync/ }))
    expect(screen.getByRole('button', { name: /^Sync now/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Replace this device/ })).toBeDisabled()
  })

  it('the palette offers "Sync now" and "Sync status…" only while Backend sync is on', async () => {
    const syncNow = vi.fn(async () => undefined)
    const onOpenSync = vi.fn()
    useEditorStore.setState({ syncNow })
    const { unmount } = render(<CommandPalette open onClose={() => {}} onOpenHelp={() => {}} onOpenSync={onOpenSync} />)
    await userEvent.type(screen.getByLabelText('Search commands'), 'sync now')
    await userEvent.keyboard('{Enter}')
    expect(syncNow).toHaveBeenCalled()
    unmount()

    render(<CommandPalette open onClose={() => {}} onOpenHelp={() => {}} onOpenSync={onOpenSync} />)
    await userEvent.type(screen.getByLabelText('Search commands'), 'sync status')
    await userEvent.keyboard('{Enter}')
    expect(onOpenSync).toHaveBeenCalled()

    useEditorStore.setState({ backendStorage: false })
    render(<CommandPalette open onClose={() => {}} onOpenHelp={() => {}} onOpenSync={onOpenSync} />)
    expect(screen.queryByText('Sync now')).not.toBeInTheDocument()
  })
})
