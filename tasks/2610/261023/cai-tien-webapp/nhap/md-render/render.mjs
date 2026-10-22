// Render markdown through the SAME pipeline as markdown-editor/src/components/MarkdownView.tsx
// (react-markdown 9 + remark-gfm + remark-math + rehype-raw + rehypeEnhance + rehype-sanitize(schema) + rehype-katex)
// Mermaid/CodeBlock are replaced by marker elements so we can see what reaches them.
import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { markdownUrlTransform, rehypeEnhance, sanitizeSchema } from './gen/rehypeEnhance.mjs'

export function render(source, extra = {}) {
  const components = {
    code: ({ node, className, children, ...props }) => {
      const match = /language-([\w-]+)/.exec(className ?? '')
      const language = match?.[1] ?? ''
      const code = String(children).replace(/\n$/, '')
      if (!language) return h('code', { className, ...props }, children)
      if (language === 'mermaid') return h('div', { 'data-component': 'MermaidDiagram' }, code)
      return h('div', { 'data-component': 'CodeBlock', 'data-lang': language }, code)
    },
    pre: ({ children }) => h(Fragment, null, children)
  }
  const remarkPlugins = extra.remarkPlugins ?? [remarkGfm, remarkMath]
  const rehypePlugins = extra.rehypePlugins ?? [rehypeRaw, [rehypeEnhance, { idPrefix: '' }], [rehypeSanitize, sanitizeSchema], rehypeKatex]
  return renderToStaticMarkup(
    h(ReactMarkdown, { remarkPlugins, rehypePlugins, components, urlTransform: markdownUrlTransform }, source)
  )
}
