import { memo, useMemo } from 'react'
import ReactMarkdown, { type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { markdownUrlTransform, rehypeEnhance, sanitizeSchema } from '../lib/rehypeEnhance'
import MermaidDiagram from './MermaidDiagram'
import CodeBlock from './CodeBlock'
// Without this stylesheet KaTeX output renders as unstyled spans.
import 'katex/dist/katex.min.css'

const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, remarkMath]

function rehypePlugins(idPrefix: string): Options['rehypePlugins'] {
  return [rehypeRaw, [rehypeEnhance, { idPrefix }], [rehypeSanitize, sanitizeSchema], rehypeKatex]
}

interface MarkdownViewProps {
  source: string
  /** Picks the highlighter and Mermaid palettes. */
  theme: 'light' | 'dark'
  /** Background behind code blocks; when set, token colours are held to 4.5:1 against it. */
  codeBackground?: string
  /** Prepended to heading ids, for a second rendering of the same document on the page. */
  idPrefix?: string
}

/**
 * The one Markdown pipeline: the preview pane and reading mode both render
 * through it, so a document reads the same in each. Sanitised before display,
 * since a file can come from the shared backend and be read anonymously.
 */
function MarkdownView({ source, theme, codeBackground, idPrefix = '' }: MarkdownViewProps) {
  const plugins = useMemo(() => rehypePlugins(idPrefix), [idPrefix])
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
        const code = String(children).replace(/\n$/, '')

        if (!language) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
        if (language === 'mermaid') return <MermaidDiagram source={code} theme={theme} />
        return <CodeBlock language={language} source={code} theme={theme} contrastBackground={codeBackground} />
      },
      // The highlighter brings its own wrapper, so the default <pre> would
      // nest a second scroll container around it.
      pre: ({ children }: any) => <>{children}</>
    }),
    [theme, codeBackground]
  )

  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={plugins} components={components} urlTransform={markdownUrlTransform}>
      {source}
    </ReactMarkdown>
  )
}

export default memo(MarkdownView)
