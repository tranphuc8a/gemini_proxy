import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROMPTS_STORAGE_KEY,
  readSavedPrompts,
  titleFromText,
  usePromptStore,
  type SavedPrompt,
} from './promptStore';

const stored = (): SavedPrompt[] => JSON.parse(localStorage.getItem(PROMPTS_STORAGE_KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
  usePromptStore.setState({ prompts: [] });
  vi.restoreAllMocks();
});

describe('My prompts', () => {
  it('adds a prompt, newest first, and keeps the list as a bare array', () => {
    const { addPrompt } = usePromptStore.getState();

    expect(addPrompt('Summarize this article')).toBe('added');
    expect(addPrompt('  Translate to English  ')).toBe('added');

    const { prompts } = usePromptStore.getState();
    expect(prompts.map((p) => p.text)).toEqual(['Translate to English', 'Summarize this article']);
    expect(prompts[0]).toEqual({
      id: expect.any(String),
      title: 'Translate to English',
      text: 'Translate to English',
      createdAt: expect.any(Number),
    });
    expect(prompts[0].id).not.toBe(prompts[1].id);
    expect(stored()).toEqual(prompts);
  });

  it('uses the given title, or the first line of the text', () => {
    const { addPrompt } = usePromptStore.getState();
    addPrompt('Line one\nLine two');
    addPrompt('Body text', 'My title');

    expect(usePromptStore.getState().prompts.map((p) => p.title)).toEqual(['My title', 'Line one']);
  });

  it('refuses an empty prompt and a duplicate', () => {
    const { addPrompt } = usePromptStore.getState();

    expect(addPrompt('   ')).toBe('empty');
    expect(addPrompt('Same text')).toBe('added');
    expect(addPrompt(' Same text \n')).toBe('duplicate');
    expect(usePromptStore.getState().prompts).toHaveLength(1);
  });

  it('deletes a prompt and persists the deletion', () => {
    const { addPrompt } = usePromptStore.getState();
    addPrompt('keep me');
    addPrompt('delete me');
    const target = usePromptStore.getState().prompts.find((p) => p.text === 'delete me');

    usePromptStore.getState().removePrompt(target!.id);

    expect(usePromptStore.getState().prompts.map((p) => p.text)).toEqual(['keep me']);
    expect(stored().map((p) => p.text)).toEqual(['keep me']);
  });

  it('survives a reload: what was saved is read back', () => {
    usePromptStore.getState().addPrompt('persist me');
    usePromptStore.setState({ prompts: [] });

    usePromptStore.getState().reload();

    expect(usePromptStore.getState().prompts.map((p) => p.text)).toEqual(['persist me']);
  });

  it('still adds the prompt for this session when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(usePromptStore.getState().addPrompt('session only')).toBe('unsaved');
    expect(usePromptStore.getState().prompts.map((p) => p.text)).toEqual(['session only']);
  });
});

describe('readSavedPrompts', () => {
  it('is empty with nothing stored', () => {
    expect(readSavedPrompts()).toEqual([]);
  });

  it('is empty rather than throwing on corrupted storage', () => {
    localStorage.setItem(PROMPTS_STORAGE_KEY, '{not json');
    expect(readSavedPrompts()).toEqual([]);
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(readSavedPrompts()).toEqual([]);
  });

  it('drops entries that are not prompts', () => {
    const good = { id: 'p1', title: 'T', text: 'Text', createdAt: 1 };
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify([good, { id: 'p2' }, 'junk', null]));
    expect(readSavedPrompts()).toEqual([good]);
  });
});

describe('titleFromText', () => {
  it('takes the first line, with whitespace collapsed', () => {
    expect(titleFromText('  Hello   world \nsecond line')).toBe('Hello world');
  });

  it('shortens a long first line', () => {
    const title = titleFromText('word '.repeat(40));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });
});
