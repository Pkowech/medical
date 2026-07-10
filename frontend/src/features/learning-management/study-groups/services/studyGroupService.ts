import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types';
import { StudyGroup, StudyGroupSummary } from '@/shared/types/studyInterface';

class StudyGroupService {
  private static instance: StudyGroupService;

  private constructor() {}

  static getInstance(): StudyGroupService {
    if (!StudyGroupService.instance) {
      StudyGroupService.instance = new StudyGroupService();
    }
    return StudyGroupService.instance;
  }

  async listGroups(): Promise<StudyGroupSummary[]> {
    const res = await apiService.get<ApiResponse<StudyGroupSummary[]>>('/study-groups');
    return res.data.data;
  }

  async getGroup(id: string): Promise<StudyGroup> {
    const res = await apiService.get<ApiResponse<StudyGroup>>(`/study-groups/${id}`);
    return res.data.data;
  }

  async createGroup(payload: { name: string; description?: string }): Promise<StudyGroup> {
    const res = await apiService.post<ApiResponse<StudyGroup>>('/study-groups', payload);
    return res.data.data;
  }

  async updateGroup(
    id: string,
    payload: Partial<{ name: string; description: string }>
  ): Promise<StudyGroup> {
    const res = await apiService.patch<ApiResponse<StudyGroup>>(`/study-groups/${id}`, payload);
    return res.data.data;
  }

  async deleteGroup(id: string): Promise<void> {
    await apiService.delete(`/study-groups/${id}`);
  }
}

export const studyGroupService = StudyGroupService.getInstance();

export default StudyGroupService;
