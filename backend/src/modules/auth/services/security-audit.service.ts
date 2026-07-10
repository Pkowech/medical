import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { SecurityAudit } from '@prisma/client';
import { Role } from '#modules/auth/constants/role.constants';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  private readonly sensitiveActions = new Set([
    'userCreate',
    'userDelete',
    'userRoleChange',
    'medicalRecordAccess',
    'medicalRecordModify',
    'systemConfigChange',
    'authLoginFailed',
    'authPasswordReset',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(params: {
    action: string;
    userId: string;
    role: Role;
    targetId?: string;
    targetType?: string;
    ipAddress: string;
    details?: Record<string, any>;
    status: 'success' | 'failure';
  }): Promise<void> {
    const {
      action,
      userId,
      role,
      targetId: _targetId,
      targetType: _targetType,
      ipAddress,
      details,
      status,
    } = params;

    const isSensitive = this.sensitiveActions.has(action);

    const audit = await this.prisma.securityAudit.create({
      data: {
        action,
        userId: userId || null,
        resource: action, // Using action as resource for now
        ipAddress: ipAddress || null,
        details: details || {},
        isSensitive,
        userAgent: '', // Required by schema
        status: status as string,
        role: role as string,
      },
    });

    if (isSensitive || status === 'failure') {
      this.logger.warn({
        message: 'Security audit event logged',
        ...params,
        timestamp: audit.createdAt,
      });
    }
  }

  async getRecentFailedActions(minutes: number = 15): Promise<SecurityAudit[]> {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - minutes);

    return this.prisma.securityAudit.findMany({
      where: {
        status: 'failure',
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserActionHistory(userId: string): Promise<SecurityAudit[]> {
    return this.prisma.securityAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // Fixed: Use createdAt if no timestamp field
      take: 100,
    });
  }

  async getSensitiveActionsByRole(role: Role): Promise<SecurityAudit[]> {
    return this.prisma.securityAudit.findMany({
      where: {
        role,
        isSensitive: true,
      },
      orderBy: { createdAt: 'desc' }, // Fixed: Use createdAt
      take: 50,
    });
  }
}
