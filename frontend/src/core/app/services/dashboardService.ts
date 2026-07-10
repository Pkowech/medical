import { apiService } from '@/features/auth/services/apiClient';

// Lightweight service wrapper for dashboard-related API endpoints
export async function getUserProgress(userId: string) {
  const response = await apiService.get<{ data: any }>(`/progress/dashboard/${userId}`);
  return response.data;
}

export async function getDeadlines(userId: string) {
  const response = await apiService.get<any>(`/progress/dashboard/${userId}`);
  return response.data?.deadlines || [];
}

export async function getStudyEvents(userId?: string) {
  const url = userId ? `/study-events?userId=${userId}` : '/study-events';
  const response = await apiService.get(url);
  return response.data;
}

export async function getBadges(userId?: string) {
  const url = userId ? `/badges?userId=${userId}` : '/badges';
  const response = await apiService.get(url);
  return response.data;
}

export async function getSystemAnalytics() {
  const response = await apiService.get('/analytics/system/metrics');
  return response.data;
}

export async function getCPDActivities(userId?: string) {
  const url = userId ? `/cpd/activities?userId=${userId}` : `/cpd/activities`;
  try {
    const response = await apiService.get(url);
    return response.data;
  } catch (error: unknown) {
    // The original function had special 404 handling, so we replicate it.
    // Narrow the unknown error to check common shapes without using `any`.
    const maybeErr = error as { status?: number; message?: string } | { response?: { status?: number; data?: { message?: string } } } | undefined;
    const status = (maybeErr && 'status' in maybeErr && maybeErr.status) || (maybeErr && 'response' in maybeErr && maybeErr.response?.status);
    const message = (maybeErr && 'message' in maybeErr && maybeErr.message) || (maybeErr && 'response' in maybeErr && maybeErr.response?.data?.message) || '';

    if (status === 404 || message.includes('404') || message.includes('Not Found')) {
      console.warn(`CPD Activities endpoint not found, returning empty array.`);
      return [];
    }
    throw error;
  }
}
