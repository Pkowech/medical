import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsIn } from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateRoleDto {
  @IsString()
  @IsIn(Object.values(RoleName))
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  hierarchyLevel?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionNames?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(RoleName))
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  hierarchyLevel?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionNames?: string[];
}

export class AssignPermissionDto {
  @IsString()
  permissionId!: string;
}

export class CreatePermissionDto {
  @IsString()
  name!: string;

  @IsString()
  resource!: string;

  @IsString()
  action!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
