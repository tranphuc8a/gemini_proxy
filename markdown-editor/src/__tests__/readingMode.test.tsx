import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import ReadingView from '../components/ReadingView'
import { useEditorStore } from '../store'
import { useReadingStore } from '../readingStore'
import { DEFAULT_READING_SETTINGS, READING_FONT, READING_KEY } from '../lib/reading'

vi.mock('../services/markdownStorage', () => ({
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn(),
  listBackends: vi.fn(async () => [])
}))

const DOC = '# Guide\n\nIntro.\n\n## First part\n\nText.\n\n- [ ] open task\n\n## Second part\n\nMore text.\n'

const reading = () => useReadingStore.getState()
const originalMatchMedia = window.matchMedia

beforeEach(() => {
  // A desktop browser in light mode; App follows the system theme with it.
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
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  useReadingStore.setState({ ...DEFAULT_READING_SETTINGS, open: false })
  useEditorStore.setState({
    files: [
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        children: [{ id: 'g', name: 'guide.md', type: 'file', parentId: 'root', content: DOC }]
      }
    ],
    currentFileId: 'g',
    currentContent: DOC,
    history: [DOC],
    historyIndex: 0,
    isAdmin: false,
    theme: 'light',
    viewMode: 'split',
    fullscreen: false,
    toasts: [],
    layout: 'desktop',
    drawerOpen: false,
    phonePane: null
  })
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  window.matchMedia = originalMatchMedia
})

describe('reading store', () => {
  it('opens and closes, keeping ?read=1 in the address bar in step', () => {
    act(() => reading().openReading())
    expect(reading().open).toBe(true)
    expect(window.location.search).toBe('?read=1')
    act(() => reading().closeReading())
    expect(reading().open).toBe(false)
    expect(window.location.search).toBe('')
  })

  it('starts in the app theme until the reader picks one', () => {
    useEditorStore.setState({ theme: 'dark' })
    act(() => reading().openReading())
    expect(reading().theme).toBe('dark')
  })

  it('restores stored settings on open', () => {
    localStorage.setItem(READING_KEY, JSON.stringify({ fontSize: 23, lineHeight: 2, width: 'wide', theme: 'sepia' }))
    act(() => reading().openReading())
    expect(reading()).toMatchObject({ fontSize: 23, lineHeight: 2, width: 'wide', theme: 'sepia' })
  })

  it('steps the text size within its range and saves every change', () => {
    act(() => {
      for (let step = 0; step < 40; step += 1) reading().stepFontSize(1)
    })
    expect(reading().fontSize).toBe(READING_FONT.max)
    act(() => reading().setReadingTheme('sepia'))
    expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toMatchObject({ fontSize: READING_FONT.max, theme: 'sepia' })
    act(() => reading().resetReadingSettings())
    expect(reading()).toMatchObject({ fontSize: DEFAULT_READING_SETTINGS.fontSize, theme: 'light' })
  })
})

describe('entering and leaving reading mode', () => {
  it('opens straight into reading mode with ?read=1, for an anonymous visitor', async () => {
    window.history.replaceState(null, '', '/?read=1')
    render(<App />)
    const dialog = await screen.findByRole('dialog', { name: /Reading mode: guide/ })
    expect(within(dialog).getByRole('article', { name: 'guide' })).toBeInTheDocument()
    // The editor underneath is hidden from assistive technology.
    expect(document.querySelector('.app')).toHaveAttribute('aria-hidden', 'true')
    expect(useEditorStore.getState().isAdmin).toBe(false)
  })

  it('opens from the header button and closes with Esc, restoring the view and the URL', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Reading mode' }))
    expect(screen.getByRole('dialog', { name: /Reading mode/ })).toBeInTheDocument()
    expect(window.location.search).toBe('?read=1')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /Reading mode/ })).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(useEditorStore.getState().viewMode).toBe('split')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reading mode' }))
  })

  it('toggles with Ctrl+Alt+V', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'v', code: 'KeyV', ctrlKey: true, altKey: true })
    expect(reading().open).toBe(true)
    fireEvent.keyDown(window, { key: 'v', code: 'KeyV', ctrlKey: true, altKey: true })
    expect(reading().open).toBe(false)
  })

  it('is offered by the command palette', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true, shiftKey: true })
    await userEvent.type(screen.getByRole('textbox', { name: 'Search commands' }), 'reading mode{Enter}')
    expect(reading().open).toBe(true)
  })

  it('keeps editor shortcuts from firing behind it', () => {
    act(() => reading().openReading())
    render(<App />)
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true })
    expect(useEditorStore.getState().viewMode).toBe('split')
  })
})

describe('ReadingView', () => {
  beforeEach(() => {
    act(() => reading().openReading())
  })

  it('shows the title, the reading time and a progress bar', () => {
    render(<ReadingView />)
    expect(screen.getByText('guide')).toBeInTheDocument()
    expect(screen.getByText(/1 min read/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Reading progress' })).toHaveAttribute('aria-valuemin', '0')
  })

  it('gives its headings ids of their own, apart from the preview underneath', () => {
    render(<ReadingView />)
    expect(document.getElementById('reading-first-part')).toHaveTextContent('First part')
    expect(document.getElementById('first-part')).toBeNull()
  })

  it('lists the headings in a contents drawer and closes it after a jump', async () => {
    render(<ReadingView />)
    const toggle = screen.getByRole('button', { name: 'Table of contents' })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const toc = screen.getByRole('dialog', { name: 'Table of contents' })
    const entries = within(toc).getAllByRole('button').filter((button) => button.classList.contains('reading-toc-item'))
    expect(entries.map((entry) => entry.textContent)).toEqual(['Guide', 'First part', 'Second part'])

    await userEvent.click(within(toc).getByText('Second part'))
    expect(screen.queryByRole('dialog', { name: 'Table of contents' })).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('changes size, spacing, width and theme from the settings popover', async () => {
    render(<ReadingView />)
    await userEvent.click(screen.getByRole('button', { name: 'Reading settings' }))
    const settings = screen.getByRole('dialog', { name: 'Reading settings' })

    await userEvent.click(within(settings).getByRole('button', { name: 'Increase text size' }))
    expect(reading().fontSize).toBe(DEFAULT_READING_SETTINGS.fontSize + 1)

    await userEvent.click(within(settings).getByRole('button', { name: 'Loose' }))
    await userEvent.click(within(settings).getByRole('button', { name: 'Narrow' }))
    await userEvent.click(within(settings).getByRole('button', { name: 'Sepia' }))
    expect(within(settings).getByRole('button', { name: 'Sepia' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(settings).getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('.reading')).toHaveAttribute('data-reading-theme', 'sepia')
    expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toMatchObject({ lineHeight: 2, width: 'narrow', theme: 'sepia' })
  })

  it('closes the settings first, then the mode, on successive Esc presses', async () => {
    render(<ReadingView />)
    await userEvent.click(screen.getByRole('button', { name: 'Reading settings' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Reading settings' })).not.toBeInTheDocument()
    expect(reading().open).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(reading().open).toBe(false)
  })

  it('is read-only: a task box cannot be ticked from here, even by an admin', () => {
    useEditorStore.setState({ isAdmin: true })
    render(<ReadingView />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(useEditorStore.getState().currentContent).toBe(DOC)
  })
})
