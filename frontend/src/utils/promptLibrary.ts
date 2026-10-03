/**
 * The built-in prompt templates and the helpers the prompt library uses.
 *
 * Titles and texts live in the i18n files under `prompts.templates.<id>`, so a
 * template follows the interface language; this catalogue only fixes which
 * templates exist and how they are grouped.
 */

export const PROMPT_GROUPS = ['writing', 'code', 'learning', 'translate', 'analysis', 'summarize'] as const;
export type PromptGroup = (typeof PROMPT_GROUPS)[number];

export interface PromptTemplate {
  id: string;
  group: PromptGroup;
}

export const PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  { id: 'professionalEmail', group: 'writing' },
  { id: 'polishWriting', group: 'writing' },
  { id: 'blogOutline', group: 'writing' },
  { id: 'explainCode', group: 'code' },
  { id: 'reviewCode', group: 'code' },
  { id: 'writeTests', group: 'code' },
  { id: 'explainSimply', group: 'learning' },
  { id: 'studyPlan', group: 'learning' },
  { id: 'quizMe', group: 'learning' },
  { id: 'translateToEnglish', group: 'translate' },
  { id: 'translateToVietnamese', group: 'translate' },
  { id: 'prosCons', group: 'analysis' },
  { id: 'swot', group: 'analysis' },
  { id: 'rootCause', group: 'analysis' },
  { id: 'keyPoints', group: 'summarize' },
  { id: 'shortSummary', group: 'summarize' },
  { id: 'meetingNotes', group: 'summarize' },
];

/**
 * The message box after choosing a prompt: the prompt itself when the box is
 * empty, otherwise what was there with the prompt on a new line below it.
 */
export const insertPromptText = (current: string, text: string): string =>
  current.trim() ? `${current.trimEnd()}\n${text}` : text;

/** Case- and diacritic-insensitive form, so "dich" finds "Dịch". */
export const normalizeForSearch = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');

/** Whether a prompt matches the search box, by title or text. */
export const matchesPromptQuery = (prompt: { title: string; text: string }, query: string): boolean => {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return true;
  return normalizeForSearch(`${prompt.title}\n${prompt.text}`).includes(needle);
};
