import { apiService } from '@/features/auth/services/apiClient';

export interface Forum {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  isPrivate?: boolean;
  topicCount: number;
  postCount: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  discussionId: string;
  userId: string;
  content: string;
  metadata?: {
    title?: string;
    tags?: string[];
    isTopicStarter?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  discussionId: string;
  userId: string;
  replyToId?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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
    const res = await apiService.get<Forum[]>('/forums');
    return res.data;
  }

  async getForum(id: string): Promise<Forum> {
    const res = await apiService.get<Forum>(`/forums/${id}`);
    return res.data;
  }

  async createForum(payload: { name: string; description?: string }): Promise<Forum> {
    const res = await apiService.post<Forum>('/forums', payload);
    return res.data;
  }

  async createTopic(
    forumId: string,
    payload: { title: string; content?: string; tags?: string[] },
  ): Promise<Topic> {
    const res = await apiService.post<Topic>(`/forums/${forumId}/topics`, payload);
    return res.data;
  }

  async getTopics(forumId: string): Promise<Topic[]> {
    const res = await apiService.get<Topic[]>(`/forums/${forumId}/topics`);
    return res.data;
  }

  async createPost(
    forumId: string,
    payload: { content: string; parentId?: string },
  ): Promise<Post> {
    const res = await apiService.post<Post>(`/forums/${forumId}/posts`, payload);
    return res.data;
  }

  async getPosts(forumId: string, params?: Record<string, unknown>): Promise<Post[]> {
    const res = await apiService.get<Post[]>(`/forums/${forumId}/posts`, { params });
    return res.data;
  }
}

export const forumService = ForumService.getInstance();
