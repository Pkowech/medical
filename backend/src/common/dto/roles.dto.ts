import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @IsString()
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
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
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
