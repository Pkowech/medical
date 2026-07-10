import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsJSON,
  IsOptional,
  IsString,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  courseId!: string;

  @ApiProperty()
  @IsInt()
  order!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  estimatedDuration?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsJSON()
  learningObjectives?: Prisma.InputJsonValue;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  estimatedMinutes?: number | null;
}

export class UpdateUnitDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  estimatedDuration?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsJSON()
  learningObjectives?: Prisma.InputJsonValue;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  estimatedMinutes?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UnitResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  title?: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  description?: string | null;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  order!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  learningObjectives?: Prisma.JsonValue | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  materialsCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  progressPercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  topics?: any[];

  @ApiProperty({ required: false })
  @IsOptional()
  materials?: any[];

  @ApiProperty({ required: false })
  @IsOptional()
  course?: any;
}
