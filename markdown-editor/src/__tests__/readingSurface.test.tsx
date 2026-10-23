import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingSurface from '../components/ReadingSurface'
import { useReadingStore } from '../readingStore'
import { useEditorStore } from '../store'
import { DEFAULT_READING_SETTINGS, READING_KEY } from '../lib/reading'

/**
 * md-share V10: the reading surface without reading mode around it -- what a read-only link's page renders. It has no
 * exit, never writes ?read=1, and takes its text settings from storage through `loadSettings`.
 */
const DOC = '# Shared guide\n\nIntro.\n\n## Part one\n\nText with [another doc](other.md).\n\n- [ ] task\n'

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia
  window.history.replaceState(null, '', '/')
  useReadingStore.setState({ ...DEFAULT_READING_SETTINGS, open: false })
  useEditorStore.setState({ theme: 'light' })
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  window.matchMedia = originalMatchMedia
})

describe('ReadingSurface without an exit', () => {
  it('has no exit button and is not a modal dialog', () => {
    render(<ReadingSurface content={DOC} title="Shared guide" links="shared" ariaLabelPrefix="Shared document: " />)
    expect(screen.queryByRole('button', { name: 'Exit reading mode' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: /Shared document/ })).toBeNull()
    expect(screen.getByRole('article', { name: 'Shared guide' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shared guide', level: 1 })).toBeInTheDocument()
  })

  it('Escape closes a panel but does nothing else, and the address never gets ?read=1', async () => {
    render(<ReadingSurface content={DOC} title="Shared guide" links="shared" />)
    await userEvent.click(screen.getByRole('button', { name: 'Reading settings' }))
    expect(screen.getByRole('dialog', { name: 'Reading settings' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Reading settings' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('article', { name: 'Shared guide' })).toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(useReadingStore.getState().open).toBe(false)
  })

  it('renders the extra bar buttons and the prelude, and passes the link policy down', () => {
    render(
      <ReadingSurface
        content={DOC}
        title="Shared guide"
        links="shared"
        barActions={<button aria-label="Download .md">d</button>}
        prelude={<p>Read-only · shared today</p>}
      />
    )
    expect(screen.getByRole('button', { name: 'Download .md' })).toBeInTheDocument()
    expect(screen.getByText('Read-only · shared today')).toBeInTheDocument()
    expect(document.querySelector('.md-dead-link')?.textContent).toBe('another doc')
    expect(document.querySelector('.reading')?.getAttribute('data-links')).toBe('shared')
  })

  it('takes the title from the first H1 when none is given', () => {
    render(<ReadingSurface content={DOC} />)
    expect(document.querySelector('.reading-title')?.textContent).toBe('Shared guide')
  })

  it('with an exit it is the modal reading mode: button and Escape both call it', async () => {
    const onClose = vi.fn()
    render(<ReadingSurface content={DOC} title="Guide" onClose={onClose} ariaLabelPrefix="Reading mode: " />)
    expect(screen.getByRole('dialog', { name: 'Reading mode: Guide' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Exit reading mode' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('readingStore.loadSettings', () => {
  it('loads the saved text settings without opening reading mode or touching the address', () => {
    localStorage.setItem(READING_KEY, JSON.stringify({ fontSize: 22, lineHeight: 1.9, width: 'wide', theme: 'sepia' }))
    act(() => useReadingStore.getState().loadSettings())
    const state = useReadingStore.getState()
    expect(state.fontSize).toBe(22)
    expect(state.theme).toBe('sepia')
    expect(state.width).toBe('wide')
    expect(state.open).toBe(false)
    expect(window.location.search).toBe('')
  })
})
