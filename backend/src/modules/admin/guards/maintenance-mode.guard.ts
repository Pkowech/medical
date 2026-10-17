import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminSettingsService } from '../services/admin-settings.service';

@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  constructor(private readonly settingsService: AdminSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      path?: string;
      originalUrl?: string;
    }>();
    const path = (request.originalUrl || request.path || '').split('?')[0];

    if (
      path === '/health' ||
      path === '/metrics' ||
      path.startsWith('/api/docs') ||
      path.startsWith('/v1/auth/') ||
      path === '/v1/auth' ||
      path.startsWith('/v1/admin/')
    ) {
      return true;
    }

    const settings = await this.settingsService.getSettings();
    if (settings.maintenanceMode) {
      throw new ServiceUnavailableException(
        'The platform is temporarily unavailable for maintenance.',
      );
    }
    return true;
  }
}
