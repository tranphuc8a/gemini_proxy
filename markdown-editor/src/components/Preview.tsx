import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useEditorStore } from '../store'
import './Preview.css'
import 'katex/dist/katex.min.css'

function Preview() {
  const currentContent = useEditorStore((state) => state.currentContent)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const previewRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!scrollSync || !previewRef.current) return

    // Initialize Mermaid diagrams
    const initMermaid = async () => {
      const mermaidScript = document.querySelector('script[src*="mermaid"]')
      if (!mermaidScript) {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js'
        script.async = true
        document.head.appendChild(script)
      }
    }

    initMermaid()
  }, [scrollSync])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!scrollSync || syncingRef.current) return

    const element = e.currentTarget
    const scrollPercentage = element.scrollTop / (element.scrollHeight - element.clientHeight)

    const editorElement = document.querySelector('.editor') as HTMLTextAreaElement
    if (editorElement) {
      syncingRef.current = true
      editorElement.scrollTop = scrollPercentage * (editorElement.scrollHeight - editorElement.clientHeight)
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
              code: ({ node, inline, className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                const lang = match ? match[1] : ''

                if (lang === 'mermaid') {
                  return (
                    <div className="mermaid" suppressHydrationWarning>
                      {String(children).replace(/\n$/, '')}
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
