import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';

export interface Forum {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Topic {
  id: string;
  forumId: string;
  title: string;
  authorId: string;
  createdAt: string;
}

export interface Post {
  id: string;
  topicId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

class ForumService {
  private static instance: ForumService;

  private constructor() {}

  static getInstance(): ForumService {
    if (!ForumService.instance) {
      ForumService.instance = new ForumService();
    }
    return ForumService.instance;
  }

  async getForums(): Promise<Forum[]> {
    const res = await apiService.get<ApiResponse<Forum[]>>('/forums');
    return res.data.data;
  }

  async getForum(id: string): Promise<Forum> {
    const res = await apiService.get<ApiResponse<Forum>>(`/forums/${id}`);
    return res.data.data;
  }

  async createForum(payload: { title: string; description?: string }): Promise<Forum> {
    const res = await apiService.post<ApiResponse<Forum>>('/forums', payload);
    return res.data.data;
  }

  async createTopic(forumId: string, payload: { title: string; authorId: string }): Promise<Topic> {
    const res = await apiService.post<ApiResponse<Topic>>(`/forums/${forumId}/topics`, payload);
    return res.data.data;
  }

  async getTopics(forumId: string): Promise<Topic[]> {
    const res = await apiService.get<ApiResponse<Topic[]>>(`/forums/${forumId}/topics`);
    return res.data.data;
  }

  async createPost(topicId: string, payload: { authorId: string; content: string }): Promise<Post> {
    const res = await apiService.post<ApiResponse<Post>>(`/topics/${topicId}/posts`, payload);
    return res.data.data;
  }

  async getPosts(topicId: string, params?: Record<string, unknown>): Promise<Post[]> {
    const res = await apiService.get<ApiResponse<Post[]>>(`/topics/${topicId}/posts`, { params });
    return res.data.data;
  }
}

export const forumService = ForumService.getInstance();
