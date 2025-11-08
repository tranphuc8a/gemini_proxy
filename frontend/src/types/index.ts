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
  content: string;
  created_at: number;
}

export interface ConversationResponse {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface ListResponse<T> {
  data: T[];
  first_id: string;
  last_id: string;
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
}

export interface ConversationUpdateRequest {
  id: string;
  name: string;
}

// UI State Types
export interface ChatMessage extends MessageResponse {
  isStreaming?: boolean;
  error?: string;
}
