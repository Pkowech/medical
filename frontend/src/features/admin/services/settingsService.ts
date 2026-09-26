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
  private readonly baseUrl = '/auth/security';

  async getSettings(): Promise<SystemSettings> {
    const response = await apiService.get<ApiResponse<SystemSettings>>(`${this.baseUrl}/settings`);
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  async updateGeneralSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/settings`,
      settings
    );
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  async updateSecuritySettings(
    settings: Partial<SystemSettings['passwordPolicy']>
  ): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/settings`,
      settings
    );
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  async updateNotificationSettings(
    settings: Partial<SystemSettings['emailNotifications']>
  ): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/settings`,
      settings
    );
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  async updatePrivacySettings(
    settings: Partial<SystemSettings['privacySettings']>
  ): Promise<SystemSettings> {
    const response = await apiService.put<ApiResponse<SystemSettings>>(
      `${this.baseUrl}/settings`,
      settings
    );
    return this.unwrapPayload<SystemSettings>(response.data);
  }

  async triggerBackup(): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<ApiResponse<{ success: boolean; message: string }>>(
      `${this.baseUrl}/backup-codes/generate`,
      {}
    );
    return this.unwrapPayload<{ success: boolean; message: string }>(response.data);
  }

  async getBackupStatus(): Promise<{
    lastBackup: string;
    nextBackup: string;
    status: 'idle' | 'running' | 'failed';
  }> {
    const response = await apiService.get<ApiResponse<unknown>>(`${this.baseUrl}/settings`);
    return this.unwrapPayload<{
      lastBackup: string;
      nextBackup: string;
      status: 'idle' | 'running' | 'failed';
    }>(response.data);
  }

  private unwrapPayload<T>(payload: unknown): T {
    if (!payload || typeof payload !== 'object') {
      return payload as T;
    }

    const record = payload as Record<string, unknown>;
    if (record.data !== undefined) {
      return record.data as T;
    }

    return payload as T;
  }
}

export const settingsService = new SettingsService();
