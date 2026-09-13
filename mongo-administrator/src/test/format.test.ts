import { describe, expect, it } from 'vitest'

import {
  describeMutation,
  formatBytes,
  formatDuration,
  formatNumber,
  formatRange,
  formatTimestamp,
  formatUptime,
  pluralise,
} from '../lib/format'

describe('formatBytes', () => {
  it('leaves small values in bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('scales through the units', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
  })

  it('respects the digit count', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB')
  })

  it('renders missing values as an em dash', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })
})

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(0)).toBe('0')
  })

  it('renders missing values as an em dash', () => {
    expect(formatNumber(null)).toBe('—')
  })
})

describe('formatDuration', () => {
  it('rounds milliseconds', () => {
    expect(formatDuration(12.4)).toBe('12 ms')
    expect(formatDuration(0.4)).toBe('<1 ms')
  })

  it('switches to seconds past a thousand', () => {
    expect(formatDuration(2500)).toBe('2.50 s')
  })

  it('renders missing values as an em dash', () => {
    expect(formatDuration(null)).toBe('—')
  })
})

describe('formatUptime', () => {
  it('picks the two coarsest useful units', () => {
    expect(formatUptime(90061)).toBe('1d 1h')
    expect(formatUptime(3661)).toBe('1h 1m')
    expect(formatUptime(61)).toBe('1m 1s')
    expect(formatUptime(45)).toBe('45s')
  })

  it('handles zero and missing values', () => {
    expect(formatUptime(0)).toBe('0s')
    expect(formatUptime(null)).toBe('—')
  })
})

describe('formatTimestamp', () => {
  it('returns the raw value when it is not a date', () => {
    expect(formatTimestamp('not a date')).toBe('not a date')
  })

  it('renders missing values as an em dash', () => {
    expect(formatTimestamp(null)).toBe('—')
  })

  it('formats a real timestamp', () => {
    expect(formatTimestamp('2026-09-13T00:00:00Z')).not.toBe('—')
  })
})

describe('formatRange', () => {
  it('describes the window inside a total', () => {
    expect(formatRange(0, 25, 1204)).toBe('1–25 of 1,204')
    expect(formatRange(50, 25, 1204)).toBe('51–75 of 1,204')
  })

  it('omits the total when counting was skipped', () => {
    expect(formatRange(0, 25, 0)).toBe('1–25')
  })

  it('handles an empty page', () => {
    expect(formatRange(0, 0, 0)).toBe('0')
    expect(formatRange(0, 0, 12)).toBe('0 of 12')
  })
})

describe('pluralise', () => {
  it('keeps the singular for exactly one', () => {
    expect(pluralise(1, 'document')).toBe('1 document')
    expect(pluralise(2, 'document')).toBe('2 documents')
    expect(pluralise(3, 'index', 'indexes')).toBe('3 indexes')
  })
})

describe('describeMutation', () => {
  it('prefers the server detail when there is one', () => {
    expect(describeMutation({ detail: 'Dropped database' })).toBe('Dropped database')
  })

  it('describes an insert', () => {
    expect(describeMutation({ inserted: 3 })).toBe('3 documents inserted')
  })

  it('describes a delete', () => {
    expect(describeMutation({ deleted: 1 })).toBe('1 document deleted')
  })

  it('describes an update', () => {
    expect(describeMutation({ matched: 2, modified: 1 })).toBe('2 matched, 1 modified')
  })

  it('falls back to something rather than nothing', () => {
    expect(describeMutation({})).toBe('Done')
  })
})
