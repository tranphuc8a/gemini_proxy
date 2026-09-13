import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import Outline from '../components/Outline'
import Toasts from '../components/Toasts'
import FileTree from '../components/FileTree'
import FormatToolbar from '../components/FormatToolbar'
import StatusBar from '../components/StatusBar'
import { onJump } from '../lib/paneSync'


beforeEach(() => {
  useEditorStore.setState({
    files: [
      {
        id: 'root',
        name: 'Docs',
        type: 'folder',
        children: [
          { id: 'a', name: 'alpha.md', type: 'file', parentId: 'root', content: '# Alpha' },
          { id: 'sub', name: 'Nested', type: 'folder', parentId: 'root', children: [] }
        ]
      }
    ],
    currentFileId: 'a',
    currentContent: '# Title\n\ntext\n\n## Section\n\n### Deep\n',
    selectedFolderId: 'root',
    expandedFolders: ['root'],
    isAdmin: false,
    toasts: [],
    saveState: 'idle',
    lastSavedAt: null
  })
})

describe('Outline', () => {
  it('lists every heading with its level', () => {
    render(<Outline />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getAllByText(/^H[123]$/).map((el) => el.textContent)).toEqual(['H1', 'H2', 'H3'])
  })

  it('emits a jump to the heading line when clicked', async () => {
    const seen: number[] = []
    const off = onJump((event) => seen.push(event.line))
    render(<Outline />)
    await userEvent.click(screen.getByText('Section'))
    off()
    expect(seen).toEqual([5])
  })

  it('explains itself when the document has no headings', () => {
    useEditorStore.setState({ currentContent: 'just prose' })
    render(<Outline />)
    expect(screen.getByText(/No headings yet/)).toBeInTheDocument()
  })

  it('indents relative to the shallowest heading', () => {
    useEditorStore.setState({ currentContent: '## One\n### Two\n' })
    render(<Outline />)
    const items = screen.getAllByRole('button')
    expect(items[0].style.paddingLeft).toBe('10px')
    expect(items[1].style.paddingLeft).toBe('22px')
  })
})

describe('FileTree', () => {
  it('renders the tree and marks the open file', () => {
    render(<FileTree query="" />)
    expect(screen.getByText('alpha.md')).toBeInTheDocument()
    expect(screen.getByText('alpha.md').closest('.tree-row')).toHaveClass('is-current')
  })

  it('hides row actions from anonymous visitors', () => {
    render(<FileTree query="" />)
    expect(screen.queryByLabelText('Rename alpha.md')).not.toBeInTheDocument()
  })

  it('shows row actions once admin is unlocked', () => {
    useEditorStore.setState({ isAdmin: true })
    render(<FileTree query="" />)
    expect(screen.getByLabelText('Rename alpha.md')).toBeInTheDocument()
  })

  it('filters by name and keeps the parent folder visible', () => {
    render(<FileTree query="alpha" />)
    expect(screen.getByText('alpha.md')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.queryByText('Nested')).not.toBeInTheDocument()
  })

  it('reports when nothing matches', () => {
    render(<FileTree query="zzz" />)
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument()
  })

  it('opens a file when its row is clicked', async () => {
    useEditorStore.setState({ currentFileId: null, currentContent: '' })
    render(<FileTree query="" />)
    await userEvent.click(screen.getByText('alpha.md'))
    expect(useEditorStore.getState().currentFileId).toBe('a')
    expect(useEditorStore.getState().currentContent).toBe('# Alpha')
  })

  it('collapses a folder when its row is clicked', async () => {
    render(<FileTree query="" />)
    await userEvent.click(screen.getByText('Docs'))
    expect(useEditorStore.getState().expandedFolders).not.toContain('root')
  })

  it('renames inline with F2 and Enter', async () => {
    useEditorStore.setState({ isAdmin: true })
    render(<FileTree query="" />)
    await userEvent.click(screen.getByLabelText('Rename alpha.md'))
    const input = screen.getByDisplayValue('alpha.md')
    await userEvent.clear(input)
    await userEvent.type(input, 'renamed.md{Enter}')
    expect(useEditorStore.getState().files[0].children![0].name).toBe('renamed.md')
  })

  it('abandons a rename on Escape', async () => {
    useEditorStore.setState({ isAdmin: true })
    render(<FileTree query="" />)
    await userEvent.click(screen.getByLabelText('Rename alpha.md'))
    const input = screen.getByDisplayValue('alpha.md')
    await userEvent.type(input, 'xyz{Escape}')
    expect(useEditorStore.getState().files[0].children![0].name).toBe('alpha.md')
  })

  it('asks before deleting and honours a cancel', async () => {
    useEditorStore.setState({ isAdmin: true })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<FileTree query="" />)
    await userEvent.click(screen.getByLabelText('Delete alpha.md'))
    expect(confirmSpy).toHaveBeenCalled()
    expect(useEditorStore.getState().files[0].children).toHaveLength(2)
    confirmSpy.mockRestore()
  })

  it('deletes when the prompt is confirmed', async () => {
    useEditorStore.setState({ isAdmin: true })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<FileTree query="" />)
    await userEvent.click(screen.getByLabelText('Delete alpha.md'))
    expect(useEditorStore.getState().files[0].children).toHaveLength(1)
    confirmSpy.mockRestore()
  })
})

describe('FormatToolbar', () => {
  it('reports the action that was pressed', async () => {
    const onAction = vi.fn()
    render(<FormatToolbar disabled={false} onAction={onAction} />)
    await userEvent.click(screen.getByLabelText('Bold'))
    expect(onAction).toHaveBeenCalledWith({ kind: 'bold' })
  })

  it('disables every control in read-only mode', () => {
    render(<FormatToolbar disabled onAction={vi.fn()} />)
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())
  })

  it('offers the six heading levels', async () => {
    const onAction = vi.fn()
    render(<FormatToolbar disabled={false} onAction={onAction} />)
    await userEvent.click(screen.getByLabelText('Heading level'))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('button')).toHaveLength(6)
    await userEvent.click(within(menu).getByText('Heading 3'))
    expect(onAction).toHaveBeenCalledWith({ kind: 'heading', level: 3 })
  })
})

describe('StatusBar', () => {
  it('shows the open file and live document statistics', () => {
    render(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText('alpha.md')).toBeInTheDocument()
    expect(screen.getByText(/7 words/)).toBeInTheDocument()
    expect(screen.getByText(/8 lines/)).toBeInTheDocument()
  })

  it('shows the read-only role by default and admin once unlocked', () => {
    const { rerender } = render(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText('View only')).toBeInTheDocument()
    useEditorStore.setState({ isAdmin: true })
    rerender(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('surfaces a failed save', () => {
    useEditorStore.setState({ saveState: 'error' })
    render(<StatusBar onOpenHelp={vi.fn()} />)
    expect(screen.getByText('Not saved')).toBeInTheDocument()
  })

  it('adjusts the editor font size', async () => {
    render(<StatusBar onOpenHelp={vi.fn()} />)
    const before = useEditorStore.getState().fontSize
    await userEvent.click(screen.getByLabelText('Increase font size'))
    expect(useEditorStore.getState().fontSize).toBe(before + 1)
  })
})

describe('Toasts', () => {
  it('renders nothing when there is nothing to say', () => {
    const { container } = render(<Toasts />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a message and dismisses it on demand', async () => {
    useEditorStore.setState({ toasts: [{ id: 't1', message: 'Saved to backend', tone: 'success' }] })
    render(<Toasts />)
    expect(screen.getByText('Saved to backend')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Dismiss'))
    expect(useEditorStore.getState().toasts).toHaveLength(0)
  })
})
