import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useStore } from '../store'
import { canOffer } from '../lib/ai'
import { appendScript } from '../lib/aiHttp'
import type { AiJob, AiJobError, Tab } from '../types'

/** The tab's job, if it is about the response the tab shows now. */
function jobFor<T>(job: AiJob<T> | undefined, tab: Tab): AiJob<T> | undefined {
  return job && tab.response && job.responseAt === tab.response.receivedAt ? job : undefined
}

const BUSY_HINT = 'thường mất 5–30 giây'

/**
 * "Mã truy cập AI" + "Mở khoá": trade the access code for an AI session, then
 * carry on with whatever the person was doing.
 */
export function AiCodeForm({ onUnlocked }: { onUnlocked: () => void }) {
  const unlockAi = useStore((s) => s.unlockAi)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputId = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await unlockAi(code.trim())
      setCode('')
      onUnlocked()
    } catch (err) {
      setError((err as Error).message || 'Không mở khoá được')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ai-code" onSubmit={submit}>
      <label htmlFor={inputId}>Mã truy cập AI</label>
      <div className="ai-code-row">
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          maxLength={200}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // The person just asked for AI; this field is the next step.
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !code.trim()}>
          {busy ? 'Đang mở khoá…' : 'Mở khoá'}
        </button>
      </div>
      {error ? (
        <p className="ai-code-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}

/** A failed job: the server's own words, the code form when that is what is missing, and a retry. */
function AiFailure({ error, onRetry, onDismiss }: { error: AiJobError; onRetry: () => void; onDismiss?: () => void }) {
  if (error.code === 'ai_code_required') {
    return (
      <div className="ai-box">
        <p className="ai-box-text">{error.message}</p>
        <AiCodeForm onUnlocked={onRetry} />
      </div>
    )
  }
  return (
    <div className="notice notice-error" role="alert">
      {error.message}
      <div className="ai-actions">
        <button className="btn btn-sm" onClick={onRetry}>
          Thử lại
        </button>
        {onDismiss ? (
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
            Bỏ
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AiList({ title, items, tone }: { title: string; items: string[]; tone?: 'problem' }) {
  if (!items.length) return null
  return (
    <section className={`ai-section${tone === 'problem' ? ' ai-problems' : ''}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

/** The "AI" view of the response panel. Everything is rendered as text, never as HTML. */
export function AiExplainView({ tab }: { tab: Tab }) {
  const status = useStore((s) => s.aiStatus)
  const job = jobFor(useStore((s) => s.aiExplain[tab.id]), tab)
  const explainResponse = useStore((s) => s.explainResponse)
  const ask = () => explainResponse(tab.id)

  const announcement = job?.busy
    ? `Đang nhờ AI giải thích response, ${BUSY_HINT}.`
    : job?.result
      ? 'AI đã giải thích xong.'
      : ''

  let content: ReactNode
  if (job?.busy) {
    content = (
      <div className="ai-busy">
        <span className="ai-spinner" aria-hidden="true" /> Đang hỏi AI… {BUSY_HINT}.
      </div>
    )
  } else if (job?.error) {
    content = <AiFailure error={job.error} onRetry={ask} />
  } else if (job?.result) {
    const result = job.result
    content = (
      <article className="ai-result">
        <p className="ai-summary">{result.summary}</p>
        <AiList title="Chi tiết" items={result.details} />
        <AiList title="Vấn đề" items={result.problems} tone="problem" />
        <AiList title="Nên thử tiếp" items={result.next} />
        {job.notes.map((note) => (
          <p className="hint" key={note}>
            {note}
          </p>
        ))}
        {result.cached ? <p className="hint">Câu trả lời lấy từ bộ nhớ đệm của máy chủ.</p> : null}
      </article>
    )
  } else if (status && !status.allowed && status.needs === 'code') {
    content = (
      <div className="ai-box">
        <p className="ai-box-text">Nhập mã truy cập AI để nhờ AI giải thích response này.</p>
        <AiCodeForm onUnlocked={ask} />
      </div>
    )
  } else {
    content = (
      <div className="empty">
        <div className="empty-icon">✨</div>
        AI đọc status, header và body để giải thích response này.
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={ask} disabled={!tab.response || tab.sending}>
            ✨ Giải thích
          </button>
        </div>
        <p className="hint">Header nhạy cảm (Authorization, Cookie, token…) được thay bằng [đã ẩn] trước khi gửi đi.</p>
      </div>
    )
  }

  return (
    <div className="viewer ai-view" aria-busy={job?.busy || undefined}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {content}
    </div>
  )
}

/** "✨ Sinh test từ response", for the Tests editor's toolbar. Hidden unless AI can be offered. */
export function AiTestsButton({ tab }: { tab: Tab }) {
  const status = useStore((s) => s.aiStatus)
  const job = jobFor(useStore((s) => s.aiTests[tab.id]), tab)
  const generateTests = useStore((s) => s.generateTests)

  if (!canOffer(status)) return null
  const busy = Boolean(job?.busy)
  return (
    <button
      className="btn btn-sm"
      onClick={() => generateTests(tab.id)}
      disabled={!tab.response || busy || tab.sending}
      title={tab.response ? 'Nhờ AI viết test pm.* dựa trên response hiện tại' : 'Gửi request trước để có response'}
    >
      {busy ? 'Đang sinh test…' : '✨ Sinh test từ response'}
    </button>
  )
}

/**
 * What the AI wrote, shown before anything touches the request.
 *
 * Nothing here runs the script: it only goes into the editor when the person
 * says so, and runs the usual way, on the next send.
 */
export function AiTestsPreview({ tab, onDone }: { tab: Tab; onDone: () => void }) {
  const job = jobFor(useStore((s) => s.aiTests[tab.id]), tab)
  const generateTests = useStore((s) => s.generateTests)
  const dismissAiTests = useStore((s) => s.dismissAiTests)
  const patchDraft = useStore((s) => s.patchDraft)
  const toast = useStore((s) => s.toast)

  const retry = () => generateTests(tab.id)
  const dismiss = () => {
    dismissAiTests(tab.id)
    onDone()
  }
  const apply = (tests: string, message: string) => {
    patchDraft(tab.id, { tests })
    dismissAiTests(tab.id)
    toast('success', message)
    onDone()
  }

  const announcement = job?.busy
    ? `Đang nhờ AI viết test, ${BUSY_HINT}.`
    : job?.result
      ? 'AI đã viết xong test. Xem lại script trước khi thêm.'
      : ''

  let content: ReactNode = null
  if (job?.busy) {
    content = (
      <div className="ai-box ai-busy">
        <span className="ai-spinner" aria-hidden="true" /> Đang nhờ AI viết test… {BUSY_HINT}.
      </div>
    )
  } else if (job?.error) {
    content = <AiFailure error={job.error} onRetry={retry} onDismiss={dismiss} />
  } else if (job?.result) {
    const { script, notes } = job.result
    content = (
      <section className="ai-box" aria-label="Test do AI sinh">
        <div className="ai-box-head">
          <b>✨ Test do AI sinh</b>
          <span className="chip chip-warn">Xem lại script trước khi chạy</span>
        </div>
        <pre className="viewer ai-script" tabIndex={0} aria-label="Script test do AI sinh, chỉ đọc">
          {script}
        </pre>
        {notes ? <p className="hint">{notes}</p> : null}
        {job.notes.map((note) => (
          <p className="hint" key={note}>
            {note}
          </p>
        ))}
        <div className="ai-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => apply(appendScript(tab.draft.tests, script), 'Đã thêm test vào cuối — gửi request để chạy')}
          >
            Thêm vào cuối
          </button>
          <button className="btn btn-sm" onClick={() => apply(script, 'Đã thay test script — gửi request để chạy')}>
            Thay thế
          </button>
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>
            Bỏ
          </button>
        </div>
        <p className="hint">Script chưa chạy. Sau khi thêm, gửi lại request để chạy test như bình thường.</p>
      </section>
    )
  }

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {content}
    </>
  )
}
