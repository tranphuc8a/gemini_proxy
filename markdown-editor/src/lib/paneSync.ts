/**
 * A tiny bus that lets the editor and preview follow each other by *source
 * line* rather than by scroll percentage. Percentages drift badly as soon as a
 * document mixes prose with tall blocks such as tables or diagrams.
 */
export type Pane = 'editor' | 'preview'

export interface ScrollSyncEvent {
  /** 1-based source line now at the top of the originating pane. */
  line: number
  source: Pane
}

export interface JumpEvent {
  line: number
  /** The pane asking for focus; the other one performs the jump. */
  source: Pane
}

type Listener<T> = (event: T) => void

const scrollListeners = new Set<Listener<ScrollSyncEvent>>()
const jumpListeners = new Set<Listener<JumpEvent>>()

export function emitScrollSync(event: ScrollSyncEvent): void {
  scrollListeners.forEach((listener) => listener(event))
}

export function onScrollSync(listener: Listener<ScrollSyncEvent>): () => void {
  scrollListeners.add(listener)
  return () => scrollListeners.delete(listener)
}

export function emitJump(event: JumpEvent): void {
  jumpListeners.forEach((listener) => listener(event))
}

export function onJump(listener: Listener<JumpEvent>): () => void {
  jumpListeners.add(listener)
  return () => jumpListeners.delete(listener)
}

/**
 * Guards against the ping-pong where pane A scrolls pane B, whose own scroll
 * handler then scrolls A back. Set while applying a remote scroll.
 */
export function createSyncLock(windowMs = 120) {
  let until = 0
  return {
    engage() {
      until = Date.now() + windowMs
    },
    get locked() {
      return Date.now() < until
    }
  }
}

export interface LineAnchor {
  line: number
  top: number
}

/**
 * Interpolates a pixel offset for `line` from sparse anchors. Anchors must be
 * sorted by line. Between two anchors the position is interpolated linearly so
 * scrolling inside a long paragraph still tracks smoothly.
 */
export function offsetForLine(anchors: LineAnchor[], line: number): number {
  if (anchors.length === 0) return 0
  if (line <= anchors[0].line) return anchors[0].top

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index]
    const next = anchors[index + 1]
    if (line >= current.line && line <= next.line) {
      const span = next.line - current.line
      if (span === 0) return current.top
      const ratio = (line - current.line) / span
      return current.top + ratio * (next.top - current.top)
    }
  }

  return anchors[anchors.length - 1].top
}

/** The inverse of `offsetForLine`: which source line sits at `top`. */
export function lineForOffset(anchors: LineAnchor[], top: number): number {
  if (anchors.length === 0) return 1
  if (top <= anchors[0].top) return anchors[0].line

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index]
    const next = anchors[index + 1]
    if (top >= current.top && top <= next.top) {
      const span = next.top - current.top
      if (span === 0) return current.line
      const ratio = (top - current.top) / span
      return Math.round(current.line + ratio * (next.line - current.line))
    }
  }

  return anchors[anchors.length - 1].line
}

/** Reads `data-line` anchors out of a rendered preview. */
export function collectPreviewAnchors(container: HTMLElement): LineAnchor[] {
  const anchors: LineAnchor[] = []
  const elements = container.querySelectorAll<HTMLElement>('[data-line]')
  const containerTop = container.getBoundingClientRect().top - container.scrollTop

  elements.forEach((element) => {
    const line = Number(element.dataset.line)
    if (!Number.isFinite(line)) return
    const top = element.getBoundingClientRect().top - containerTop
    const previous = anchors[anchors.length - 1]
    // Keep anchors monotonic; nested blocks can report a smaller line.
    if (previous && line <= previous.line) return
    anchors.push({ line, top })
  })

  return anchors
}
