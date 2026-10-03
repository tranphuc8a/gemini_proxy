import { create } from 'zustand';

/** Where "My prompts" are kept: a bare JSON array of `SavedPrompt`. */
export const PROMPTS_STORAGE_KEY = 'gemini-chat:prompts';
/** Longest title derived from a prompt's text. */
const TITLE_LENGTH = 60;

export interface SavedPrompt {
  id: string;
  title: string;
  text: string;
  /** Milliseconds. */
  createdAt: number;
}

/** How `addPrompt` went: kept, already there, nothing to keep, or kept for this session only. */
export type AddPromptResult = 'added' | 'duplicate' | 'empty' | 'unsaved';

const isSavedPrompt = (value: unknown): value is SavedPrompt => {
  if (!value || typeof value !== 'object') return false;
  const { id, title, text, createdAt } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof title === 'string' &&
    typeof text === 'string' &&
    typeof createdAt === 'number'
  );
};

/** The stored prompts; anything unreadable is dropped rather than breaking the library. */
export const readSavedPrompts = (): SavedPrompt[] => {
  try {
    const raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSavedPrompt) : [];
  } catch {
    return [];
  }
};

const writeSavedPrompts = (prompts: SavedPrompt[]): boolean => {
  try {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
    return true;
  } catch {
    // Disabled or full storage: the list still works until the page reloads.
    return false;
  }
};

/** A title for a prompt saved straight from the message box: its first line, shortened. */
export const titleFromText = (text: string): string => {
  const firstLine = text.trim().split('\n')[0].trim().replace(/\s+/g, ' ');
  return firstLine.length > TITLE_LENGTH ? `${firstLine.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : firstLine;
};

// Not crypto.randomUUID: that only exists in secure contexts, and the app is
// also served over plain HTTP on a LAN.
const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface PromptState {
  prompts: SavedPrompt[];
  /** Keep a prompt, newest first. */
  addPrompt: (text: string, title?: string) => AddPromptResult;
  removePrompt: (id: string) => void;
  /** Re-read storage, e.g. after another tab changed it. */
  reload: () => void;
}

/** "My prompts" in the prompt library. */
export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: readSavedPrompts(),

  addPrompt: (text, title) => {
    const body = text.trim();
    if (!body) return 'empty';
    if (get().prompts.some((prompt) => prompt.text.trim() === body)) return 'duplicate';

    const prompt: SavedPrompt = {
      id: newId(),
      title: title?.trim() || titleFromText(body),
      text: body,
      createdAt: Date.now(),
    };
    const prompts = [prompt, ...get().prompts];
    set({ prompts });
    return writeSavedPrompts(prompts) ? 'added' : 'unsaved';
  },

  removePrompt: (id) => {
    const prompts = get().prompts.filter((prompt) => prompt.id !== id);
    set({ prompts });
    writeSavedPrompts(prompts);
  },

  reload: () => set({ prompts: readSavedPrompts() }),
}));
