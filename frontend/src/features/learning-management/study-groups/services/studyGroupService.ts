import { apiService } from '@/features/auth/services/apiClient';

export interface StudyGroupRecord {
  id: string;
  name: string;
  description: string | null;
  type: 'general' | 'course_specific' | 'exam_prep' | 'research' | 'clinical_cases';
  privacy: 'public' | 'private' | 'invite_only';
  maxMembers: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    memberCount?: number;
    tags?: string[];
    studyTopics?: string[];
    courseId?: string | null;
  };
  members?: Array<{
    userId: string;
    role: string;
    status: string;
  }>;
}

class StudyGroupService {
  private static instance: StudyGroupService;

  private constructor() {}

  static getInstance(): StudyGroupService {
    if (!StudyGroupService.instance) {
      StudyGroupService.instance = new StudyGroupService();
    }
    return StudyGroupService.instance;
  }

  async listGroups(): Promise<StudyGroupRecord[]> {
    const res = await apiService.get<StudyGroupRecord[]>('/study-groups');
    return res.data;
  }

  async listMyGroups(): Promise<StudyGroupRecord[]> {
    const res = await apiService.get<StudyGroupRecord[]>('/study-groups/my-groups');
    return res.data;
  }

  async getGroup(id: string): Promise<StudyGroupRecord> {
    const res = await apiService.get<StudyGroupRecord>(`/study-groups/${id}`);
    return res.data;
  }

  async createGroup(payload: {
    name: string;
    description?: string;
    type: StudyGroupRecord['type'];
    privacy: StudyGroupRecord['privacy'];
    maxMembers?: number;
    courseId?: string;
  }): Promise<StudyGroupRecord> {
    const res = await apiService.post<StudyGroupRecord>('/study-groups', payload);
    return res.data;
  }

  async joinGroup(id: string, inviteCode?: string): Promise<void> {
    await apiService.post(`/study-groups/${id}/join`, { inviteCode });
  }

  async updateGroup(
    id: string,
    payload: Partial<{ name: string; description: string; courseId: string | null }>
  ): Promise<StudyGroupRecord> {
    const res = await apiService.put<StudyGroupRecord>(`/study-groups/${id}`, payload);
    return res.data;
  }

  async deleteGroup(id: string): Promise<void> {
    await apiService.delete(`/study-groups/${id}`);
  }
}

export const studyGroupService = StudyGroupService.getInstance();

export default StudyGroupService;
