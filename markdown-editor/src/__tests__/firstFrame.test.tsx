import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useEditorStore } from '../store'
import { FILES_KEY } from '../lib/persistence'

/**
 * M0 saw the built-in welcome text painted before the stored document (dot/M0.md, item 1): the workspace
 * was loaded in a layout effect, after the panes had already rendered. Each pane below records what it was
 * first rendered with; with the workspace loaded before the first render, that is the stored document.
 */
const seen = vi.hoisted(() => ({ editor: [] as string[], preview: [] as string[] }))

vi.mock('../components/EditorPane', () => ({
  default: function EditorPaneProbe() {
    seen.editor.push(useEditorStore((state) => state.currentContent))
    return null
  }
}))

vi.mock('../components/Preview', () => ({
  default: function PreviewProbe() {
    seen.preview.push(useEditorStore((state) => state.currentContent))
    return null
  }
}))

vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => []),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  recheckAdminSession: vi.fn(async () => 'valid'),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn()
}))

const STORED = '# Stored document\n\nWritten last time.\n'

beforeEach(() => {
  seen.editor.length = 0
  seen.preview.length = 0
  window.history.replaceState(null, '', '/')
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
  // A fresh store, as on page load: the welcome document is what it starts with.
  useEditorStore.setState({
    currentFileId: 'welcome',
    currentContent: '# Welcome to Markdown Editor\n\nA fast, offline-first editor.\n'
  })
  localStorage.setItem(
    FILES_KEY,
    JSON.stringify({
      version: 2,
      currentFileId: 'mine',
      expandedFolders: ['root'],
      files: [{ id: 'root', name: 'Docs', type: 'folder', children: [{ id: 'mine', name: 'mine.md', type: 'file', content: STORED }] }]
    })
  )
})

describe('first frame', () => {
  it('renders the stored document from the very first render of each pane', () => {
    render(<App />)
    expect(seen.editor.length).toBeGreaterThan(0)
    expect(seen.preview.length).toBeGreaterThan(0)
    expect(seen.editor[0]).toBe(STORED)
    expect(seen.preview[0]).toBe(STORED)
    expect([...seen.editor, ...seen.preview].some((content) => content.includes('Welcome to Markdown Editor'))).toBe(false)
  })
})
