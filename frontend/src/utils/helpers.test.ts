import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatTime,
  formatTimestamp,
  generateConversationTitle,
  toDate,
  toSafeFilename,
  truncateText,
} from './helpers';

/** 2026-09-12T14:30:00Z as the API reports it: whole seconds. */
const SECONDS = 1_789_223_400;

describe('toDate', () => {
  it('reads the API value as seconds, not milliseconds', () => {
    // Regression: treating the value as milliseconds dated everything to 1970.
    expect(toDate(SECONDS).getUTCFullYear()).toBe(2026);
    expect(new Date(SECONDS).getUTCFullYear()).toBe(1970);
  });
});

describe('formatDateTime / formatTime', () => {
  it('renders a real date rather than the epoch', () => {
    expect(formatDateTime(SECONDS, 'en')).toContain('2026');
  });

  it('formats time without a date', () => {
    expect(formatTime(SECONDS, 'en')).toMatch(/\d{1,2}:\d{2}/);
    expect(formatTime(SECONDS, 'en')).not.toContain('2026');
  });

  it('follows the requested language', () => {
    const vi = formatDateTime(SECONDS, 'vi');
    const en = formatDateTime(SECONDS, 'en');
    // vi-VN puts the day first; en-US puts the month first.
    expect(vi).not.toBe(en);
  });
});

describe('formatTimestamp', () => {
  const now = new Date('2026-09-12T15:00:00Z');
  const secondsAgo = (n: number) => Math.floor(now.getTime() / 1000) - n;

  it('describes the last minute as now', () => {
    expect(formatTimestamp(secondsAgo(20), 'en', now)).toMatch(/now|this minute/i);
  });

  it('counts minutes, hours and days', () => {
    expect(formatTimestamp(secondsAgo(5 * 60), 'en', now)).toContain('5 minutes ago');
    expect(formatTimestamp(secondsAgo(3 * 3600), 'en', now)).toContain('3 hours ago');
    expect(formatTimestamp(secondsAgo(2 * 86400), 'en', now)).toMatch(/2 days ago|yesterday/i);
  });

  it('falls back to an absolute date beyond a week', () => {
    expect(formatTimestamp(secondsAgo(30 * 86400), 'en', now)).toContain('2026');
  });

  it('translates rather than always answering in Vietnamese', () => {
    // Regression: this used to return hard-coded Vietnamese whatever the locale.
    expect(formatTimestamp(secondsAgo(5 * 60), 'en', now)).not.toContain('phút');
    expect(formatTimestamp(secondsAgo(5 * 60), 'vi', now)).toContain('phút');
  });

  it('reads a slightly future timestamp as now, not as a countdown', () => {
    // Client and server clocks are never exactly aligned.
    expect(formatTimestamp(secondsAgo(-3), 'en', now)).toMatch(/now|this minute/i);
  });
});

describe('toSafeFilename', () => {
  it('keeps Vietnamese characters', () => {
    // Regression: the old [^a-z0-9] strip reduced this to underscores.
    expect(toSafeFilename('Cuộc trò chuyện')).toBe('Cuộc_trò_chuyện');
  });

  it('removes characters a filesystem rejects', () => {
    expect(toSafeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('collapses whitespace runs into one separator', () => {
    expect(toSafeFilename('a   b')).toBe('a_b');
  });

  it('drops control characters', () => {
    expect(toSafeFilename(`na${String.fromCharCode(0)}me`)).toBe('name');
  });

  it('falls back when nothing usable is left', () => {
    expect(toSafeFilename('///')).toBe('conversation');
    expect(toSafeFilename('', 'chat')).toBe('chat');
  });

  it('bounds the length', () => {
    expect(toSafeFilename('x'.repeat(500)).length).toBe(80);
  });
});

describe('truncateText', () => {
  it('leaves short text alone', () => {
    expect(truncateText('short', 10)).toBe('short');
  });

  it('marks text it cut', () => {
    expect(truncateText('abcdefghij', 4)).toBe('abcd...');
  });
});

describe('generateConversationTitle', () => {
  it('flattens the first message onto one line', () => {
    expect(generateConversationTitle('  hello\nworld  ')).toBe('hello world');
  });
});
