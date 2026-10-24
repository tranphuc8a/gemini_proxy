import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isExporting, subscribeExporting } from '../lib/previewController'

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null
let currentTheme: string | null = null

/** Loaded on first use so the 2 MB library stays out of the entry chunk. */
async function getMermaid(theme: 'light' | 'dark') {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => module.default)
  }
  const mermaid = await mermaidPromise
  const wanted = theme === 'dark' ? 'dark' : 'default'
  if (currentTheme !== wanted) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: wanted,
      fontFamily: 'inherit'
    })
    currentTheme = wanted
  }
  return mermaid
}

let idCounter = 0

type Rendered = { svg: string } | { error: string }

/**
 * Finished diagrams by theme and source (LRU, 100). A block that is rebuilt, a document that is reopened and a second
 * copy of the same diagram all take the result from here instead of asking Mermaid again, and show no flash of
 * "Rendering diagram…".
 */
const CACHE_MAX = 100
const cache = new Map<string, Rendered>()

function remember(key: string, result: Rendered) {
  cache.delete(key)
  cache.set(key, result)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
}

/** Test hook. */
export function resetMermaidCache() {
  cache.clear()
}

/** One diagram at a time: Mermaid measures in the page, and a dozen at once is a long task per diagram anyway. */
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

async function renderDiagram(key: string, source: string, theme: 'light' | 'dark'): Promise<Rendered> {
  const hit = cache.get(key)
  if (hit) return hit
  const id = `mermaid-${(idCounter += 1)}`
  let result: Rendered
  try {
    const mermaid = await getMermaid(theme)
    await mermaid.parse(source)
    result = { svg: (await mermaid.render(id, source)).svg }
  } catch (cause) {
    result = { error: cause instanceof Error ? cause.message : 'Could not render this diagram' }
  } finally {
    // mermaid.render leaves its measuring node behind when parsing throws.
    document.getElementById(`d${id}`)?.remove()
  }
  remember(key, result)
  return result
}

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
