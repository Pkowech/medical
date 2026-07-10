import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';

export interface SystemSettings {
  id: string;
  platformName: string;
  platformDescription: string;
  maintenanceMode: boolean;
  passwordPolicy: {
    requireStrong: boolean;
    minLength: number;
    requireSpecialChars: boolean;
  };
  twoFactorAuthRequired: boolean;
  sessionTimeout: number; // in minutes
  emailNotifications: {
    newUserRegistrations: boolean;
    courseUpdates: boolean;
    systemMaintenance: boolean;
  };
  privacySettings: {
    allowPublicProfile: boolean;
    allowDataExport: boolean;
  };
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  createdAt: string;
  updatedAt: string;
}

class SettingsService {
  private readonly baseUrl = '/admin/settings';

  async getSettings(): Promise<SystemSettings> {
    const response = await apiService.get<ApiResponse<SystemSettings>>(this.baseUrl);
    return response.data.data;
  }

  async updateGeneralSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/general`,
      settings
    );
    return response.data.data;
  }

  async updateSecuritySettings(
    settings: Partial<SystemSettings['passwordPolicy']>
  ): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/security`,
      settings
    );
    return response.data.data;
  }

  async updateNotificationSettings(
    settings: Partial<SystemSettings['emailNotifications']>
  ): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/notifications`,
      settings
    );
    return response.data.data;
  }

  async updatePrivacySettings(
    settings: Partial<SystemSettings['privacySettings']>
  ): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/privacy`,
      settings
    );
    return response.data.data;
  }

  async triggerBackup(): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<ApiResponse<{ success: boolean; message: string }>>(
      `${this.baseUrl}/backup`,
      {}
    );
    return response.data.data;
  }

  async getBackupStatus(): Promise<{
    lastBackup: string;
    nextBackup: string;
    status: 'idle' | 'running' | 'failed';
  }> {
    const response = await apiService.get<ApiResponse<unknown>>(`${this.baseUrl}/backup-status`);
    return response.data.data as {
      lastBackup: string;
      nextBackup: string;
      status: 'idle' | 'running' | 'failed';
    };
  }
}

export const settingsService = new SettingsService();
