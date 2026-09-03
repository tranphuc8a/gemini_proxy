import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import mermaid from 'mermaid'
import { useEditorStore } from '../store'
import './Preview.css'
import 'katex/dist/katex.min.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

function MermaidDiagram({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!ref.current) return
      ref.current.removeAttribute('data-processed')
      ref.current.textContent = source
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
      if (!cancelled) await mermaid.run({ nodes: [ref.current] })
    }
    void render().catch((error) => console.error('Failed to render Mermaid diagram', error))
    const observer = new ResizeObserver(() => void render())
    if (ref.current) observer.observe(ref.current)
    return () => { cancelled = true; observer.disconnect() }
  }, [source])

  return <div ref={ref} className="mermaid" aria-label="Mermaid diagram">{source}</div>
}

function Preview() {
  const currentContent = useEditorStore((state) => state.currentContent)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const previewRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    const handleEditorScroll = (event: Event) => {
      if (!scrollSync || !previewRef.current) return
      const ratio = (event as CustomEvent<number>).detail
      const range = previewRef.current.scrollHeight - previewRef.current.clientHeight
      previewRef.current.scrollTop = ratio * Math.max(0, range)
    }
    const handlePreviewFocus = (event: Event) => {
      window.dispatchEvent(new CustomEvent('preview-focus-editor', { detail: (event as MouseEvent).clientY }))
    }
    window.addEventListener('editor-scroll', handleEditorScroll)
    previewRef.current?.addEventListener('dblclick', handlePreviewFocus)
    return () => {
      window.removeEventListener('editor-scroll', handleEditorScroll)
      previewRef.current?.removeEventListener('dblclick', handlePreviewFocus)
    }
  }, [currentContent, scrollSync])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!scrollSync || syncingRef.current) return

    const element = e.currentTarget
    const scrollRange = element.scrollHeight - element.clientHeight
    const scrollPercentage = scrollRange > 0 ? element.scrollTop / scrollRange : 0

    const editorElement = document.querySelector('.editor') as HTMLTextAreaElement
    if (editorElement) {
      syncingRef.current = true
      editorElement.scrollTop = scrollPercentage * (editorElement.scrollHeight - editorElement.clientHeight)
      window.dispatchEvent(new CustomEvent('preview-scroll', { detail: scrollPercentage }))
      setTimeout(() => {
        syncingRef.current = false
      }, 50)
    }
  }

  return (
    <div className="preview-wrapper">
      <div className="preview-header">
        <h3>👁️ Preview</h3>
        <span className="preview-hint">GitHub Markdown</span>
      </div>
      <div
        ref={previewRef}
        className="preview-content"
        onScroll={handleScroll}
      >
        <article className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
              img: ({ node, ...props }) => (
                <img {...props} loading="lazy" />
              ),
              pre: ({ node, ...props }) => (
                <pre {...props} />
              ),
              code: ({ node, className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                const lang = match ? match[1] : ''
                const source = String(children).replace(/\n$/, '')

                if (lang === 'mermaid') {
                  return <MermaidDiagram source={source} />
                }

                if (lang) {
                  return (
                    <div className="code-block-wrapper">
                      <button className="copy-code-btn" onClick={() => void navigator.clipboard.writeText(source)} title="Copy code">Copy</button>
                      <SyntaxHighlighter language={lang} style={vscDarkPlus} PreTag="div">{source}</SyntaxHighlighter>
                    </div>
                  )
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {currentContent}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}

export default Preview
