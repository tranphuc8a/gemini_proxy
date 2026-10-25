import { renderToStaticMarkup } from 'react-dom/server'
import MarkdownView from '../../components/MarkdownView'

/** A document rendered the way the preview renders it (MarkdownView → static HTML), as a DOM to query. */
export function render(md: string): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = renderToStaticMarkup(<MarkdownView source={md} theme="light" />)
  return div
}

export function htmlOf(md: string): string {
  return renderToStaticMarkup(<MarkdownView source={md} theme="light" />)
}
