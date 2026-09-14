/**
 * Getting a drawing out of the editor.
 *
 * JSON is the lossless format and the one to re-import. SVG is the vector
 * format; PNG and PDF are both rendered *from* that SVG rather than redrawn, so
 * an export can never disagree with what is on screen.
 *
 * PDF is written by hand -- about eighty lines -- rather than by pulling in
 * jsPDF. The page is one raster image, and a hand-written PDF for that case is
 * smaller than the dependency and has nothing to go stale.
 */

import type { GraphDocument } from '../types'
import { contentBounds } from './geometry'

export interface ExportOptions {
  /** Pixels per unit for the raster formats. */
  scale?: number
  background?: string
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Revoke late: revoking immediately can beat the download starting.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeName(title: string): string {
  const cleaned = title.trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-')
  return cleaned || 'graph'
}

export function exportJson(graph: GraphDocument): void {
  download(`${safeName(graph.title)}.json`, new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }))
}

/**
 * Serialise the live `<svg>` into a standalone document.
 *
 * `viewBox` is recomputed from the content rather than taken from the element:
 * the on-screen one follows the user's pan and zoom, and an export cropped to
 * wherever they happened to be scrolled is not what anybody wants.
 */
export function toSvgText(graph: GraphDocument, svg: SVGSVGElement, options: ExportOptions = {}): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const bounds = contentBounds(graph.nodes, graph.annotations, graph.defaults)

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)
  clone.setAttribute('width', String(Math.round(bounds.width)))
  clone.setAttribute('height', String(Math.round(bounds.height)))

  // Interaction-only layers would be noise in a file meant for a document.
  for (const node of clone.querySelectorAll('[data-export="skip"]')) node.remove()

  // The viewport transform belongs to the screen, not to the exported picture.
  const viewport = clone.querySelector('[data-viewport]')
  if (viewport) viewport.removeAttribute('transform')

  const background = options.background ?? '#0b1120'
  const rect =
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${background}"/>`
  clone.innerHTML = rect + clone.innerHTML

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
}

export function exportSvg(graph: GraphDocument, svg: SVGSVGElement, options?: ExportOptions): void {
  download(`${safeName(graph.title)}.svg`, new Blob([toSvgText(graph, svg, options)], { type: 'image/svg+xml' }))
}

/**
 * Rasterise the SVG.
 *
 * The SVG reaches the `Image` through a data: URL rather than a blob: URL:
 * a canvas that has drawn from a blob: URL is tainted in some browsers, and a
 * tainted canvas cannot be read back at all.
 */
export async function toCanvas(graph: GraphDocument, svg: SVGSVGElement, options: ExportOptions = {}): Promise<HTMLCanvasElement> {
  const scale = options.scale ?? 2
  const bounds = contentBounds(graph.nodes, graph.annotations, graph.defaults)
  const text = toSvgText(graph, svg, options)

  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Không dựng được ảnh từ SVG'))
    image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)))
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bounds.width * scale))
  canvas.height = Math.max(1, Math.round(bounds.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không hỗ trợ canvas 2D')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function exportPng(graph: GraphDocument, svg: SVGSVGElement, options?: ExportOptions): Promise<void> {
  const canvas = await toCanvas(graph, svg, options)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Không tạo được PNG')
  download(`${safeName(graph.title)}.png`, blob)
}

/**
 * A one-page PDF holding the drawing as a JPEG.
 *
 * PDF is a small format when the page is a single image: a catalogue, a pages
 * node, one page, one XObject and a content stream that paints it. The only
 * fiddly part is the cross-reference table, which must record each object's
 * byte offset exactly -- so the file is assembled as byte arrays and the
 * offsets are measured, never estimated.
 *
 * JPEG rather than PNG because `DCTDecode` is a filter every PDF reader has
 * built in; embedding a PNG would mean implementing the `FlateDecode` +
 * predictor path by hand.
 */
export async function exportPdf(graph: GraphDocument, svg: SVGSVGElement, options: ExportOptions = {}): Promise<void> {
  const canvas = await toCanvas(graph, svg, { ...options, scale: options.scale ?? 2, background: options.background ?? '#ffffff' })
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const jpeg = base64ToBytes(dataUrl.slice(dataUrl.indexOf(',') + 1))

  // Fit the image inside A4 (in PostScript points) with a 36pt margin.
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 36
  const available = { width: pageWidth - margin * 2, height: pageHeight - margin * 2 }
  const ratio = Math.min(available.width / canvas.width, available.height / canvas.height)
  const drawWidth = canvas.width * ratio
  const drawHeight = canvas.height * ratio
  const offsetX = (pageWidth - drawWidth) / 2
  const offsetY = (pageHeight - drawHeight) / 2

  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const startObject = () => { offsets.push(length) }

  push('%PDF-1.4\n')

  startObject()
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  startObject()
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  startObject()
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
    '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n'
  )

  startObject()
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  )
  push(jpeg)
  push('\nendstream\nendobj\n')

  // `cm` sets the transform; the unit square the image is painted into is then
  // scaled to the size worked out above.
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm\n/Im0 Do\nQ\n`
  startObject()
  push(`5 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`)

  const xrefOffset = length
  let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`
  push(xref)
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  const file = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    file.set(chunk, at)
    at += chunk.length
  }

  download(`${safeName(graph.title)}.pdf`, new Blob([file], { type: 'application/pdf' }))
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * DOT source, for anyone who wants to hand the graph to Graphviz.
 *
 * Positions are deliberately left out: the point of exporting to DOT is to let
 * Graphviz do the layout.
 */
export function toDot(graph: GraphDocument): string {
  const arrow = graph.directed ? '->' : '--'
  const quote = (value: string) => '"' + value.replace(/"/g, '\\"') + '"'
  const lines: string[] = [`${graph.directed ? 'digraph' : 'graph'} ${quote(graph.title)} {`]

  for (const node of graph.nodes) {
    const attributes = [`label=${quote(node.label || node.id)}`]
    if (node.shape) attributes.push(`shape=${node.shape === 'rounded' ? 'box' : node.shape === 'rect' ? 'box' : node.shape}`)
    lines.push(`  ${quote(node.id)} [${attributes.join(', ')}];`)
  }
  for (const edge of graph.edges) {
    const attributes: string[] = []
    const label = edge.label ?? (edge.weight !== undefined ? String(edge.weight) : undefined)
    if (label) attributes.push(`label=${quote(label)}`)
    if (edge.style && edge.style !== 'solid') attributes.push(`style=${edge.style}`)
    lines.push(`  ${quote(edge.source)} ${arrow} ${quote(edge.target)}${attributes.length ? ` [${attributes.join(', ')}]` : ''};`)
  }

  lines.push('}')
  return lines.join('\n')
}

export function exportDot(graph: GraphDocument): void {
  download(`${safeName(graph.title)}.dot`, new Blob([toDot(graph)], { type: 'text/vnd.graphviz' }))
}

/** Adjacency matrix as CSV — the form most coursework wants. */
export function toAdjacencyCsv(graph: GraphDocument): string {
  const ids = graph.nodes.map((node) => node.id)
  const index = new Map(ids.map((id, at) => [id, at]))
  const matrix = ids.map(() => ids.map(() => 0))

  for (const edge of graph.edges) {
    const from = index.get(edge.source)
    const to = index.get(edge.target)
    if (from === undefined || to === undefined) continue
    const value = edge.weight ?? 1
    matrix[from][to] = value
    if (!graph.directed) matrix[to][from] = value
  }

  const header = ['', ...graph.nodes.map((node) => node.label || node.id)].join(',')
  const rows = matrix.map((row, at) => [graph.nodes[at].label || graph.nodes[at].id, ...row].join(','))
  return [header, ...rows].join('\n')
}

export function exportAdjacencyCsv(graph: GraphDocument): void {
  download(`${safeName(graph.title)}-adjacency.csv`, new Blob([toAdjacencyCsv(graph)], { type: 'text/csv' }))
}
