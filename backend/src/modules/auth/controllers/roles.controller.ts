import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Logger,
  Req,
} from '@nestjs/common';
import { Roles } from '#common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Role } from '#modules/auth/constants/role.constants';
import { AuditLogService } from '../../auth/services/audit-log.service';
import { securityEventTypes } from '#common/dto/security.dto';
import type { AuthenticatedRequest } from '#common/dto/user.dto';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionDto,
  CreatePermissionDto,
} from '../../../common/dto/roles.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.admin)
export class RolesController {
  private readonly logger = new Logger(RolesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  async getAllRoles(
    @Query('includePermissions') includePermissions: boolean = false,
  ) {
    try {
      const roles = await this.prisma.role.findMany({
        include: includePermissions ? { permissions: true } : undefined,
        orderBy: { hierarchyLevel: 'asc' },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        'unknown',
        'unknown',
        'unknown',
        { action: 'view_roles', success: true },
      );
      return roles;
    } catch (error) {
      this.logger.error(
        `Failed to fetch roles: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Post()
  async createRole(
    @Body() roleData: CreateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const role = await this.prisma.role.create({
        data: {
          name: roleData.name as any,
          description: roleData.description,
          color: roleData.color,
          hierarchyLevel: roleData.hierarchyLevel || 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        { action: 'create_role', roleName: role.name, success: true },
      );
      return role;
    } catch (error) {
      this.logger.error(
        `Failed to create role: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() updateData: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const role = await this.prisma.role.update({
        where: { id },
        data: {
          name: updateData.name as any,
          description: updateData.description,
          color: updateData.color,
          hierarchyLevel: updateData.hierarchyLevel,
          isActive:
            updateData.isActive !== undefined ? updateData.isActive : undefined,
          updatedAt: new Date(),
        },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        { action: 'update_role', roleId: id, success: true },
      );
      return role;
    } catch (error) {
      this.logger.error(
        `Failed to update role: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    try {
      await this.prisma.role.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        { action: 'delete_role', roleId: id, success: true },
      );
      return { message: 'Role soft-deleted' };
    } catch (error) {
      this.logger.error(
        `Failed to delete role: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Post(':id/permissions')
  async assignPermission(
    @Param('id') roleId: string,
    @Body() body: AssignPermissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const rolePermission = await this.prisma.rolePermission.create({
        data: {
          roleId,
          permissionId: body.permissionId,
          assignedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          action: 'assign_permission',
          roleId,
          permissionId: body.permissionId,
          success: true,
        },
      );
      return rolePermission;
    } catch (error) {
      this.logger.error(
        `Failed to assign permission: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Delete(':id/permissions/:permissionId')
  async removePermission(
    @Param('id') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      await this.prisma.rolePermission.delete({
        where: { roleId_permissionId: { roleId, permissionId } },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        { action: 'remove_permission', roleId, permissionId, success: true },
      );
      return { message: 'Permission removed' };
    } catch (error) {
      this.logger.error(
        `Failed to remove permission: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Get('permissions')
  async getAllPermissions() {
    try {
      const permissions = await this.prisma.permission.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        'unknown',
        'unknown',
        'unknown',
        { action: 'view_permissions', success: true },
      );
      return permissions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch permissions: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Post('permissions')
  async createPermission(
    @Body() permissionData: CreatePermissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const permission = await this.prisma.permission.create({
        data: {
          name: permissionData.name,
          resource: permissionData.resource,
          action: permissionData.action,
          description: permissionData.description,
          category: permissionData.category,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          action: 'create_permission',
          permissionName: permission.name,
          success: true,
        },
      );
      return permission;
    } catch (error) {
      this.logger.error(
        `Failed to create permission: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Delete('permissions/:id')
  async deletePermission(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      await this.prisma.permission.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        req.user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        { action: 'delete_permission', permissionId: id, success: true },
      );
      return { message: 'Permission soft-deleted' };
    } catch (error) {
      this.logger.error(
        `Failed to delete permission: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }
}
