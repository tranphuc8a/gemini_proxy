import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_READING_SETTINGS,
  READING_FONT,
  READING_KEY,
  activeHeadingIndex,
  clampFontSize,
  clampLineHeight,
  hasReadFlag,
  isReadingShortcut,
  loadReadingSettings,
  measureFor,
  minutesLeft,
  normalizeReadingSettings,
  readingProgress,
  readingTimeLabel,
  saveReadingSettings,
  withReadFlag
} from '../reading'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('clamping', () => {
  it('keeps the text size inside the supported range, in whole pixels', () => {
    expect(clampFontSize(2)).toBe(READING_FONT.min)
    expect(clampFontSize(99)).toBe(READING_FONT.max)
    expect(clampFontSize(17.6)).toBe(18)
  })

  it('falls back to the default for unusable numbers', () => {
    expect(clampFontSize(Number.NaN)).toBe(DEFAULT_READING_SETTINGS.fontSize)
    expect(clampLineHeight(Number.POSITIVE_INFINITY)).toBe(DEFAULT_READING_SETTINGS.lineHeight)
  })

  it('bounds the line height and rounds it to two decimals', () => {
    expect(clampLineHeight(0.5)).toBe(1.3)
    expect(clampLineHeight(9)).toBe(2.2)
    expect(clampLineHeight(1.7777)).toBe(1.78)
  })

  it('maps each column width to an em measure', () => {
    expect(measureFor('narrow')).toBe('30em')
    expect(measureFor('medium')).toBe('36em')
    expect(measureFor('wide')).toBe('46em')
  })
})

describe('normalizeReadingSettings', () => {
  it('keeps good fields and repairs bad ones one by one', () => {
    expect(normalizeReadingSettings({ fontSize: 500, lineHeight: 'tall', width: 'wide', theme: 'neon' })).toEqual({
      ...DEFAULT_READING_SETTINGS,
      fontSize: READING_FONT.max,
      width: 'wide'
    })
  })

  it('returns the fallback for anything that is not an object', () => {
    const fallback = { ...DEFAULT_READING_SETTINGS, theme: 'dark' as const }
    expect(normalizeReadingSettings(null, fallback)).toEqual(fallback)
    expect(normalizeReadingSettings('x', fallback)).toEqual(fallback)
  })

  it('ignores unknown keys', () => {
    expect(normalizeReadingSettings({ isAdmin: true, fontSize: 20 })).not.toHaveProperty('isAdmin')
  })
})

describe('persistence', () => {
  it('round-trips through its own namespaced key', () => {
    expect(saveReadingSettings({ fontSize: 22, lineHeight: 2, width: 'narrow', theme: 'sepia' })).toBe(true)
    expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toMatchObject({ version: 1, fontSize: 22, theme: 'sepia' })
    expect(loadReadingSettings()).toEqual({ fontSize: 22, lineHeight: 2, width: 'narrow', theme: 'sepia' })
  })

  it('clamps what it stores, so a bad caller cannot persist nonsense', () => {
    saveReadingSettings({ fontSize: 400, lineHeight: 0, width: 'medium', theme: 'light' })
    expect(loadReadingSettings()).toMatchObject({ fontSize: READING_FONT.max, lineHeight: 1.3 })
  })

  it('uses the app theme until the reader has chosen one', () => {
    expect(loadReadingSettings('dark').theme).toBe('dark')
    saveReadingSettings({ ...DEFAULT_READING_SETTINGS, theme: 'sepia' })
    expect(loadReadingSettings('dark').theme).toBe('sepia')
  })

  it('survives unparsable storage', () => {
    localStorage.setItem(READING_KEY, '{nope')
    expect(loadReadingSettings()).toEqual(DEFAULT_READING_SETTINGS)
  })

  it('keeps working when storage throws (private mode, quota)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(loadReadingSettings('dark')).toEqual({ ...DEFAULT_READING_SETTINGS, theme: 'dark' })
    expect(saveReadingSettings(DEFAULT_READING_SETTINGS)).toBe(false)
  })
})

describe('progress and time left', () => {
  it('measures how far through the scrollable range the reader is', () => {
    expect(readingProgress(0, 2000, 500)).toBe(0)
    expect(readingProgress(750, 2000, 500)).toBe(0.5)
    expect(readingProgress(1500, 2000, 500)).toBe(1)
  })

  it('clamps overscroll and treats a page that fits as fully read', () => {
    expect(readingProgress(-40, 2000, 500)).toBe(0)
    expect(readingProgress(1600, 2000, 500)).toBe(1)
    expect(readingProgress(0, 400, 500)).toBe(1)
    expect(readingProgress(0, 0, 0)).toBe(0)
  })

  it('rounds the minutes left up and reaches zero only at the end', () => {
    expect(minutesLeft(10, 0)).toBe(10)
    expect(minutesLeft(10, 0.55)).toBe(5)
    expect(minutesLeft(10, 0.99)).toBe(1)
    expect(minutesLeft(10, 1)).toBe(0)
  })

  it('labels the estimate', () => {
    expect(readingTimeLabel(4, 0, false)).toBe('4 min read')
    expect(readingTimeLabel(4, 0.5, true)).toBe('4 min read · 2 min left')
    expect(readingTimeLabel(4, 1, true)).toBe('4 min read · finished')
  })
})

describe('activeHeadingIndex', () => {
  const tops = [0, 400, 900, 1500]

  it('is the last heading above the reading line', () => {
    expect(activeHeadingIndex(tops, 450)).toBe(1)
    expect(activeHeadingIndex(tops, 900)).toBe(2)
  })

  it('is -1 before the first heading and when there are none', () => {
    expect(activeHeadingIndex([100, 400], 50)).toBe(-1)
    expect(activeHeadingIndex([], 500)).toBe(-1)
  })

  it('picks the last heading once the end is reached', () => {
    expect(activeHeadingIndex(tops, 1000, true)).toBe(3)
  })
})

describe('the ?read=1 flag', () => {
  it('recognises the flag and its common spellings', () => {
    expect(hasReadFlag('https://x.test/app/?read=1')).toBe(true)
    expect(hasReadFlag('https://x.test/app/?read')).toBe(true)
    expect(hasReadFlag('https://x.test/app/?read=true')).toBe(true)
    expect(hasReadFlag('https://x.test/app/?read=0')).toBe(false)
    expect(hasReadFlag('https://x.test/app/')).toBe(false)
    expect(hasReadFlag('not a url')).toBe(false)
  })

  it('adds and removes it without touching other parameters or the hash', () => {
    expect(withReadFlag('https://x.test/app/?import=1#top', true)).toBe('/app/?import=1&read=1#top')
    expect(withReadFlag('https://x.test/app/?read=1&a=b', false)).toBe('/app/?a=b')
  })
})

describe('isReadingShortcut', () => {
  const key = (init: Partial<KeyboardEvent>) =>
    ({ key: 'v', code: 'KeyV', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent

  it('is Ctrl+Alt+V, or Cmd+Option+V on a Mac', () => {
    expect(isReadingShortcut(key({ ctrlKey: true, altKey: true }))).toBe(true)
    expect(isReadingShortcut(key({ ctrlKey: true, altKey: true, key: 'V' }))).toBe(true)
    // Option changes the character on a Mac; the physical key still counts.
    expect(isReadingShortcut(key({ metaKey: true, altKey: true, key: '√' }))).toBe(true)
  })

  it('leaves paste and paste-as-plain-text alone', () => {
    expect(isReadingShortcut(key({ ctrlKey: true }))).toBe(false)
    expect(isReadingShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isReadingShortcut(key({ ctrlKey: true, altKey: true, shiftKey: true }))).toBe(false)
  })

  it('lets an AltGr layout type its own character on that key', () => {
    // Windows reports AltGr as Ctrl+Alt; Czech AltGr+V types "@".
    expect(isReadingShortcut(key({ ctrlKey: true, altKey: true, key: '@' }))).toBe(false)
  })
})
