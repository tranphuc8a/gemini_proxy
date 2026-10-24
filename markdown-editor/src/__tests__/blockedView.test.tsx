import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BlockedMarkdownView from '../components/BlockedMarkdownView'
import Preview from '../components/Preview'
import { revealIn, withFullRender } from '../lib/previewController'
import { collectPreviewAnchors, onJump } from '../lib/paneSync'
import { useEditorStore } from '../store'
import { longDoc } from '../test/longDoc'

const paragraphs = (count: number, tag = 'p') =>
  Array.from({ length: count }, (_, at) => `${tag}${at} text of the paragraph number ${at}`).join('\n\n')

describe('BlockedMarkdownView: only the block that changed renders again', () => {
  it('editing one paragraph renders one block', () => {
    const rendered: string[] = []
    const onBlockRender = (text: string) => rendered.push(text)
    const source = paragraphs(40)
    const { rerender, container } = render(<BlockedMarkdownView source={source} theme="light" onBlockRender={onBlockRender} />)
    expect(container.querySelectorAll('.md-block')).toHaveLength(40)
    expect(rendered).toHaveLength(40)
    rendered.length = 0

    rerender(<BlockedMarkdownView source={source.replace('number 17', 'number 17 EDITED')} theme="light" onBlockRender={onBlockRender} />)
    expect(rendered).toHaveLength(1)
    expect(rendered[0]).toContain('number 17 EDITED')
    expect(container.textContent).toContain('number 17 EDITED')
  })

  it('inserting a paragraph above renders only the new one (the rest keep their instance)', () => {
    const rendered: string[] = []
    const onBlockRender = (text: string) => rendered.push(text)
    const source = paragraphs(30)
    const { rerender, container } = render(<BlockedMarkdownView source={source} theme="light" onBlockRender={onBlockRender} />)
    const before = container.querySelectorAll('.md-block')[10]
    rendered.length = 0
    rerender(<BlockedMarkdownView source={`brand new\n\n${source}`} theme="light" onBlockRender={onBlockRender} />)
    expect(rendered).toEqual(['brand new\n'])
    expect(container.querySelectorAll('.md-block')).toHaveLength(31)
    expect(container.querySelectorAll('.md-block')[11]).toBe(before)
    // the wrapper that moved says where it is now
    expect(before.getAttribute('data-block-line')).toBe('23')
  })

  it('a link definition changing renders only the blocks that can use it', () => {
    const rendered: string[] = []
    const onBlockRender = (text: string) => rendered.push(text)
    const source = `${paragraphs(10)}\n\nA [link][x] here.\n\n[x]: https://a.test`
    const { rerender, container } = render(<BlockedMarkdownView source={source} theme="light" onBlockRender={onBlockRender} />)
    expect(container.querySelector('a[href="https://a.test"]')).not.toBeNull()
    rendered.length = 0
    rerender(<BlockedMarkdownView source={source.replace('a.test', 'b.test')} theme="light" onBlockRender={onBlockRender} />)
    expect(container.querySelector('a[href="https://b.test"]')).not.toBeNull()
    // the link block and the definition block (both hold a `[`), nothing else
    expect(rendered.length).toBeLessThanOrEqual(2)
  })

  it('a document with footnotes takes the whole-document path and renders as it always did', () => {
    const { container } = render(<BlockedMarkdownView source={'Text[^a].\n\nmore\n\n[^a]: the note'} theme="light" />)
    expect(container.querySelector('.md-block')).toBeNull()
    expect(container.querySelector('section[data-footnotes]')).not.toBeNull()
  })

  it('?render=full switches render-by-block off', () => {
    window.history.replaceState(null, '', '/?render=full')
    try {
      const { container } = render(<BlockedMarkdownView source={paragraphs(5)} theme="light" />)
      expect(container.querySelector('.md-block')).toBeNull()
      expect(container.querySelectorAll('p')).toHaveLength(5)
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('data-line stays relative to the block and the wrapper holds the first line', () => {
    const { container } = render(<BlockedMarkdownView source={'one\n\n# two\n\nthree\nfour\n\n- a\n- b'} theme="light" />)
    const wrappers = Array.from(container.querySelectorAll<HTMLElement>('.md-block'))
    expect(wrappers.map((w) => w.dataset.blockLine)).toEqual(['1', '3', '5', '8'])
    expect(wrappers.map((w) => (w.firstElementChild as HTMLElement).dataset.line)).toEqual(['1', '1', '1', '1'])
  })

  it('sanitising still holds: script and event handlers do not survive inside a block', () => {
    const { container } = render(<BlockedMarkdownView source={'<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>\n\nok'} theme="light" />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
  })
})

describe('BlockedMarkdownView: progressive building', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const pendingCount = (root: HTMLElement) => root.querySelectorAll('.md-block.is-pending').length

  it('builds a first screen, then the rest in slices, and reports progress', async () => {
    const source = paragraphs(120)
    const progress: Array<[number, number]> = []
    const { container } = render(
      <BlockedMarkdownView source={source} theme="light" progressive onProgress={(done, total) => progress.push([done, total])} />
    )
    const first = container.querySelectorAll('.md-block:not(.is-pending)').length
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(60)
    expect(pendingCount(container)).toBe(120 - first)
    expect(container.querySelector('.md-block.is-pending')!.getAttribute('style')).toContain('height')

    for (let tick = 0; tick < 400 && pendingCount(container) > 0; tick++) await act(async () => void vi.advanceTimersByTime(20))
    expect(pendingCount(container)).toBe(0)
    expect(container.querySelectorAll('.md-block')).toHaveLength(120)
    expect(progress[0][1]).toBe(120)
    expect(progress[progress.length - 1][0]).toBe(120)
    expect(progress.every(([done, total], at) => total === 120 && (at === 0 || done >= progress[at - 1][0]))).toBe(true)
  }, 30_000)

  it('a block the reader just wrote is built at once while the rest still waits', () => {
    const source = paragraphs(300)
    const { container, rerender } = render(<BlockedMarkdownView source={source} theme="light" progressive />)
    expect(pendingCount(container)).toBeGreaterThan(100)
    expect(container.textContent).not.toContain('number 250 TYPED')
    rerender(<BlockedMarkdownView source={source.replace('number 250', 'number 250 TYPED')} theme="light" progressive />)
    // the edited block is in the page now, though its neighbours are still placeholders
    expect(container.textContent).toContain('number 250 TYPED')
    expect(pendingCount(container)).toBeGreaterThan(100)
  })

  it('inserting a paragraph into a half-built document does not tear the built part down', async () => {
    const source = paragraphs(300)
    const { container, rerender } = render(<BlockedMarkdownView source={source} theme="light" progressive />)
    for (let tick = 0; tick < 6; tick++) await act(async () => void vi.advanceTimersByTime(20))
    const built = container.querySelectorAll('.md-block:not(.is-pending)').length
    rerender(<BlockedMarkdownView source={`added\n\n${source}`} theme="light" progressive />)
    expect(container.querySelectorAll('.md-block:not(.is-pending)').length).toBe(built + 1)
  })

  it('renderAll (exports, printing) builds everything and waits for the commit', async () => {
    const { container } = render(<BlockedMarkdownView source={paragraphs(200)} theme="light" progressive />)
    expect(pendingCount(container)).toBeGreaterThan(0)
    let seen = -1
    const done = withFullRender(() => {
      seen = pendingCount(container)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
      await done
    })
    expect(seen).toBe(0)
    expect(container.querySelectorAll('.md-block')).toHaveLength(200)
    expect(document.body.classList.contains('is-exporting')).toBe(false)
  })

  it('revealIn builds the block that holds a line, synchronously', () => {
    const source = paragraphs(300)
    const { container } = render(<BlockedMarkdownView source={source} theme="light" progressive />)
    const line = 2 * 250 + 1
    expect(container.querySelector(`.md-block[data-block-line="${line}"]`)!.classList.contains('is-pending')).toBe(true)
    act(() => void revealIn(container, { line }))
    expect(container.querySelector(`.md-block[data-block-line="${line}"]`)!.classList.contains('is-pending')).toBe(false)
    expect(pendingCount(container)).toBeGreaterThan(100)
    act(() => void revealIn(container, { all: true }))
    expect(pendingCount(container)).toBe(0)
    expect(revealIn(container, { all: true })).toBe(false)
  })

  it('headings built later still get their ids in document order', async () => {
    const source = Array.from({ length: 60 }, () => '## Same\n\ntext').join('\n\n')
    const { container } = render(<BlockedMarkdownView source={source} theme="light" progressive />)
    for (let tick = 0; tick < 300 && pendingCount(container) > 0; tick++) await act(async () => void vi.advanceTimersByTime(20))
    const ids = Array.from(container.querySelectorAll('h2')).map((h) => h.id)
    expect(ids).toHaveLength(60)
    expect(ids.slice(0, 3)).toEqual(['same', 'same-1', 'same-2'])
    expect(ids[59]).toBe('same-59')
  }, 30_000)
})

describe('Preview on render by block', () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null
    })) as unknown as typeof window.matchMedia
  })

  const open = (content: string) => useEditorStore.setState({ currentContent: content, isAdmin: true, scrollSync: false } as never)

  it('double-click jumps to the absolute source line', () => {
    open('one\n\ntwo\n\nthree\nfour\n\nfive')
    const { container } = render(<Preview />)
    const received: number[] = []
    const stop = onJump((event) => {
      if (event.source === 'preview') received.push(event.line)
    })
    // "three\nfour" is one paragraph that starts on line 5
    const target = Array.from(container.querySelectorAll('p')).find((p) => p.textContent?.startsWith('three'))!
    fireEvent.doubleClick(target)
    stop()
    expect(received).toEqual([5])
  })

  it('collects anchors from the block wrappers, with absolute lines', () => {
    const { container } = render(<BlockedMarkdownView source={'one\n\ntwo\n\nthree\nfour\n\n- a\n- b'} theme="light" />)
    const root = container as HTMLElement
    root.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
    let top = 0
    root.querySelectorAll<HTMLElement>('.md-block, .md-block > *').forEach((element) => {
      element.getBoundingClientRect = () => ({ top: (top += 10) }) as DOMRect
    })
    expect(collectPreviewAnchors(root).map((anchor) => anchor.line)).toEqual([1, 3, 5, 8])
  })

  it('ticking a task box in the preview edits the source line it came from', () => {
    open('intro\n\n- [ ] first\n\n- [ ] second')
    const { container } = render(<Preview />)
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    fireEvent.click(boxes[1])
    expect(useEditorStore.getState().currentContent).toBe('intro\n\n- [ ] first\n\n- [x] second')
  })

  it('a long document shows its first screen and builds the rest later', () => {
    open(longDoc('doc-2k').slice(0, 60_000))
    vi.useFakeTimers()
    try {
      const { container } = render(<Preview />)
      act(() => void vi.advanceTimersByTime(30))
      const all = container.querySelectorAll('.md-block').length
      expect(all).toBeGreaterThan(50)
      expect(container.querySelectorAll('.md-block:not(.is-pending)').length).toBeLessThan(all)
    } finally {
      vi.useRealTimers()
    }
  })
})
