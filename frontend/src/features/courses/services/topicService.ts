import { apiService } from '@/features/auth/services/apiClient';

export interface Topic {
  id: string;
  unitId: string;
  courseId?: string;
  title: string;
  description?: string;
  orderIndex: number;
  isMandatory?: boolean;
  status?: 'active' | 'inactive';
  materials?: Material[];
}

export interface Material {
  id: string;
  topicId?: string;
  title: string;
  type?: string;
}

class TopicService {
  private readonly baseUrl = '/topics';

  /**
   * Get all topics
   */
  async getTopics(): Promise<Topic[]> {
    const response = await apiService.get<Topic[] | { items: Topic[] }>(this.baseUrl);
    const data = response.data;
    return Array.isArray(data) ? data : data?.items || [];
  }

  /**
   * Get topic by ID
   */
  async getTopicById(id: string): Promise<Topic> {
    const response = await apiService.get<Topic>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  /**
   * Get topics for a unit
   */
  async getTopicsByUnitId(unitId: string): Promise<Topic[]> {
    const response = await apiService.get<Topic[] | { items: Topic[] }>(this.baseUrl, {
      params: { unitId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : data?.items || [];
  }

  /**
   * Create a new topic
   */
  async createTopic(unitId: string, topicData: Partial<Topic>): Promise<Topic> {
    const response = await apiService.post<Topic>(this.baseUrl, {
      unitId,
      ...topicData,
    });
    return response.data;
  }

  /**
   * Update a topic
   */
  async updateTopic(id: string, topicData: Partial<Topic>): Promise<Topic> {
    const response = await apiService.patch<Topic>(`${this.baseUrl}/${id}`, topicData);
    return response.data;
  }

  /**
   * Delete a topic
   */
  async deleteTopic(id: string): Promise<void> {
    await apiService.delete<void>(`${this.baseUrl}/${id}`);
  }
}

export const topicService = new TopicService();
