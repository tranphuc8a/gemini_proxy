import { useMemo, useState } from 'react'
import { useEditorStore } from '../store'
import { extractHeadings } from '../lib/markdown'
import { emitJump } from '../lib/paneSync'
import { IconHash } from './Icons'
import './Outline.css'

function Outline() {
  const content = useEditorStore((state) => state.currentContent)
  const headings = useMemo(() => extractHeadings(content), [content])
  const [active, setActive] = useState<number | null>(null)

  if (headings.length === 0) {
    return (
      <p className="outline-empty">
        <IconHash size={15} />
        No headings yet. Start a line with <code># </code> to build an outline.
      </p>
    )
  }

  // Indent relative to the shallowest heading so a document that starts at
  // `##` is not pushed off to the right.
  const base = Math.min(...headings.map((heading) => heading.level))

  return (
    <nav className="outline" aria-label="Document outline">
      {headings.map((heading) => (
        <button
          key={`${heading.line}-${heading.slug}`}
          className={`outline-item level-${heading.level}${active === heading.line ? ' is-active' : ''}`}
          style={{ paddingLeft: 10 + (heading.level - base) * 12 }}
          onClick={() => {
            setActive(heading.line)
            emitJump({ line: heading.line, source: 'preview' })
            document.getElementById(heading.slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          title={heading.text}
        >
          <span className="outline-level">H{heading.level}</span>
          <span className="outline-text">{heading.text}</span>
        </button>
      ))}
    </nav>
  )
}

export default Outline
