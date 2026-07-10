import {
  Conversation,
  Message,
  ConversationResponse,
  ConversationsListResponse,
  MessageResponse,
  MessagesListResponse,
} from '@/shared/types/chatInterface';
import apiClient from './api/client';

class ChatService {
  private readonly baseUrl = '/chat';

  async getConversations(page = 1, limit = 10): Promise<Conversation[]> {
    const response = await apiClient.get<ConversationsListResponse>(
      `${this.baseUrl}/conversations?page=${page}&limit=${limit}`
    );
    return response.data.data;
  }

  async getConversation(id: string): Promise<Conversation> {
    const response = await apiClient.get<ConversationResponse>(
      `${this.baseUrl}/conversations/${id}`
    );
    return response.data.data;
  }

  async getMessages(conversationId: string, page = 1, limit = 50): Promise<Message[]> {
    const response = await apiClient.get<MessagesListResponse>(
      `${this.baseUrl}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
    );
    return response.data.data;
  }

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const response = await apiClient.post<MessageResponse>(
      `${this.baseUrl}/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data.data;
  }

  async createConversation(participants: string[]): Promise<Conversation> {
    const response = await apiClient.post<ConversationResponse>(`${this.baseUrl}/conversations`, {
      participants,
    });
    return response.data.data;
  }

  async markMessagesAsRead(conversationId: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/conversations/${conversationId}/read`);
  }
}

export const chatService = new ChatService();
