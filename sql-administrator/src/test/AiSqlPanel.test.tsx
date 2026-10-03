import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SqlConsole } from '../components/SqlConsole'
import { __testing, type AiStatus, getStatus } from '../lib/ai'
import type { AiSqlAnswer } from '../lib/aiSql'
import { useStore } from '../store'
import type { SessionInfo } from '../types'

const session: SessionInfo = {
  token: 'tok-123',
  host: 'localhost',
  port: 3306,
  username: 'root',
  database: null,
  label: 'root@localhost',
  server_version: '8.0.36',
  server_flavor: 'MySQL',
  connected_at: '2026-10-03T00:00:00+00:00',
  last_used_at: '2026-10-03T00:00:00+00:00',
}

const allowed: AiStatus = {
  enabled: true,
  access: 'public',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 6, perDay: 200 },
}

const update = "UPDATE `orders` SET `status` = 'paid' WHERE `id` = 5"
const writeAnswer: AiSqlAnswer = {
  sql: update,
  explanation: 'Đánh dấu đơn số 5 là đã thanh toán.',
  statements: [{ sql: update, readOnly: false, checked: true, error: null }],
  readOnly: false,
  repaired: false,
  tables: 4,
  truncated: false,
  cached: false,
}

const select = 'SELECT * FROM `orders` ORDER BY `created_at` DESC LIMIT 100'
const readAnswer: AiSqlAnswer = {
  sql: select,
  explanation: 'Lấy 100 đơn hàng mới nhất.',
  statements: [{ sql: select, readOnly: true, checked: true, error: null }],
  readOnly: true,
  repaired: true,
  tables: 4,
  truncated: true,
  cached: false,
}

const fetchMock = vi.fn()
const runSql = vi.fn<(sql?: string) => Promise<void>>(async () => {})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Route the AI gateway: a status, and a fresh /ai/sql response per call. */
function serve(status: AiStatus, sql: () => Response = () => json(readAnswer)) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/ai/status') return json(status)
    if (url === '/ai/sql') return sql()
    throw new Error(`unexpected request to ${url}`)
  })
}

function sqlCalls() {
  return fetchMock.mock.calls.filter(([url]) => url === '/ai/sql') as [string, RequestInit][]
}

/** Render the console and let the AI status arrive. */
async function renderConsole() {
  render(<SqlConsole />)
  await act(async () => {
    await getStatus().catch(() => undefined)
  })
}

async function ask(question: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }))
  await userEvent.type(screen.getByRole('textbox', { name: /Hỏi AI viết SQL/ }), question)
  await userEvent.click(screen.getByRole('button', { name: 'Viết SQL' }))
}

beforeEach(() => {
  __testing.reset()
  fetchMock.mockReset()
  runSql.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
  useStore.setState({
    session,
    currentDatabase: 'shop',
    sql: '',
    results: [],
    running: false,
    history: [],
    aiAnswer: null,
    toasts: [],
    runSql,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Hỏi AI in the SQL console', () => {
  it('shows no AI button when the server keeps AI for administrators', async () => {
    serve({ ...allowed, access: 'admin', allowed: false, needs: 'admin' })
    await renderConsole()

    expect(fetchMock).toHaveBeenCalledWith('/ai/status', expect.anything())
    expect(screen.queryByRole('button', { name: 'Hỏi AI' })).not.toBeInTheDocument()
  })

  it('asks before running an answer that writes, and runs nothing when declined', async () => {
    serve(allowed, () => json(writeAnswer))
    await renderConsole()

    await ask('đánh dấu đơn 5 đã trả')
    expect(await screen.findByText('Ghi / đổi cấu trúc')).toBeInTheDocument()
    expect(screen.getByText('Đánh dấu đơn số 5 là đã thanh toán.')).toBeInTheDocument()

    // The question went out for the current database, over this app's SQL session.
    const [, init] = sqlCalls()[0]
    expect(JSON.parse(String(init.body))).toEqual({ database: 'shop', question: 'đánh dấu đơn 5 đã trả' })
    expect((init.headers as Record<string, string>)['X-Session-Token']).toBe('tok-123')

    await userEvent.click(screen.getByRole('button', { name: 'Chạy' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('root@localhost:3306 / shop')
    expect(dialog).toHaveTextContent(update)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(runSql).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Chạy' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Chạy' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Chạy' }))
    expect(runSql).toHaveBeenCalledWith(update)
  })

  it('runs a read-only answer MySQL accepted straight away', async () => {
    serve(allowed, () => json(readAnswer))
    await renderConsole()

    await userEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Hỏi AI viết SQL/ }), '100 đơn mới nhất')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(await screen.findByText('Chỉ đọc')).toBeInTheDocument()
    expect(screen.getByText('AI đã đọc cấu trúc 4 bảng — không đọc dữ liệu (danh sách bị cắt)')).toBeInTheDocument()
    expect(screen.getByText('Đã tự sửa sau khi MySQL báo lỗi')).toBeInTheDocument()
    expect(screen.getByText(/MySQL đã kiểm \(EXPLAIN\)/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Chạy' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(runSql).toHaveBeenCalledWith(select)
  })

  it('puts the answer in the editor and focuses it', async () => {
    serve(allowed)
    await renderConsole()

    await ask('100 đơn mới nhất')
    await userEvent.click(await screen.findByRole('button', { name: 'Đưa vào editor' }))

    const editor = screen.getByRole('textbox', { name: 'SQL editor' })
    expect(editor).toHaveValue(select)
    expect(editor).toHaveFocus()
    expect(useStore.getState().sql).toBe(select)
  })

  it('sends the editor SQL when asked to revise it', async () => {
    serve(allowed)
    useStore.setState({ sql: 'SELECT * FROM `orders`' })
    await renderConsole()

    await userEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Hỏi AI viết SQL/ }), 'chỉ đơn đã trả')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sửa từ câu SQL đang có trong editor' }))
    await userEvent.click(screen.getByRole('button', { name: 'Viết SQL' }))
    await screen.findByText('Chỉ đọc')

    const [, init] = sqlCalls()[0]
    expect(JSON.parse(String(init.body)).current).toBe('SELECT * FROM `orders`')
  })

  it('needs a database before it can ask', async () => {
    serve(allowed)
    useStore.setState({ currentDatabase: null })
    await renderConsole()

    await userEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Hỏi AI viết SQL/ }), 'đơn mới nhất')

    expect(screen.getByText('Chọn một CSDL ở thanh bên trước')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Viết SQL' })).toBeDisabled()
  })

  it("shows the server's message when the AI refuses, and retries on request", async () => {
    let refuse = true
    serve(allowed, () =>
      refuse
        ? json(
            {
              status_code: 429,
              message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
              data: { code: 'ai_rate_limited', retryAfter: 12 },
            },
            429,
          )
        : json(readAnswer),
    )
    await renderConsole()

    await ask('100 đơn mới nhất')
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn hỏi AI nhanh quá — thử lại sau 12 giây')

    refuse = false
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chỉ đọc')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks for the code when the server wants it mid-way, then sends the question again by itself', async () => {
    // The page was told AI is open, but the saved token has since stopped working.
    let token = false
    let statusNow: AiStatus = { ...allowed, access: 'code' }
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/ai/status') return json(statusNow)
      if (url === '/ai/session') {
        token = true
        statusNow = { ...allowed, access: 'code' }
        return json({ ok: true, session: 'ai-tok', expiresAt: 0 })
      }
      if (url === '/ai/sql') {
        if (token) return json(readAnswer)
        statusNow = { ...allowed, access: 'code', allowed: false, needs: 'code' }
        return json(
          {
            status_code: 403,
            message: 'Cần mã truy cập AI — nhập mã để dùng tính năng này',
            data: { code: 'ai_code_required' },
          },
          403,
        )
      }
      throw new Error(`unexpected request to ${url}`)
    })
    await renderConsole()

    await ask('100 đơn mới nhất')
    const codeField = await screen.findByLabelText('Mã truy cập AI')
    expect(codeField).toHaveFocus()

    await userEvent.type(codeField, 'mo-khoa')
    await userEvent.click(screen.getByRole('button', { name: 'Mở khoá' }))

    expect(await screen.findByText('Chỉ đọc')).toBeInTheDocument()
    expect(sqlCalls()).toHaveLength(2)
    expect((sqlCalls()[1][1].headers as Record<string, string>)['X-AI-Session']).toBe('ai-tok')
  })

  it('asks for the access code first, then lets the question through with the new token', async () => {
    let unlocked = false
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === '/ai/status') {
        return json(unlocked ? { ...allowed, access: 'code' } : { ...allowed, access: 'code', allowed: false, needs: 'code' })
      }
      if (url === '/ai/session') {
        expect(JSON.parse(String(init.body))).toEqual({ code: 'mo-khoa' })
        unlocked = true
        return json({ ok: true, session: 'ai-tok', expiresAt: Math.floor(Date.now() / 1000) + 3600 })
      }
      if (url === '/ai/sql') return json(readAnswer)
      throw new Error(`unexpected request to ${url}`)
    })
    await renderConsole()

    await userEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }))
    expect(screen.queryByRole('textbox', { name: /Hỏi AI viết SQL/ })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Mã truy cập AI'), 'mo-khoa')
    await userEvent.click(screen.getByRole('button', { name: 'Mở khoá' }))

    // Unlocked: the question form replaces the code field and takes the focus.
    const question = await screen.findByRole('textbox', { name: /Hỏi AI viết SQL/ })
    expect(question).toHaveFocus()
    expect(screen.queryByLabelText('Mã truy cập AI')).not.toBeInTheDocument()

    await userEvent.type(question, '100 đơn mới nhất')
    await userEvent.click(screen.getByRole('button', { name: 'Viết SQL' }))
    expect(await screen.findByText('Chỉ đọc')).toBeInTheDocument()
    const [, init] = sqlCalls()[0]
    expect((init.headers as Record<string, string>)['X-AI-Session']).toBe('ai-tok')
  })
})
