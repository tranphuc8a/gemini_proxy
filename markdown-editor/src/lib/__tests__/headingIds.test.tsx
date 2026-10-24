import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BlockedMarkdownView from '../../components/BlockedMarkdownView'
import MarkdownView from '../../components/MarkdownView'
import { assignHeadingIds, dedupeSlugs } from '../headingIds'
import { extractHeadings } from '../markdown'
import { longDoc } from '../../test/longDoc'

describe('dedupeSlugs', () => {
  it('numbers repeats the way extractHeadings does', () => {
    expect(dedupeSlugs(['a', 'b', 'a', 'a', 'b', 'c'])).toEqual(['a', 'b', 'a-1', 'a-2', 'b-1', 'c'])
    const doc = longDoc('doc-2k')
    const headings = extractHeadings(doc)
    const base = headings.map((heading) => heading.slug.replace(/-\d+$/, ''))
    // The slugs extractHeadings made are exactly what dedupeSlugs makes from the bases (a base ending in -n aside).
    expect(dedupeSlugs(headings.map((heading) => heading.slug.replace(/-(\d+)$/, '')))).toEqual(headings.map((heading) => heading.slug))
    void base
  })
})

describe('assignHeadingIds', () => {
  it('sets id and href on data-slug headings in document order', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<h2 data-slug="a"><a class="heading-anchor">#</a>A</h2><p>x</p><h2 data-slug="a"><a class="heading-anchor">#</a>A</h2><h3 data-slug="b"><a class="heading-anchor">#</a>B</h3>'
    expect(assignHeadingIds(root, 'p-')).toBe(3)
    const headings = Array.from(root.querySelectorAll('h2, h3'))
    expect(headings.map((h) => h.id)).toEqual(['p-a', 'p-a-1', 'p-b'])
    expect(headings.map((h) => h.querySelector('a')!.getAttribute('href'))).toEqual(['#p-a', '#p-a-1', '#p-b'])
  })

  it('the block renderer gives the ids the whole-document renderer gives, prefix included', () => {
    const doc = '# Intro\n\ntext\n\n## Part\n\n- a\n\n## Part\n\nmore\n\n# Intro\n\n## Part\n'
    for (const idPrefix of ['', 'reading-']) {
      const whole = render(<MarkdownView source={doc} theme="light" idPrefix={idPrefix} />).container
      const blocks = render(<BlockedMarkdownView source={doc} theme="light" idPrefix={idPrefix} />).container
      const ids = (root: HTMLElement) => Array.from(root.querySelectorAll('h1, h2, h3')).map((h) => [h.id, h.querySelector('a')!.getAttribute('href')])
      expect(ids(blocks)).toEqual(ids(whole))
      expect(ids(blocks).length).toBe(5)
    }
  })

  it('the ids follow the headings when a block is edited and the order changes', () => {
    const { container, rerender } = render(<BlockedMarkdownView source={'# A\n\nx\n\n# A\n'} theme="light" />)
    expect(Array.from(container.querySelectorAll('h1')).map((h) => h.id)).toEqual(['a', 'a-1'])
    rerender(<BlockedMarkdownView source={'# A\n\nx\n\n# B\n\n# A\n'} theme="light" />)
    expect(Array.from(container.querySelectorAll('h1')).map((h) => h.id)).toEqual(['a', 'b', 'a-1'])
  })
})
