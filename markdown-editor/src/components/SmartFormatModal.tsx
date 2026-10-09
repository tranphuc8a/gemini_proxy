import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveTheme, useEditorStore } from '../store'
import {
  AiError,
  FORMAT_MAX_CHARS,
  canOffer,
  chooseModel,
  chosenModel,
  formatMarkdown,
  getStatus,
  listModels,
  unlockWithCode,
  type AiModels,
  type AiStatus,
  type FormatMode,
  type FormatResult
} from '../services/aiClient'
import { MODE_LABELS, applyResult, chooseTarget, type Scope } from '../lib/smartFormat'
import { useFocusTrap } from '../hooks/useFocusTrap'
import MarkdownView from './MarkdownView'
import { IconClose, IconSparkles } from './Icons'
import './SmartFormatModal.css'

type ResultTab = 'result' | 'original' | 'markdown'

/** A sentence for each way the gateway can refuse, so nobody is left with a bare status code. */
function explain(error: unknown): string {
  if (error instanceof AiError) {
    if (error.code === 'ai_rate_limited' || error.code === 'ai_budget_exhausted') {
      return error.retryAfter ? `${error.message} (try again in about ${Math.ceil(error.retryAfter)} s).` : error.message
    }
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function SmartFormatModal() {
  const request = useEditorStore((state) => state.smartFormat)
  const close = useEditorStore((state) => state.closeSmartFormat)
  const content = useEditorStore((state) => state.currentContent)
  const themePreference = useEditorStore((state) => state.theme)
  const setContent = useEditorStore((state) => state.setContent)
  const commitHistory = useEditorStore((state) => state.commitHistory)
  const pushToast = useEditorStore((state) => state.pushToast)

  const open = request !== null
  const panelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  /** The document as it was when the dialog opened: what the answer is about, and what it will replace. */
  const [snapshot, setSnapshot] = useState('')
  const [scope, setScope] = useState<Scope>('document')
  const [mode, setMode] = useState<FormatMode>('smart')
  const [hint, setHint] = useState('')
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [models, setModels] = useState<AiModels | null>(null)
  const [model, setModel] = useState(() => chosenModel())
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FormatResult | null>(null)
  const [tab, setTab] = useState<ResultTab>('result')

  // Take the snapshot, and ask the server what this visitor may do, each time the dialog opens.
  useEffect(() => {
    if (!request) return
    setSnapshot(content)
    setScope(chooseTarget(content, request.start, request.end).scope)
    setResult(null)
    setError('')
    setStatusError('')
    setCode('')
    setCodeError('')
    setTab('result')
    setModel(chosenModel())
    let active = true
    getStatus(true).then(
      (next) => active && setStatus(next),
      (cause) => {
        if (!active) return
        setStatus(null)
        setStatusError(explain(cause))
      }
    )
    listModels().then(
      (next) => active && setModels(next),
      () => active && setModels(null)
    )
    return () => {
      active = false
      abortRef.current?.abort()
    }
    // The snapshot is taken once per opening, not on every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useFocusTrap(panelRef, open)

  const target = useMemo(
    () => (request ? chooseTarget(snapshot, request.start, request.end, scope) : null),
    [request, snapshot, scope]
  )
  const hasSelection = Boolean(request && snapshot.slice(request.start, request.end).trim())
  const tooLong = Boolean(target && target.text.length > FORMAT_MAX_CHARS)

  const closeModal = useCallback(() => {
    abortRef.current?.abort()
    close()
  }, [close])

  // Escape closes this dialog; the global handler stands aside while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closeModal()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, closeModal])

  if (!request || !target) return null

  const theme = resolveTheme(themePreference)
  const ready = canOffer(status) && status?.allowed
  const needsCode = Boolean(status?.enabled && !status.allowed && status.needs === 'code')

  const run = async () => {
    if (running || !ready || tooLong) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const answer = await formatMarkdown(target.text, mode, hint.trim(), controller.signal)
      if (controller.signal.aborted) return
      setResult(answer)
      setTab('result')
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof AiError && cause.code === 'ai_code_required') void getStatus(true).then(setStatus, () => undefined)
      setError(explain(cause))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setRunning(false)
      }
    }
  }

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault()
    setCodeError('')
    try {
      setStatus(await unlockWithCode(code))
      setCode('')
    } catch (cause) {
      setCodeError(explain(cause))
    }
  }

  const pickModel = (id: string) => {
    setModel(id)
    chooseModel(id)
  }

  const apply = () => {
    if (!result) return
    const latest = useEditorStore.getState().currentContent
    const next = applyResult(latest, target, result.markdown)
    if (next === null) {
      pushToast('The document changed while the AI was working — run it again on the current text.', 'error')
      return
    }
    // One undo step for the AI's edit, separate from whatever was typed just before.
    commitHistory()
    setContent(next)
    commitHistory()
    pushToast('Formatted with AI — Ctrl+Z undoes it.', 'success')
    closeModal()
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.markdown)
      pushToast('Result copied', 'success')
    } catch {
      pushToast('Could not copy — select the Markdown tab and copy by hand.', 'error')
    }
  }

  const unsafe = Boolean(result?.truncated)
  const modelOptions = models?.models ?? []

  return (
    <div className="overlay smart-overlay" onClick={closeModal}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className="panel smart-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-title"
      >
        <header className="smart-head">
          <span className="smart-icon">
            <IconSparkles size={18} />
          </span>
          <div>
            <h2 id="smart-title">Smart format</h2>
            <p>AI restructures raw text, notes, logs or code into readable Markdown. Nothing changes until you apply it.</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={closeModal} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="smart-body">
          {statusError && (
            <p className="smart-note smart-note-error" role="alert">
              {statusError}
            </p>
          )}
          {status && !status.enabled && <p className="smart-note smart-note-error">AI is turned off or not configured on this server.</p>}
          {status?.enabled && !status.allowed && status.needs === 'admin' && (
            <p className="smart-note smart-note-error">
              AI on this server is for course administrators. Sign in on the course management page of this server, then reopen this dialog.
            </p>
          )}
          {needsCode && (
            <form className="smart-code" onSubmit={(event) => void unlock(event)}>
              <label htmlFor="smart-code">AI access code</label>
              <div className="smart-code-row">
                <input id="smart-code" type="password" autoComplete="off" maxLength={200} value={code} onChange={(event) => setCode(event.target.value)} />
                <button type="submit" className="btn btn-outline" disabled={!code.trim()}>
                  Unlock
                </button>
              </div>
              {codeError && (
                <p className="smart-note smart-note-error" role="alert">
                  {codeError}
                </p>
              )}
            </form>
          )}

          {!result && (
            <>
              <fieldset className="smart-field" disabled={running}>
                <legend>Format</legend>
                <div className="smart-choices" role="radiogroup" aria-label="What to format">
                  <label className={`smart-choice${scope === 'selection' ? ' is-on' : ''}${hasSelection ? '' : ' is-disabled'}`}>
                    <input type="radio" name="smart-scope" checked={scope === 'selection'} disabled={!hasSelection} onChange={() => setScope('selection')} />
                    <span>
                      Selection
                      {hasSelection && request ? ` · ${Math.abs(request.end - request.start).toLocaleString()} characters` : ' · nothing selected'}
                    </span>
                  </label>
                  <label className={`smart-choice${scope === 'document' ? ' is-on' : ''}`}>
                    <input type="radio" name="smart-scope" checked={scope === 'document'} onChange={() => setScope('document')} />
                    <span>Whole document · {snapshot.length.toLocaleString()} characters</span>
                  </label>
                </div>
                {tooLong && (
                  <p className="smart-note smart-note-error" role="alert">
                    {target.text.length.toLocaleString()} characters is more than the {FORMAT_MAX_CHARS.toLocaleString()} the AI takes at once — select a part of the document.
                  </p>
                )}
              </fieldset>

              <fieldset className="smart-field" disabled={running}>
                <legend>Mode</legend>
                <div className="smart-choices" role="radiogroup" aria-label="Mode">
                  {(Object.keys(MODE_LABELS) as FormatMode[]).map((key) => (
                    <label key={key} className={`smart-choice${mode === key ? ' is-on' : ''}`}>
                      <input type="radio" name="smart-mode" checked={mode === key} onChange={() => setMode(key)} />
                      <span>
                        <strong>{MODE_LABELS[key].label}</strong>
                        <small>{MODE_LABELS[key].hint}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="smart-row">
                <label className="smart-field smart-grow">
                  <span className="smart-label">Note for the AI (optional)</span>
                  <input
                    type="text"
                    maxLength={300}
                    value={hint}
                    disabled={running}
                    placeholder="e.g. this is a server log; keep timestamps"
                    onChange={(event) => setHint(event.target.value)}
                  />
                </label>
                {modelOptions.length > 0 && (
                  <label className="smart-field">
                    <span className="smart-label">Model</span>
                    <select value={model} disabled={running} onChange={(event) => pickModel(event.target.value)} aria-label="AI model">
                      <option value="">Default ({models?.default})</option>
                      {modelOptions.map((option) => (
                        <option key={option.id} value={option.id} disabled={!option.allowed}>
                          {option.label}
                          {option.preview ? ' · preview' : ''}
                          {!option.allowed ? ' — administrators only' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <p className="smart-privacy">
                The selected text is sent to Google Gemini through this server. It is not stored or cached on the server.
              </p>
            </>
          )}

          {error && (
            <p className="smart-note smart-note-error" role="alert">
              {error}
            </p>
          )}

          {result && (
            <section className="smart-result" aria-label="Result">
              {result.shrunk && (
                <p className="smart-note smart-note-warn" role="alert">
                  The result has far fewer words than the original ({result.words.toLocaleString()} vs {result.sourceWords.toLocaleString()}). Check that nothing was lost before applying.
                </p>
              )}
              {result.truncated && (
                <p className="smart-note smart-note-error" role="alert">
                  The AI ran out of room and the result may end early. Select a smaller part of the document and run it again.
                </p>
              )}
              {result.changes.length > 0 && (
                <ul className="smart-changes" aria-label="What changed">
                  {result.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              )}
              <div className="smart-tabs" role="tablist" aria-label="Compare">
                {(['result', 'original', 'markdown'] as ResultTab[]).map((key) => (
                  <button key={key} role="tab" type="button" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>
                    {key === 'result' ? 'Result' : key === 'original' ? 'Original' : 'Markdown'}
                  </button>
                ))}
              </div>
              <div className="smart-view" role="tabpanel">
                {tab === 'markdown' ? (
                  <pre className="smart-source">{result.markdown}</pre>
                ) : tab === 'original' ? (
                  <pre className="smart-source">{target.text}</pre>
                ) : (
                  <article className="markdown-body smart-preview">
                    <MarkdownView source={result.markdown} theme={theme} idPrefix="smart-" />
                  </article>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="smart-foot">
          {result ? (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setResult(null)}>
                Back
              </button>
              <button type="button" className="btn btn-outline" onClick={() => void run()} disabled={running}>
                Run again
              </button>
              <button type="button" className="btn btn-outline" onClick={() => void copy()}>
                Copy
              </button>
              <button type="button" className="btn btn-primary" onClick={apply} disabled={unsafe}>
                {target.scope === 'selection' ? 'Replace selection' : 'Replace document'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={running || !ready || tooLong}>
                {running ? 'Formatting…' : 'Format with AI'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

export default SmartFormatModal
