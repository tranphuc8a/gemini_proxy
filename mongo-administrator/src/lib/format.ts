/** Small display helpers shared by the views. */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  let size = Number(value)
  if (size < 1024) return `${size} B`
  let unit = 0
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(digits)} ${BYTE_UNITS[unit]}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-US')
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

/** Uptime in seconds as the coarse "3d 4h" form a dashboard wants. */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const total = Math.max(0, Math.floor(Number(seconds)))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${total % 60}s`
  return `${total}s`
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return String(iso)
  return parsed.toLocaleString()
}

/** "1–50 of 1,204", or "1–50" when the count was skipped. */
export function formatRange(skip: number, shown: number, total: number): string {
  if (shown === 0) return total ? `0 of ${formatNumber(total)}` : '0'
  const from = skip + 1
  const to = skip + shown
  return total ? `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}` : `${formatNumber(from)}–${formatNumber(to)}`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

/** A one-line summary of what a write did, for the toast. */
export function describeMutation(result: {
  inserted?: number
  matched?: number
  modified?: number
  deleted?: number
  detail?: string | null
}): string {
  if (result.detail) return result.detail
  if (result.inserted) return pluralise(result.inserted, 'document') + ' inserted'
  if (result.deleted) return pluralise(result.deleted, 'document') + ' deleted'
  if (result.matched !== undefined) return `${result.matched} matched, ${result.modified ?? 0} modified`
  return 'Done'
}

/** Total document count is what the sidebar sorts and labels by. */
export function collectionLabel(count: number | null | undefined): string {
  return count === null || count === undefined ? '' : formatNumber(count)
}
