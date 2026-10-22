import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveTheme, useEditorStore } from '../store'
import { toggleTaskAtIndex } from '../lib/editorCommands'
import {
  collectPreviewAnchors,
  createSyncLock,
  emitJump,
  emitScrollSync,
  lineForOffset,
  offsetForLine,
  onJump,
  onScrollSync,
  type LineAnchor
} from '../lib/paneSync'
import MarkdownView from './MarkdownView'
import './Preview.css'

/** Keeps typing responsive: re-parsing on every keystroke stutters on long files. */
const RENDER_DEBOUNCE_MS = 120
/**
 * A document longer than this is first rendered just after the first paint,
 * so the editor appears at once instead of waiting for the whole preview.
 */
const DEFER_FIRST_RENDER_CHARS = 20_000

function Preview() {
  const content = useEditorStore((state) => state.currentContent)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const themePreference = useEditorStore((state) => state.theme)
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const setContent = useEditorStore((state) => state.setContent)

  const theme = resolveTheme(themePreference)
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const lockRef = useRef(createSyncLock())
  const anchorsRef = useRef<LineAnchor[]>([])
  const anchorFrame = useRef(0)

  // null until a long document's first render, which waits for the first paint.
  const [debounced, setDebounced] = useState<string | null>(() => (content.length > DEFER_FIRST_RENDER_CHARS ? null : content))
  const pending = debounced === null

  useEffect(() => {
    if (pending) {
      // After the frame that shows the editor: rAF runs before that paint, the timeout after it.
      let timer: ReturnType<typeof setTimeout> | undefined
      const frame = requestAnimationFrame(() => {
        timer = setTimeout(() => setDebounced(content), 0)
      })
      return () => {
        cancelAnimationFrame(frame)
        if (timer) clearTimeout(timer)
      }
    }
    const timer = setTimeout(() => setDebounced(content), RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content, pending])

  /**
   * Re-reads the line anchors at most once per frame. Every image that loads
   * and every resize asks for it, and each read walks thousands of elements.
   */
  const scheduleAnchors = useCallback(() => {
    if (anchorFrame.current) return
    anchorFrame.current = requestAnimationFrame(() => {
      anchorFrame.current = 0
      if (scrollRef.current) anchorsRef.current = collectPreviewAnchors(scrollRef.current)
    })
  }, [])

  // Anchors move as images load and diagrams finish rendering.
  useEffect(() => {
    scheduleAnchors()
    const container = scrollRef.current
    const cancel = () => {
      cancelAnimationFrame(anchorFrame.current)
      anchorFrame.current = 0
    }
    if (!container) return cancel

    const observer = new ResizeObserver(scheduleAnchors)
    observer.observe(container)
    container.addEventListener('load', scheduleAnchors, true)

    return () => {
      cancel()
      observer.disconnect()
      container.removeEventListener('load', scheduleAnchors, true)
    }
  }, [debounced, scheduleAnchors])

  useEffect(() => {
    const offScroll = onScrollSync((event) => {
      if (event.source === 'preview' || !scrollSync || !scrollRef.current) return
      lockRef.current.engage()
      scrollRef.current.scrollTo({ top: offsetForLine(anchorsRef.current, event.line) })
    })
    const offJump = onJump((event) => {
      if (event.source === 'preview' || !scrollRef.current) return
      scrollRef.current.scrollTo({ top: offsetForLine(anchorsRef.current, event.line), behavior: 'smooth' })
    })
    return () => {
      offScroll()
      offJump()
    }
  }, [scrollSync])

  const onScroll = useCallback(() => {
    if (!scrollSync || lockRef.current.locked || !scrollRef.current) return
    emitScrollSync({ line: lineForOffset(anchorsRef.current, scrollRef.current.scrollTop), source: 'preview' })
  }, [scrollSync])

  /** Double-clicking a block moves the editor caret to the matching source line. */
  const onDoubleClick = useCallback((event: React.MouseEvent) => {
    const block = (event.target as HTMLElement).closest<HTMLElement>('[data-line]')
    if (!block) return
    const line = Number(block.dataset.line)
    if (Number.isFinite(line)) emitJump({ line, source: 'preview' })
  }, [])

  /** Ticking a checkbox in the preview edits the source it came from. */
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') return
      if (!isAdmin || !articleRef.current) {
        event.preventDefault()
        return
      }
      const boxes = Array.from(articleRef.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      const index = boxes.indexOf(target as HTMLInputElement)
      if (index >= 0) setContent(toggleTaskAtIndex(content, index))
    },
    [content, isAdmin, setContent]
  )

  return (
    <section className="preview-pane" aria-label="Rendered preview">
      <div className="pane-header">
        <span className="pane-title">Preview</span>
        <span className="pane-meta">GitHub flavoured</span>
      </div>

      <div ref={scrollRef} className="preview-scroll" onScroll={onScroll} onDoubleClick={onDoubleClick} onClick={onClick}>
        <article ref={articleRef} className="markdown-body">
          {pending ? (
            <p className="preview-empty">Rendering preview…</p>
          ) : (
            <>
              <MarkdownView source={debounced} theme={theme} />
              {!debounced.trim() && <p className="preview-empty">Nothing to preview yet — start writing in the editor.</p>}
            </>
          )}
        </article>
      </div>
    </section>
  )
}

export default Preview
