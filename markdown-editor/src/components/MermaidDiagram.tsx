import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isExporting, subscribeExporting } from '../lib/previewController'
import { cache, enqueue, renderDiagram, type Rendered } from '../lib/mermaidRender'


/** The nearest ancestor that scrolls: the observer must clip against it, not only against the window. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const overflow = window.getComputedStyle(parent).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return parent
  }
  return null
}

/** How far outside the scroll area a diagram starts rendering. */
const NEAR_MARGIN = '1000px'

interface MermaidDiagramProps {
  source: string
  theme: 'light' | 'dark'
}

/**
 * Renders through `mermaid.render`, which returns an SVG string instead of
 * mutating the node in place. The previous `mermaid.run` approach combined
 * with a ResizeObserver re-rendered itself in a loop, because each render
 * changed the node's size and re-triggered the observer.
 *
 * A diagram renders when it is within `NEAR_MARGIN` of the scroll area (or at once when exporting or printing,
 * previewController.ts), one at a time, and the result is cached by theme and source.
 */
function MermaidDiagram({ source, theme }: MermaidDiagramProps) {
  const key = `${theme}\0${source}`
  const waitingRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ key: string; result: Rendered } | null>(null)
  const exporting = useSyncExternalStore(subscribeExporting, isExporting, () => false)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  const result = cache.get(key) ?? (state?.key === key ? state.result : undefined)
  const wanted = result === undefined && (near || exporting)

  // Wait for the reader to come near.
  useEffect(() => {
    const element = waitingRef.current
    if (result !== undefined || near || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { root: scrollParent(element), rootMargin: NEAR_MARGIN }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [result, near])

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    void enqueue(() => renderDiagram(key, source, theme)).then((rendered) => {
      if (!cancelled) setState({ key, result: rendered })
    })
    return () => {
      cancelled = true
    }
  }, [wanted, key, source, theme])

  if (result && 'error' in result) {
    return (
      <div className="mermaid-error" role="alert">
        <strong>Diagram error</strong>
        <pre>{result.error}</pre>
        <details>
          <summary>Source</summary>
          <pre>{source}</pre>
        </details>
      </div>
    )
  }

  if (!result) {
    return (
      <div ref={waitingRef} className={wanted ? 'mermaid-loading' : 'mermaid-loading is-waiting'}>
        Rendering diagram…
      </div>
    )
  }

  return (
    <div
      className="mermaid-diagram"
      role="img"
      aria-label="Diagram"
      // The SVG comes from mermaid itself, which is configured with
      // securityLevel 'strict' so labels in the source are escaped.
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  )
}

export default MermaidDiagram
