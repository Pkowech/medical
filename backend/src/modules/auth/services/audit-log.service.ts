import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import type {
  AuditLogEntry,
  SecurityEventType,
} from '#common/dto/security.dto';
import * as crypto from 'crypto';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('security.audit')
  async handleSecurityEvent(payload: {
    eventType: SecurityEventType;
    userId: string;
    ipAddress: string;
    userAgent: string;
    eventData?: any;
  }) {
    await this.log(
      payload.eventType,
      payload.userId,
      payload.ipAddress,
      payload.userAgent,
      payload.eventData,
    );
  }

  async log(
    eventType: SecurityEventType,
    userId: string,
    ipAddress: string,
    userAgent: string,
    eventData?: any,
  ): Promise<void> {
    try {
      const isGuestSession = userId?.startsWith('guest_');
      let user = null;
      // Avoid database query for 'unknown' or guest users
      if (userId && !isGuestSession && userId !== 'unknown') {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { userRoles: true },
        });
      }

      // If user is not found, or if userId is 'unknown', use null for the audit log.
      const effectiveUserId = user ? user.id : null;

      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        userId: effectiveUserId,
        action: eventType,
        resource: eventData?.resource || 'auth',
        details: {
          userEmail: user?.email || 'unknown',
          isGuestSession,
          guestSessionId: isGuestSession ? userId : undefined,
          originalUserId: userId !== effectiveUserId ? userId : undefined, // Log the original identifier if different
          ...eventData,
        },
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        status: eventData?.success ? 'success' : 'failure',
        metadata: {
          ...eventData,
          environment: process.env.NODE_ENV || 'production',
          timestamp: new Date().toISOString(),
        },
      };

      await this.prisma.securityAudit.create({
        data: {
          id: entry.id,
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          details: entry.details as any,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          createdAt: entry.timestamp,
        },
      });

      // Also create a SecurityEvent record for regular users, if the user exists
      if (entry.userId) {
        await this.prisma.securityEvent.create({
          data: {
            userId: entry.userId,
            eventType: entry.action,
            description: `User ${entry.action}`,
            details: entry.details as any,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            severity: eventData?.success ? 'low' : 'high', // More dynamic severity
          },
        });
      }

      this.logger.log(
        `Audit log entry created for user ${userId} (Action: ${eventType})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create audit log entry for user ${userId} (Action: ${eventType}): ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  async getAuditLogs(page: number, limit: number): Promise<AuditLogEntry[]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const auditLogs = await this.prisma.securityAudit.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return auditLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      userId: log.userId || undefined,
      action: log.action as SecurityEventType,
      resource: log.resource || 'unknown',
      details: log.details,
      ipAddress: log.ipAddress || 'unknown',
      userAgent: log.userAgent || 'unknown',
      status: (log.status as 'success' | 'failure') || 'failure',
      metadata: log.details, // Re-using details for metadata for now
    }));
  }
}
