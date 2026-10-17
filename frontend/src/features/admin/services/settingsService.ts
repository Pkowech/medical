import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';

export interface SystemSettings {
  platformName: string;
  platformDescription: string;
  maintenanceMode: boolean;
  passwordPolicy: {
    requireStrong: boolean;
    minLength: number;
    requireSpecialChars: boolean;
  };
  twoFactorAuthRequired: boolean;
  sessionTimeout: 15 | 30 | 60 | 120;
}

export type SystemSettingsUpdate = Partial<Omit<SystemSettings, 'passwordPolicy'>> & {
  passwordPolicy?: Partial<SystemSettings['passwordPolicy']>;
};

class SettingsService {
  async getSettings(): Promise<SystemSettings> {
    const response = await apiService.get<ApiResponse<SystemSettings>>('/admin/settings');
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  async updateSettings(settings: SystemSettingsUpdate): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      '/admin/settings',
      settings
    );
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  private unwrapPayload<T>(payload: unknown): T {
    if (!payload || typeof payload !== 'object') {
      throw new Error('The system settings service returned an invalid response.');
    }
    const record = payload as Record<string, unknown>;
    if ('data' in record) return record.data as T;
    return payload as T;
  }
}

export const settingsService = new SettingsService();
