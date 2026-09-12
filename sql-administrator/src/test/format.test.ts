import { describe, expect, it } from 'vitest'

import {
  columnBadge,
  formatBytes,
  formatDuration,
  formatNumber,
  formatUptime,
  isNumericColumn,
  pageRange,
  renderCell,
  truncate,
} from '../lib/format'
import type { ColumnInfo } from '../types'

function column(overrides: Partial<ColumnInfo> = {}): ColumnInfo {
  return {
    name: 'id',
    data_type: 'int',
    column_type: 'int(11)',
    nullable: false,
    key: null,
    default: null,
    extra: '',
    comment: '',
    position: 1,
    ...overrides,
  }
}

describe('renderCell', () => {
  it('flags NULL', () => {
    expect(renderCell(null)).toEqual({ text: 'NULL', isNull: true, isBinary: false })
  })

  it('renders numbers and strings as text', () => {
    expect(renderCell(42).text).toBe('42')
    expect(renderCell('hello').text).toBe('hello')
  })

  it('renders booleans the way MySQL shows them', () => {
    expect(renderCell(true).text).toBe('1')
    expect(renderCell(false).text).toBe('0')
  })

  it('summarises a binary cell', () => {
    const rendered = renderCell({ __binary__: 'AA==', size: 2048 })
    expect(rendered.isBinary).toBe(true)
    expect(rendered.text).toBe('[BLOB 2.0 KB]')
  })

  it('keeps an empty string distinct from NULL', () => {
    expect(renderCell('')).toEqual({ text: '', isNull: false, isBinary: false })
  })
})

describe('formatBytes', () => {
  it('reports bytes below 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('scales to larger units', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB')
  })

  it('drops the decimal for large values', () => {
    expect(formatBytes(1024 * 1024 * 25)).toBe('25 MB')
  })

  it('renders a dash for unknown sizes', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })
})

describe('formatNumber and formatDuration', () => {
  it('groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('renders a dash for unknown numbers', () => {
    expect(formatNumber(null)).toBe('—')
  })

  it('uses milliseconds under a second', () => {
    expect(formatDuration(3.456)).toBe('3.46 ms')
    expect(formatDuration(250)).toBe('250 ms')
  })

  it('switches to seconds above a second', () => {
    expect(formatDuration(1500)).toBe('1.50 s')
  })
})

describe('formatUptime', () => {
  it('shows days and hours', () => {
    expect(formatUptime(90000)).toBe('1d 1h')
  })

  it('shows hours and minutes', () => {
    expect(formatUptime(3700)).toBe('1h 1m')
  })

  it('shows minutes alone', () => {
    expect(formatUptime(120)).toBe('2m')
  })

  it('renders a dash when unknown', () => {
    expect(formatUptime(null)).toBe('—')
  })
})

describe('column presentation', () => {
  it('treats integer and decimal columns as numeric', () => {
    expect(isNumericColumn(column({ data_type: 'bigint' }))).toBe(true)
    expect(isNumericColumn(column({ data_type: 'decimal' }))).toBe(true)
  })

  it('treats text columns as non-numeric', () => {
    expect(isNumericColumn(column({ data_type: 'varchar' }))).toBe(false)
    expect(isNumericColumn(undefined)).toBe(false)
  })

  it('badges keyed columns', () => {
    expect(columnBadge(column({ key: 'PRI' }))).toBe('PK')
    expect(columnBadge(column({ key: 'UNI' }))).toBe('UQ')
    expect(columnBadge(column({ key: 'MUL' }))).toBe('IDX')
    expect(columnBadge(column({ key: null }))).toBeNull()
  })
})

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('short')).toBe('short')
  })

  it('adds an ellipsis to long text', () => {
    expect(truncate('x'.repeat(200))).toHaveLength(161)
  })
})

describe('pageRange', () => {
  it('describes the visible slice', () => {
    expect(pageRange(0, 50, 120)).toBe('1–50 of 120')
    expect(pageRange(100, 50, 120)).toBe('101–120 of 120')
  })

  it('reports an empty table', () => {
    expect(pageRange(0, 50, 0)).toBe('No rows')
  })
})
