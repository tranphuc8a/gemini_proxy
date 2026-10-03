/**
 * "Hỏi AI" in the SQL console: a question in words becomes a MySQL script for
 * the current database (POST /ai/sql), plus the rule for running the answer.
 *
 * The server reads the database's structure (never a row) over this app's own
 * session, classifies every statement and EXPLAINs the ones MySQL can check
 * without running them. The rule built on that is the point of the feature:
 * an answer runs straight away only when it is validated, meaning read only and
 * rejected by MySQL nowhere; anything else runs only once the user confirms it.
 */

import { AiError, aiPost } from './ai'
import { authHeaders, reportUnauthorized } from './api'
import { splitStatements } from './sql'

/** What the server accepts (QUESTION_CHARS / CURRENT_CHARS in ai_query_usecase.py). */
export const QUESTION_MAX = 1000
export const CURRENT_MAX = 8000

export interface AiSqlStatement {
  sql: string
  /** Strict server-side classification: false for UPDATE/DELETE/DDL, SELECT … FOR UPDATE, INTO OUTFILE… */
  readOnly: boolean
  /** true: EXPLAIN accepted it (it was not run); false: EXPLAIN failed with `error`; null: not checked. */
  checked: boolean | null
  error: string | null
}

export interface AiSqlAnswer {
  /** The whole script as generated; it may hold several statements. */
  sql: string
  /** Vietnamese, one to three sentences. */
  explanation: string
  statements: AiSqlStatement[]
  /** Every statement is read only. */
  readOnly: boolean
  /** The first answer failed EXPLAIN and the model fixed it once. */
  repaired: boolean
  /** How many tables' structure the model read. */
  tables: number
  /** The table list was cut short. */
  truncated: boolean
  cached: boolean
}

/** The last answer, kept with what produced it: it belongs to one database only. */
export interface AiSqlEntry {
  database: string
  question: string
  answer: AiSqlAnswer
}

export async function askSql(
  request: { database: string; question: string; current?: string },
  options: { signal?: AbortSignal } = {},
): Promise<AiSqlAnswer> {
  const body: Record<string, string> = { database: request.database, question: request.question }
  if (request.current) body.current = request.current

  let answer: AiSqlAnswer
  try {
    // X-Session-Token: the server reads THIS connection's schema and EXPLAINs on it.
    answer = await aiPost<AiSqlAnswer>('sql', body, { headers: authHeaders(), signal: options.signal })
  } catch (error) {
    // The AI's own refusals are 403/429/503; a 401 here means the SQL session is gone.
    if (error instanceof AiError && error.status === 401) reportUnauthorized()
    throw error
  }
  if (typeof answer.sql !== 'string' || !Array.isArray(answer.statements)) {
    throw new AiError('Máy chủ AI trả lời không đúng định dạng', 'bad_response', 200)
  }
  return answer
}

export interface RunCheck {
  /** Ask the user before running. */
  confirm: boolean
  /** Something in the script changes data or structure, or was never classified and might. */
  writes: boolean
  /** One entry per thing to look at, for the confirmation dialog. */
  reasons: string[]
}

/**
 * Validated or confirmed: an answer may run without asking only when the server
 * classified every statement in it as read only and MySQL rejected none of them.
 */
export function needsConfirmation(answer: AiSqlAnswer): RunCheck {
  const reasons: string[] = []
  let writes = false

  for (const statement of answer.statements) {
    const flags: string[] = []
    if (!statement.readOnly) flags.push('Ghi / đổi cấu trúc')
    if (statement.checked === false) flags.push(`MySQL báo lỗi: ${statement.error || 'không rõ lỗi'}`)
    if (!flags.length) continue
    if (!statement.readOnly) writes = true
    reasons.push(`${flags.join(' · ')}\n${statement.sql}`)
  }

  // The server lists at most a dozen statements: whatever follows them was never classified.
  const total = splitStatements(answer.sql).length
  if (total > answer.statements.length) {
    writes = true
    reasons.push(`Kịch bản có ${total} câu lệnh nhưng máy chủ chỉ kiểm ${answer.statements.length} câu đầu`)
  }

  // The script-wide flag is the server's word too, even if no statement above says why.
  if (!answer.readOnly && !writes) {
    writes = true
    reasons.push('Máy chủ đánh dấu kịch bản này là có ghi / đổi cấu trúc')
  }

  return { confirm: reasons.length > 0, writes, reasons }
}
