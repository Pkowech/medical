import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types';
import type { Member, MembershipRequest } from '@/shared/types/studyGroupInterface';

class GroupMembershipService {
  private static instance: GroupMembershipService;

  private constructor() {}

  static getInstance(): GroupMembershipService {
    if (!GroupMembershipService.instance) {
      GroupMembershipService.instance = new GroupMembershipService();
    }
    return GroupMembershipService.instance;
  }

  async listMembers(groupId: string): Promise<Member[]> {
    const res = await apiService.get<ApiResponse<Member[]>>(`/study-groups/${groupId}/members`);
    return res.data.data;
  }

  async requestMembership(groupId: string, userId: string): Promise<MembershipRequest> {
    const res = await apiService.post<ApiResponse<MembershipRequest>>(
      `/study-groups/${groupId}/requests`,
      { userId }
    );
    return res.data.data;
  }

  async approveRequest(groupId: string, requestId: string): Promise<void> {
    await apiService.post(`/study-groups/${groupId}/requests/${requestId}/approve`);
  }

  async rejectRequest(groupId: string, requestId: string): Promise<void> {
    await apiService.post(`/study-groups/${groupId}/requests/${requestId}/reject`);
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    await apiService.delete(`/study-groups/${groupId}/members/${memberId}`);
  }
}

export const groupMembershipService = GroupMembershipService.getInstance();

export default GroupMembershipService;
