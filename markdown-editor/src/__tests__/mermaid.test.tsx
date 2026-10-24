import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MermaidDiagram from '../components/MermaidDiagram'
import { resetMermaidCache } from '../lib/mermaidRender'
import { withFullRender } from '../lib/previewController'

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(async () => true),
  render: vi.fn(async (_id: string, source: string) => ({ svg: `<svg data-source="${source}"></svg>` }))
}))
vi.mock('mermaid', () => ({ default: mermaid }))

/** An IntersectionObserver the test drives by hand. */
class FakeObserver {
  static all: FakeObserver[] = []
  disconnected = false
  constructor(
    private callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {
    FakeObserver.all.push(this)
  }
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
  disconnect() {
    this.disconnected = true
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

describe('MermaidDiagram', () => {
  beforeEach(() => {
    resetMermaidCache()
    mermaid.render.mockClear()
    mermaid.parse.mockClear()
    FakeObserver.all = []
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for the reader to come near before it renders, and says it is waiting', async () => {
    const { container } = render(<MermaidDiagram source="graph TD;A-->B" theme="light" />)
    expect(container.querySelector('.mermaid-loading.is-waiting')).not.toBeNull()
    await act(async () => void (await Promise.resolve()))
    expect(mermaid.render).not.toHaveBeenCalled()
    expect(FakeObserver.all[0].options?.rootMargin).toBe('1000px')

    await act(async () => FakeObserver.all[0].fire(false))
    expect(mermaid.render).not.toHaveBeenCalled()

    await act(async () => FakeObserver.all[0].fire(true))
    await waitFor(() => expect(container.querySelector('.mermaid-diagram')).not.toBeNull())
    expect(mermaid.render).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.mermaid-loading')).toBeNull()
  })

  it('a second mount of the same source takes the result from the cache: no render, no flash', async () => {
    const first = render(<MermaidDiagram source="graph TD;X-->Y" theme="light" />)
    await act(async () => FakeObserver.all[0].fire(true))
    await waitFor(() => expect(first.container.querySelector('.mermaid-diagram')).not.toBeNull())
    first.unmount()
    mermaid.render.mockClear()

    const second = render(<MermaidDiagram source="graph TD;X-->Y" theme="light" />)
    expect(second.container.querySelector('.mermaid-diagram')).not.toBeNull()
    expect(screen.queryByText('Rendering diagram…')).toBeNull()
    await act(async () => void (await Promise.resolve()))
    expect(mermaid.render).not.toHaveBeenCalled()
  })

  it('another theme is another cache entry', async () => {
    const light = render(<MermaidDiagram source="graph TD;T-->U" theme="light" />)
    await act(async () => FakeObserver.all[0].fire(true))
    await waitFor(() => expect(light.container.querySelector('.mermaid-diagram')).not.toBeNull())
    light.unmount()
    mermaid.render.mockClear()
    const dark = render(<MermaidDiagram source="graph TD;T-->U" theme="dark" />)
    expect(dark.container.querySelector('.mermaid-diagram')).toBeNull()
    await act(async () => FakeObserver.all[FakeObserver.all.length - 1].fire(true))
    await waitFor(() => expect(dark.container.querySelector('.mermaid-diagram')).not.toBeNull())
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it('renders one diagram at a time, in order', async () => {
    let running = 0
    let peak = 0
    const order: string[] = []
    mermaid.render.mockImplementation(async (_id: string, source: string) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push(source)
      running -= 1
      return { svg: '<svg></svg>' }
    })
    const { container } = render(
      <>
        <MermaidDiagram source="graph TD;1-->2" theme="light" />
        <MermaidDiagram source="graph TD;3-->4" theme="light" />
        <MermaidDiagram source="graph TD;5-->6" theme="light" />
      </>
    )
    await act(async () => FakeObserver.all.forEach((observer) => observer.fire(true)))
    await waitFor(() => expect(container.querySelectorAll('.mermaid-diagram')).toHaveLength(3))
    expect(peak).toBe(1)
    expect(order).toEqual(['graph TD;1-->2', 'graph TD;3-->4', 'graph TD;5-->6'])
    mermaid.render.mockImplementation(async (_id: string, source: string) => ({ svg: `<svg data-source="${source}"></svg>` }))
  })

  it('exporting renders a diagram that is still waiting', async () => {
    const { container } = render(<MermaidDiagram source="graph TD;E-->F" theme="light" />)
    expect(container.querySelector('.mermaid-loading.is-waiting')).not.toBeNull()
    let seen: number | null = null
    const exported = withFullRender(() => {
      seen = container.querySelectorAll('.mermaid-diagram').length
    })
    await waitFor(() => expect(container.querySelector('.mermaid-diagram')).not.toBeNull())
    await exported
    expect(seen).toBe(1)
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it('a diagram that fails shows the error and the source, and the error is remembered too', async () => {
    mermaid.parse.mockRejectedValueOnce(new Error('Parse error on line 1'))
    const { container, unmount } = render(<MermaidDiagram source="not a diagram" theme="light" />)
    await act(async () => FakeObserver.all[0].fire(true))
    await waitFor(() => expect(container.querySelector('.mermaid-error')).not.toBeNull())
    expect(container.textContent).toContain('Parse error on line 1')
    unmount()
    mermaid.parse.mockClear()
    const again = render(<MermaidDiagram source="not a diagram" theme="light" />)
    expect(again.container.querySelector('.mermaid-error')).not.toBeNull()
    expect(mermaid.parse).not.toHaveBeenCalled()
  })

  it('without IntersectionObserver (old browsers, jsdom) it renders at once', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<MermaidDiagram source="graph TD;N-->O" theme="light" />)
    await waitFor(() => expect(container.querySelector('.mermaid-diagram')).not.toBeNull())
  })
})
