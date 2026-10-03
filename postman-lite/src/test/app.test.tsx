import { act, cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { RequestPanel } from '../components/RequestPanel'
import { ResponsePanel } from '../components/ResponsePanel'
import { Toasts } from '../components/Toasts'
import { type AiStatus, aiSessionKey, resetAiForTests } from '../lib/ai'
import { resetApiBaseForTests } from '../lib/api'
import { encodeSharedRequest, toSharedRequest } from '../lib/share'
import { kv } from '../lib/util'
import { blankRequest, selectActiveTab, useStore } from '../store'
import type { ResponseData, Tab } from '../types'

// Whole panels in jsdom are slow on a busy machine: role queries walk the
// accessibility tree. None of these tests is about timing, so give them room.
const UI = { timeout: 30_000 }
configure({ asyncUtilTimeout: 5_000 })

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const AI_OFF: AiStatus = {
  enabled: false,
  access: 'admin',
  allowed: false,
  needs: 'admin',
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 5, perDay: 100 },
}
const AI_PUBLIC: AiStatus = { ...AI_OFF, enabled: true, access: 'public', allowed: true, needs: null }

type Handler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>

/** A fake backend: the routes a test cares about, and quiet defaults for the rest. */
function mockServer(routes: Record<string, Handler> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    for (const [fragment, handler] of Object.entries(routes)) {
      if (url.includes(fragment)) return handler(init, url)
    }
    if (url.endsWith('/proxy/status')) return json(200, { status_code: 200, message: 'OK', data: { enabled: true } })
    if (url.endsWith('/ai/status')) return json(200, AI_OFF)
    return json(404, { status_code: 404, message: 'Not found', data: null })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const callsTo = (fetchMock: ReturnType<typeof mockServer>, fragment: string) =>
  fetchMock.mock.calls.filter(([input]) => String(input).includes(fragment))

const response = (overrides: Partial<ResponseData> = {}): ResponseData => ({
  status: 200,
  statusText: 'OK',
  headers: [['content-type', 'application/json']],
  bytes: new TextEncoder().encode('{"id":7,"name":"Phở"}'),
  contentType: 'application/json',
  sizeBytes: 21,
  timeMs: 42,
  via: 'proxy',
  finalUrl: 'https://a.dev/items/7',
  redirected: false,
  truncated: false,
  headersComplete: true,
  receivedAt: '2026-10-03T10:00:00.000Z',
  ...overrides,
})

/** One tab with a response, as if the request had just been sent. */
function seedTab(overrides: Partial<Tab['draft']> = {}): Tab {
  const tab: Tab = {
    id: 'tab_1',
    requestId: null,
    draft: blankRequest({
      method: 'GET',
      url: 'https://a.dev/items/7',
      auth: { type: 'bearer', token: 'BEARER-SECRET' },
      ...overrides,
    }),
    response: response(),
    sending: false,
    dirty: true,
  }
  useStore.setState({ tabs: [tab], activeTabId: tab.id })
  return tab
}

/** The request editor's Tests tab (the response panel has a "Tests" tab of its own, after it). */
const openTestsEditor = () => fireEvent.click(screen.getAllByRole('button', { name: 'Tests' })[0])

/** The panels as App renders them: always handed the current tab from the store. */
function Panels() {
  const tab = useStore(selectActiveTab)
  if (!tab) return null
  return (
    <>
      <RequestPanel tab={tab} onSaveAs={() => {}} onShare={() => {}} onSelectFiles={() => {}} files={[]} />
      <ResponsePanel tab={tab} />
      <Toasts />
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  resetApiBaseForTests()
  resetAiForTests()
  useStore.setState({
    tabs: [],
    activeTabId: '',
    collections: [],
    requests: [],
    environments: [],
    activeEnvironmentId: null,
    toasts: [],
    aiStatus: null,
    aiExplain: {},
    aiTests: {},
  })
  history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
describe('opening share links at startup', UI, () => {
  it('reads ?share=…&backend=…, asks that store, and imports only when asked', async () => {
    history.replaceState(null, '', '/app/?share=tok_9&backend=mysql')
    const fetchMock = mockServer({
      '/postman/shared/': () =>
        json(200, {
          status_code: 200,
          message: 'OK',
          data: {
            id: 'ws_1',
            name: 'Demo API',
            revision: 3,
            updated_at: '',
            collections: [{ id: 'c1', name: 'Users', parentId: null }],
            requests: [
              { ...blankRequest({ name: 'List', url: 'https://a.dev/users' }), collectionId: 'c1' },
              { ...blankRequest({ name: 'Ping', url: 'https://a.dev/ping' }), collectionId: null },
            ],
          },
        }),
    })

    render(<App />)

    expect(await screen.findByText('Workspace được chia sẻ: Demo API — 1 collection, 2 request')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/postman/shared/').map(([input]) => String(input))).toEqual([
      '/postman/shared/tok_9?backend=mysql',
    ])
    // Nothing is imported just by opening the link.
    expect(useStore.getState().collections).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Nhập vào máy này' }))

    const { collections, requests } = useStore.getState()
    expect(collections.map((c) => c.name)).toEqual(['Demo API', 'Users'])
    expect(requests.map((r) => r.name)).toEqual(['List', 'Ping'])
    expect(screen.queryByText(/Workspace được chia sẻ:/)).not.toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe('/app/')
  })

  it('shows why a share link cannot be opened, and clears it on close', async () => {
    history.replaceState(null, '', '/?share=gone&backend=mongo')
    mockServer({
      '/postman/shared/': () =>
        json(404, { status_code: 404, message: 'Link chia sẻ không tồn tại hoặc đã bị thu hồi', data: null }),
    })

    render(<App />)

    const dialog = await screen.findByRole('dialog', { name: 'Link chia sẻ workspace' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Link chia sẻ không tồn tại hoặc đã bị thu hồi')
    expect(within(dialog).getByText(/kho "mongo"/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Nhập vào máy này' })).toBeDisabled()

    const closeButtons = within(dialog).getAllByRole('button', { name: 'Đóng' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('opens #req=… in a new unsaved tab and drops the fragment', () => {
    const { shared } = toSharedRequest(
      blankRequest({ name: 'Đặt bàn 🍜', method: 'PUT', url: 'https://a.dev/bàn/1', headers: [kv('X-Ghi-Chú', 'gần cửa sổ')] }),
      { stripSecrets: true },
    )
    history.replaceState(null, '', `/app/#req=${encodeSharedRequest(shared)}`)
    mockServer()

    render(<App />)

    const state = useStore.getState()
    const tab = selectActiveTab(state)!
    // It took the place of the empty tab the app starts with.
    expect(state.tabs).toHaveLength(1)
    expect(tab.requestId).toBeNull()
    expect(tab.draft).toMatchObject({ name: 'Đặt bàn 🍜', method: 'PUT', url: 'https://a.dev/bàn/1' })
    expect(tab.draft.headers.map((h) => [h.key, h.value])).toEqual([['X-Ghi-Chú', 'gần cửa sổ']])
    expect(screen.getByRole('textbox', { name: 'URL' })).toHaveValue('https://a.dev/bàn/1')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/app/')
  })

  it('refuses a malformed #req= with a message and opens nothing', async () => {
    history.replaceState(null, '', '/#req=%%%')
    mockServer()

    render(<App />)

    expect(await screen.findByText(/Link request không hợp lệ/)).toBeInTheDocument()
    expect(useStore.getState().tabs).toHaveLength(1)
    expect(selectActiveTab(useStore.getState())!.draft.url).toBe('')
    expect(window.location.hash).toBe('')
  })

  it('also opens a link pasted into the address bar of an open app', () => {
    mockServer()
    render(<App />)
    const { shared } = toSharedRequest(blankRequest({ name: 'Sau', url: 'https://a.dev/later' }), { stripSecrets: true })

    act(() => {
      history.replaceState(null, '', `/#req=${encodeSharedRequest(shared)}`)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(selectActiveTab(useStore.getState())!.draft.name).toBe('Sau')
    expect(window.location.hash).toBe('')
  })
})

// ---------------------------------------------------------------------------
describe('pasting into the URL bar', UI, () => {
  it('turns a curl command into the request instead of inserting it', () => {
    mockServer()
    render(<App />)
    const url = screen.getByRole('textbox', { name: 'URL' })
    act(() => useStore.getState().patchDraft(useStore.getState().activeTabId, { tests: 'pm.test("giữ", () => {})' }))

    const notPrevented = fireEvent.paste(url, {
      clipboardData: {
        getData: () => `curl -X POST 'https://a.dev/items?limit=5' -H 'X-Trace: 1' -H 'Authorization: Bearer tok' -d '{"a":1}'`,
      },
    })

    expect(notPrevented).toBe(false)
    const draft = selectActiveTab(useStore.getState())!.draft
    expect(draft).toMatchObject({
      method: 'POST',
      url: 'https://a.dev/items?limit=5',
      bodyMode: 'json',
      body: '{"a":1}',
      auth: { type: 'bearer', token: 'tok' },
      tests: 'pm.test("giữ", () => {})',
    })
    expect(draft.headers.map((h) => [h.key, h.value])).toEqual([['X-Trace', '1']])
    expect(url).toHaveValue('https://a.dev/items?limit=5')
  })

  it('leaves an ordinary paste alone', () => {
    mockServer()
    render(<App />)
    const url = screen.getByRole('textbox', { name: 'URL' })
    expect(fireEvent.paste(url, { clipboardData: { getData: () => 'https://a.dev/x' } })).toBe(true)
    expect(selectActiveTab(useStore.getState())!.draft.method).toBe('GET')
  })

  it('says so when the curl command cannot be read, and changes nothing', async () => {
    mockServer()
    render(<App />)
    const url = screen.getByRole('textbox', { name: 'URL' })
    fireEvent.paste(url, { clipboardData: { getData: () => 'curl -X POST' } })
    expect(await screen.findByText(/Không đọc được lệnh cURL/)).toBeInTheDocument()
    expect(selectActiveTab(useStore.getState())!.draft).toMatchObject({ method: 'GET', url: '' })
  })
})

// ---------------------------------------------------------------------------
describe('AI in the panels', UI, () => {
  const explanation = {
    summary: 'Server trả về sản phẩm id 7 <b>thành công</b>.',
    details: ['Body là JSON với hai trường: id, name.'],
    problems: [],
    next: ['Thử GET /items/8 để so sánh.'],
    cached: false,
  }

  it('shows nothing about AI to a guest when AI is for administrators only', () => {
    mockServer()
    seedTab()
    useStore.setState({ aiStatus: { ...AI_OFF, enabled: true } })
    render(<Panels />)

    openTestsEditor()
    expect(screen.queryByRole('button', { name: /Giải thích/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /AI/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sinh test/ })).not.toBeInTheDocument()
  })

  it('explains a response in the AI view, as plain text, with secrets masked on the way out', async () => {
    const fetchMock = mockServer({ '/ai/http': () => json(200, explanation) })
    seedTab()
    useStore.setState({ aiStatus: AI_PUBLIC })
    render(<Panels />)

    fireEvent.click(screen.getByRole('button', { name: '✨ Giải thích' }))

    // Rendered as text: the markup in the answer shows up literally.
    expect(await screen.findByText('Server trả về sản phẩm id 7 <b>thành công</b>.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chi tiết' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nên thử tiếp' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vấn đề' })).not.toBeInTheDocument() // empty, so omitted
    expect(screen.getByText('Thử GET /items/8 để so sánh.')).toBeInTheDocument()

    const [[, init]] = callsTo(fetchMock, '/ai/http')
    const sent = JSON.parse(String(init!.body))
    expect(sent.action).toBe('explain')
    expect(sent.request.headers).toContainEqual(['Authorization', '[đã ẩn]'])
    expect(sent.response).toMatchObject({ status: 200, body: '{"id":7,"name":"Phở"}' })
    expect(String(init!.body)).not.toContain('BEARER-SECRET')

    // Asking again shows the answer already here instead of paying for it twice.
    fireEvent.click(screen.getByRole('button', { name: '✨ Giải thích' }))
    expect(callsTo(fetchMock, '/ai/http')).toHaveLength(1)
  })

  it('highlights problems when there are some', async () => {
    mockServer({ '/ai/http': () => json(200, { ...explanation, problems: ['Status 200 nhưng body báo lỗi.'] }) })
    seedTab()
    useStore.setState({ aiStatus: AI_PUBLIC })
    render(<Panels />)

    fireEvent.click(screen.getByRole('button', { name: '✨ Giải thích' }))
    const heading = await screen.findByRole('heading', { name: 'Vấn đề' })
    expect(heading.closest('section')).toHaveClass('ai-problems')
  })

  it('asks for the access code in code mode, then carries on', async () => {
    const fetchMock = mockServer({
      '/ai/session': () => json(200, { ok: true, session: 'S-1', expiresAt: Math.floor(Date.now() / 1000) + 3600 }),
      '/ai/status': () => json(200, { ...AI_PUBLIC, access: 'code' }),
      '/ai/http': () => json(200, explanation),
    })
    seedTab()
    useStore.setState({ aiStatus: { ...AI_OFF, enabled: true, access: 'code', needs: 'code' } })
    render(<Panels />)

    fireEvent.click(screen.getByRole('button', { name: '✨ Giải thích' }))
    const field = screen.getByLabelText('Mã truy cập AI')
    expect(field).toHaveAttribute('type', 'password')
    expect(callsTo(fetchMock, '/ai/http')).toHaveLength(0)

    fireEvent.change(field, { target: { value: 'mã-đúng' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mở khoá' }))

    expect(await screen.findByText(explanation.summary)).toBeInTheDocument()
    expect(JSON.parse(String(callsTo(fetchMock, '/ai/session')[0][1]!.body))).toEqual({ code: 'mã-đúng' })
    expect(JSON.parse(localStorage.getItem(aiSessionKey(window.location.origin))!).token).toBe('S-1')
    const [[, init]] = callsTo(fetchMock, '/ai/http')
    expect((init!.headers as Record<string, string>)['X-AI-Session']).toBe('S-1')
  })

  it("shows the server's message and offers a retry when AI refuses", async () => {
    let calls = 0
    mockServer({
      '/ai/http': () =>
        ++calls === 1
          ? json(429, {
              status_code: 429,
              message: 'Bạn hỏi AI nhanh quá — thử lại sau 30 giây',
              data: { code: 'ai_rate_limited', retryAfter: 30 },
            })
          : json(200, explanation),
    })
    seedTab()
    useStore.setState({ aiStatus: AI_PUBLIC })
    render(<Panels />)

    fireEvent.click(screen.getByRole('button', { name: '✨ Giải thích' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn hỏi AI nhanh quá — thử lại sau 30 giây')

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText(explanation.summary)).toBeInTheDocument()
  })

  it('previews generated tests, never runs them, and appends them after a blank line', async () => {
    const script = "pm.test('Status là 200', function () {\n  pm.response.to.have.status(200);\n});"
    const fetchMock = mockServer({
      '/ai/http': () => json(200, { script, notes: 'Giả định id luôn là số.', cached: false }),
    })
    seedTab({ tests: 'pm.test("cũ", () => {})' })
    useStore.setState({ aiStatus: AI_PUBLIC })
    render(<Panels />)

    openTestsEditor()
    fireEvent.click(screen.getByRole('button', { name: '✨ Sinh test từ response' }))

    expect(await screen.findByText('Xem lại script trước khi chạy')).toBeInTheDocument()
    expect(screen.getByLabelText('Script test do AI sinh, chỉ đọc')).toHaveTextContent('Status là 200')
    expect(screen.getByText('Giả định id luôn là số.')).toBeInTheDocument()
    expect(JSON.parse(String(callsTo(fetchMock, '/ai/http')[0][1]!.body)).action).toBe('tests')

    // Shown, not applied, not run.
    let tab = selectActiveTab(useStore.getState())!
    expect(tab.draft.tests).toBe('pm.test("cũ", () => {})')
    expect(tab.testResults).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào cuối' }))

    tab = selectActiveTab(useStore.getState())!
    expect(tab.draft.tests).toBe(`pm.test("cũ", () => {})\n\n${script}`)
    expect(tab.testResults).toBeUndefined()
    expect(callsTo(fetchMock, '/proxy/request')).toHaveLength(0)
    expect(screen.queryByText('Xem lại script trước khi chạy')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Test script' })).toHaveFocus()
  })

  it('can replace the tests, or drop the suggestion', async () => {
    mockServer({ '/ai/http': () => json(200, { script: "pm.test('mới', function () {});", notes: '', cached: true }) })
    seedTab({ tests: 'pm.test("cũ", () => {})' })
    useStore.setState({ aiStatus: AI_PUBLIC })
    render(<Panels />)
    openTestsEditor()

    fireEvent.click(screen.getByRole('button', { name: '✨ Sinh test từ response' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ' }))
    expect(selectActiveTab(useStore.getState())!.draft.tests).toBe('pm.test("cũ", () => {})')

    fireEvent.click(screen.getByRole('button', { name: '✨ Sinh test từ response' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Thay thế' }))
    expect(selectActiveTab(useStore.getState())!.draft.tests).toBe("pm.test('mới', function () {});")
  })

  it('keeps the test button disabled until there is a response', () => {
    mockServer()
    const tab = seedTab()
    useStore.setState({ tabs: [{ ...tab, response: undefined }], aiStatus: AI_PUBLIC })
    render(<Panels />)
    openTestsEditor()
    expect(screen.getByRole('button', { name: '✨ Sinh test từ response' })).toBeDisabled()
  })
})
