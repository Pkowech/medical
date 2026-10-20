import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class UserNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  progress?: boolean;
}

export class UserPreferenceSettingsDto {
  @IsOptional()
  @IsIn(['en', 'es', 'fr', 'de', 'sw'])
  language?: string;

  @IsOptional()
  @IsIn(['Africa/Nairobi', 'Africa/Dar_es_Salaam', 'Africa/Kampala', 'UTC'])
  timezone?: string;
}

export class UserPrivacySettingsDto {
  @IsOptional()
  @IsIn(['public', 'private'])
  profileVisibility?: 'public' | 'private';

  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  showLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMessages?: boolean;
}

export class UserSecurityPreferenceDto {
  @IsOptional()
  @IsBoolean()
  loginNotifications?: boolean;
}

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserNotificationSettingsDto)
  notifications?: UserNotificationSettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserPreferenceSettingsDto)
  preferences?: UserPreferenceSettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserPrivacySettingsDto)
  privacy?: UserPrivacySettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserSecurityPreferenceDto)
  security?: UserSecurityPreferenceDto;
}
