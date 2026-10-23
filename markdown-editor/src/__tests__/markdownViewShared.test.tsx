import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MarkdownView from '../components/MarkdownView'

/**
 * md-share V9: the same pipeline renders a read-only link's page, with `links='shared'`. Links to the owner's other
 * documents become text, images load without a referrer, nothing can be ticked -- and the sanitiser still strips
 * everything active. `links='app'` (the default) keeps the editor's behaviour.
 */
function render(md: string, links?: 'app' | 'shared'): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = renderToStaticMarkup(<MarkdownView source={md} theme="light" links={links} />)
  return div
}

const DOC = [
  '# Title',
  '',
  '[other doc](khac.md) · [root path](/duong-dan) · [web](https://example.com) · [mail](mailto:a@b.c) · [section](#title)',
  '',
  '[evil](javascript:window.__xss=3)',
  '',
  '![pic](./a.png) ![remote](https://img.example/b.png) ![inline](data:image/png;base64,iVBORw0KGgo=)',
  '',
  '- [ ] task',
  '- [x] done',
  '',
  '<script>window.__xss=1</script>',
  '<img src="x" onerror="window.__xss=2">',
  '<iframe src="https://example.com"></iframe>',
  '<a href="javascript:alert(1)">raw evil</a>'
].join('\n')

describe("MarkdownView links='shared'", () => {
  const root = render(DOC, 'shared')

  it('turns links to other documents into plain text with an explanation', () => {
    const dead = Array.from(root.querySelectorAll('span.md-dead-link'))
    const texts = dead.map((node) => node.textContent)
    expect(texts).toEqual(expect.arrayContaining(['other doc', 'root path']))
    expect(dead[0].getAttribute('title')).toMatch(/isn't part of this share/)
    expect(root.querySelector('a[href="khac.md"]')).toBeNull()
    expect(root.querySelector('a[href="/duong-dan"]')).toBeNull()
  })

  it('keeps external links in a new tab without opener or referrer, and anchors as they are', () => {
    const web = root.querySelector<HTMLAnchorElement>('a[href="https://example.com"]')!
    expect(web.target).toBe('_blank')
    expect(web.rel).toContain('noopener')
    expect(web.rel).toContain('noreferrer')
    expect(root.querySelector('a[href="mailto:a@b.c"]')).not.toBeNull()
    const anchor = root.querySelector<HTMLAnchorElement>('a[href="#title"]')!
    expect(anchor.target).toBe('')
  })

  it('leaves no javascript: link anywhere', () => {
    expect(root.innerHTML).not.toMatch(/javascript:/i)
    expect(Array.from(root.querySelectorAll('span.md-dead-link')).map((node) => node.textContent)).toContain('evil')
  })

  it('strips script, event handlers and iframes', () => {
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('iframe')).toBeNull()
    expect(root.innerHTML).not.toMatch(/onerror/i)
    expect(root.innerHTML).not.toContain('__xss')
  })

  it('shows remote and data images without a referrer, and a placeholder for relative ones', () => {
    const images = Array.from(root.querySelectorAll('img'))
    const sources = images.map((img) => img.getAttribute('src'))
    expect(sources).toContain('https://img.example/b.png')
    expect(sources.some((src) => src?.startsWith('data:image/png'))).toBe(true)
    expect(sources).not.toContain('./a.png')
    for (const img of images.filter((node) => node.getAttribute('src') !== 'x')) expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(root.querySelector('span.md-missing-image')?.textContent).toBe('[image: pic]')
  })

  it('disables task boxes', () => {
    const boxes = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    expect(boxes).toHaveLength(2)
    for (const box of boxes) expect(box.disabled).toBe(true)
  })
})

describe("MarkdownView links='app' (default) is unchanged", () => {
  const root = render(DOC)

  it('keeps links to other documents as links in a new tab', () => {
    const other = root.querySelector<HTMLAnchorElement>('a[href="khac.md"]')!
    expect(other).not.toBeNull()
    expect(other.target).toBe('_blank')
    expect(root.querySelector('span.md-dead-link')).toBeNull()
  })

  it('keeps relative images and enabled task boxes', () => {
    expect(root.querySelector('img[src="./a.png"]')).not.toBeNull()
    expect(root.querySelector('span.md-missing-image')).toBeNull()
    for (const box of Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) expect(box.disabled).toBe(false)
  })
})
