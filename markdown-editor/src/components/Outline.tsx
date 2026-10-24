import { useMemo, useState } from 'react'
import { useEditorStore } from '../store'
import { extractHeadings } from '../lib/markdown'
import { emitJump } from '../lib/paneSync'
import { revealIn } from '../lib/previewController'
import { useIdleValue } from '../hooks/useIdleValue'
import { IconHash } from './Icons'
import './Outline.css'

function Outline() {
  const content = useEditorStore((state) => state.currentContent)
  // Rebuilt once typing pauses: on a long document every keystroke re-drew hundreds of entries.
  const fileId = useEditorStore((state) => state.currentFileId)
  // Another file: its own headings at once -- a stale entry would jump to a heading that is not there.
  const settled = useIdleValue(content, 300, fileId)
  const headings = useMemo(() => extractHeadings(settled), [settled])
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
            // In the small-screen drawer, the drawer is in the way of the jump.
            useEditorStore.getState().setDrawerOpen(false)
            emitJump({ line: heading.line, source: 'preview' })
            // The preview builds a long document in pieces: the heading's block is built first, so there is an element to go to.
            const preview = document.querySelector<HTMLElement>('.preview-scroll .markdown-body')
            if (preview) revealIn(preview, { line: heading.line })
            const target = document.getElementById(heading.slug)
            if (target) {
              // Far away, the preview's height is still an estimate (blocks and content-visibility settle as they come into
              // view), so a long glide would end short of the heading: go there at once, then again once layout has settled.
              const scroller = target.closest<HTMLElement>('.preview-scroll')
              const far = !scroller || Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) > scroller.clientHeight * 3
              target.scrollIntoView({ behavior: far ? 'auto' : 'smooth', block: 'start' })
              if (far) {
                requestAnimationFrame(() => {
                  target.scrollIntoView({ behavior: 'auto', block: 'start' })
                  requestAnimationFrame(() => target.scrollIntoView({ behavior: 'auto', block: 'start' }))
                })
              }
            }
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
