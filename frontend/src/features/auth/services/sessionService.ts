import { apiService } from '@/features/auth/services/apiClient';
import { GetSessionsResponse } from '@/shared/types';

const getSessions = async (): Promise<GetSessionsResponse> => {
  const response = await apiService.get<GetSessionsResponse>('/security/sessions');
  return response?.data ?? [];
};

const terminateSession = async (sessionId: string): Promise<void> => {
  await apiService.delete(`/security/sessions/${sessionId}`);
};

const logout = async (): Promise<void> => {
  // Call the consolidated logout endpoint
  await apiService.post('/auth/sessions/logout', {});
};

const revokeAllSessions = async (): Promise<void> => {
  // Alternative: revoke all sessions
  await apiService.post('/auth/sessions/revoke-all', {});
};

const terminateAllOtherSessions = async (): Promise<void> => {
  await apiService.delete('/security/sessions/terminate-others');
};

export const sessionService = {
  getSessions,
  terminateSession,
  logout,
  revokeAllSessions,
  terminateAllOtherSessions,
};
