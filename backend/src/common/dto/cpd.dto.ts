import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class CreateCPDRecordDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'CPD points earned' })
  @IsNumber()
  points!: number;

  @ApiProperty()
  @IsDateString()
  activityDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateUrl?: string;
}
