import {
  Conversation,
  Message,
} from '@/shared/types/chatInterface';
import apiClient from './api/client';

export interface ChatUser {
  id: string;
  name: string;
  username: string | null;
}

class ChatService {
  private readonly baseUrl = '/chat';

  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<Conversation[]>(`${this.baseUrl}/conversations`);
    return response.data;
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const response = await apiClient.get<Message[]>(
      `${this.baseUrl}/conversations/${conversationId}/messages`,
      { params: { limit } },
    );
    return response.data;
  }

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const response = await apiClient.post<Message>(
      `${this.baseUrl}/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data;
  }

  async searchUsers(search: string): Promise<ChatUser[]> {
    const response = await apiClient.get<ChatUser[]>(`${this.baseUrl}/users`, {
      params: { search },
    });
    return response.data;
  }

  async createConversation(targetUserId: string): Promise<Conversation> {
    const response = await apiClient.post<Conversation>(
      `${this.baseUrl}/conversations`,
      { targetUserId },
    );
    return response.data;
  }

  async markMessagesAsRead(conversationId: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/conversations/${conversationId}/read`);
  }
}

export const chatService = new ChatService();
