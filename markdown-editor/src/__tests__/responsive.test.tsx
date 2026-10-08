import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import Header from '../components/Header'
import FormatToolbar from '../components/FormatToolbar'
import { useEditorStore } from '../store'
import { useReadingStore } from '../readingStore'
import { DEFAULT_READING_SETTINGS } from '../lib/reading'

vi.mock('../services/markdownStorage', () => ({
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn(),
  listBackends: vi.fn(async () => [])
}))

const store = () => useEditorStore.getState()
const originalMatchMedia = window.matchMedia

/** Every width query matches: a phone. Nothing matches: a desktop. */
function emulate(kind: 'phone' | 'desktop') {
  window.matchMedia = ((query: string) => ({
    matches: kind === 'phone' && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  useReadingStore.setState({ ...DEFAULT_READING_SETTINGS, open: false })
  useEditorStore.setState({
    files: [
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        children: [
          { id: 'a', name: 'alpha.md', type: 'file', parentId: 'root', content: '# Alpha' },
          { id: 'b', name: 'beta.md', type: 'file', parentId: 'root', content: '# Beta' }
        ]
      }
    ],
    currentFileId: 'a',
    currentContent: '# Alpha',
    history: ['# Alpha'],
    historyIndex: 0,
    expandedFolders: ['root'],
    isAdmin: false,
    viewMode: 'split',
    sidebarCollapsed: false,
    fullscreen: false,
    fontSize: 14,
    toasts: [],
    layout: 'desktop',
    drawerOpen: false,
    phonePane: null
  })
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('sidebar state by layout', () => {
  it('toggles the drawer below desktop and leaves the docked preference alone', () => {
    act(() => store().setLayout('phone'))
    act(() => store().toggleSidebar())
    expect(store().drawerOpen).toBe(true)
    expect(store().sidebarCollapsed).toBe(false)
    act(() => store().toggleSidebar())
    expect(store().drawerOpen).toBe(false)
  })

  it('collapses the docked sidebar on desktop and never opens a drawer there', () => {
    act(() => store().toggleSidebar())
    expect(store().sidebarCollapsed).toBe(true)
    act(() => store().setDrawerOpen(true))
    expect(store().drawerOpen).toBe(false)
  })

  it('closes the drawer when a file is picked and when the layout changes', () => {
    act(() => {
      store().setLayout('tablet')
      store().setDrawerOpen(true)
      store().setCurrentFile('b')
    })
    expect(store().drawerOpen).toBe(false)
    expect(store().currentContent).toBe('# Beta')

    act(() => store().setDrawerOpen(true))
    act(() => store().setLayout('desktop'))
    expect(store().drawerOpen).toBe(false)
  })

  it('opens the drawer on the outline shortcut below desktop', () => {
    useEditorStore.setState({ sidebarCollapsed: true })
    act(() => store().setLayout('phone'))
    act(() => store().setSidebarTab('outline'))
    expect(store().drawerOpen).toBe(true)
    expect(store().sidebarTab).toBe('outline')
    expect(store().sidebarCollapsed).toBe(true)
  })

  it('never persists the responsive state', () => {
    act(() => {
      store().setLayout('phone')
      store().setDrawerOpen(true)
      store().setPhonePane('editor')
      store().flushPersist()
    })
    const saved = localStorage.getItem('markdown-editor:settings')!
    expect(saved).not.toMatch(/drawerOpen|phonePane|layout/)
  })
})

describe('on a phone', () => {
  beforeEach(() => emulate('phone'))

  it('starts with the sidebar as a closed drawer', () => {
    render(<App />)
    expect(document.querySelector('.app')).toHaveAttribute('data-layout', 'phone')
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the drawer, traps focus in it, and hands focus back on Esc', async () => {
    render(<App />)
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' })
    await userEvent.click(toggle)
    const drawer = screen.getByRole('dialog', { name: 'Files and outline' })
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(drawer.contains(document.activeElement)).toBe(true)

    await userEvent.tab({ shift: true })
    expect(drawer.contains(document.activeElement)).toBe(true)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Files and outline' })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(toggle)
  })

  it('closes the drawer once a file is chosen', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Files and outline' })).getByText('beta.md'))
    expect(screen.queryByRole('dialog', { name: 'Files and outline' })).not.toBeInTheDocument()
    expect(store().currentFileId).toBe('b')
  })

  it('closes the drawer from its own close button and from the backdrop', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close sidebar' }))
    expect(store().drawerOpen).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    await userEvent.click(document.querySelector('.drawer-backdrop')!)
    expect(store().drawerOpen).toBe(false)
  })

  it('shows one pane at a time in the split view, preview first for visitors', async () => {
    render(<App />)
    const panes = document.querySelector('.panes')!
    expect(panes).toHaveClass('is-single')
    expect(panes).toHaveAttribute('data-active-pane', 'preview')
    const group = screen.getByRole('group', { name: 'Visible pane' })
    expect(within(group).getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(group).getByRole('button', { name: 'Editor' }))
    expect(panes).toHaveAttribute('data-active-pane', 'editor')
    expect(within(group).getByRole('button', { name: 'Editor' })).toHaveAttribute('aria-pressed', 'true')
    // Both stay mounted, so each keeps its scroll position.
    expect(screen.getByLabelText('Markdown source')).toBeInTheDocument()
    expect(screen.getByLabelText('Rendered preview')).toBeInTheDocument()
  })

  it('opens administrators on the editor', () => {
    useEditorStore.setState({ isAdmin: true })
    render(<App />)
    expect(document.querySelector('.panes')).toHaveAttribute('data-active-pane', 'editor')
  })

  it('has no pane switch outside the split view', () => {
    // App restores the stored view mode on start-up.
    localStorage.setItem('markdown-editor:settings', JSON.stringify({ viewMode: 'preview' }))
    render(<App />)
    expect(screen.queryByRole('group', { name: 'Visible pane' })).not.toBeInTheDocument()
  })

  it('moves secondary header controls into the overflow menu, font size included', async () => {
    render(<Header tier="compact" onOpenHelp={vi.fn()} onOpenPalette={vi.fn()} onOpenAuth={vi.fn()} />)
    act(() => store().setLayout('phone'))
    expect(screen.queryByRole('button', { name: /^File/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading mode' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('radiogroup', { name: 'View mode' })).toBeInTheDocument()
    expect(within(menu).getByText('Export Markdown')).toBeInTheDocument()

    // Touch screens render the editor at 16px at least, so the stepper starts there.
    expect(within(menu).getByText('16px')).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Smaller editor text' })).toBeDisabled()
    await userEvent.click(within(menu).getByRole('button', { name: 'Larger editor text' }))
    expect(store().fontSize).toBe(17)
    // A setting, not a command: the menu stays open.
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})

describe('on a desktop', () => {
  beforeEach(() => emulate('desktop'))

  it('keeps the docked sidebar, the side-by-side split and the full header', () => {
    render(<App />)
    expect(document.querySelector('.app')).toHaveAttribute('data-layout', 'desktop')
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Visible pane' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^File/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('heading popover', () => {
  it('is positioned against the viewport so the scrolling toolbar cannot clip it', async () => {
    render(<FormatToolbar disabled={false} onAction={vi.fn()} />)
    const trigger = screen.getByLabelText('Heading level')
    trigger.getBoundingClientRect = () => ({ left: 1000, right: 1028, top: 10, bottom: 38, width: 28, height: 28, x: 1000, y: 10, toJSON: () => ({}) })
    await userEvent.click(trigger)
    const menu = screen.getByRole('menu')
    // Kept on screen: 1024px wide jsdom window, 180px popover, 8px margin.
    expect(menu.style.left).toBe('836px')
    expect(menu.style.top).toBe('42px')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })
})
