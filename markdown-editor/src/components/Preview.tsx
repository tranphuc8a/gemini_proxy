import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { resolveTheme, useEditorStore } from '../store'
import { useReadingStore } from '../readingStore'
import { revealIn } from '../lib/previewController'
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
import BlockedMarkdownView from './BlockedMarkdownView'
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
  // Reading mode covers the app and builds its own copy: the preview underneath waits.
  const readingOpen = useReadingStore((state) => state.open)

  const theme = resolveTheme(themePreference)
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const lockRef = useRef(createSyncLock())
  const anchorsRef = useRef<LineAnchor[]>([])

  // null until a long document's first render, which waits for the first paint.
  const [built, setBuilt] = useState<{ done: number; total: number } | null>(null)
  const onProgress = useCallback((done: number, total: number) => setBuilt(done < total ? { done, total } : null), [])

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
    // A transition: React renders the update in short slices and lets a key press in between, instead of one long task.
    const timer = setTimeout(() => startTransition(() => setDebounced(content)), RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content, pending])

  /**
   * The line anchors are read when a scroll needs them, not after every change: each read measures every block of the
   * preview (a layout), and it used to run after each pause in typing. Anything that moves things (an edit, an image
   * that loads, a diagram that finishes, more blocks built, a resize) only marks them stale.
   */
  const anchorsStale = useRef(true)
  const markAnchorsStale = useCallback(() => {
    anchorsStale.current = true
  }, [])
  const getAnchors = useCallback((): LineAnchor[] => {
    if (anchorsStale.current && scrollRef.current) {
      anchorsRef.current = collectPreviewAnchors(scrollRef.current)
      anchorsStale.current = false
    }
    return anchorsRef.current
  }, [])

  useEffect(() => {
    markAnchorsStale()
    const container = scrollRef.current
    if (!container) return

    const observer = new ResizeObserver(markAnchorsStale)
    observer.observe(container)
    container.addEventListener('load', markAnchorsStale, true)

    return () => {
      observer.disconnect()
      container.removeEventListener('load', markAnchorsStale, true)
    }
  }, [debounced, markAnchorsStale])

  useEffect(() => {
    const offScroll = onScrollSync((event) => {
      if (event.source === 'preview' || !scrollSync || !scrollRef.current) return
      lockRef.current.engage()
      scrollRef.current.scrollTo({ top: offsetForLine(getAnchors(), event.line) })
    })
    const offJump = onJump((event) => {
      if (event.source === 'preview' || !scrollRef.current) return
      // The block holding the line may still be a placeholder: build it first, so the target has its real height.
      if (articleRef.current && revealIn(articleRef.current, { line: event.line })) markAnchorsStale()
      scrollRef.current.scrollTo({ top: offsetForLine(getAnchors(), event.line), behavior: 'smooth' })
    })
    return () => {
      offScroll()
      offJump()
    }
  }, [scrollSync, getAnchors, markAnchorsStale])

  const onScroll = useCallback(() => {
    if (!scrollSync || lockRef.current.locked || !scrollRef.current) return
    emitScrollSync({ line: lineForOffset(getAnchors(), scrollRef.current.scrollTop), source: 'preview' })
  }, [scrollSync, getAnchors])

  /** Double-clicking a block moves the editor caret to the matching source line. */
  const onDoubleClick = useCallback((event: React.MouseEvent) => {
    const block = (event.target as HTMLElement).closest<HTMLElement>('[data-line]')
    if (!block) return
    // Rendered block by block, `data-line` counts from the block's first line.
    const wrapper = block.closest<HTMLElement>('[data-block-line]')
    const offset = wrapper ? Number(wrapper.dataset.blockLine) - 1 : 0
    const line = Number(block.dataset.line) + offset
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
        <span className="pane-meta">
          {built ? <span className="pane-progress" role="status">Building {Math.round((built.done / built.total) * 100)}%</span> : null}
          GitHub flavoured
        </span>
      </div>

      <div ref={scrollRef} className="preview-scroll" onScroll={onScroll} onDoubleClick={onDoubleClick} onClick={onClick}>
        <article ref={articleRef} className="markdown-body">
          {pending ? (
            <p className="preview-empty">Rendering preview…</p>
          ) : (
            <>
              <BlockedMarkdownView source={debounced} theme={theme} progressive paused={readingOpen} onProgress={onProgress} onBuilt={markAnchorsStale} />
              {!debounced.trim() && <p className="preview-empty">Nothing to preview yet — start writing in the editor.</p>}
            </>
          )}
        </article>
      </div>
    </section>
  )
}

export default Preview
