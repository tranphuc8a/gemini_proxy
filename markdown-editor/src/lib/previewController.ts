/**
 * What an export or a print needs from a preview that builds itself in pieces (perf-md tasks 9 and 10, batch M5).
 *
 * The preview renders a long document block by block, and the blocks off screen are either not built yet or have
 * `content-visibility: auto`; Mermaid diagrams wait for the reader to come near. Exporters read the rendered DOM, so
 * they run inside `withFullRender`: every registered view builds all its blocks, diagrams render at once (`isExporting`
 * switches their wait off), KaTeX's fonts are loaded, and `.is-exporting` on <body> turns `content-visibility` off.
 */

export interface PreviewHandle {
  /** Builds every block; resolves once they are in the DOM. */
  renderAll(): Promise<void>
}

const views = new Set<PreviewHandle>()
const listeners = new Set<() => void>()
let exporting = 0

export function registerPreview(view: PreviewHandle): () => void {
  views.add(view)
  return () => {
    views.delete(view)
  }
}

export function isExporting(): boolean {
  return exporting > 0
}

/** For `useSyncExternalStore`. */
export function subscribeExporting(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Resolves when no diagram is still rendering (a waiting one renders at once while exporting), or after `maxMs`. */
export async function waitForDiagrams(maxMs = 30_000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (document.querySelector('.mermaid-loading') && Date.now() < deadline) await sleep(40)
}

async function fontsReady(): Promise<void> {
  try {
    await document.fonts?.ready
  } catch {
    // No font loading API: nothing to wait for.
  }
}

/** Builds every block and diagram, then runs `action` with the preview complete (blocks, diagrams, KaTeX fonts). */
export async function withFullRender<T>(action: () => Promise<T> | T): Promise<T> {
  exporting += 1
  document.body.classList.add('is-exporting')
  notify()
  try {
    await Promise.all(Array.from(views, (view) => view.renderAll()))
    await waitForDiagrams()
    await fontsReady()
    // One more frame so the last commit is laid out.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return await action()
  } finally {
    exporting -= 1
    if (exporting === 0) document.body.classList.remove('is-exporting')
    notify()
  }
}

/** Print or save as PDF: the whole document, not the part that happens to be built. */
export function printDocument(): Promise<void> {
  return withFullRender(() => {
    window.print()
  })
}

/** `mdb-reveal`: asks the block view that contains `element` to build a pending block (or all of them). */
export const REVEAL_EVENT = 'mdb-reveal'
export interface RevealDetail {
  line?: number
  all?: boolean
}

/**
 * Builds the pending block holding source `line` (or every pending block) inside `scope`, synchronously, so an element
 * in it can be found right away. False when nothing was pending.
 */
export function revealIn(scope: Element, detail: RevealDetail): boolean {
  const target = scope.querySelector('.md-block.is-pending')
  if (!target) return false
  target.dispatchEvent(new CustomEvent<RevealDetail>(REVEAL_EVENT, { bubbles: true, detail }))
  return true
}

/**
 * Keeps a long jump on its target while the page settles. Far from the viewport the height of a block is an estimate
 * (placeholders, `content-visibility`), so one `scrollTo` lands short once the blocks near the target get their real size.
 * Re-aims every frame for `maxMs`, and stops at once if the reader takes over (wheel, touch, key, pointer).
 */
export function settleScroll(
  scroller: HTMLElement,
  target: HTMLElement,
  offset = 0,
  onAdjust?: (top: number) => void,
  maxMs = 900
): void {
  const start = performance.now()
  let cancelled = false
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
  const stop = () => {
    cancelled = true
    for (const name of events) scroller.removeEventListener(name, stop)
  }
  for (const name of events) scroller.addEventListener(name, stop, { passive: true, once: true })
  const step = () => {
    if (cancelled || !target.isConnected || !scroller.isConnected) return stop()
    const wanted = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset
    const top = Math.min(Math.max(0, wanted), scroller.scrollHeight - scroller.clientHeight)
    if (Math.abs(top - scroller.scrollTop) > 2) {
      onAdjust?.(top)
      scroller.scrollTo({ top, behavior: 'auto' })
    }
    if (performance.now() - start < maxMs) requestAnimationFrame(step)
    else stop()
  }
  requestAnimationFrame(step)
}
