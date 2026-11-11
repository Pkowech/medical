import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '#infrastructure/redis/redis.service';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { RefreshTokenService } from './refresh-token.service';
import type { SessionInfo } from '#common/dto/security.dto';
import { Role } from '#modules/auth/constants/role.constants';
import { securityEventTypes } from '#common/dto/security.dto';

@Injectable()
export class SessionTrackingService {
  private readonly logger = new Logger(SessionTrackingService.name);
  private readonly prefix = 'session:';
  private readonly userSessionsPrefix = 'userSessions:';
  private readonly maxSessions = {
    [Role.admin]: 2,
    [Role.moderator]: 3,
    [Role.instructor]: 5,
    [Role.student]: 3,
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async trackSession(
    sessionId: string,
    sessionInfo: SessionInfo & { token: string; expiresAt: Date },
  ): Promise<void> {
    const userSessionsKey = `${this.userSessionsPrefix}${sessionInfo.userId}`;
    const maxAllowed = this.maxSessions[sessionInfo.role as Role] || 1;
    const existing = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, token: true, revokedAt: true },
    });

    if (existing && existing.userId !== sessionInfo.userId) {
      throw new Error('Session ID is already associated with another user.');
    }
    if (existing?.revokedAt) {
      throw new Error('A revoked session cannot be reused.');
    }

    if (existing) {
      await this.tokenBlacklistService.blacklistToken(existing.token);
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: {
          token: sessionInfo.token,
          deviceId: sessionInfo.deviceId,
          ipAddress: sessionInfo.ipAddress,
          userAgent: sessionInfo.userAgent,
          expiresAt: sessionInfo.expiresAt,
          lastAccessed: new Date(),
          isActive: true,
        },
      });
    } else {
      const activeSessions = await this.prisma.userSession.findMany({
        where: {
          userId: sessionInfo.userId,
          isActive: true,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (activeSessions.length >= maxAllowed) {
        await this.removeSession(activeSessions[0].id, sessionInfo.userId);
        this.logger.warn(
          `Removed oldest session for user ${sessionInfo.userId} due to limit`,
        );
      }

      await this.prisma.userSession.create({
        data: {
          id: sessionId,
          userId: sessionInfo.userId,
          token: sessionInfo.token,
          deviceId: sessionInfo.deviceId,
          ipAddress: sessionInfo.ipAddress,
          userAgent: sessionInfo.userAgent,
          expiresAt: sessionInfo.expiresAt,
          createdAt: sessionInfo.createdAt,
          isActive: true,
        },
      });
    }

    const sessionMetadata: SessionInfo = { ...sessionInfo };
    delete sessionMetadata.token;
    await this.redisService.set(
      `${this.prefix}${sessionId}`,
      JSON.stringify(sessionMetadata),
      Math.max(1, Math.ceil((sessionInfo.expiresAt.getTime() - Date.now()) / 1000)),
    );

    await this.redisService.addToSet(userSessionsKey, sessionId);

    await this.auditLogService.log(
      securityEventTypes.sessionCreated,
      sessionInfo.userId,
      sessionInfo.ipAddress || 'unknown',
      sessionInfo.userAgent || 'unknown',
      { success: true, role: sessionInfo.role },
    );

    this.logger.log(
      `Session tracked for user ${sessionInfo.userId} (${sessionInfo.role})`,
    );
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const dbSession = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
    if (!dbSession || dbSession.revokedAt || dbSession.expiresAt < new Date()) {
      return false;
    }

    session.expiresAt = new Date(dbSession.expiresAt);
    await this.redisService.set(
      `${this.prefix}${sessionId}`,
      JSON.stringify(session),
      86400,
    );

    return true;
  }

  async removeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { token: true },
    });
    if (session) {
      await this.tokenBlacklistService.blacklistToken(session.token);
    }

    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date(), isActive: false },
    });
    await this.refreshTokenService.revokeSessionTokens(userId, sessionId);
    await this.redisService.del(`${this.prefix}${sessionId}`);
    await this.redisService.removeFromSet(
      `${this.userSessionsPrefix}${userId}`,
      sessionId,
    );

    await this.auditLogService.log(
      securityEventTypes.sessionRevoked,
      userId,
      'unknown',
      'unknown',
      { success: true, sessionId },
    );
  }

  async endSessionByToken(userId: string, token: string): Promise<boolean> {
    const session = await this.prisma.userSession.findFirst({
      where: { userId, token, revokedAt: null },
    });

    if (session) {
      await this.removeSession(session.id, userId);
      return true;
    }
    return false;
  }

  async revokeAllSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    for (const session of sessions) {
      await this.removeSession(session.id, userId);
    }
    return sessions.length;
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const dbSessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        deviceId: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        lastAccessed: true,
        isActive: true,
      },
    });

    return Promise.all(
      dbSessions.map(async (dbSession) => {
        const cached = await this.getSession(dbSession.id);
        const session: SessionInfo = {
          ...cached,
          id: dbSession.id,
          userId: dbSession.userId,
          role: cached?.role ?? 'unknown',
          deviceId: dbSession.deviceId ?? cached?.deviceId,
          ipAddress: dbSession.ipAddress ?? cached?.ipAddress,
          userAgent: dbSession.userAgent ?? cached?.userAgent,
          expiresAt: dbSession.expiresAt,
          revokedAt: dbSession.revokedAt,
          createdAt: dbSession.createdAt,
          lastAccessed: dbSession.lastAccessed ?? undefined,
          isActive: dbSession.isActive,
        };
        delete session.token;
        return session;
      }),
    );
  }

  private async getSession(sessionId: string): Promise<SessionInfo | null> {
    const data = await this.redisService.get(`${this.prefix}${sessionId}`);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as SessionInfo;
  }

}
