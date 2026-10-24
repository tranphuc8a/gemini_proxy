/**
 * Heading ids for a document rendered block by block.
 *
 * A block cannot know how many headings with the same text came before it, so in block mode `rehypeEnhance` marks each
 * heading with `data-slug` (the slug alone), leaves `id` out and gives its anchor the first-occurrence href; `assignHeadingIds` then walks the
 * rendered headings in document order and gives them the ids the outline panel and reading mode look up -- the same
 * `-n` suffix rule as `extractHeadings` and as `rehypeEnhance` uses on a whole document. React never owns `id`/`href`
 * (they are not props), so it does not overwrite them.
 */

/** `a`, `a-1`, `a-2` … for repeated slugs, in order. */
export function dedupeSlugs(slugs: readonly string[]): string[] {
  const seen = new Map<string, number>()
  return slugs.map((base) => {
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  })
}

/** Sets `id` (and the anchor's `href`) on these headings, which must be in document order. */
export function assignIds(headings: ArrayLike<HTMLElement>, prefix: string): void {
  const ids = dedupeSlugs(Array.from(headings, (heading) => heading.dataset.slug ?? ''))
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]
    const id = prefix + ids[index]
    if (heading.id !== id) heading.id = id
    const anchor = heading.firstElementChild
    if (anchor instanceof HTMLAnchorElement && anchor.classList.contains('heading-anchor')) {
      const href = `#${id}`
      if (anchor.getAttribute('href') !== href) anchor.setAttribute('href', href)
    }
  }
}

/** Sets `id` (and the anchor's `href`) on every `[data-slug]` heading under `root`; returns how many it visited. */
export function assignHeadingIds(root: ParentNode, prefix: string): number {
  const headings = root.querySelectorAll<HTMLElement>('[data-slug]')
  assignIds(headings, prefix)
  return headings.length
}
