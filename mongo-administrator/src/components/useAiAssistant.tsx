import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { canOffer, getStatus, type AiStatus } from '../lib/ai'
import type { AiView, FindTexts } from '../lib/aiMongo'
import { AiQueryPanel } from './AiQueryPanel'

/**
 * "✨ Hỏi AI" for a view: `{ toggle, panel }` to place in its toolbar and its body.
 *
 * Like useConfirm, a hook that hands back elements, so each view only decides
 * where they go. The button exists only when the server offers AI to this
 * person — switched on, and allowed or one access code away; in admin-only
 * mode a guest sees nothing at all.
 */
export function useAiAssistant(view: AiView, options: { onFindApplied?: (texts: FindTexts) => void } = {}) {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    let live = true
    getStatus().then(
      (next) => {
        if (live) setStatus(next)
      },
      () => {
        if (live) setStatus(null)
      },
    )
    return () => {
      live = false
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    toggleRef.current?.focus()
  }, [])

  // Kept while the panel is open, so closing it always has a button to return focus to.
  const toggle =
    canOffer(status) || open ? (
      <button
        ref={toggleRef}
        type="button"
        className={`btn btn-sm ai-toggle${open ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">✨</span>
        Hỏi AI
      </button>
    ) : null

  const panel = open ? (
    <AiQueryPanel
      id={panelId}
      view={view}
      status={status}
      onStatus={setStatus}
      onClose={close}
      onFindApplied={options.onFindApplied}
    />
  ) : null

  return { toggle, panel }
}
