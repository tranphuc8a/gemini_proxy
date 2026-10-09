import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import SmartFormatModal from '../components/SmartFormatModal'
import FormatToolbar from '../components/FormatToolbar'
import { registerEditorSelection } from '../lib/editorSelection'
import { __testing, aiRoot, type AiStatus } from '../services/aiClient'

vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn().mockResolvedValue({ svg: '<svg />' }) }
}))
vi.mock('../services/markdownStorage', () => ({
  listBackends: vi.fn(async () => []),
  verifyAdminKey: vi.fn(),
  restoreAdminSession: vi.fn(async () => false),
  clearAdminCredentials: vi.fn(),
  loadMarkdownFiles: vi.fn(),
  saveMarkdownFiles: vi.fn()
}))

const DOC = '# Notes\n\nraw deploy notes: pip install then run uvicorn\nafter that check the log\n\nTail paragraph.\n'
const ALLOWED: AiStatus = { enabled: true, access: 'admin', allowed: true, needs: null, admin: true, model: 'gemini-3.5-flash' }
const MODELS = {
  default: 'gemini-3.5-flash',
  source: 'api',
  admin: true,
  models: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'flash', preview: false, alias: false, adminOnly: false, default: true, allowed: true },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', tier: 'pro', preview: true, alias: false, adminOnly: true, default: false, allowed: false }
  ]
}
const RESULT = {
  markdown: '## Deploy\n\n1. `pip install`\n2. run `uvicorn`\n\nThen check the log.',
  changes: ['Thêm tiêu đề', 'Đánh số các bước'],
  words: 12,
  sourceWords: 14,
  shrunk: false,
  truncated: false,
  mode: 'smart'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** A stand-in gateway; `format` answers POST /ai/markdown. */
const gateway = ({
  status = ALLOWED,
  format = () => json(RESULT)
}: { status?: AiStatus; format?: (body: Record<string, unknown>) => Response } = {}) => {
  const spy = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/ai/status')) return json(status)
    if (url.endsWith('/ai/models')) return json(MODELS)
    if (url.endsWith('/ai/session')) return json({ ok: true, session: 'tok', expiresAt: 4_102_444_800 })
    if (url.endsWith('/ai/markdown')) return format(JSON.parse(String(init?.body)))
    throw new Error(`unexpected request to ${url}`)
  })
  vi.stubGlobal('fetch', spy)
  return {
    spy,
    formatBodies: () =>
      spy.mock.calls.filter(([input]) => String(input).endsWith('/ai/markdown')).map(([, init]) => JSON.parse(String(init?.body)))
  }
}

const SELECTION = { start: DOC.indexOf('raw'), end: DOC.indexOf('\n\nTail') }
const content = () => useEditorStore.getState().currentContent

let unregister: () => void = () => undefined

/** Opens the dialog the way the toolbar does: from the selection the editor reports. */
const openDialog = (selection: { start: number; end: number } = SELECTION) => {
  unregister = registerEditorSelection(() => selection)
  act(() => useEditorStore.getState().openSmartFormat())
}

beforeEach(() => {
  localStorage.clear()
  __testing.reset()
  useEditorStore.setState({
    files: [{ id: 'root', name: 'Docs', type: 'folder', children: [{ id: 'g', name: 'notes.md', type: 'file', parentId: 'root', content: DOC }] }],
    currentFileId: 'g',
    currentContent: DOC,
    history: [DOC],
    historyIndex: 0,
    isAdmin: true,
    theme: 'light',
    toasts: [],
    smartFormat: null
  })
})

afterEach(() => {
  unregister()
  vi.unstubAllGlobals()
})

describe('SmartFormatModal', () => {
  it('stays closed until opened, and only opens for administrators', () => {
    gateway()
    render(<SmartFormatModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    useEditorStore.setState({ isAdmin: false })
    openDialog()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens on the selection, sends exactly that text, shows the result, and replaces it', async () => {
    const api = gateway()
    render(<SmartFormatModal />)
    openDialog()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: /selection/i })).toBeChecked()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())

    await userEvent.type(within(dialog).getByPlaceholderText(/server log/i), 'a deploy note')
    await userEvent.click(within(dialog).getByRole('radio', { name: /tidy only/i }))
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))

    expect(await within(dialog).findByText('Thêm tiêu đề')).toBeInTheDocument()
    expect(api.formatBodies()).toEqual([
      { text: DOC.slice(SELECTION.start, SELECTION.end), mode: 'tidy', hint: 'a deploy note' }
    ])
    // The rendered result, and the source on its own tab.
    expect(within(dialog).getByRole('heading', { name: 'Deploy' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Markdown' }))
    expect(within(dialog).getByText(/1\. `pip install`/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /replace selection/i }))
    expect(content()).toBe('# Notes\n\n' + RESULT.markdown + '\n\nTail paragraph.\n')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useEditorStore.getState().toasts.some((toast) => /Ctrl\+Z/.test(toast.message))).toBe(true)
  })

  it('makes the edit one undo step', async () => {
    gateway()
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))
    await userEvent.click(await within(dialog).findByRole('button', { name: /replace selection/i }))

    expect(content()).not.toBe(DOC)
    act(() => useEditorStore.getState().undo())
    expect(content()).toBe(DOC)
  })

  it('formats the whole document when nothing is selected', async () => {
    const api = gateway()
    render(<SmartFormatModal />)
    openDialog({ start: 4, end: 4 })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: /selection/i })).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /whole document/i })).toBeChecked()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))
    await userEvent.click(await within(dialog).findByRole('button', { name: /replace document/i }))
    expect(api.formatBodies()[0].text).toBe(DOC)
    expect(content()).toBe(RESULT.markdown + '\n')
  })

  it('will not overwrite a document that changed while the AI was working', async () => {
    gateway()
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))
    await within(dialog).findByText('Thêm tiêu đề')

    const edited = DOC.replace('raw deploy notes', 'RAW DEPLOY NOTES')
    act(() => useEditorStore.getState().setContent(edited))
    await userEvent.click(within(dialog).getByRole('button', { name: /replace selection/i }))

    expect(content()).toBe(edited)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useEditorStore.getState().toasts.some((toast) => /changed while the AI was working/.test(toast.message))).toBe(true)
  })

  it('warns when the answer lost words, and will not apply one that was cut short', async () => {
    gateway({ format: () => json({ ...RESULT, shrunk: true, truncated: true }) })
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))

    expect(await within(dialog).findByText(/far fewer words/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/ran out of room/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /replace selection/i })).toBeDisabled()
  })

  it('shows the server\'s refusal and keeps the dialog usable', async () => {
    gateway({
      format: () => json({ message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây', data: { code: 'ai_rate_limited', retryAfter: 12 } }, 429)
    })
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/nhanh quá.*12 s/)
    expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled()
    expect(content()).toBe(DOC)
  })

  it('explains AI that is off, or for administrators only, and does not offer to run', async () => {
    gateway({ status: { ...ALLOWED, enabled: false, allowed: false } })
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/turned off or not configured/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeDisabled()
  })

  it('asks for the access code when the gateway wants one, then lets the run go ahead', async () => {
    const api = gateway({ status: { ...ALLOWED, access: 'code', allowed: false, needs: 'code', admin: false } })
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeDisabled()

    // Once the code is accepted the gateway answers as allowed.
    api.spy.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/ai/session')) return json({ ok: true, session: 'tok', expiresAt: 4_102_444_800 })
      if (url.endsWith('/ai/status')) return json({ ...ALLOWED, access: 'code', admin: false })
      if (url.endsWith('/ai/models')) return json(MODELS)
      return json(RESULT)
    })
    await userEvent.type(await within(dialog).findByLabelText(/ai access code/i), 'open-sesame')
    await userEvent.click(within(dialog).getByRole('button', { name: /unlock/i }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    expect(JSON.parse(localStorage.getItem(`ai.phien@${aiRoot()}`) ?? 'null')).toMatchObject({ token: 'tok' })
  })

  it('refuses text longer than the AI takes, and the model picker disables administrators\' models', async () => {
    const long = 'word '.repeat(5000)
    useEditorStore.setState({ currentContent: long })
    gateway({ status: { ...ALLOWED, admin: false } })
    render(<SmartFormatModal />)
    openDialog({ start: 0, end: 0 })
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/more than the 20,000/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeDisabled()

    const picker = await within(dialog).findByRole('combobox', { name: /ai model/i })
    expect(within(picker).getByRole('option', { name: /3\.1 Pro Preview.*administrators only/i })).toBeDisabled()
  })

  it('closes on Escape, and a request still in flight is cancelled', async () => {
    let signal: AbortSignal | undefined
    const spy = vi.fn<typeof fetch>((input, init) => {
      const url = String(input)
      if (url.endsWith('/ai/status')) return Promise.resolve(json(ALLOWED))
      if (url.endsWith('/ai/models')) return Promise.resolve(json(MODELS))
      signal = init?.signal ?? undefined
      return new Promise<Response>(() => undefined)
    })
    vi.stubGlobal('fetch', spy)
    render(<SmartFormatModal />)
    openDialog()
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /format with ai/i })).toBeEnabled())
    await userEvent.click(within(dialog).getByRole('button', { name: /format with ai/i }))
    await waitFor(() => expect(signal).toBeDefined())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(signal?.aborted).toBe(true)
  })
})

describe('entry points', () => {
  it('the toolbar button asks for the dialog on the editor selection', async () => {
    gateway()
    const onAction = vi.fn()
    render(<FormatToolbar disabled={false} onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: /smart format with ai/i }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'smartFormat' })
  })

  it('reads the selection from whichever editor is mounted, and falls back to the whole document', () => {
    unregister = registerEditorSelection(() => ({ start: 3, end: 9 }))
    act(() => useEditorStore.getState().openSmartFormat())
    expect(useEditorStore.getState().smartFormat).toEqual({ start: 3, end: 9 })
    act(() => useEditorStore.getState().closeSmartFormat())
    unregister()
    act(() => useEditorStore.getState().openSmartFormat())
    expect(useEditorStore.getState().smartFormat).toEqual({ start: 0, end: 0 })
  })
})
