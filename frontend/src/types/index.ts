// API Types based on FastAPI backend

export const ERole = {
  USER: 'user',
  MODEL: 'model',
} as const;

export type ERole = typeof ERole[keyof typeof ERole];

/**
 * The models offered when the server cannot list its own (GET /ai/models): what
 * the live Gemini API answered on 2026-10-08. The real list comes from the server
 * — see useAiModels — and decides who may pick what (Pro is for administrators).
 */
export const FALLBACK_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

/** The server's own default when it cannot be asked (AI_MODEL). */
export const DEFAULT_MODEL = 'gemini-3.5-flash';

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: ERole;
  /** Unix timestamp in **seconds**, as produced by the backend. */
  created_at: number;
  content: string;
}

export interface ConversationResponse {
  id: string;
  name: string;
  /** Unix timestamp in **seconds**. */
  created_at: number;
  /** Unix timestamp in **seconds**; null until the conversation is first used. */
  updated_at: number | null;
  messages_count?: number;
}

export interface ListResponse<T> {
  data: T[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  status_code: number;
}

export interface MessageRequest {
  conversation_id: string;
  content: string;
  model: string;
  /**
   * Only set when re-asking a question the server already stored. The id comes
   * from the failed attempt's error frame, so the retry updates that record
   * instead of filing the same question twice.
   */
  message_id?: string;
}

/** Payload of the terminal `error` frame on a streaming answer. */
export interface StreamFailure {
  message?: string;
  /** The record the question was stored under, for a retry to reuse. */
  user_message_id?: string;
}

export interface ConversationUpdateRequest {
  id: string;
  name: string;
}

/**
 * Payload of the terminal `done` frame on a streaming answer: the ids the two
 * messages were actually persisted under, so the optimistic placeholders the UI
 * created can be swapped for real records.
 */
export interface StreamCompletion {
  conversation_id?: string;
  user_message_id?: string;
  message_id?: string;
}

// UI State Types
export interface ChatMessage extends MessageResponse {
  isStreaming?: boolean;
  error?: string;
  /** True while this message only exists locally, before the server confirms it. */
  pending?: boolean;
}
