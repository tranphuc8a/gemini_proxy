/**
 * All export helpers. The heavy libraries (html2canvas, jsPDF) are imported
 * lazily so they stay out of the initial bundle.
 */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

/** Strips an extension and any character a filesystem would reject. */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'document'
}

export function exportMarkdown(name: string, content: string): void {
  downloadText(`${baseName(name)}.md`, content, 'text/markdown;charset=utf-8')
}

/**
 * Resolves every `url(…)` of `css` against `base` (the address of the stylesheet the rules came from), leaving `data:`,
 * `#fragment` and already absolute addresses alone. Rules copied out of a stylesheet into another document lose the
 * stylesheet's location: KaTeX's `url(fonts/KaTeX_Main.woff2)` would otherwise be looked up next to the exported file
 * and never found. Scans with `indexOf`, so a stylesheet of nothing but `url(` stays linear.
 */
export function absolutizeCssUrls(css: string, base: string): string {
  if (!/url\(/i.test(css)) return css
  const open = /url\(/gi
  let out = ''
  let last = 0
  for (let match = open.exec(css); match; match = open.exec(css)) {
    let at = match.index + match[0].length
    while (at < css.length && /\s/.test(css[at])) at++
    const quote = css[at] === '"' || css[at] === "'" ? css[at] : ''
    const from = quote ? at + 1 : at
    const close = css.indexOf(quote || ')', from)
    if (close === -1) break
    const target = quote ? css.slice(from, close) : css.slice(from, close).trim()
    const end = quote ? css.indexOf(')', close + 1) : close
    if (end === -1) break
    if (target && !/^(?:data:|#|about:|blob:|[a-z][a-z0-9+.-]*:)/i.test(target)) {
      try {
        out += `${css.slice(last, match.index)}url("${new URL(target, base).href}")`
        last = end + 1
      } catch {
        /* leave it as it was */
      }
    }
    open.lastIndex = end + 1
  }
  return out + css.slice(last)
}

/** Most the embedded fonts may add to an exported page. */
export const EMBED_FONT_BUDGET = 320_000

/**
 * Turns the `@font-face` sources of the KaTeX fonts in `css` into data URLs (woff2 only; the other formats of a source
 * list are dropped once one is embedded), so the exported page shows its formulas with no network at all. `load` gets
 * an absolute address and answers the bytes as a data URL, or null when it cannot; the budget bounds the total size
 * (fonts beyond it keep their address). Async because fetching is.
 */
export async function embedFontFaces(css: string, load: (url: string) => Promise<string | null>, budget = EMBED_FONT_BUDGET): Promise<string> {
  const face = /@font-face\s*\{[^}]*\}/g
  const parts: string[] = []
  let last = 0
  let used = 0
  for (let match = face.exec(css); match; match = face.exec(css)) {
    parts.push(css.slice(last, match.index))
    last = match.index + match[0].length
    const rule = match[0]
    const woff2 = /url\(\s*["']?([^"')\s]+\.woff2)["']?\s*\)\s*format\(\s*["']woff2["']\s*\)/i.exec(rule)
    if (!woff2 || !/KaTeX/i.test(rule) || /^data:/i.test(woff2[1]) || used >= budget) {
      parts.push(rule)
      continue
    }
    const data = await load(woff2[1])
    if (!data || used + data.length > budget) {
      parts.push(rule)
      continue
    }
    used += data.length
    parts.push(rule.replace(/src\s*:[^;}]*/i, `src:url("${data}") format("woff2")`))
  }
  parts.push(css.slice(last))
  return parts.join('')
}

export interface HtmlExportOptions {
  /** Put the KaTeX fonts inside the file (about 300 KB) so it renders formulas with no network. */
  embedFonts?: boolean
}

/** The whole exported page, from the pieces. Pure. */
export function buildHtmlDocument(title: string, theme: 'light' | 'dark', styles: string, body: string): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${styles}
body { margin: 0; padding: 40px 24px; background: var(--bg); }
.markdown-body { max-width: 860px; margin: 0 auto; }
</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>`
}

/** A font file as a data URL, or null. */
async function loadFont(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * A self-contained HTML file: the preview markup plus a copy of every
 * stylesheet rule the page is using, so it renders identically offline.
 * Font and image addresses in those rules are made absolute (see `absolutizeCssUrls`), so the file still finds
 * KaTeX's fonts when opened with a network; `embedFonts` removes that dependency.
 */
export async function exportHtml(name: string, previewElement: HTMLElement, theme: 'light' | 'dark', options: HtmlExportOptions = {}): Promise<void> {
  let styles = collectStyles()
  if (options.embedFonts && previewElement.querySelector('.katex')) styles = await embedFontFaces(styles, loadFont)
  const title = baseName(name)
  downloadText(`${title}.html`, buildHtmlDocument(title, theme, styles, previewElement.innerHTML), 'text/html;charset=utf-8')
}

/** Same-origin stylesheets only; cross-origin rules throw on access. */
function collectStyles(): string {
  const chunks: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    const base = sheet.href || document.baseURI
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(absolutizeCssUrls(rule.cssText, base))
    } catch {
      /* cross-origin sheet, skip */
    }
  }
  return chunks.join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

interface CaptureOptions {
  background: string
  scale?: number
}

async function capture(element: HTMLElement, options: CaptureOptions): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  return html2canvas(element, {
    backgroundColor: options.background,
    scale: options.scale ?? Math.min(2, window.devicePixelRatio || 1),
    useCORS: true,
    // A tainted canvas cannot be read back, so an unreachable remote image
    // must not take the whole export down with it.
    logging: false,
    onclone: (doc) => {
      doc.querySelectorAll('img').forEach((img) => {
        img.crossOrigin = 'anonymous'
      })
    }
  })
}

export async function exportImage(name: string, element: HTMLElement, format: 'png' | 'jpeg', background: string): Promise<void> {
  const canvas = await capture(element, { background })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${format}`, 0.95))
  if (!blob) throw new Error('Could not encode the image')
  downloadBlob(`${baseName(name)}.${format === 'jpeg' ? 'jpg' : 'png'}`, blob)
}

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 12

/**
 * Slices the captured canvas into page-sized tiles instead of re-drawing the
 * whole image on every page with a negative offset, which made multi-page
 * exports grow quadratically and cut lines in half.
 */
export async function exportPdf(name: string, element: HTMLElement, background: string): Promise<void> {
  const canvas = await capture(element, { background, scale: 2 })
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2
  const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2
  const pxPerMm = canvas.width / contentWidthMm
  const pageHeightPx = Math.floor(contentHeightMm * pxPerMm)

  const slice = document.createElement('canvas')
  const context = slice.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  slice.width = canvas.width

  let offset = 0
  let page = 0
  while (offset < canvas.height) {
    const height = Math.min(pageHeightPx, canvas.height - offset)
    slice.height = height
    context.fillStyle = background
    context.fillRect(0, 0, slice.width, height)
    context.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height)

    if (page > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, MARGIN_MM, contentWidthMm, height / pxPerMm)

    offset += height
    page += 1
  }

  pdf.save(`${baseName(name)}.pdf`)
}

/** Copy that still works on http:// origins, where the Clipboard API is absent. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* fall through to the textarea fallback */
    }
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
