import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiError } from '../lib/ai'
import { type AiSqlAnswer, type AiSqlStatement, askSql, needsConfirmation } from '../lib/aiSql'
import { configureApi } from '../lib/api'

function statement(overrides: Partial<AiSqlStatement> = {}): AiSqlStatement {
  return { sql: 'SELECT * FROM `orders` LIMIT 100', readOnly: true, checked: true, error: null, ...overrides }
}

function answer(statements: AiSqlStatement[], overrides: Partial<AiSqlAnswer> = {}): AiSqlAnswer {
  return {
    sql: statements.map((item) => item.sql).join(';\n'),
    explanation: 'Lấy 100 đơn hàng mới nhất.',
    statements,
    readOnly: statements.every((item) => item.readOnly),
    repaired: false,
    tables: 4,
    truncated: false,
    cached: false,
    ...overrides,
  }
}

describe('needsConfirmation', () => {
  it('lets a read-only answer MySQL accepted run without asking', () => {
    expect(needsConfirmation(answer([statement()]))).toEqual({ confirm: false, writes: false, reasons: [] })
  })

  it('does not ask for a read-only statement EXPLAIN could not check', () => {
    const check = needsConfirmation(answer([statement({ sql: 'SHOW TABLES', checked: null })]))
    expect(check.confirm).toBe(false)
  })

  it('asks before a write and names the statement', () => {
    const update = "UPDATE `orders` SET `status` = 'paid' WHERE `id` = 5"
    const check = needsConfirmation(answer([statement({ sql: update, readOnly: false })]))

    expect(check.confirm).toBe(true)
    expect(check.writes).toBe(true)
    expect(check.reasons).toEqual([`Ghi / đổi cấu trúc\n${update}`])
  })

  it('asks before DDL that MySQL could not check', () => {
    const check = needsConfirmation(
      answer([statement({ sql: 'CREATE TABLE `t` (`id` INT)', readOnly: false, checked: null })]),
    )
    expect(check).toMatchObject({ confirm: true, writes: true })
  })

  it('asks when MySQL rejected a read-only statement, quoting its error', () => {
    const check = needsConfirmation(
      answer([statement({ sql: 'SELECT `x` FROM `orders`', checked: false, error: "Unknown column 'x' in 'field list'" })]),
    )

    expect(check.confirm).toBe(true)
    expect(check.writes).toBe(false)
    expect(check.reasons).toEqual(["MySQL báo lỗi: Unknown column 'x' in 'field list'\nSELECT `x` FROM `orders`"])
  })

  it('gives one entry to a statement that both writes and failed', () => {
    const check = needsConfirmation(
      answer([statement({ sql: 'DELETE FROM `nope` WHERE 1', readOnly: false, checked: false, error: "Table 'nope' doesn't exist" })]),
    )
    expect(check.reasons).toEqual(["Ghi / đổi cấu trúc · MySQL báo lỗi: Table 'nope' doesn't exist\nDELETE FROM `nope` WHERE 1"])
  })

  it('lists only the statements that need a look', () => {
    const check = needsConfirmation(
      answer([statement(), statement({ sql: 'DELETE FROM `orders` WHERE `id` = 5', readOnly: false })]),
    )
    expect(check.reasons).toHaveLength(1)
    expect(check.reasons[0]).toContain('DELETE FROM `orders`')
  })

  it('asks when the script holds statements the server never classified', () => {
    // The server classifies a dozen statements; a write after them must not slip through as "read only".
    const listed = Array.from({ length: 12 }, (_, index) => statement({ sql: `SELECT ${index + 1}` }))
    const check = needsConfirmation({
      ...answer(listed),
      sql: `${listed.map((item) => item.sql).join(';\n')};\nDELETE FROM \`orders\``,
      readOnly: true,
    })

    expect(check).toMatchObject({ confirm: true, writes: true })
    expect(check.reasons).toEqual(['Kịch bản có 13 câu lệnh nhưng máy chủ chỉ kiểm 12 câu đầu'])
  })

  it('does not count comments or quoted semicolons as statements', () => {
    const check = needsConfirmation({
      ...answer([statement({ sql: "SELECT ';' AS `a;b`" })]),
      sql: "-- one; two\nSELECT ';' AS `a;b`; /* three; */",
    })
    expect(check.confirm).toBe(false)
  })

  it('trusts the server when it marks the whole script as writing', () => {
    const check = needsConfirmation(answer([statement()], { readOnly: false }))
    expect(check).toMatchObject({ confirm: true, writes: true })
    expect(check.reasons).toHaveLength(1)
  })
})

describe('askSql', () => {
  const fetchMock = vi.fn()
  const onUnauthorized = vi.fn()
  const reply = answer([statement()])

  function lastCall() {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    return { url, init, headers: (init?.headers ?? {}) as Record<string, string> }
  }

  beforeEach(() => {
    fetchMock.mockReset()
    onUnauthorized.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
    configureApi({ getToken: () => 'tok-123', onUnauthorized })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the question with the SQL session token and the caller identity', async () => {
    window.localStorage.setItem(`qlkh.phien@${window.location.origin}.token`, JSON.stringify('adm-1'))
    fetchMock.mockResolvedValue(new Response(JSON.stringify(reply), { status: 200 }))

    await expect(askSql({ database: 'shop', question: 'đơn mới nhất' })).resolves.toEqual(reply)

    const { url, init, headers } = lastCall()
    expect(url).toBe('/ai/sql')
    expect(init.method).toBe('POST')
    expect(headers['X-Session-Token']).toBe('tok-123')
    expect(headers['X-Admin-Session']).toBe('adm-1')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({ database: 'shop', question: 'đơn mới nhất' })
  })

  it('sends the editor SQL only when there is some to revise', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(reply), { status: 200 }))

    await askSql({ database: 'shop', question: 'chỉ đơn đã trả', current: 'SELECT * FROM `orders`' })
    expect(JSON.parse(String(lastCall().init.body)).current).toBe('SELECT * FROM `orders`')

    await askSql({ database: 'shop', question: 'chỉ đơn đã trả', current: '' })
    expect(JSON.parse(String(lastCall().init.body))).not.toHaveProperty('current')
  })

  it('treats a 401 as the SQL session expiring, like the rest of the app', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status_code: 401, message: 'Session expired or not found; please connect again', data: null }),
        { status: 401 },
      ),
    )

    await expect(askSql({ database: 'shop', question: 'q' })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not sign the user out when the AI refuses', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status_code: 403, message: 'Cần mã truy cập AI', data: { code: 'ai_code_required' } }),
        { status: 403 },
      ),
    )

    await expect(askSql({ database: 'shop', question: 'q' })).rejects.toMatchObject({ code: 'ai_code_required' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('rejects an answer that has no statements', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sql: 'SELECT 1' }), { status: 200 }))

    const error = await askSql({ database: 'shop', question: 'q' }).catch((caught) => caught)
    expect(error).toBeInstanceOf(AiError)
    expect(error.code).toBe('bad_response')
  })
})
