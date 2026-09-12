import { useEffect, useRef, useState } from 'react'

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

interface MermaidDiagramProps {
  source: string
  theme: 'light' | 'dark'
}

/**
 * Renders through `mermaid.render`, which returns an SVG string instead of
 * mutating the node in place. The previous `mermaid.run` approach combined
 * with a ResizeObserver re-rendered itself in a loop, because each render
 * changed the node's size and re-triggered the observer.
 */
function MermaidDiagram({ source, theme }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${(idCounter += 1)}`

    const render = async () => {
      try {
        const mermaid = await getMermaid(theme)
        if (cancelled) return
        await mermaid.parse(source)
        const result = await mermaid.render(id, source)
        if (cancelled) return
        setSvg(result.svg)
        setError(null)
      } catch (cause) {
        if (cancelled) return
        setSvg(null)
        setError(cause instanceof Error ? cause.message : 'Could not render this diagram')
      } finally {
        // mermaid.render leaves its measuring node behind when parsing throws.
        document.getElementById(`d${id}`)?.remove()
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [source, theme])

  if (error) {
    return (
      <div className="mermaid-error" role="alert">
        <strong>Diagram error</strong>
        <pre>{error}</pre>
        <details>
          <summary>Source</summary>
          <pre>{source}</pre>
        </details>
      </div>
    )
  }

  if (!svg) {
    return <div className="mermaid-loading">Rendering diagram…</div>
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      role="img"
      aria-label="Diagram"
      // The SVG comes from mermaid itself, which is configured with
      // securityLevel 'strict' so labels in the source are escaped.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default MermaidDiagram
