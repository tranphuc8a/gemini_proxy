import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { flushSync } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import { blockIndexAtLine, blockSource, splitBlocks, type MdBlock, type SplitResult } from '../lib/blocks'
import { assignIds } from '../lib/headingIds'
import { markdownComponents, rehypePlugins, remarkPlugins, type LinkPolicy } from '../lib/markdownPipeline'
import { prepareBlock } from '../lib/prepareMarkdown'
import { markdownUrlTransform } from '../lib/rehypeEnhance'
import { estimatedHeightEm, initialBlocks, nextBatch, orderFrom } from '../lib/progressive'
import { REVEAL_EVENT, registerPreview, type RevealDetail } from '../lib/previewController'
import MarkdownView from './MarkdownView'

/** The time one slice of background building aims to take, and the pause that follows it so input stays responsive. */
const SLICE_BUDGET_MS = 20
const SLICE_PAUSE_MS = 4
/** While the document is still being built, heading ids and the owner's `onBuilt` follow at most this often. */
const SETTLE_MS = 600
/** A change that makes this many blocks new at once is another document (or a big paste), not typing. */
const FRESH_BLOCK_RUN = 24

/** `?render=full` renders the whole document in one piece, as before render-by-block (a switch for comparing). */
function forceWholeRender(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('render') === 'full'
  } catch {
    return false
  }
}

/** The nearest ancestor that scrolls, or null. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const overflow = window.getComputedStyle(parent).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return parent
  }
  return null
}

export interface BlockedMarkdownViewProps {
  source: string
  theme: 'light' | 'dark'
  codeBackground?: string
  idPrefix?: string
  links?: LinkPolicy
  /** Build the document in slices, nearest the reader first; off, every block is built at once. */
  progressive?: boolean
  /** Hold the background slices (a view hidden under another one); blocks being written still build at once. */
  paused?: boolean
  /** After a commit that built more of the document: the blocks built so far and the total. */
  onProgress?: (built: number, total: number) => void
  /** After blocks were added to the page (headings and heights have moved); while building, at most every 600 ms. */
  onBuilt?: () => void
  /** Test hook: called each time a block is rendered by React. */
  onBlockRender?: (text: string) => void
}

interface BlockProps {
  text: string
  /** The block opens the document: the only one that may hold front matter. */
  first: boolean
  remark: ReturnType<typeof remarkPlugins>
  rehype: ReturnType<typeof rehypePlugins>
  components: ReturnType<typeof markdownComponents>
  report: React.MutableRefObject<((text: string) => void) | undefined>
}

/** One block through the one pipeline; re-rendered only when its text (or the theme, …) changes. */
const MarkdownBlock = memo(
  function MarkdownBlock({ text, first, remark, rehype, components, report }: BlockProps) {
    report.current?.(text)
    return (
      <ReactMarkdown remarkPlugins={remark} rehypePlugins={rehype} components={components} urlTransform={markdownUrlTransform}>
        {prepareBlock(text, first).text}
      </ReactMarkdown>
    )
  },
  (a, b) => a.text === b.text && a.first === b.first && a.remark === b.remark && a.rehype === b.rehype && a.components === b.components
)

/** The remark plugins of a block: they carry the block's own `display`/`generated` offsets, so one per text. */
const remarkCache = new Map<string, ReturnType<typeof remarkPlugins>>()
function remarkFor(text: string, first: boolean): ReturnType<typeof remarkPlugins> {
  const key = first ? `1|${text}` : `0|${text}`
  let plugins = remarkCache.get(key)
  if (!plugins) {
    plugins = remarkPlugins(prepareBlock(text, first))
    remarkCache.set(key, plugins)
    if (remarkCache.size > 4000) {
      let drop = 1000
      for (const key of remarkCache.keys()) {
        remarkCache.delete(key)
        if (--drop <= 0) break
      }
    }
  }
  return plugins
}

interface BlocksProps extends Omit<BlockedMarkdownViewProps, 'source'> {
  split: SplitResult
}

function Blocks({ split, theme, codeBackground, idPrefix = '', links = 'app', progressive = false, paused = false, onProgress, onBuilt, onBlockRender }: BlocksProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  /** Keys of the blocks that are in the page; the rest are placeholders. */
  const built = useRef(new Set<string>())
  /** Keys of the previous split: a key not in it is a block the reader just wrote. */
  const previous = useRef<Set<string> | null>(null)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const report = useRef(onBlockRender)
  report.current = onBlockRender
  const latest = useRef({ split, onProgress, onBuilt })
  latest.current = { split, onProgress, onBuilt }
  /** The batch the last slice asked for, to time it. */
  const lastBatch = useRef<{ at: number; count: number } | null>(null)
  const average = useRef(4)
  const waiters = useRef<Array<() => void>>([])
  const changed = useRef(true)
  /** A block was written (not just built): heading ids are due at once. */
  const edited = useRef(true)
  const idsAt = useRef(Number.NEGATIVE_INFINITY)
  const idsPrefix = useRef<string | null>(null)
  const builtTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Each built block's headings, found once per block text instead of by walking the whole page. */
  const headingCache = useRef(new WeakMap<Element, { key: string; list: HTMLElement[] }>())
  /** The build order, kept until the reader scrolls or the document changes. */
  const order = useRef<{ for: SplitResult; list: number[] } | null>(null)
  const scrolled = useRef(true)

  const components = useMemo(() => markdownComponents({ theme, codeBackground, links }), [theme, codeBackground, links])
  const rehype = useMemo(() => rehypePlugins({ idPrefix, blockMode: true }), [idPrefix])

  // Which blocks exist in the page this render. Idempotent, so a repeated render (StrictMode) changes nothing.
  const { blocks } = split
  const keys = new Set<string>()
  for (const block of blocks) keys.add(block.key)
  const fresh = previous.current ? blocks.filter((block) => !previous.current!.has(block.key)).length : blocks.length
  if (fresh > 0) edited.current = true
  if (!progressive) {
    for (const block of blocks) built.current.add(block.key)
  } else if (!previous.current || fresh >= FRESH_BLOCK_RUN) {
    // First paint of this document, another document, or a big paste: with nothing of it in the page yet only what the
    // reader will see first is built; a paste into a built document leaves the rest as it is and builds the new blocks
    // in the next slices, nearest the reader first.
    if (!blocks.some((block) => built.current.has(block.key))) {
      built.current.clear()
      for (const index of initialBlocks(blocks.map((block) => block.end - block.start + 1))) built.current.add(blocks[index].key)
      changed.current = true
    }
  } else if (fresh > 0) {
    // The reader is typing: their block is built at once, whatever else is still waiting.
    for (const block of blocks) if (!previous.current.has(block.key)) built.current.add(block.key)
  }
  if (built.current.size > keys.size) for (const key of Array.from(built.current)) if (!keys.has(key)) built.current.delete(key)
  previous.current = keys
  const pending = blocks.reduce((count, block) => count + (built.current.has(block.key) ? 0 : 1), 0)

  /** Heading ids, in document order, from each block's own headings (cached per block). */
  const assignIdsNow = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const wrappers = root.children
    const all = latest.current.split.blocks
    const headings: HTMLElement[] = []
    for (let index = 0; index < all.length && index < wrappers.length; index++) {
      const wrapper = wrappers[index] as HTMLElement
      if (wrapper.classList.contains('is-pending')) continue
      let hit = headingCache.current.get(wrapper)
      if (!hit || hit.key !== all[index].key) {
        hit = { key: all[index].key, list: Array.from(wrapper.querySelectorAll<HTMLElement>('[data-slug]')) }
        headingCache.current.set(wrapper, hit)
      }
      for (const heading of hit.list) headings.push(heading)
    }
    assignIds(headings, idsPrefix.current ?? '')
    idsAt.current = performance.now()
    edited.current = false
  }, [])

  // After every commit: ids for the headings, the cost of the last slice, and what the owner wants to know.
  useLayoutEffect(() => {
    // While the document is being built the ids follow every ~600 ms; after an edit, and at the end, at once.
    const prefixChanged = idsPrefix.current !== idPrefix
    idsPrefix.current = idPrefix
    if (prefixChanged || pending === 0 || edited.current || performance.now() - idsAt.current > SETTLE_MS) assignIdsNow()

    const batch = lastBatch.current
    if (batch) {
      lastBatch.current = null
      const per = (performance.now() - batch.at) / batch.count
      average.current = average.current * 0.5 + per * 0.5
    }
    if (changed.current) {
      changed.current = false
      latest.current.onProgress?.(blocks.length - pending, blocks.length)
      const fire = () => {
        builtTimer.current = undefined
        latest.current.onBuilt?.()
      }
      if (pending === 0) {
        clearTimeout(builtTimer.current)
        fire()
      } else if (builtTimer.current === undefined) {
        builtTimer.current = setTimeout(fire, SETTLE_MS)
      }
    }
    if (pending === 0 && waiters.current.length) {
      const done = waiters.current
      waiters.current = []
      done.forEach((resolve) => resolve())
    }
  })
  useEffect(() => () => clearTimeout(builtTimer.current), [])

  /** Marks the build order stale when the reader scrolls the area this view sits in. */
  useEffect(() => {
    const root = rootRef.current
    const scroller = root ? scrollParent(root) : null
    if (!scroller) return
    const onScroll = () => {
      scrolled.current = true
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  /** The index of the block at the top of the scroll area (what is being viewed), for the build order. */
  const viewedIndex = useCallback((): number => {
    const root = rootRef.current
    if (!root) return 0
    const scroller = scrollParent(root)
    if (!scroller) return 0
    const top = scroller.getBoundingClientRect().top
    const children = root.children
    let low = 0
    let high = children.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if (children[middle].getBoundingClientRect().top <= top + 4) low = middle
      else high = middle - 1
    }
    return low
  }, [])

  // Background slices until every block is built.
  useEffect(() => {
    if (!progressive || paused || pending === 0) return
    const timer = setTimeout(() => {
      const current = latest.current.split
      const all = current.blocks
      if (scrolled.current || !order.current || order.current.for !== current) {
        order.current = { for: current, list: orderFrom(viewedIndex(), all.length) }
        scrolled.current = false
      }
      const batch = nextBatch(order.current.list, (index) => built.current.has(all[index].key), SLICE_BUDGET_MS, average.current)
      if (batch.length === 0) return
      for (const index of batch) built.current.add(all[index].key)
      lastBatch.current = { at: performance.now(), count: batch.length }
      changed.current = true
      // A transition: a key press can interrupt the render of a slice.
      startTransition(rerender)
    }, SLICE_PAUSE_MS)
    return () => clearTimeout(timer)
  })

  const buildAll = useCallback(() => {
    const all = latest.current.split.blocks
    let added = false
    for (const block of all) {
      if (!built.current.has(block.key)) {
        built.current.add(block.key)
        added = true
      }
    }
    if (added) changed.current = true
    return added
  }, [])

  // Exports and printing: everything, now.
  useEffect(
    () =>
      registerPreview({
        renderAll: () =>
          new Promise<void>((resolve) => {
            if (!buildAll()) return resolve()
            waiters.current.push(resolve)
            rerender()
          })
      }),
    [buildAll]
  )
  useEffect(
    () => () => {
      waiters.current.forEach((resolve) => resolve())
      waiters.current = []
    },
    []
  )

  // `revealIn`: a heading link or the contents wants an element that may sit in a block not built yet.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onReveal = (event: Event) => {
      const detail = (event as CustomEvent<RevealDetail>).detail ?? {}
      const all = latest.current.split.blocks
      let added = false
      if (detail.all || detail.line === undefined) added = buildAll()
      else {
        const block = all[blockIndexAtLine(all, detail.line)]
        if (block && !built.current.has(block.key)) {
          built.current.add(block.key)
          added = true
          changed.current = true
          edited.current = true
        }
      }
      if (added) {
        edited.current = true
        flushSync(rerender)
      }
    }
    root.addEventListener(REVEAL_EVENT, onReveal)
    return () => root.removeEventListener(REVEAL_EVENT, onReveal)
  }, [buildAll])

  // Printing from the browser's own menu cannot wait: build the rest synchronously.
  useEffect(() => {
    const onBeforePrint = () => {
      if (buildAll()) {
        edited.current = true
        flushSync(rerender)
      }
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [buildAll])

  const { defs } = split
  return (
    <div ref={rootRef} className="md-blocks">
      {blocks.map((block: MdBlock) => {
        if (!built.current.has(block.key)) {
          return (
            <div
              key={block.key}
              className="md-block is-pending"
              data-block-line={block.start}
              style={{ height: `${estimatedHeightEm(block.end - block.start + 1)}em` }}
            />
          )
        }
        const text = block.needsDefs && defs ? blockSource(block, defs) : block.text
        return (
          <div key={block.key} className="md-block" data-block-line={block.start}>
            <MarkdownBlock text={text} first={block.start === 1 && text.startsWith('---')} remark={remarkFor(text, block.start === 1 && text.startsWith('---'))} rehype={rehype} components={components} report={report} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * The preview and reading mode's renderer: the document cut into blocks (lib/blocks.ts), each rendered through the one
 * pipeline and kept by its text, so an edit re-renders the block it touched. Footnotes number across the whole
 * document and cannot be split, so a document with footnotes (or `?render=full`) takes the old whole-document path.
 */
function BlockedMarkdownView(props: BlockedMarkdownViewProps) {
  const { source, theme, codeBackground, idPrefix, links } = props
  const whole = useMemo(() => forceWholeRender(), [])
  const split = useMemo(() => (whole ? null : splitBlocks(source)), [source, whole])
  if (!split || split.needsWhole) return <MarkdownView source={source} theme={theme} codeBackground={codeBackground} idPrefix={idPrefix} links={links} />
  return <Blocks {...props} split={split} />
}

export default memo(BlockedMarkdownView)
