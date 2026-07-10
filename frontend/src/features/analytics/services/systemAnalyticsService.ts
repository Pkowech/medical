import apiClient from '@/features/auth/services/apiClient';
import type { SystemAnalytics, GetSystemAnalyticsResponse } from '@/shared/types/systemInterface';

class SystemAnalyticsService {
  private readonly baseUrl = '/analytics/system/metrics';

  async getSystemAnalytics(): Promise<SystemAnalytics> {
    const response = await apiClient.get<GetSystemAnalyticsResponse>(this.baseUrl);
    return response.data.data;
  }

  async getSystemOverview(): Promise<SystemAnalytics['overview']> {
    const analytics = await this.getSystemAnalytics();
    return analytics.overview;
  }

  async getUserActivityMetrics(): Promise<SystemAnalytics['userActivity']> {
    const analytics = await this.getSystemAnalytics();
    return analytics.userActivity;
  }

  async getContentPerformanceMetrics(): Promise<SystemAnalytics['contentPerformance']> {
    const analytics = await this.getSystemAnalytics();
    return analytics.contentPerformance;
  }

  async exportAnalyticsReport(format: 'csv' | 'pdf' = 'csv'): Promise<Blob> {
    const response = await apiClient.get(`${this.baseUrl}/export?format=${format}`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }
}

export const systemAnalyticsService = new SystemAnalyticsService();

// Backwards-compatible named exports
export async function getSystemOverview() {
  return systemAnalyticsService.getSystemOverview();
}

export async function getUserActivityMetrics() {
  return systemAnalyticsService.getUserActivityMetrics();
}

export async function getContentPerformanceMetrics() {
  return systemAnalyticsService.getContentPerformanceMetrics();
}
