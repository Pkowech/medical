import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseDifficulty, MaterialType } from '@prisma/client';

/**
 * Base Material DTO with common properties
 */
export class BaseMaterialDto {
  @ApiProperty({ description: 'Material title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Material description' })
  @IsString()
  description!: string;

  @ApiProperty({ enum: MaterialType, description: 'Type of material' })
  @IsEnum(MaterialType)
  contentType!: MaterialType;

  @ApiProperty({ description: 'Material content' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    enum: CourseDifficulty,
    description: 'Material difficulty level',
  })
  @IsEnum(CourseDifficulty)
  @IsOptional()
  difficulty?: CourseDifficulty;

  @ApiPropertyOptional({ type: [String], description: 'Material tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

/**
 * Create Material DTO
 */
export class CreateMaterialDto extends BaseMaterialDto {
  @ApiProperty({ description: 'Material unique identifier' })
  @IsString()
  @IsNotEmpty()
  materialId!: string;

  @ApiPropertyOptional({ description: 'Unit ID this material belongs to' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Material author' })
  @IsString()
  @IsOptional()
  author?: string;

  @ApiPropertyOptional({ description: 'Material source/reference' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({
    description: 'Answer/solution for flashcards/quizzes',
  })
  @IsString()
  @IsOptional()
  answer?: string;

  @ApiProperty({ description: 'Creator user ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/**
 * Update Material DTO
 */
export class UpdateMaterialDto {
  @ApiPropertyOptional({ description: 'Material title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Material description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: MaterialType, description: 'Type of material' })
  @IsEnum(MaterialType)
  @IsOptional()
  contentType?: MaterialType;

  @ApiPropertyOptional({ description: 'Material content' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    enum: CourseDifficulty,
    description: 'Material difficulty level',
  })
  @IsEnum(CourseDifficulty)
  @IsOptional()
  difficulty?: CourseDifficulty;

  @ApiPropertyOptional({ type: [String], description: 'Material tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Material ID' })
  @IsString()
  @IsOptional()
  materialId?: string;

  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Author' })
  @IsString()
  @IsOptional()
  author?: string;

  @ApiPropertyOptional({ description: 'Source' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: 'Answer/solution' })
  @IsString()
  @IsOptional()
  answer?: string;
}

/**
 * Material Response DTO
 */
export class MaterialResponseDto extends BaseMaterialDto {
  @ApiProperty({ description: 'Material ID' })
  id!: string;

  @ApiProperty({ description: 'Material creation date' })
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({ description: 'Material last update date' })
  @Type(() => Date)
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Version number — incremented on each content update',
  })
  version?: number;

  @ApiPropertyOptional({
    description:
      "Whether the current user's progress is stale (material updated since last view)",
  })
  isStale?: boolean;

  @ApiPropertyOptional({ description: 'Unit this material belongs to' })
  unit?: {
    id: string;
    name: string;
    order: number;
  };

  @ApiPropertyOptional({ description: 'Material creator' })
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
  };

  @ApiPropertyOptional({ description: 'Material analytics' })
  analytics?: {
    views: number;
    completions: number;
    averageRating: number;
    timeSpent: number;
    difficulty: number;
  };
}
