import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PasswordPolicySettingsDto {
  @IsOptional()
  @IsBoolean()
  requireStrong?: boolean;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(128)
  minLength?: number;

  @IsOptional()
  @IsBoolean()
  requireSpecialChars?: boolean;
}

export class AdminSystemSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  platformName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  platformDescription?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PasswordPolicySettingsDto)
  passwordPolicy?: PasswordPolicySettingsDto;

  @IsOptional()
  @IsBoolean()
  twoFactorAuthRequired?: boolean;

  @IsOptional()
  @IsIn([15, 30, 60, 120])
  sessionTimeout?: number;
}
