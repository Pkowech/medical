import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { AuthController } from './controllers/auth.controller';
import { SecurityController } from './controllers/security.controller';
import { SessionsController } from './controllers/sessions.controller';
import { AuditController } from './controllers/audit.controller';
import { AuthService } from './services/auth.service';
import { SecurityService } from './services/security.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { SecurityAuditService } from './services/security-audit.service';
import { AuditLogService } from './services/audit-log.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionTrackingService } from './services/session-tracking.service';
import { PermissionCalculationService } from './services/permission-calculation.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { RolesModule } from './roles.module';
import { CacheModule } from '@nestjs/cache-manager';

@Global()
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    PassportModule,
    PrismaModule,
    RolesModule,
    CacheModule.register(),
  ],
  controllers: [
    AuthController,
    SecurityController,
    SessionsController,
    AuditController,
  ],
  providers: [
    AuthService,

    SecurityService,
    TokenBlacklistService,
    SecurityAuditService,
    AuditLogService,
    RefreshTokenService,
    SessionTrackingService,
    JwtStrategy,
    RoleGuard,
    JwtAuthGuard,
    PermissionCalculationService,
  ],
  exports: [
    AuthService,

    SecurityService,
    TokenBlacklistService,
    SecurityAuditService,
    AuditLogService,
    RefreshTokenService,
    SessionTrackingService,
    PermissionCalculationService,
  ],
})
export class AuthModule {}
