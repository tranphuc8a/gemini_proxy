import type { KeyValue } from '../types'

export function uid(prefix = ''): string {
  if (globalThis.crypto?.randomUUID) return prefix + globalThis.crypto.randomUUID()
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function kv(key = '', value = '', enabled = true): KeyValue {
  return { id: uid('kv_'), key, value, enabled }
}

/** Key/value rows as a plain object, skipping blank and disabled rows. */
export function kvToObject(rows: KeyValue[] | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows ?? []) {
    if (!row.enabled) continue
    const key = row.key.trim()
    if (key) out[key] = row.value
  }
  return out
}

export function objectToKv(obj: Record<string, unknown> | undefined): KeyValue[] {
  return Object.entries(obj ?? {}).map(([key, value]) => kv(key, String(value ?? '')))
}

/** A table always shows one blank row at the end so there is something to type into. */
export function withBlankRow(rows: KeyValue[]): KeyValue[] {
  const last = rows[rows.length - 1]
  if (last && !last.key && !last.value) return rows
  return [...rows, kv()]
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${units[i]}`
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'vừa xong'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function statusClass(status: number | string | undefined): string {
  const code = typeof status === 'number' ? status : parseInt(String(status ?? ''), 10)
  if (Number.isNaN(code)) return 'status-error'
  if (code < 300) return 'status-2xx'
  if (code < 400) return 'status-3xx'
  if (code < 500) return 'status-4xx'
  return 'status-5xx'
}

export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  // fromCharCode.apply overflows the call stack past ~100 kB, so chunk it.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64 || '')
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Decode using the charset the response declared, falling back to UTF-8. */
export function decodeBytes(bytes: Uint8Array, contentType = ''): string {
  const match = /charset=["']?([\w-]+)/i.exec(contentType)
  const charset = match?.[1]?.toLowerCase() || 'utf-8'
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

export function isTextualContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase()
  if (!ct) return true // no header at all: assume text, the usual case
  return (
    ct.startsWith('text/') ||
    ct.includes('json') ||
    ct.includes('xml') ||
    ct.includes('javascript') ||
    ct.includes('x-www-form-urlencoded') ||
    ct.includes('csv')
  )
}

/**
 * A copy of the bytes backed by a plain ArrayBuffer.
 *
 * Blob and the File APIs type their input as a view over ArrayBuffer, while a
 * Uint8Array may be backed by a SharedArrayBuffer. Copying once is cheaper than
 * casting the type away and being wrong about it later.
 */
export function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export function download(filename: string, data: BlobPart, mime = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // The clipboard API needs a secure context; plain http:// falls back here.
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  }
}

/** Subsequence match: "opnrq" finds "open request". */
export function fuzzy(haystack: string, needle: string): boolean {
  let i = 0
  for (const char of haystack) {
    if (char === needle[i]) i++
    if (i === needle.length) return true
  }
  return i === needle.length
}
