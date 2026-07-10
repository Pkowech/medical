import { IsOptional, IsString, IsObject, IsDateString } from 'class-validator';

export class CreateXapiStatementDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsObject()
  actor?: Record<string, any>;

  @IsOptional()
  @IsObject()
  verb?: Record<string, any> | string;

  @IsOptional()
  @IsObject()
  object?: Record<string, any>;

  @IsOptional()
  @IsObject()
  result?: Record<string, any>;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
