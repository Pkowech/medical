import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { AdminSystemSettingsDto } from '../dto/system-settings.dto';

export interface AppSystemSettings {
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

const DEFAULT_SETTINGS: AppSystemSettings = {
  platformName: 'MedTrack Hub',
  platformDescription: 'Medical education platform for students and professionals',
  maintenanceMode: false,
  passwordPolicy: {
    requireStrong: true,
    minLength: 8,
    requireSpecialChars: true,
  },
  twoFactorAuthRequired: false,
  sessionTimeout: 120,
};

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSystemSettings> {
    const row = await this.prisma.appSystemSettings.findUnique({
      where: { id: 'global' },
      select: { settings: true },
    });
    const stored = this.asSettingsObject(row?.settings);
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      passwordPolicy: {
        ...DEFAULT_SETTINGS.passwordPolicy,
        ...this.asSettingsObject(stored.passwordPolicy),
      },
    } as AppSystemSettings;
  }

  async updateSettings(update: AdminSystemSettingsDto): Promise<AppSystemSettings> {
    const current = await this.getSettings();
    const updated: AppSystemSettings = {
      ...current,
      ...update,
      sessionTimeout:
        update.sessionTimeout === undefined
          ? current.sessionTimeout
          : this.validateSessionTimeout(update.sessionTimeout),
      passwordPolicy: {
        ...current.passwordPolicy,
        ...update.passwordPolicy,
      },
    };

    await this.prisma.appSystemSettings.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        settings: updated as unknown as Prisma.InputJsonObject,
      },
      update: {
        settings: updated as unknown as Prisma.InputJsonObject,
      },
    });
    return updated;
  }

  async validatePassword(password: string): Promise<void> {
    const { passwordPolicy } = await this.getSettings();
    const errors: string[] = [];
    if (password.length < passwordPolicy.minLength) {
      errors.push(`Password must be at least ${passwordPolicy.minLength} characters long.`);
    }
    if (passwordPolicy.requireStrong) {
      if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
      if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
      if (!/\d/.test(password)) errors.push('Password must contain a number.');
    }
    if (passwordPolicy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain a special character.');
    }
    if (errors.length) {
      throw new BadRequestException(errors);
    }
  }

  private validateSessionTimeout(value: number): AppSystemSettings['sessionTimeout'] {
    if (value === 15 || value === 30 || value === 60 || value === 120) {
      return value;
    }
    throw new BadRequestException('Session timeout must be 15, 30, 60, or 120 minutes.');
  }

  private asSettingsObject(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}
