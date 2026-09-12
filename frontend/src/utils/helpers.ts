/**
 * The API reports times as Unix timestamps in **seconds**; JavaScript's Date
 * wants milliseconds. Every conversion goes through here so the factor of 1000
 * cannot be forgotten at one call site and applied at another — which is how
 * exported transcripts ended up dated 1970.
 */
export const toDate = (unixSeconds: number): Date => new Date(unixSeconds * 1000);

const LOCALES: Record<string, string> = { vi: 'vi-VN', en: 'en-US' };

const localeFor = (language: string): string => LOCALES[language] ?? language;

/** Absolute date and time, e.g. "12/09/2026, 21:45". */
export const formatDateTime = (unixSeconds: number, language = 'vi'): string =>
  toDate(unixSeconds).toLocaleString(localeFor(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Clock time alone, for the label under a message bubble. */
export const formatTime = (unixSeconds: number, language = 'vi'): string =>
  toDate(unixSeconds).toLocaleTimeString(localeFor(language), {
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Relative age of a timestamp: "5 minutes ago", "3 days ago", then an absolute
 * date once it is more than a week old.
 *
 * Uses Intl.RelativeTimeFormat so the wording follows the active language rather
 * than the hard-coded Vietnamese strings this used to return regardless of the
 * user's choice.
 */
export const formatTimestamp = (unixSeconds: number, language = 'vi', now: Date = new Date()): string => {
  const date = toDate(unixSeconds);
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const locale = localeFor(language);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  // Clock skew between client and server can put a fresh message slightly in the
  // future; read that as "just now" rather than "in 3 seconds".
  if (diffSeconds < 60) return relative.format(0, 'minute');
  if (diffSeconds < 3600) return relative.format(-Math.floor(diffSeconds / 60), 'minute');
  if (diffSeconds < 86400) return relative.format(-Math.floor(diffSeconds / 3600), 'hour');
  if (diffSeconds < 604800) return relative.format(-Math.floor(diffSeconds / 86400), 'day');

  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const generateConversationTitle = (firstMessage: string): string => {
  // Generate a title from first message
  const cleaned = firstMessage.trim().replace(/\n/g, ' ');
  return truncateText(cleaned, 40);
};

/**
 * Code points a filename may not contain: the C0 control range, and
 * < > : " / BACKSLASH | ? * which Windows reserves and POSIX shells dislike.
 */
const isFilenameSafe = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x20) return false;
  return ![0x3c, 0x3e, 0x3a, 0x22, 0x2f, 0x5c, 0x7c, 0x3f, 0x2a].includes(code);
};

/**
 * Filename-safe version of a conversation name, for the Markdown export.
 *
 * Accented and non-Latin characters are kept: stripping everything outside
 * `[a-z0-9]`, as this used to, turned a Vietnamese conversation title into a
 * row of underscores.
 */
export const toSafeFilename = (name: string, fallback = 'conversation'): string => {
  const cleaned = Array.from(name)
    .filter(isFilenameSafe)
    .join('')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
};
