import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AggregateConsole } from '../components/AggregateConsole'
import { DocumentBrowser } from '../components/DocumentBrowser'
import { __testing, getStatus, type AiStatus } from '../lib/ai'
import type { MongoAnswer } from '../lib/aiMongo'
import { api } from '../lib/api'
import { storage } from '../lib/storage'
import { DEFAULT_LIMIT, useStore } from '../store'
import type { DocumentPage } from '../types'

// Whole user flows — typing included — in jsdom: far slower than the unit
// tests, and slower still while the other files run alongside.
vi.setConfig({ testTimeout: 30_000 })

const ALLOWED: AiStatus = {
  enabled: true,
  access: 'public',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 6, perDay: 100 },
}

const FIND: MongoAnswer = {
  mode: 'find',
  filter: { status: 'paid' },
  projection: null,
  sort: { paidAt: -1 },
  limit: 20,
  pipeline: [],
  explanation: 'Lấy 20 đơn đã thanh toán, mới nhất trước.',
  writes: false,
  risky: [],
  fields: 12,
  sampled: 30,
  cached: false,
}

const WRITES: MongoAnswer = {
  ...FIND,
  mode: 'aggregate',
  filter: {},
  sort: null,
  limit: 50,
  pipeline: [{ $group: { _id: '$day', total: { $sum: '$total' } } }, { $out: 'daily' }],
  explanation: 'Cộng tổng theo ngày rồi ghi vào collection daily.',
  writes: true,
}

const PAGE: DocumentPage = {
  database: 'shop',
  collection: 'orders',
  documents: [],
  fields: [],
  total: 0,
  skip: 0,
  limit: 20,
  duration_ms: 1,
  truncated: false,
}

type Route = (init: RequestInit) => Response | Promise<Response>

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function failure(status: number, message: string, data: unknown = null) {
  return json({ status_code: status, message, data }, status)
}

const PRISTINE = useStore.getState()
let routes: Record<string, Route>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  window.localStorage.clear()
  __testing.resetStatus()
  storage.setToken('tok-123')
  useStore.setState({
    ...PRISTINE,
    status: 'connected',
    activeDb: 'shop',
    activeCollection: 'orders',
    tab: 'documents',
    filterText: '{}',
    projectionText: '',
    sortText: '',
    limit: DEFAULT_LIMIT,
    page: null,
    pipelineText: '[]',
    aggregateResult: null,
    aggregateError: null,
    history: [],
    toasts: [],
    busy: false,
  })
  routes = { '/ai/status': () => json(ALLOWED) }
  fetchMock = vi.fn((url: string, init: RequestInit) => {
    const route = routes[url]
    return route ? Promise.resolve(route(init)) : Promise.reject(new Error(`unexpected fetch ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Every call made to one endpoint, as [headers, body]. */
function callsTo(url: string) {
  return (fetchMock.mock.calls as [string, RequestInit][])
    .filter(([called]) => called === url)
    .map(([, init]) => ({
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    }))
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByRole('button', { name: 'Hỏi AI' })
  await user.click(toggle)
  return toggle
}

async function askQuestion(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox', { name: /Câu hỏi/ }), text)
  await user.keyboard('{Control>}{Enter}{/Control}')
}

describe('the Hỏi AI button', () => {
  it('is not there for a guest in admin-only mode', async () => {
    routes['/ai/status'] = () => json({ ...ALLOWED, access: 'admin', allowed: false, needs: 'admin' })
    render(<DocumentBrowser />)
    await act(async () => {
      await getStatus()
    })
    expect(screen.queryByRole('button', { name: 'Hỏi AI' })).toBeNull()
  })

  it('opens the panel with the question box focused, and Escape closes it back onto the button', async () => {
    const user = userEvent.setup({ delay: null })
    render(<DocumentBrowser />)
    const toggle = await openPanel(user)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: /Hỏi AI về shop\.orders/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Câu hỏi/ })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: /Hỏi AI/ })).toBeNull()
    expect(toggle).toHaveFocus()
  })
})

describe('in the document browser', () => {
  it('writes a find, shows it, and applies it by running the find', async () => {
    const user = userEvent.setup({ delay: null })
    const find = vi.spyOn(api, 'findDocuments').mockResolvedValue(PAGE)
    routes['/ai/mongo'] = () => json(FIND)
    render(<DocumentBrowser />)
    await openPanel(user)

    await askQuestion(user, 'đơn đã thanh toán, mới nhất trước')

    expect(await screen.findByText(FIND.explanation)).toBeInTheDocument()
    expect(screen.getByText(/AI đã xem 30 tài liệu mẫu \(12 trường\)/)).toBeInTheDocument()
    expect(screen.getByText('find')).toBeInTheDocument()
    const [request] = callsTo('/ai/mongo')
    expect(request.headers['X-Session-Token']).toBe('tok-123')
    expect(request.body).toEqual({ database: 'shop', collection: 'orders', question: 'đơn đã thanh toán, mới nhất trước' })

    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(find).toHaveBeenCalledOnce())
    expect(find).toHaveBeenCalledWith('shop', 'orders', {
      filter: { status: 'paid' },
      projection: undefined,
      sort: { paidAt: -1 },
      skip: 0,
      limit: 20,
    })
    const state = useStore.getState()
    expect(state.filterText).toBe(JSON.stringify(FIND.filter, null, 2))
    expect(state.sortText).toBe(JSON.stringify(FIND.sort, null, 2))
    expect(state.projectionText).toBe('')
    // The sort it set is on screen, and so is its page size.
    expect(screen.getByRole('button', { name: 'Fewer options' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Rows/ })).toHaveValue('20')
  })

  it('sends the query on screen only when asked to revise it', async () => {
    const user = userEvent.setup({ delay: null })
    routes['/ai/mongo'] = () => json(FIND)
    useStore.setState({ filterText: '{ status: "paid" }' })
    render(<DocumentBrowser />)
    await openPanel(user)

    await askQuestion(user, 'chỉ đơn trên 1 triệu')
    await screen.findByText(FIND.explanation)
    await user.click(screen.getByRole('checkbox', { name: 'Sửa từ truy vấn đang có' }))
    await user.click(screen.getByRole('button', { name: 'Viết truy vấn' }))
    await waitFor(() => expect(callsTo('/ai/mongo')).toHaveLength(2))

    const [first, second] = callsTo('/ai/mongo')
    expect(first.body).not.toHaveProperty('current')
    expect(second.body.current).toBe('{ status: "paid" }')
  })

  it('asks before running a find that runs JavaScript on the server', async () => {
    const user = userEvent.setup({ delay: null })
    const find = vi.spyOn(api, 'findDocuments').mockResolvedValue(PAGE)
    routes['/ai/mongo'] = () => json({ ...FIND, filter: { $where: 'this.total > 100' }, risky: ['$where'] })
    render(<DocumentBrowser />)
    await openPanel(user)
    await askQuestion(user, 'tổng lớn hơn 100')

    expect(await screen.findByText('Chạy JavaScript trên server: $where')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('$where')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(find).not.toHaveBeenCalled()
    expect(useStore.getState().filterText).toBe('{}')

    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vẫn chạy' }))
    await waitFor(() => expect(find).toHaveBeenCalledOnce())
  })
})

describe('in the aggregate console', () => {
  it('asks before running a pipeline that writes, and runs it once confirmed', async () => {
    const user = userEvent.setup({ delay: null })
    const aggregate = vi.spyOn(api, 'aggregate').mockResolvedValue({
      kind: 'aggregate',
      database: 'shop',
      result: null,
      documents: [],
      row_count: 0,
      duration_ms: 1,
      truncated: false,
    })
    routes['/ai/mongo'] = () => json(WRITES)
    useStore.setState({ tab: 'aggregate' })
    render(<AggregateConsole />)
    await openPanel(user)
    await user.type(screen.getByRole('textbox', { name: /Câu hỏi/ }), 'tổng theo ngày, lưu vào daily')
    await user.click(screen.getByRole('button', { name: 'Viết truy vấn' }))

    expect(await screen.findByText(/Ghi dữ liệu \(\$out\/\$merge\) → shop\.daily/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chạy' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('shop.daily')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(aggregate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Chạy' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vẫn chạy' }))

    await waitFor(() => expect(aggregate).toHaveBeenCalledWith('shop', 'orders', WRITES.pipeline))
    expect(useStore.getState().pipelineText).toBe(JSON.stringify(WRITES.pipeline, null, 2))
  })

  it('applies a find answer as a pipeline, without running it', async () => {
    const user = userEvent.setup({ delay: null })
    const aggregate = vi.spyOn(api, 'aggregate')
    routes['/ai/mongo'] = () => json(FIND)
    render(<AggregateConsole />)
    await openPanel(user)
    await askQuestion(user, 'đơn đã thanh toán')
    await screen.findByText(FIND.explanation)

    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(JSON.parse(useStore.getState().pipelineText)).toEqual([
      { $match: { status: 'paid' } },
      { $sort: { paidAt: -1 } },
      { $limit: 20 },
    ])
    expect(aggregate).not.toHaveBeenCalled()
  })
})

describe('access and failures', () => {
  it('asks for the access code, then asks the question again with the AI token', async () => {
    const user = userEvent.setup({ delay: null })
    routes['/ai/status'] = () => json({ ...ALLOWED, access: 'code', allowed: false, needs: 'code' })
    routes['/ai/mongo'] = (init) =>
      (init.headers as Record<string, string>)['X-AI-Session'] === 'ai-tok'
        ? json(FIND)
        : failure(403, 'Cần mã truy cập AI — nhập mã để dùng tính năng này', { code: 'ai_code_required' })
    routes['/ai/session'] = () => {
      routes['/ai/status'] = () => json({ ...ALLOWED, access: 'code' })
      return json({ ok: true, session: 'ai-tok', expiresAt: Math.floor(Date.now() / 1000) + 3600 })
    }
    render(<DocumentBrowser />)
    await openPanel(user)
    expect(screen.getByLabelText('Mã truy cập AI')).toBeInTheDocument()

    await askQuestion(user, 'đơn đã thanh toán')
    expect(await screen.findByText(/Cần mã truy cập AI/)).toBeInTheDocument()
    expect(screen.getByLabelText('Mã truy cập AI')).toHaveFocus()

    await user.type(screen.getByLabelText('Mã truy cập AI'), 'sesame')
    await user.click(screen.getByRole('button', { name: 'Mở khoá' }))

    expect(await screen.findByText(FIND.explanation)).toBeInTheDocument()
    expect(screen.queryByLabelText('Mã truy cập AI')).toBeNull()
    expect(callsTo('/ai/session')[0].body).toEqual({ code: 'sesame' })
    expect(callsTo('/ai/mongo').at(-1)?.headers['X-AI-Session']).toBe('ai-tok')
    expect(JSON.parse(window.localStorage.getItem(`ai.phien@${window.location.origin}`) as string)).toMatchObject({
      token: 'ai-tok',
    })
  })

  it('shows the server’s message, and a retry that asks again', async () => {
    const user = userEvent.setup({ delay: null })
    routes['/ai/mongo'] = () =>
      failure(429, 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây', { code: 'ai_rate_limited', retryAfter: 12 })
    render(<DocumentBrowser />)
    await openPanel(user)
    await askQuestion(user, 'đơn đã thanh toán')

    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn hỏi AI nhanh quá — thử lại sau 12 giây')

    routes['/ai/mongo'] = () => json(FIND)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText(FIND.explanation)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('can cancel a question that is taking long', async () => {
    const user = userEvent.setup({ delay: null })
    routes['/ai/mongo'] = (init) =>
      new Promise<Response>((_, reject) =>
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      )
    render(<DocumentBrowser />)
    await openPanel(user)
    await askQuestion(user, 'đơn đã thanh toán')

    expect(await screen.findByText(/thường mất 5–30 giây/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đang viết…' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByText(/thường mất 5–30 giây/)).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('textbox', { name: /Câu hỏi/ })).toHaveFocus()
  })

  it('sends the user back to the login screen when the Mongo session has expired', async () => {
    const user = userEvent.setup({ delay: null })
    routes['/ai/mongo'] = () => failure(401, 'Session expired or not found; please connect again')
    render(<DocumentBrowser />)
    await openPanel(user)
    await askQuestion(user, 'đơn đã thanh toán')

    await waitFor(() => expect(useStore.getState().status).toBe('idle'))
    expect(storage.getToken()).toBeNull()
    expect(useStore.getState().toasts.at(-1)?.message).toBe('Session expired or not found; please connect again')
  })
})
