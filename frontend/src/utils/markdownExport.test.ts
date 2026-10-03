import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INBOX_SENDER,
  MARKDOWN_EDITOR_INBOX_KEY,
  buildConversationMarkdown,
  buildMarkdownEditorInbox,
  markdownEditorUrl,
  sendToMarkdownEditor,
} from './markdownExport';
import { formatDateTime } from './helpers';
import { ERole } from '../types';

/** 2026-09-12T14:30:00Z as the API reports it: whole seconds. */
const SECONDS = 1_789_223_400;
const LABELS = { user: 'You', assistant: 'Gemini', exportedOn: 'Exported on today' };

const injectConfig = (config: unknown) => {
  (window as unknown as { __WEBAPP_CONFIG__?: unknown }).__WEBAPP_CONFIG__ = config;
};

afterEach(() => {
  delete (window as unknown as { __WEBAPP_CONFIG__?: unknown }).__WEBAPP_CONFIG__;
  vi.restoreAllMocks();
});

describe('buildConversationMarkdown', () => {
  it('writes the title, the export line, then each turn under its author and time', () => {
    const markdown = buildConversationMarkdown(
      'Planning',
      [
        { role: ERole.USER, content: 'What is the plan?', created_at: SECONDS },
        { role: ERole.MODEL, content: 'Step **one**.', created_at: SECONDS + 60 },
      ],
      LABELS,
      'en'
    );

    expect(markdown).toBe(
      '# Planning\n\n' +
        '*Exported on today*\n\n' +
        '---\n\n' +
        `## You - ${formatDateTime(SECONDS, 'en')}\n\n` +
        'What is the plan?\n\n' +
        '---\n\n' +
        `## Gemini - ${formatDateTime(SECONDS + 60, 'en')}\n\n` +
        'Step **one**.\n\n' +
        '---\n\n'
    );
  });

  it('dates the turns as seconds, not milliseconds', () => {
    const markdown = buildConversationMarkdown(
      'T',
      [{ role: ERole.USER, content: 'x', created_at: SECONDS }],
      LABELS,
      'en'
    );
    expect(markdown).toContain('2026');
  });
});

describe('buildMarkdownEditorInbox', () => {
  it('builds the {name, content, at, from} payload the editor reads', () => {
    expect(buildMarkdownEditorInbox({ title: 'Planning', content: '# Planning', now: 1_800_000_000_000 })).toEqual({
      name: 'Planning.md',
      content: '# Planning',
      at: 1_800_000_000_000,
      from: INBOX_SENDER,
    });
    expect(INBOX_SENDER).toBe('Gemini Chat');
  });

  it('stamps it with the current time by default', () => {
    const before = Date.now();
    const { at } = buildMarkdownEditorInbox({ title: 'x', content: '' });
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it('turns the title into a safe file name', () => {
    const named = (title: string) => buildMarkdownEditorInbox({ title, content: '' }).name;

    expect(named('Kế hoạch du lịch')).toBe('Kế_hoạch_du_lịch.md');
    expect(named('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij.md');
    expect(named(`na${String.fromCharCode(0)}me`)).toBe('name.md');
    expect(named('///')).toBe('conversation.md');
    expect(named('x'.repeat(300))).toBe(`${'x'.repeat(80)}.md`);
  });
});

describe('markdownEditorUrl', () => {
  it('lives under /webapp when the server injected nothing', () => {
    expect(markdownEditorUrl()).toBe('/webapp/tranphuc8a/markdown-editor-pro/?import=1');
  });

  it('follows the collection root the server injected', () => {
    injectConfig({ webappBase: '/apps//' });
    expect(markdownEditorUrl()).toBe('/apps/tranphuc8a/markdown-editor-pro/?import=1');
  });

  it('ignores an injected root that is not a usable string', () => {
    injectConfig({ webappBase: '' });
    expect(markdownEditorUrl()).toBe('/webapp/tranphuc8a/markdown-editor-pro/?import=1');
    injectConfig({ webappBase: 42 });
    expect(markdownEditorUrl()).toBe('/webapp/tranphuc8a/markdown-editor-pro/?import=1');
  });
});

describe('sendToMarkdownEditor', () => {
  it('leaves the document in the inbox and opens the editor in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const inbox = buildMarkdownEditorInbox({ title: 'Planning', content: '# Planning', now: 1 });

    expect(sendToMarkdownEditor(inbox)).toBe(true);

    expect(JSON.parse(localStorage.getItem(MARKDOWN_EDITOR_INBOX_KEY) ?? 'null')).toEqual(inbox);
    expect(open).toHaveBeenCalledWith('/webapp/tranphuc8a/markdown-editor-pro/?import=1', '_blank', 'noopener');
  });

  it('opens nothing when the inbox cannot be written', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(sendToMarkdownEditor(buildMarkdownEditorInbox({ title: 'x', content: 'y' }))).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
