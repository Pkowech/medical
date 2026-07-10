// src/modules/communication/dto/notification.dto.ts
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  type?: 'info' | 'success' | 'warning' | 'error';

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
