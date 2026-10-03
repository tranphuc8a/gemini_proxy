import { describe, expect, it } from 'vitest';
import {
  PROMPT_GROUPS,
  PROMPT_TEMPLATES,
  insertPromptText,
  matchesPromptQuery,
  normalizeForSearch,
} from './promptLibrary';
import en from '../i18n/en';
import vi from '../i18n/vi';

describe('insertPromptText', () => {
  it('replaces an empty message box', () => {
    expect(insertPromptText('', 'Translate this')).toBe('Translate this');
  });

  it('treats a box holding only whitespace as empty', () => {
    expect(insertPromptText('  \n ', 'Translate this')).toBe('Translate this');
  });

  it('appends on a new line below what is already there', () => {
    expect(insertPromptText('Some context', 'Translate this')).toBe('Some context\nTranslate this');
  });

  it('does not stack blank lines when the box already ends with one', () => {
    expect(insertPromptText('Some context\n\n', 'Translate this')).toBe('Some context\nTranslate this');
  });
});

describe('search', () => {
  const prompt = { title: 'Dịch sang tiếng Anh', text: 'Dịch đoạn văn sau…' };

  it('matches the title or the text, ignoring case and accents', () => {
    expect(matchesPromptQuery(prompt, 'dich sang')).toBe(true);
    expect(matchesPromptQuery(prompt, 'ĐOẠN VĂN')).toBe(true);
    expect(matchesPromptQuery(prompt, 'doan van')).toBe(true);
    expect(matchesPromptQuery(prompt, 'summary')).toBe(false);
  });

  it('matches everything with an empty query', () => {
    expect(matchesPromptQuery(prompt, '   ')).toBe(true);
  });

  it('folds đ to d, which Unicode does not decompose', () => {
    expect(normalizeForSearch('Đường đi')).toBe('duong di');
  });
});

describe('built-in templates', () => {
  type Templates = Record<string, { title?: string; text?: string }>;
  const languages = { en: en.translation.prompts.templates, vi: vi.translation.prompts.templates } as Record<
    string,
    Templates
  >;

  it('has at least 12 templates, with ids that are unique', () => {
    expect(PROMPT_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PROMPT_TEMPLATES.map((t) => t.id)).size).toBe(PROMPT_TEMPLATES.length);
  });

  it('fills every group', () => {
    for (const group of PROMPT_GROUPS) {
      expect(PROMPT_TEMPLATES.some((t) => t.group === group)).toBe(true);
    }
  });

  it.each(['en', 'vi'])('has a title and a text for every template in %s', (language) => {
    for (const { id } of PROMPT_TEMPLATES) {
      expect(languages[language][id]?.title, `${language}: ${id}.title`).toBeTruthy();
      expect(languages[language][id]?.text, `${language}: ${id}.text`).toBeTruthy();
    }
  });
});
