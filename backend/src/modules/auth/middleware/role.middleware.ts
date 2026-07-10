import {
  Injectable,
  NestMiddleware,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '#common/dto/user.dto';
import { securityEventTypes } from '#common/dto/security.dto';
import { AuditLogService } from '../../auth/services/audit-log.service';
import { Role, roleHierarchy } from '#modules/auth/constants/role.constants';

@Injectable()
export class RoleMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RoleMiddleware.name);

  private readonly RESOURCE_ROLE_MAP: Record<string, Role> = {
    '/api/admin': Role.admin,
    '/api/courses/manage': Role.instructor,
    '/api/clinical-cases': Role.instructor,
    '/api/medical-records': Role.moderator,
  };

  constructor(
    private readonly auditLogService: AuditLogService,
    private configService: ConfigService, // For future dynamic map
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const user = req.user;
    if (!user) {
      next();
      return;
    }

    const primaryRole = user.role || Role.student;
    req.role = primaryRole;
    req.roleLevel = roleHierarchy[primaryRole] || 0;

    const path = req.path;
    const requiredRole = this.getRequiredRoleForPath(path);

    if (requiredRole && !this.hasAccess(primaryRole, requiredRole)) {
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        user.id || 'unknown',
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          success: false,
          reason: 'UNAUTHORIZED_ACCESS',
          path,
          requiredRole,
          userRole: primaryRole,
        },
      );
      throw new ForbiddenException(
        `Access denied to ${path}. Required role: ${requiredRole}`,
      );
    }

    next();
  }

  private getRequiredRoleForPath(path: string): Role | null {
    for (const [pattern, role] of Object.entries(this.RESOURCE_ROLE_MAP)) {
      if (path.startsWith(pattern)) {
        return role;
      }
    }
    return null;
  }

  private hasAccess(userRole: Role, requiredRole: Role): boolean {
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
}
