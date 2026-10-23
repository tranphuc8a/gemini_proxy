import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SharePage from '../share/SharePage'
import { readShared, ShareError } from '../services/shareClient'
import { exportMarkdown } from '../lib/exporters'
import { useReadingStore } from '../readingStore'
import { DEFAULT_READING_SETTINGS } from '../lib/reading'

vi.mock('../services/shareClient', async () => {
  const actual = await vi.importActual<typeof import('../services/shareClient')>('../services/shareClient')
  return { ...actual, readShared: vi.fn() }
})
vi.mock('../lib/exporters', () => ({ exportMarkdown: vi.fn() }))

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'
const DOC = {
  title: 'Meeting notes',
  content: '# Meeting notes\n\nSee [the plan](plan.md) and $x^2$.\n',
  mode: 'snapshot',
  sharedAt: Date.UTC(2026, 9, 1),
  updatedAt: Date.UTC(2026, 9, 5),
  expiresAt: Date.UTC(2026, 10, 1)
}

beforeEach(() => {
  useReadingStore.setState({ ...DEFAULT_READING_SETTINGS, open: false })
  vi.mocked(readShared).mockReset()
  vi.mocked(exportMarkdown).mockReset()
  document.title = 'Markdown Editor'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SharePage', () => {
  it('shows the snapshot read-only, with its title in the tab and the dates', async () => {
    vi.mocked(readShared).mockResolvedValue(DOC)
    render(<SharePage token={TOKEN} backend="json" />)
    expect(screen.getByRole('status')).toHaveTextContent(/Opening/)
    expect(await screen.findByRole('heading', { name: 'Meeting notes', level: 1 })).toBeInTheDocument()
    expect(readShared).toHaveBeenCalledWith(TOKEN, 'json')
    expect(document.title).toBe('Meeting notes · Shared (read-only)')
    expect(screen.getByText(/Read-only · shared .* · updated .* · expires /)).toBeInTheDocument()
    expect(document.querySelector('.md-dead-link')?.textContent).toBe('the plan')
    expect(screen.queryByRole('button', { name: 'Exit reading mode' })).toBeNull()
    expect(document.querySelector('.editor-input')).toBeNull()
  })

  it('Download .md hands the snapshot to exportMarkdown', async () => {
    vi.mocked(readShared).mockResolvedValue(DOC)
    render(<SharePage token={TOKEN} backend="json" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Download .md' }))
    expect(exportMarkdown).toHaveBeenCalledWith('Meeting notes', DOC.content)
  })

  it('a revoked, expired or unknown link: one message, no retry', async () => {
    vi.mocked(readShared).mockRejectedValue(new ShareError('x', { code: 'markdown_share_not_found', status: 404 }))
    render(<SharePage token={TOKEN} backend="json" />)
    expect(await screen.findByRole('alert')).toHaveTextContent("This link doesn't exist, has expired, or was revoked by its owner.")
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('a malformed token is "not found" without asking the server', async () => {
    render(<SharePage token="../x" backend="json" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn't exist/)
    expect(readShared).not.toHaveBeenCalled()
  })

  it('429: says how long to wait and offers to try again', async () => {
    vi.mocked(readShared).mockRejectedValueOnce(new ShareError('x', { code: 'markdown_rate_limited', status: 429, retryAfter: 42 }))
    vi.mocked(readShared).mockResolvedValueOnce(DOC)
    render(<SharePage token={TOKEN} backend={null} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Try again in 42 seconds/)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Meeting notes', level: 1 })).toBeInTheDocument()
    expect(readShared).toHaveBeenCalledTimes(2)
  })

  it('offline: says so, shows nothing old, and can try again', async () => {
    vi.mocked(readShared).mockRejectedValue(new ShareError("You're offline.", { offline: true }))
    render(<SharePage token={TOKEN} backend="json" />)
    expect(await screen.findByRole('heading', { name: "You're offline" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText(/Meeting notes/)).toBeNull()
  })

  it('another error shows its message', async () => {
    vi.mocked(readShared).mockRejectedValue(new ShareError('The server answered 500.', { status: 500 }))
    render(<SharePage token={TOKEN} backend="json" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The server answered 500.'))
  })

  it('loads the reader’s text settings without opening reading mode', async () => {
    vi.mocked(readShared).mockResolvedValue(DOC)
    const spy = vi.spyOn(useReadingStore.getState(), 'loadSettings')
    render(<SharePage token={TOKEN} backend="json" />)
    await screen.findByRole('heading', { name: 'Meeting notes', level: 1 })
    expect(spy).toHaveBeenCalled()
    expect(useReadingStore.getState().open).toBe(false)
    expect(window.location.search).toBe('')
  })
})
