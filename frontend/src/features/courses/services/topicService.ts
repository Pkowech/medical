import { apiService } from '@/features/auth/services/apiClient';
import type { Topic as SharedTopic } from '@/shared/types/courseInterface';
import type { Material as SharedMaterial } from '@/shared/types/materialInterface';

export type Topic = SharedTopic;
export interface Material extends SharedMaterial {
  topicId?: string;
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
