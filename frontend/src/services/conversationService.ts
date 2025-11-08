import { apiClient } from './apiClient';
import type {
  ConversationResponse,
  ConversationUpdateRequest,
  ListResponse,
  MessageResponse,
  ApiResponse,
} from '../types';

export const conversationService = {
  // List conversations with cursor pagination
  async list(params: {
    after?: string;
    limit?: number;
    order?: 'asc' | 'desc';
  }): Promise<ListResponse<ConversationResponse>> {
    const response = await apiClient.get<ApiResponse<ListResponse<ConversationResponse>>>(
      '/conversations',
      { params }
    );
    return response.data.data;
  },

  // Get conversation detail
  async get(conversationId: string): Promise<ConversationResponse> {
    const response = await apiClient.get<ApiResponse<ConversationResponse>>(
      `/conversations/${conversationId}`
    );
    return response.data.data;
  },

  // Create new conversation
  async create(): Promise<ConversationResponse> {
    const response = await apiClient.post<ApiResponse<ConversationResponse>>('/conversations');
    return response.data.data;
  },

  // Update conversation (rename)
  async update(request: ConversationUpdateRequest): Promise<ConversationResponse> {
    const response = await apiClient.put<ApiResponse<ConversationResponse>>(
      '/conversations',
      request
    );
    return response.data.data;
  },

  // Delete conversation
  async delete(conversationId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
      `/conversations/${conversationId}`
    );
    return response.data.data;
  },

  // Get messages for conversation (paginated)
  async getMessages(
    conversationId: string,
    params: {
      after?: string;
      limit?: number;
      order?: 'asc' | 'desc';
    }
  ): Promise<ListResponse<MessageResponse>> {
    const response = await apiClient.get<ApiResponse<ListResponse<MessageResponse>>>(
      `/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data.data;
  },

  // Get recent messages (top k messages)
  async getRecentMessages(conversationId: string, k: number = 20): Promise<MessageResponse[]> {
    const response = await apiClient.get<ApiResponse<MessageResponse[]>>(
      `/conversations/${conversationId}/messages/recent`,
      { params: { k } }
    );
    return response.data.data;
  },
};
