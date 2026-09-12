import type { CellValue, ColumnInfo } from '../types'

/** Renders a cell for the grid. NULL is styled differently, so it is flagged. */
export function renderCell(value: CellValue): { text: string; isNull: boolean; isBinary: boolean } {
  if (value === null || value === undefined) return { text: 'NULL', isNull: true, isBinary: false }
  if (typeof value === 'object' && '__binary__' in value) {
    return { text: `[BLOB ${formatBytes(value.size)}]`, isNull: false, isBinary: true }
  }
  if (typeof value === 'boolean') return { text: value ? '1' : '0', isNull: false, isBinary: false }
  return { text: String(value), isNull: false, isBinary: false }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US')
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 0)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatUptime(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Right-align numeric columns the way a spreadsheet would. */
export function isNumericColumn(column: ColumnInfo | undefined): boolean {
  if (!column) return false
  return /^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|bit|year)$/i.test(
    column.data_type,
  )
}

export function columnBadge(column: ColumnInfo): string | null {
  if (column.key === 'PRI') return 'PK'
  if (column.key === 'UNI') return 'UQ'
  if (column.key === 'MUL') return 'IDX'
  return null
}

/** Truncates long cell text so one wide column cannot break the grid layout. */
export function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function pageRange(offset: number, limit: number, total: number): string {
  if (total === 0) return 'No rows'
  const first = offset + 1
  const last = Math.min(offset + limit, total)
  return `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)}`
}
