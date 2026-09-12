// API Types based on FastAPI backend

export const ERole = {
  USER: 'user',
  MODEL: 'model',
} as const;

export type ERole = typeof ERole[keyof typeof ERole];

export const EModel = {
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
  GEMINI_2_0_FLASH: 'gemini-2.0-flash',
  GEMINI_2_0_FLASH_LITE: 'gemini-2.0-flash-lite',
  GEMINI_FLASH_LATEST: 'gemini-flash-latest',
} as const;

export type EModel = typeof EModel[keyof typeof EModel];

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
