import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { markdownUrlTransform } from '../lib/rehypeEnhance'
import { markdownComponents, rehypePlugins, remarkPlugins, type LinkPolicy } from '../lib/markdownPipeline'
import { prepareMarkdown } from '../lib/prepareMarkdown'

interface MarkdownViewProps {
  source: string
  /** Picks the highlighter and Mermaid palettes. */
  theme: 'light' | 'dark'
  /** Background behind code blocks; when set, token colours are held to 4.5:1 against it. */
  codeBackground?: string
  /** Prepended to heading ids, for a second rendering of the same document on the page. */
  idPrefix?: string
  /** `shared` on a read-only link's page (dead internal links, no-referrer images); default `app`. */
  links?: LinkPolicy
}

/**
 * Renders a document through the one Markdown pipeline (lib/markdownPipeline.ts): the preview pane, reading mode
 * and the Smart-format preview all use it, so a document reads the same in each. Sanitised before display, since a
 * file can come from the shared backend and be read anonymously.
 */
function MarkdownView({ source, theme, codeBackground, idPrefix = '', links = 'app' }: MarkdownViewProps) {
  // Line-preserving rewrites (LLM maths delimiters…) happen before parsing; the plugins after it need their notes.
  const prepared = useMemo(() => prepareMarkdown(source), [source])
  const remark = useMemo(() => remarkPlugins(prepared), [prepared])
  const rehype = useMemo(() => rehypePlugins({ idPrefix }), [idPrefix])
  const components = useMemo(() => markdownComponents({ theme, codeBackground, links }), [theme, codeBackground, links])

  return (
    <ReactMarkdown remarkPlugins={remark} rehypePlugins={rehype} components={components} urlTransform={markdownUrlTransform}>
      {prepared.text}
    </ReactMarkdown>
  )
}

export default memo(MarkdownView)
