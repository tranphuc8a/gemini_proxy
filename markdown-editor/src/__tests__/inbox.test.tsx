import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useEditorStore } from '../store'
import { INBOX_KEY } from '../lib/inbox'
import { flatten } from '../lib/tree'
import { restoreAdminSession } from '../services/markdownStorage'

vi.mock('../services/markdownStorage', () => ({
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn(),
  listBackends: vi.fn(async () => [])
}))

const DOC = { name: 'Gemini – hội thoại.md', content: '# Hội thoại\n\nXin chào 👋', from: 'Gemini Chat' }

describe('opening a document another app handed over (?import=1)', () => {
  const original = window.location.href

  beforeEach(() => {
    // jsdom has no matchMedia; App follows the system theme with it.
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never
    localStorage.clear()
    useEditorStore.setState({ isAdmin: false, toasts: [], currentContent: '', currentFileId: null })
    localStorage.setItem(INBOX_KEY, JSON.stringify({ ...DOC, at: Date.now() }))
    window.history.replaceState(null, '', '/webapp/tranphuc8a/markdown-editor-pro/?import=1')
  })

  afterEach(() => {
    window.history.replaceState(null, '', original)
    vi.mocked(restoreAdminSession).mockImplementation(async () => false)
  })

  it('shows it to a visitor without keeping it, once', async () => {
    render(<App />)
    await waitFor(() => expect(useEditorStore.getState().currentContent).toBe(DOC.content))
    expect(useEditorStore.getState().currentFileId).toBeNull()
    expect(useEditorStore.getState().toasts.map((t) => t.message).join()).toContain('from Gemini Chat')
    expect(localStorage.getItem(INBOX_KEY)).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('files it for an administrator once the session is confirmed', async () => {
    vi.mocked(restoreAdminSession).mockImplementation(async () => true)
    render(<App />)
    await waitFor(() =>
      expect(flatten(useEditorStore.getState().files).some((node) => node.name === DOC.name)).toBe(true)
    )
    expect(useEditorStore.getState().currentContent).toBe(DOC.content)
    expect(useEditorStore.getState().isAdmin).toBe(true)
  })

  it('does nothing without the flag', async () => {
    window.history.replaceState(null, '', '/webapp/tranphuc8a/markdown-editor-pro/')
    render(<App />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(localStorage.getItem(INBOX_KEY)).not.toBeNull()
    expect(useEditorStore.getState().currentContent).not.toBe(DOC.content)
  })
})
