import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray } from 'class-validator';

// NOTE: AdminDashboardResponseDto, UserStatisticsDto, AdminResponseDto,
// CreateAdminDto, and UpdateAdminDto have been removed as they were unused
// and causing circular dependency issues in Swagger documentation generation.

export class AssignRoleDto {
  @ApiProperty({ description: 'User ID to assign roles to' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'List of role IDs to assign', type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}

export class UpdateRolesDto {
  @ApiProperty({ description: 'List of role IDs to update', type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}

export class RolesResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'List of assigned role IDs', type: [String] })
  roleIds!: string[];
}
