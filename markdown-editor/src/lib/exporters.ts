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
 * A self-contained HTML file: the preview markup plus a copy of every
 * stylesheet rule the page is using, so it renders identically offline.
 */
export function exportHtml(name: string, previewElement: HTMLElement, theme: 'light' | 'dark'): void {
  const styles = collectStyles()
  const title = baseName(name)
  const html = `<!doctype html>
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
${previewElement.innerHTML}
</article>
</body>
</html>`

  downloadText(`${title}.html`, html, 'text/html;charset=utf-8')
}

/** Same-origin stylesheets only; cross-origin rules throw on access. */
function collectStyles(): string {
  const chunks: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText)
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
