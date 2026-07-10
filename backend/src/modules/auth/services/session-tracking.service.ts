import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '#infrastructure/redis/redis.service';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
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
  ) {}

  async trackSession(
    sessionId: string,
    sessionInfo: SessionInfo,
  ): Promise<void> {
    const userSessionsKey = `${this.userSessionsPrefix}${sessionInfo.userId}`;
    const maxAllowed = this.maxSessions[sessionInfo.role as Role] || 1;

    const currentSessions =
      await this.redisService.getSetMembers(userSessionsKey);
    if (currentSessions.length >= maxAllowed) {
      const oldestSession = await this.getOldestSession(currentSessions);
      if (oldestSession) {
        await this.removeSession(oldestSession, sessionInfo.userId);
        this.logger.warn(
          `Removed oldest session for user ${sessionInfo.userId} due to limit`,
        );
      }
    }

    await this.redisService.set(
      `${this.prefix}${sessionId}`,
      JSON.stringify(sessionInfo),
      86400,
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
    await this.redisService.del(`${this.prefix}${sessionId}`);
    await this.redisService.removeFromSet(
      `${this.userSessionsPrefix}${userId}`,
      sessionId,
    );

    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });

    await this.auditLogService.log(
      securityEventTypes.sessionRevoked,
      userId,
      'unknown',
      'unknown',
      { success: true, sessionId },
    );
  }

  async endSessionByToken(userId: string, token: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: { userId, token, revokedAt: null },
    });

    if (session) {
      await this.removeSession(session.id, userId);
    }
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await this.redisService.getSetMembers(
      `${this.userSessionsPrefix}${userId}`,
    );

    // Batch fetch DB sessions for perf
    const dbSessions = await this.prisma.userSession.findMany({
      where: { id: { in: sessionIds }, revokedAt: null },
      select: { id: true, expiresAt: true, revokedAt: true, createdAt: true },
    });
    const validDbIds = new Set(dbSessions.map((s) => s.id));

    const sessions = await Promise.all(
      sessionIds.map(async (id): Promise<SessionInfo | null> => {
        if (!validDbIds.has(id)) {
          return null;
        }
        const session = await this.getSession(id);
        if (session) {
          const dbSession = dbSessions.find((s) => s.id === id);
          if (dbSession && dbSession.expiresAt > new Date()) {
            return {
              ...session,
              expiresAt: dbSession.expiresAt,
              revokedAt: dbSession.revokedAt,
              createdAt: dbSession.createdAt,
            };
          }
        }
        return null;
      }),
    );

    return sessions.filter((s): s is SessionInfo => s !== null);
  }

  private async getSession(sessionId: string): Promise<SessionInfo | null> {
    const data = await this.redisService.get(`${this.prefix}${sessionId}`);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as SessionInfo;
  }

  private async getOldestSession(sessionIds: string[]): Promise<string | null> {
    const sessions = await Promise.all(
      sessionIds.map(async (id) => {
        const info = await this.getSession(id);
        return info ? { id, createdAt: info.createdAt } : null;
      }),
    );

    const valid = sessions.filter(
      (s): s is { id: string; createdAt: Date } => s !== null,
    );
    return valid.length > 0
      ? valid.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
          .id
      : null;
  }
}
