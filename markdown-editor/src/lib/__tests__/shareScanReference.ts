import { classifyHref, type DocumentRefs } from '../share'

/**
 * The regex-based `scanDocumentRefs` as it was in M3 (before M3V made it linear), kept ONLY as the oracle of the fuzz test:
 * the linear scanner must answer exactly what this does on every input small enough for it to finish. It is quadratic on
 * a line of `[` (and on repeated `<a `), which is why it was replaced; never import it from the app.
 *
 * Differences that are deliberate and NOT fuzzed (the alphabet has no backtick, `~` or `\r`):
 * - inline code spans follow CommonMark (a run closes with the next run of the same length) instead of the old regex.
 */
function withoutFencedCode(markdown: string): string {
  const lines = markdown.split('\n')
  let fence: string | null = null
  const kept: string[] = []
  for (const line of lines) {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && line.trim() === open[1]) fence = null
      kept.push('')
      continue
    }
    if (open) {
      fence = open[1]
      kept.push('')
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}

function cleanTarget(raw: string): string {
  let target = raw.trim()
  if (target.startsWith('<')) {
    const close = target.indexOf('>')
    return close > 0 ? target.slice(1, close) : target.slice(1)
  }
  const space = target.search(/\s/)
  if (space > 0) target = target.slice(0, space)
  return target
}

export function referenceScanDocumentRefs(markdown: string): DocumentRefs {
  const text = withoutFencedCode(markdown)
  const refs: DocumentRefs = { internalLinks: [], relativeImages: [], externalImages: [], dataImages: 0 }
  const image = (src: string) => {
    if (/^data:image\//i.test(src)) refs.dataImages += 1
    else if (classifyHref(src) === 'external') refs.externalImages.push(src)
    else if (classifyHref(src) === 'internal') refs.relativeImages.push(src)
  }
  const link = (href: string) => {
    if (classifyHref(href) === 'internal') refs.internalLinks.push(href)
  }
  const inline = /(!?)\[(?:[^\]\\\n]|\\.)*\]\(([^()\n]*(?:\([^()\n]*\)[^()\n]*)*)\)/g
  for (let match = inline.exec(text); match; match = inline.exec(text)) {
    const target = cleanTarget(match[2])
    if (match[1]) image(target)
    else link(target)
  }
  const anchor = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  for (let match = anchor.exec(text); match; match = anchor.exec(text)) link(match[1] ?? match[2] ?? match[3] ?? '')
  const img = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  for (let match = img.exec(text); match; match = img.exec(text)) image(match[1] ?? match[2] ?? match[3] ?? '')
  return refs
}
