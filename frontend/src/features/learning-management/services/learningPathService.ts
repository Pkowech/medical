import { apiService } from '@/features/auth/services/apiClient';
import { LearningPath, LearningPathProgress } from '@/shared/types/learningInterface';
import { ApiResponse } from '@/shared/types/base-responseInterface';

const LEARNING_PATH_BASE_URL = '/learning-paths';

export interface CreateLearningPathPayload {
  title: string;
  description: string;
  targetCareerStages: string[];
  category: string;
  difficulty: string;
  estimatedDurationWeeks: number;
  estimatedHoursPerWeek: number;
  learningObjectives: string[];
  pathStructure: {
    id: string;
    title: string;
    description: string;
    modules: [];
    phases: Array<{
      id: string;
      title: string;
      description: string;
      order: number;
      modules: Array<{
        id: string;
        type: 'course' | 'assessment' | 'milestone';
        resourceId: string;
        title: string;
        description?: string;
        order: number;
        required: boolean;
        estimatedMinutes?: number;
      }>;
    }>;
  };
}

export interface InstructorLearningPath {
  id: string;
  title: string;
  status: string;
  description?: string;
  category?: string;
}

const unwrapResponse = (value: unknown): unknown => {
  let payload = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    const record = payload as Record<string, unknown>;
    if (record.data !== undefined) {
      payload = record.data;
    } else if (record.learningPaths !== undefined) {
      payload = record.learningPaths;
    } else if (record.items !== undefined) {
      payload = record.items;
    } else {
      return payload;
    }
  }
  return payload;
};

const asInstructorLearningPath = (value: unknown): InstructorLearningPath => {
  const path = unwrapResponse(value);
  if (!path || typeof path !== 'object' || Array.isArray(path)) {
    throw new Error('The learning path response was invalid.');
  }
  const record = path as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.status !== 'string'
  ) {
    throw new Error('The learning path response was invalid.');
  }
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    description: typeof record.description === 'string' ? record.description : undefined,
    category: typeof record.category === 'string'
      ? record.category
      : typeof record.categoryId === 'string'
        ? record.categoryId
        : undefined,
  };
};

class LearningPathService {
  async getAuthoredPaths(userId: string): Promise<InstructorLearningPath[]> {
    const response = await apiService.get<unknown>(LEARNING_PATH_BASE_URL, {
      params: { createdById: userId },
    });
    const payload = unwrapResponse(response.data);
    if (!Array.isArray(payload)) {
      throw new Error('The instructor learning paths response was invalid.');
    }
    return payload.map(asInstructorLearningPath);
  }

  async createLearningPath(payload: CreateLearningPathPayload): Promise<InstructorLearningPath> {
    const response = await apiService.post<unknown>(LEARNING_PATH_BASE_URL, payload);
    return asInstructorLearningPath(response.data);
  }

  async publishLearningPath(pathId: string): Promise<InstructorLearningPath> {
    const response = await apiService.post<unknown>(
      `${LEARNING_PATH_BASE_URL}/${pathId}/publish`,
    );
    return asInstructorLearningPath(response.data);
  }

  async getMyProgress(): Promise<LearningPathProgress[]> {
    const response = await apiService.get<unknown>(
      `${LEARNING_PATH_BASE_URL}/my-progress`,
    );
    let payload: unknown = response;
    for (let depth = 0; depth < 3; depth += 1) {
      if (Array.isArray(payload)) return payload as LearningPathProgress[];
      if (!payload || typeof payload !== 'object' || !('data' in payload)) break;
      payload = payload.data;
    }
    if (!Array.isArray(payload)) {
      throw new Error('The learning path progress response was invalid.');
    }
    return payload as LearningPathProgress[];
  }

  async getRecommendedPaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await apiService.get<ApiResponse<LearningPath[]>>(
      `${LEARNING_PATH_BASE_URL}/discovery/personalized?limit=${limit}`
    );
    return response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  async getTrendingPaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await apiService.get<ApiResponse<LearningPath[]>>(
      `${LEARNING_PATH_BASE_URL}/discovery/trending?limit=${limit}`
    );
    return response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  async getCollaborativePaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await apiService.get<ApiResponse<LearningPath[]>>(
      `${LEARNING_PATH_BASE_URL}/discovery/collaborative?limit=${limit}`
    );
    return response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  async enroll(pathId: string): Promise<void> {
    await apiService.post(`${LEARNING_PATH_BASE_URL}/${pathId}/enroll`, {});
  }

  async deleteLearningPath(learningPathId: string): Promise<void> {
    await apiService.delete(`${LEARNING_PATH_BASE_URL}/${learningPathId}`);
  }
}

export const learningPathService = new LearningPathService();
