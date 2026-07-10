// src/modules/roles/roles.module.ts
import { Module } from '@nestjs/common';
import { RolesController } from './controllers/roles.controller';
import { RolesService } from './services/roles.service';
import { RoleInitializationService } from './services/role-initialization.service';
import { RoleLimitingService } from './services/role-limiting.service';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [RolesController],
  providers: [RolesService, RoleInitializationService, RoleLimitingService],
  exports: [RolesService, RoleLimitingService],
})
export class RolesModule {}
