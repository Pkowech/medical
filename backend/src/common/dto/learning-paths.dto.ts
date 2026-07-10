import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
  Max,
  IsDate,
  IsBoolean,
} from 'class-validator';
import {
  LearningPathCategory,
  LearningPathStatus,
  LearningPathType,
} from '@prisma/client';

export class ModuleDto {
  @ApiProperty({ description: 'Module ID' })
  @IsString()
  id!: string;

  @ApiProperty({
    enum: ['course', 'assessment', 'clinicalCase', 'resource', 'milestone'],
    description: 'Module type',
  })
  @IsString()
  type!: 'course' | 'assessment' | 'clinicalCase' | 'resource' | 'milestone';

  @ApiProperty({ description: 'Resource ID' })
  @IsString()
  resourceId!: string;

  @ApiProperty({ description: 'Module title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Is module required' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ description: 'Module order' })
  @IsNumber()
  order!: number;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  @IsOptional()
  @IsNumber()
  estimatedMinutes?: number;

  @ApiPropertyOptional({ description: 'Passing score required' })
  @IsOptional()
  @IsNumber()
  passingScore?: number;
}

export class PhaseRequirementsDto {
  @ApiPropertyOptional({ description: 'Minimum modules to complete' })
  @IsOptional()
  @IsNumber()
  minModulesCompleted?: number;

  @ApiPropertyOptional({ description: 'Minimum score required' })
  @IsOptional()
  @IsNumber()
  minScoreRequired?: number;
}

export class PhaseDto {
  @ApiProperty({ description: 'Phase ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Phase title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Phase description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Phase order' })
  @IsNumber()
  order!: number;

  @ApiProperty({ description: 'Modules in this phase' })
  @IsArray()
  modules!: ModuleDto[];

  @ApiPropertyOptional({ description: 'Phase requirements' })
  @IsOptional()
  @IsObject()
  requirements?: PhaseRequirementsDto;
}

export class PathStructureDto {
  @ApiProperty({ description: 'Path ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Path title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Path description' })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Modules at top-level (optional if using phases)',
  })
  @IsArray()
  modules!: ModuleDto[];

  @ApiProperty({ description: 'Learning path phases' })
  @IsArray()
  phases!: PhaseDto[];
}

export class CustomScheduleItemDto {
  @ApiProperty({ description: 'Scheduled date' })
  @IsDate()
  @Type(() => Date)
  date!: Date;

  @ApiProperty({ description: 'Scheduled time' })
  @IsString()
  time!: string;
}

export class PreferencesDto {
  @ApiPropertyOptional({
    enum: ['slow', 'moderate', 'fast'],
    description: 'Learning pace',
  })
  @IsOptional()
  @IsEnum(['slow', 'moderate', 'fast'])
  pace?: 'slow' | 'moderate' | 'fast';

  @ApiPropertyOptional({ description: 'Schedule preferences' })
  @IsOptional()
  @IsObject()
  schedule?: {
    daysOfWeek: number[];
    preferredTime: string;
  };
}

export class CreateLearningPathDto {
  @ApiProperty({ description: 'Path title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Path description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: LearningPathType, description: 'Path type' })
  @IsOptional()
  @IsEnum(LearningPathType)
  type?: LearningPathType;

  @ApiProperty({ enum: LearningPathCategory, description: 'Path category' })
  @IsEnum(LearningPathCategory)
  category!: LearningPathCategory;

  @ApiProperty({ description: 'Difficulty level' })
  @IsString()
  difficulty!: string;

  @ApiProperty({ description: 'Estimated duration in weeks' })
  @IsNumber()
  @Min(1)
  @Max(52)
  estimatedDurationWeeks!: number;

  @ApiProperty({ description: 'Estimated hours per week' })
  @IsNumber()
  @Min(1)
  @Max(40)
  estimatedHoursPerWeek!: number;

  @ApiPropertyOptional({ description: 'Path tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Learning objectives' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningObjectives?: string[];

  @ApiPropertyOptional({ description: 'Prerequisites' })
  @IsOptional()
  @IsObject()
  prerequisites?: Record<string, unknown>;

  @ApiProperty({ description: 'Path structure with phases and modules' })
  @IsObject()
  pathStructure!: PathStructureDto;

  @ApiPropertyOptional({ description: 'Associated course IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courseIds?: string[];

  @ApiPropertyOptional({ description: 'Associated assessment IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assessmentIds?: string[];

  @ApiPropertyOptional({ description: 'Associated clinical case IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clinicalCaseIds?: string[];
}

export class UpdateLearningPathDto {
  @ApiPropertyOptional({ description: 'Path title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Path description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Path structure with phases and modules',
  })
  @IsOptional()
  @IsObject()
  pathStructure?: PathStructureDto;
}

export class LearningPathFiltersDto {
  @ApiPropertyOptional({
    enum: LearningPathCategory,
    description: 'Filter by category',
  })
  @IsOptional()
  @IsEnum(LearningPathCategory)
  category?: LearningPathCategory;

  @ApiPropertyOptional({ description: 'Filter by difficulty' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({
    enum: LearningPathStatus,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsEnum(LearningPathStatus)
  status?: LearningPathStatus;

  @ApiPropertyOptional({
    enum: LearningPathType,
    description: 'Filter by type',
  })
  @IsOptional()
  @IsEnum(LearningPathType)
  type?: LearningPathType;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by creator ID' })
  @IsOptional()
  @IsString()
  createdById?: string;
}

export class GenerateLearningPathDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'User interests' })
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced'],
    description: 'Current skill level',
  })
  @IsOptional()
  @IsString()
  currentLevel?: 'beginner' | 'intermediate' | 'advanced';

  @ApiPropertyOptional({ description: 'Available time commitment' })
  @IsOptional()
  @IsString()
  timeAvailable?: string;

  @ApiPropertyOptional({ description: 'Preferred learning topics' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTopics?: string[];
}

export class LearningPathStartDto {
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Learning Path ID' })
  @IsString()
  learningPathId!: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Learning preferences' })
  @IsOptional()
  @IsObject()
  preferences?: PreferencesDto;
}

export class LearningPathUpdateDto {
  @ApiPropertyOptional({
    description: 'Phase ID (when updating module progress)',
  })
  @IsOptional()
  @IsString()
  phaseId?: string;

  @ApiPropertyOptional({ description: 'Module ID' })
  @IsOptional()
  @IsString()
  moduleId?: string;

  @ApiPropertyOptional({ description: 'Module status' })
  @IsOptional()
  moduleStatus?:
    | 'notStarted'
    | 'inProgress'
    | 'completed'
    | 'skipped'
    | 'failed';

  @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @ApiPropertyOptional({ description: 'Time spent in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentMinutes?: number;

  @ApiPropertyOptional({ description: 'Score for assessment/module' })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Current module ID' })
  @IsOptional()
  @IsString()
  currentModuleId?: string;

  @ApiPropertyOptional({ description: 'Last activity date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastActivityDate?: Date;

  @ApiPropertyOptional({
    enum: ['inProgress', 'completed', 'paused'],
    description: 'Completion status',
  })
  @IsOptional()
  completionStatus?: 'inProgress' | 'completed' | 'paused';
}

// Redundant interfaces removed. Using DTO classes as single source of truth.
