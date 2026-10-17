import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { AdminSettingsService } from './services/admin-settings.service';
import { MaintenanceModeGuard } from './guards/maintenance-mode.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    AdminSettingsService,
    {
      provide: APP_GUARD,
      useClass: MaintenanceModeGuard,
    },
  ],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
