/**
 * "✨ Hỏi AI" in the SQL console: ask for SQL in words, read what came back,
 * then put it in the editor or run it.
 *
 * Running follows `needsConfirmation`: a read-only answer that MySQL's EXPLAIN
 * did not reject runs at once; one that writes, failed EXPLAIN or was not fully
 * classified runs only after a confirmation naming the connection and database.
 */

import { useEffect, useRef, useState } from 'react'

import { AiError, type AiStatus, getStatus, unlockWithCode } from '../lib/ai'
import { askSql, CURRENT_MAX, needsConfirmation, QUESTION_MAX } from '../lib/aiSql'
import { useStore } from '../store'
import { PlayIcon } from './Icons'
import { useConfirm } from './useConfirm'

const BUSY_TEXT = 'AI đang đọc cấu trúc CSDL và viết SQL — thường mất 5–30 giây…'

interface Props {
  id: string
  status: AiStatus
  onStatusChange(status: AiStatus): void
  /** The editor's text, sent along when the user asks to revise it. */
  editorSql: string
  /** Replace the editor's text and focus it. */
  onUseSql(sql: string): void
  /** Focus the first field: true when the user has just opened the panel, not when it was restored. */
  autoFocus?: boolean
}

export function AiSqlPanel({ id, status, onStatusChange, editorSql, onUseSql, autoFocus = false }: Props) {
  const session = useStore((state) => state.session)
  const database = useStore((state) => state.currentDatabase)
  const entry = useStore((state) => state.aiAnswer)
  const setAiAnswer = useStore((state) => state.setAiAnswer)
  const runSql = useStore((state) => state.runSql)
  const running = useStore((state) => state.running)
  const notify = useStore((state) => state.notify)
  const [confirm, confirmDialog] = useConfirm()

  const [question, setQuestion] = useState(() => entry?.question ?? '')
  const [revise, setRevise] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AiError | null>(null)
  const [notice, setNotice] = useState('')
  const [code, setCode] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const questionRef = useRef<HTMLTextAreaElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const runRef = useRef<HTMLButtonElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  // Set when a question was turned away for want of the access code: unlocking then sends it again.
  const resumeRef = useRef(false)

  const locked = !status.allowed && status.needs === 'code'
  const answer = entry && entry.database === database ? entry.answer : null
  const hasEditorSql = Boolean(editorSql.trim())

  // Locking or unlocking swaps the form under the user's caret: focus its field.
  const lockedRef = useRef(locked)
  useEffect(() => {
    if (lockedRef.current === locked) return
    lockedRef.current = locked
    ;(locked ? codeRef.current : questionRef.current)?.focus()
  }, [locked])

  // An answer is written for one database: switching (or closing the panel) drops the request.
  useEffect(() => {
    setError(null)
    return () => requestRef.current?.abort()
  }, [database])

  async function ask() {
    const text = question.trim()
    if (!text || !database || busy) return
    const current = revise ? editorSql.trim() : ''
    if (current.length > CURRENT_MAX) {
      setError(
        new AiError(
          `Câu SQL trong editor dài hơn ${CURRENT_MAX} ký tự — hãy rút gọn, hoặc bỏ chọn "Sửa từ câu SQL đang có trong editor".`,
          'too_long',
        ),
      )
      return
    }

    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setBusy(true)
    setError(null)
    setNotice('')
    setAiAnswer(null)
    try {
      const result = await askSql(
        { database, question: text, current: current || undefined },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setAiAnswer({ database, question: text, answer: result })
      setNotice('AI đã viết xong — xem câu lệnh bên dưới.')
    } catch (cause) {
      if (controller.signal.aborted) return
      const failure = cause instanceof AiError ? cause : new AiError(cause instanceof Error ? cause.message : String(cause))
      if (failure.code === 'ai_code_required') {
        // The saved AI token expired or the code changed: ask for the code, then carry on.
        resumeRef.current = true
        onStatusChange({ ...status, allowed: false, needs: 'code' })
        // Re-read the status too, so the console does not offer the question form on its next visit.
        getStatus(true).catch(() => undefined)
      } else if (failure.status === 401) {
        // The SQL session expired; askSql already sent the app back to its login screen.
        notify('error', failure.message)
      } else {
        setError(failure)
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setBusy(false)
      }
    }
  }

  function cancel() {
    requestRef.current?.abort()
    setNotice('Đã huỷ.')
  }

  async function unlock() {
    const value = code.trim()
    if (!value || unlocking) return
    setUnlocking(true)
    setCodeError(null)
    try {
      const next = await unlockWithCode(value)
      setCode('')
      onStatusChange(next)
      if (!next.allowed) {
        setCodeError('Chưa mở khoá được: trình duyệt không lưu được phiên AI (bộ nhớ trang bị chặn?)')
      } else if (resumeRef.current) {
        resumeRef.current = false
        void ask()
      }
    } catch (cause) {
      setCodeError(cause instanceof Error ? cause.message : String(cause))
      codeRef.current?.select()
    } finally {
      setUnlocking(false)
    }
  }

  async function run() {
    if (!answer || !database || running) return
    const check = needsConfirmation(answer)
    if (check.confirm) {
      const target = `${session ? `${session.username}@${session.host}:${session.port}` : 'máy chủ'} / ${database}`
      const ok = await confirm({
        title: check.writes ? 'Chạy câu lệnh ghi / đổi cấu trúc?' : 'Chạy dù MySQL báo lỗi?',
        message: check.writes
          ? `Câu lệnh do AI viết sẽ thay đổi dữ liệu hoặc cấu trúc trên ${target}. Không hoàn tác được.`
          : `MySQL báo lỗi khi kiểm (EXPLAIN) câu lệnh do AI viết; chạy trên ${target} nhiều khả năng sẽ lỗi.`,
        details: (
          <ul className="error-list ai-confirm-list">
            {check.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        ),
        confirmLabel: 'Chạy',
        cancelLabel: 'Huỷ',
        danger: check.writes,
      })
      runRef.current?.focus()
      if (!ok) return
    }
    await runSql(answer.sql)
  }

  return (
    <section id={id} className="ai-panel" aria-label="Hỏi AI viết SQL">
      {locked ? (
        <form
          className="ai-unlock"
          onSubmit={(event) => {
            event.preventDefault()
            void unlock()
          }}
        >
          <label className="field">
            <span>Mã truy cập AI</span>
            <input
              ref={codeRef}
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              maxLength={200}
              autoFocus={autoFocus}
            />
          </label>
          <button type="submit" className="btn btn-sm btn-primary" disabled={unlocking || !code.trim()}>
            {unlocking ? 'Đang mở khoá…' : 'Mở khoá'}
          </button>
          <span className="hint">Máy chủ này cần mã truy cập để dùng AI.</span>
          {codeError ? (
            <p className="notice notice-danger ai-error" role="alert">
              {codeError}
            </p>
          ) : null}
        </form>
      ) : (
        <form
          className="ai-form"
          onSubmit={(event) => {
            event.preventDefault()
            void ask()
          }}
        >
          <label className="field">
            <span>
              {database ? (
                <>
                  Hỏi AI viết SQL cho CSDL <code>{database}</code>
                </>
              ) : (
                'Hỏi AI viết SQL'
              )}
            </span>
            <textarea
              ref={questionRef}
              rows={2}
              value={question}
              maxLength={QUESTION_MAX}
              autoFocus={autoFocus}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void ask()
                }
              }}
              placeholder="Ví dụ: 10 khách hàng mua nhiều nhất tháng này"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={revise && hasEditorSql}
              onChange={(event) => setRevise(event.target.checked)}
              disabled={!hasEditorSql}
            />
            Sửa từ câu SQL đang có trong editor
          </label>
          <div className="ai-form-actions">
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={busy || !database || !question.trim()}
              title="Ctrl/Cmd + Enter"
            >
              {busy ? 'Đang viết…' : 'Viết SQL'}
            </button>
            {busy ? (
              <button type="button" className="btn btn-sm" onClick={cancel}>
                Huỷ
              </button>
            ) : null}
            {!database ? <span className="hint">Chọn một CSDL ở thanh bên trước</span> : null}
            <p className="ai-status" role="status" aria-live="polite">
              {busy ? BUSY_TEXT : notice}
            </p>
          </div>
        </form>
      )}

      {error ? (
        <div className="notice notice-danger ai-error" role="alert">
          <span>{error.message}</span>
          {error.code !== 'too_long' ? (
            <button type="button" className="link-btn" onClick={() => void ask()} disabled={busy}>
              Thử lại
            </button>
          ) : null}
        </div>
      ) : null}

      {answer ? (
        <section className="result-card ai-result" aria-label="SQL do AI viết">
          {answer.explanation ? <p className="ai-explanation">{answer.explanation}</p> : null}
          <p className="hint">
            AI đã đọc cấu trúc {answer.tables} bảng — không đọc dữ liệu
            {answer.truncated ? ' (danh sách bị cắt)' : ''}
          </p>
          {answer.repaired ? <p className="hint">Đã tự sửa sau khi MySQL báo lỗi</p> : null}

          <ol className="ai-statements">
            {answer.statements.map((statement, index) => (
              <li className="ai-statement" key={index}>
                <pre className="ai-statement-sql">
                  <code>{statement.sql}</code>
                </pre>
                <div className="ai-badges">
                  <span className={`ai-badge ${statement.readOnly ? 'is-read' : 'is-write'}`}>
                    {statement.readOnly ? 'Chỉ đọc' : 'Ghi / đổi cấu trúc'}
                  </span>
                  {statement.checked === true ? (
                    <span className="ai-badge is-ok">
                      <span aria-hidden="true">✓ </span>MySQL đã kiểm (EXPLAIN)
                    </span>
                  ) : statement.checked === false ? (
                    <span className="ai-badge is-bad">
                      <span aria-hidden="true">✗ </span>MySQL báo lỗi: {statement.error || 'không rõ lỗi'}
                    </span>
                  ) : (
                    <span className="ai-badge">Chưa kiểm</span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="ai-result-actions">
            <button type="button" className="btn btn-sm" onClick={() => onUseSql(answer.sql)}>
              Đưa vào editor
            </button>
            <button
              ref={runRef}
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => void run()}
              disabled={running}
            >
              <PlayIcon size={14} /> Chạy
            </button>
          </div>
        </section>
      ) : null}

      {confirmDialog}
    </section>
  )
}
