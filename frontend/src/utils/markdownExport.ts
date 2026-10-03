import { runtimeConfig } from '../services/runtimeConfig';
import { ERole, type ChatMessage } from '../types';
import { formatDateTime, toSafeFilename } from './helpers';

/** The words the transcript needs, passed in so the builder stays free of i18n. */
export interface TranscriptLabels {
  /** Heading for the user's turns. */
  user: string;
  /** Heading for the model's turns. */
  assistant: string;
  /** The italic line under the title, already formatted ("Exported on …"). */
  exportedOn: string;
}

/**
 * A conversation as one Markdown document: title, export line, then each turn
 * under a heading with its author and time.
 *
 * Shared by the download and the hand-off to Markdown Editor, so the two can
 * never drift apart.
 */
export const buildConversationMarkdown = (
  title: string,
  messages: readonly Pick<ChatMessage, 'role' | 'content' | 'created_at'>[],
  labels: TranscriptLabels,
  language: string
): string => {
  let markdown = `# ${title}\n\n`;
  markdown += `*${labels.exportedOn}*\n\n`;
  markdown += `---\n\n`;

  messages.forEach((msg) => {
    const role = msg.role === ERole.USER ? labels.user : labels.assistant;
    markdown += `## ${role} - ${formatDateTime(msg.created_at, language)}\n\n`;
    markdown += `${msg.content}\n\n`;
    markdown += `---\n\n`;
  });

  return markdown;
};

/** localStorage key Markdown Editor reads once when opened with `?import=1`. */
export const MARKDOWN_EDITOR_INBOX_KEY = 'markdown-editor:inbox';
/** Shown by the editor in its "opened from …" toast. */
export const INBOX_SENDER = 'Gemini Chat';

/** What the editor's inbox holds: `{name, content, at, from}`. */
export interface MarkdownEditorInbox {
  name: string;
  content: string;
  /** Milliseconds; the editor ignores an inbox older than a few minutes. */
  at: number;
  from: string;
}

/** The inbox payload for one document; `title` becomes a safe `.md` file name. */
export const buildMarkdownEditorInbox = ({
  title,
  content,
  now = Date.now(),
}: {
  title: string;
  content: string;
  now?: number;
}): MarkdownEditorInbox => ({
  name: `${toSafeFilename(title)}.md`,
  content,
  at: now,
  from: INBOX_SENDER,
});

/**
 * Where Markdown Editor is published: under the collection root the server
 * injected (`webappBase`), '/webapp' when it injected none.
 */
export const markdownEditorUrl = (webappBase: unknown = runtimeConfig().webappBase): string => {
  const root = typeof webappBase === 'string' && webappBase ? webappBase : '/webapp';
  return `${root.replace(/\/+$/, '')}/tranphuc8a/markdown-editor-pro/?import=1`;
};

/**
 * Leave the document in the editor's inbox and open the editor in a new tab.
 *
 * False when the inbox could not be written (storage disabled or full); the
 * editor is then not opened, since it would have nothing to show.
 */
export const sendToMarkdownEditor = (inbox: MarkdownEditorInbox): boolean => {
  try {
    localStorage.setItem(MARKDOWN_EDITOR_INBOX_KEY, JSON.stringify(inbox));
  } catch {
    return false;
  }
  window.open(markdownEditorUrl(), '_blank', 'noopener');
  return true;
};
