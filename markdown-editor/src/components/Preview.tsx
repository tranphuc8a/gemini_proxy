import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { resolveTheme, useEditorStore } from '../store'
import { rehypeEnhance, sanitizeSchema } from '../lib/rehypeEnhance'
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
import MermaidDiagram from './MermaidDiagram'
import CodeBlock from './CodeBlock'
import './Preview.css'
// Without this stylesheet KaTeX output renders as unstyled spans.
import 'katex/dist/katex.min.css'

/** Keeps typing responsive: re-parsing on every keystroke stutters on long files. */
const RENDER_DEBOUNCE_MS = 120

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

  const [debounced, setDebounced] = useState(content)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(content), RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content])

  const refreshAnchors = useCallback(() => {
    if (scrollRef.current) anchorsRef.current = collectPreviewAnchors(scrollRef.current)
  }, [])

  // Anchors move as images load and diagrams finish rendering.
  useEffect(() => {
    const frame = requestAnimationFrame(refreshAnchors)
    const container = scrollRef.current
    if (!container) return () => cancelAnimationFrame(frame)

    const observer = new ResizeObserver(refreshAnchors)
    observer.observe(container)
    const onLoad = () => refreshAnchors()
    container.addEventListener('load', onLoad, true)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      container.removeEventListener('load', onLoad, true)
    }
  }, [debounced, refreshAnchors])

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

  const components = useMemo(
    () => ({
      a: ({ node, ...props }: any) => {
        void node
        const href = String(props.href ?? '')
        // In-document anchors must scroll the preview, not open a new tab.
        return href.startsWith('#') ? <a {...props} /> : <a {...props} target="_blank" rel="noopener noreferrer" />
      },
      img: ({ node, ...props }: any) => {
        void node
        return <img {...props} loading="lazy" decoding="async" />
      },
      input: ({ node, ...props }: any) => {
        void node
        return <input {...props} readOnly={false} onChange={() => undefined} disabled={false} />
      },
      code: ({ node, className, children, ...props }: any) => {
        void node
        const match = /language-([\w-]+)/.exec(className ?? '')
        const language = match?.[1] ?? ''
        const source = String(children).replace(/\n$/, '')

        if (!language) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
        if (language === 'mermaid') return <MermaidDiagram source={source} theme={theme} />
        return <CodeBlock language={language} source={source} theme={theme} />
      },
      // The highlighter brings its own wrapper, so the default <pre> would
      // nest a second scroll container around it.
      pre: ({ children }: any) => <>{children}</>
    }),
    [theme]
  )

  return (
    <section className="preview-pane" aria-label="Rendered preview">
      <div className="pane-header">
        <span className="pane-title">Preview</span>
        <span className="pane-meta">GitHub flavoured</span>
      </div>

      <div ref={scrollRef} className="preview-scroll" onScroll={onScroll} onDoubleClick={onDoubleClick} onClick={onClick}>
        <article ref={articleRef} className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
              rehypeEnhance,
              [rehypeSanitize, sanitizeSchema],
              rehypeKatex
            ]}
            components={components}
          >
            {debounced}
          </ReactMarkdown>
          {!debounced.trim() && <p className="preview-empty">Nothing to preview yet — start writing on the left.</p>}
        </article>
      </div>
    </section>
  )
}

export default Preview
