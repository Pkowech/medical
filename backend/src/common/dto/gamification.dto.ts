import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  requiredPoints!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePointsDto {
  @IsString()
  userId!: string;

  @IsNumber()
  points!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  category?: string;
}
