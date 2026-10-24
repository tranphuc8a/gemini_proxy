/**
 * Mermaid, off the React tree: the library is loaded on first use, finished diagrams are cached by theme and source, and
 * diagrams render one at a time (MermaidDiagram.tsx decides when a diagram is near enough to be rendered).
 */
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

export type Rendered = { svg: string } | { error: string }

/**
 * Finished diagrams by theme and source (LRU, 100). A block that is rebuilt, a document that is reopened and a second
 * copy of the same diagram all take the result from here instead of asking Mermaid again, and show no flash of
 * "Rendering diagram…".
 */
const CACHE_MAX = 100
export const cache = new Map<string, Rendered>()

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
export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

export async function renderDiagram(key: string, source: string, theme: 'light' | 'dark'): Promise<Rendered> {
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
