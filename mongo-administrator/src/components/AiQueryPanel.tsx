/**
 * "Hỏi AI": a question in, a find or an aggregation pipeline out.
 *
 * Shared by the document browser and the aggregate console. What an answer
 * does once applied is decided in lib/aiMongo; this panel asks, shows the
 * answer with its warnings, and wires "Áp dụng" / "Chạy" to the store —
 * behind a confirmation whenever running it would write data or run
 * JavaScript on the server.
 */

import { useEffect, useId, useRef, useState } from 'react'

import { AiError, unlock, type AiStatus } from '../lib/ai'
import {
  QUESTION_MAX,
  applyTarget,
  askMongo,
  confirmationText,
  currentQuery,
  findTexts,
  needsConfirmation,
  pipelineText,
  previewText,
  serverJavaScript,
  writeStages,
  type AiView,
  type FindTexts,
  type MongoAnswer,
} from '../lib/aiMongo'
import { storage } from '../lib/storage'
import { useStore } from '../store'
import { IconClose } from './Icons'
import { useConfirm } from './useConfirm'

interface Props {
  id: string
  view: AiView
  status: AiStatus | null
  onStatus: (status: AiStatus) => void
  onClose: () => void
  /** After a find answer filled the browser's editors (the browser reveals sort & projection). */
  onFindApplied?: (texts: FindTexts) => void
}

/** Worth a "Thử lại": no answer, a malformed one, too fast, or the server/AI failing. */
function retryable(error: AiError): boolean {
  return error.status < 400 || error.status === 429 || error.status >= 500
}

function applyHint(answer: MongoAnswer, view: AiView): string {
  if (applyTarget(answer, view) === 'find') return 'Áp dụng điền filter, sort, projection, số dòng rồi chạy Find.'
  if (view === 'documents') return 'Pipeline được mở ở tab Aggregate.'
  return answer.mode === 'find' ? 'Truy vấn find đã được đổi thành pipeline.' : ''
}

/** After switching tabs the button that was pressed is gone: carry focus to the pipeline. */
function focusPipelineEditor(): void {
  window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.console .code-input')?.focus())
}

export function AiQueryPanel({ id, view, status, onStatus, onClose, onFindApplied }: Props) {
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const setFilterText = useStore((state) => state.setFilterText)
  const setProjectionText = useStore((state) => state.setProjectionText)
  const setSortText = useStore((state) => state.setSortText)
  const setLimit = useStore((state) => state.setLimit)
  const runFind = useStore((state) => state.runFind)
  const setPipelineText = useStore((state) => state.setPipelineText)
  const runAggregate = useStore((state) => state.runAggregate)
  const setTab = useStore((state) => state.setTab)
  const sessionExpired = useStore((state) => state.sessionExpired)

  const { confirm, dialog } = useConfirm()
  const [question, setQuestion] = useState('')
  const [revise, setRevise] = useState(false)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<MongoAnswer | null>(null)
  const [error, setError] = useState<AiError | null>(null)
  const [codeAsked, setCodeAsked] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const questionRef = useRef<HTMLTextAreaElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  /** The last question was refused for want of the access code: ask it again once unlocked. */
  const askAfterUnlock = useRef(false)
  const titleId = useId()
  const codeErrorId = useId()

  const namespace = activeDb && activeCollection ? `${activeDb}.${activeCollection}` : ''
  const needsCode = codeAsked || (!!status && !status.allowed && status.needs === 'code')

  // Opening the panel is asking to type a question.
  useEffect(() => {
    questionRef.current?.focus()
  }, [])

  // An answer belongs to the collection it was asked about.
  useEffect(() => {
    request.current?.abort()
    setAnswer(null)
    setError(null)
  }, [namespace])

  // Closing the panel cancels a question still on its way.
  useEffect(() => () => request.current?.abort(), [])

  useEffect(() => {
    if (codeAsked) codeRef.current?.focus()
  }, [codeAsked])

  async function ask() {
    const text = question.trim()
    if (!text || busy || !activeDb || !activeCollection) return
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setBusy(true)
    setError(null)
    setAnswer(null)
    setAnnouncement('AI đang viết truy vấn…')
    try {
      const result = await askMongo(
        {
          database: activeDb,
          collection: activeCollection,
          question: text,
          current: revise ? currentQuery(view, useStore.getState()) : undefined,
        },
        { token: storage.getToken(), signal: controller.signal },
      )
      setAnswer(result)
      const warnings = [
        result.writes || writeStages(result.pipeline, activeDb).length ? 'ghi dữ liệu' : '',
        serverJavaScript(result).length ? 'chạy JavaScript trên server' : '',
      ].filter(Boolean)
      setAnnouncement(
        `Đã có truy vấn ${result.mode}. ${result.explanation}${warnings.length ? ` Cảnh báo: ${warnings.join(', ')}.` : ''}`,
      )
    } catch (caught) {
      const failure = caught instanceof AiError ? caught : new AiError((caught as Error)?.message || 'Có lỗi xảy ra')
      if (failure.code === 'aborted') {
        // Cancelled by the person, or by leaving the collection; not when a newer question replaced it.
        if (request.current === controller) setAnnouncement('Đã huỷ câu hỏi.')
        return
      }
      if (failure.status === 401) {
        // The Mongo session is gone, exactly as for any other call to the bridge.
        sessionExpired(failure.message)
        return
      }
      if (failure.code === 'ai_code_required') {
        setCodeAsked(true)
        askAfterUnlock.current = true
      }
      setAnnouncement('')
      setError(failure)
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }

  function cancel() {
    request.current?.abort()
    questionRef.current?.focus()
  }

  async function submitCode() {
    const value = code.trim()
    if (!value || unlocking) return
    setUnlocking(true)
    setCodeError(null)
    try {
      onStatus(await unlock(value))
      setCode('')
      setCodeAsked(false)
      setError(null)
      setAnnouncement('Đã mở khoá AI.')
      // The code form is about to go, and focus with it.
      questionRef.current?.focus()
      if (askAfterUnlock.current) {
        askAfterUnlock.current = false
        void ask()
      }
    } catch (caught) {
      setCodeError(caught instanceof Error ? caught.message : 'Không mở khoá được')
      codeRef.current?.focus()
      codeRef.current?.select()
    } finally {
      setUnlocking(false)
    }
  }

  async function apply(run: boolean) {
    if (!answer || !activeDb) return
    const target = applyTarget(answer, view)
    // A find only reads, so applying it runs it; a pipeline runs only on "Chạy".
    if ((target === 'find' || run) && needsConfirmation(answer)) {
      if (!(await confirm(confirmationText(answer, activeDb)))) return
    }

    if (target === 'find') {
      const texts = findTexts(answer)
      setFilterText(texts.filterText)
      setProjectionText(texts.projectionText)
      setSortText(texts.sortText)
      setLimit(texts.limit)
      onFindApplied?.(texts)
      setAnnouncement('Đã áp dụng truy vấn và chạy Find.')
      await runFind({ skip: 0 })
      return
    }

    setPipelineText(pipelineText(answer))
    setAnnouncement(run ? 'Đã đưa pipeline vào console và chạy.' : 'Đã đưa pipeline vào console.')
    if (view !== 'aggregate') {
      await setTab('aggregate')
      focusPipelineEditor()
    }
    if (run) await runAggregate()
  }

  const target = answer ? applyTarget(answer, view) : null
  const writes = answer && activeDb ? writeStages(answer.pipeline, activeDb) : []
  const writing = !!answer && (answer.writes || writes.length > 0)
  const javascript = answer ? serverJavaScript(answer) : []

  return (
    <section
      id={id}
      className="ai-panel"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        // Escape belongs to the confirmation while one is open.
        if (event.key !== 'Escape' || dialog) return
        event.preventDefault()
        if (busy) cancel()
        else onClose()
      }}
    >
      <header className="ai-panel-head">
        <h3 id={titleId} className="ai-panel-title">
          <span aria-hidden="true">✨</span> Hỏi AI về <code>{namespace}</code>
        </h3>
        <button type="button" className="icon-btn" title="Đóng" aria-label="Đóng Hỏi AI" onClick={onClose}>
          <IconClose />
        </button>
      </header>

      {needsCode ? (
        <form
          className="ai-code"
          onSubmit={(event) => {
            event.preventDefault()
            void submitCode()
          }}
        >
          <label className="field">
            <span>Mã truy cập AI</span>
            <input
              ref={codeRef}
              type="password"
              value={code}
              maxLength={200}
              autoComplete="off"
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? codeErrorId : undefined}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={unlocking || !code.trim()}>
            {unlocking ? 'Đang mở khoá…' : 'Mở khoá'}
          </button>
          {codeError ? (
            <p id={codeErrorId} className="ai-error" role="alert">
              {codeError}
            </p>
          ) : (
            <p className="hint">Máy chủ này cần mã truy cập để dùng AI.</p>
          )}
        </form>
      ) : null}

      <form
        className="ai-ask"
        onSubmit={(event) => {
          event.preventDefault()
          void ask()
        }}
      >
        <label className="field">
          <span>Câu hỏi</span>
          <textarea
            ref={questionRef}
            rows={3}
            value={question}
            maxLength={QUESTION_MAX}
            placeholder={
              view === 'aggregate'
                ? 'VD: tổng doanh thu theo từng tháng của năm nay'
                : 'VD: đơn đã thanh toán trong tháng này, mới nhất trước'
            }
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void ask()
              }
            }}
          />
        </label>
        <div className="ai-ask-actions">
          <label className="check">
            <input type="checkbox" checked={revise} onChange={(event) => setRevise(event.target.checked)} />
            Sửa từ truy vấn đang có
          </label>
          <span className="modal-hint">⌘/Ctrl + Enter</span>
          <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>
            {busy ? 'Đang viết…' : 'Viết truy vấn'}
          </button>
        </div>
      </form>

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>

      {busy ? (
        <div className="ai-busy">
          <span className="spinner" aria-hidden="true" />
          <span>AI đang đọc mẫu dữ liệu và viết truy vấn — thường mất 5–30 giây.</span>
          <button type="button" className="btn btn-sm" onClick={cancel}>
            Huỷ
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="ai-error" role="alert">
          <span>{error.message}</span>
          {retryable(error) ? (
            <button type="button" className="btn btn-sm" onClick={() => void ask()}>
              Thử lại
            </button>
          ) : null}
        </div>
      ) : null}

      {answer && target ? (
        <div className="ai-answer">
          {answer.explanation ? <p className="ai-explanation">{answer.explanation}</p> : null}
          <div className="ai-meta">
            <span className="badge ai-mode">{answer.mode}</span>
            {writing ? (
              <span className="ai-flag ai-flag-danger">
                Ghi dữ liệu ($out/$merge){writes.length ? ` → ${writes.map((item) => item.target).join(', ')}` : ''}
              </span>
            ) : null}
            {javascript.length ? (
              <span className="ai-flag ai-flag-warn">Chạy JavaScript trên server: {javascript.join(', ')}</span>
            ) : null}
            <span className="ai-sample">
              AI đã xem {answer.sampled} tài liệu mẫu ({answer.fields} trường)
              {answer.cached ? ' · câu trả lời đã lưu' : ''}
            </span>
          </div>
          <pre className="ai-preview" tabIndex={0}>
            {previewText(answer, view)}
          </pre>
          <div className="ai-answer-actions">
            <button type="button" className="btn btn-primary" onClick={() => void apply(false)}>
              Áp dụng
            </button>
            {target === 'aggregate' ? (
              <button
                type="button"
                className={writing ? 'btn btn-danger-ghost' : 'btn'}
                onClick={() => void apply(true)}
              >
                Chạy
              </button>
            ) : null}
            <span className="hint">{applyHint(answer, view)}</span>
          </div>
        </div>
      ) : null}

      {dialog}
    </section>
  )
}
