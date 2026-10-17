import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import InstallModal from '../components/InstallModal'
import Header from '../components/Header'
import { installState, offlineStatus, promptInstall } from '../lib/pwa'

// Header asks the backend which storage backends exist, and the store imports the session helpers.
vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => [{ id: 'json', available: true }]),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn()
}))

// What the browser and the worker report is the lib's business (pwa.test.ts); here it is a given.
vi.mock('../lib/pwa', () => ({
  installState: vi.fn(() => 'menu'),
  offlineStatus: vi.fn(async () => ({ phase: 'ready', files: 412, failed: 0 })),
  promptInstall: vi.fn(async () => true),
  subscribeInstall: vi.fn(() => () => {})
}))

beforeEach(() => {
  useEditorStore.setState({ isAdmin: false })
  vi.mocked(installState).mockReturnValue('menu')
  vi.mocked(offlineStatus).mockResolvedValue({ phase: 'ready', files: 412, failed: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('InstallModal', () => {
  const show = async () => {
    const onClose = vi.fn()
    render(<InstallModal open onClose={onClose} />)
    await screen.findByRole('dialog', { name: /use offline/i })
    return onClose
  }

  it('renders nothing while closed', () => {
    render(<InstallModal open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says the app is ready offline, and how many files that took', async () => {
    await show()
    expect(await screen.findByRole('status')).toHaveTextContent('Ready offline — 412 files are saved on this device.')
  })

  it('says what is missing when some files could not be saved', async () => {
    vi.mocked(offlineStatus).mockResolvedValue({ phase: 'partial', files: 412, failed: 3 })
    await show()
    expect(await screen.findByRole('status')).toHaveTextContent('3 of 412 files could not be downloaded')
  })

  it('explains why offline is unavailable on an insecure address', async () => {
    vi.mocked(offlineStatus).mockResolvedValue({ phase: 'unsupported', files: 0, failed: 0 })
    await show()
    expect(await screen.findByRole('status')).toHaveTextContent(/needs HTTPS/i)
  })

  it('keeps looking while the worker is still saving, then settles', async () => {
    vi.useFakeTimers()
    vi.mocked(offlineStatus)
      .mockResolvedValueOnce({ phase: 'preparing', files: 0, failed: 0 })
      .mockResolvedValue({ phase: 'ready', files: 412, failed: 0 })
    render(<InstallModal open onClose={() => {}} />)
    await act(async () => {})
    expect(screen.getByRole('status')).toHaveTextContent('Saving a copy for offline use…')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Ready offline')
    expect(offlineStatus).toHaveBeenCalledTimes(2)
  })

  it('offers the install button when the browser allows it, and passes the click on', async () => {
    vi.mocked(installState).mockReturnValue('ready')
    await show()
    await userEvent.click(screen.getByRole('button', { name: 'Install app' }))
    expect(promptInstall).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ios', /Add to Home Screen/],
    ['insecure', /secure address/],
    ['installed', /running the installed app/],
    ['menu', /browser’s install option/]
  ] as const)('shows the right instruction for %s', async (state, text) => {
    vi.mocked(installState).mockReturnValue(state)
    await show()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
  })

  it('tells a visitor that editing offline needs unlocking first, and an admin that it just works', async () => {
    const { unmount } = render(<InstallModal open onClose={() => {}} />)
    expect(await screen.findByText(/once you have unlocked editing on this device/)).toBeInTheDocument()
    unmount()

    useEditorStore.setState({ isAdmin: true })
    render(<InstallModal open onClose={() => {}} />)
    expect(await screen.findByText(/Keep editing them\./)).toBeInTheDocument()
    expect(screen.queryByText(/once you have unlocked/)).not.toBeInTheDocument()
  })

  it('closes from the close button', async () => {
    const onClose = await show()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Header', () => {
  it('opens the offline dialog from the File menu', async () => {
    const onOpenInstall = vi.fn()
    render(<Header onOpenHelp={() => {}} onOpenInstall={onOpenInstall} onOpenPalette={() => {}} onOpenAuth={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: /^File/ }))
    await userEvent.click(screen.getByRole('button', { name: /install app \/ use offline/i }))

    expect(onOpenInstall).toHaveBeenCalledTimes(1)
  })
})
