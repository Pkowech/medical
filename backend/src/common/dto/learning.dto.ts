import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from './base';
import { LearningPathCategory } from '@prisma/client';
import type { Prerequisite, CompletedPrerequisite } from './prerequisites.dto';
import type { ProgressData } from './progress.dto';

export class LearningResponseDto extends BaseResponseDto {
  @ApiProperty({ description: 'Learning data' })
  data!: {
    userId: string;
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    totalLearningTime: number; // in minutes
    currentStreak: number; // days
    longestStreak: number; // days
    courses: any[];
  };
}

export class LearningModuleStatsDto {
  @ApiProperty({ description: 'Total study time in minutes' })
  totalStudyTime!: number;

  @ApiProperty({ description: 'Average session duration in minutes' })
  averageSessionDuration!: number;

  @ApiProperty({ description: 'Sessions this week' })
  sessionsThisWeek!: number;

  @ApiProperty({ description: 'Current learning streak' })
  currentStreak!: number;

  @ApiProperty({ description: 'Courses in progress' })
  coursesInProgress!: number;

  @ApiProperty({ description: 'Courses completed' })
  coursesCompleted!: number;

  @ApiProperty({ description: 'Average quiz score' })
  averageQuizScore!: number;

  @ApiProperty({ description: 'Achievements earned' })
  achievementsCount!: number;
}

export type LearningResourceType =
  | 'course'
  | 'learningPath'
  | 'assessment'
  | 'clinicalCase'
  | 'resource'
  | 'milestone'
  | 'material';

export interface LearningRecommendation {
  type: LearningResourceType;
  id: string;
  title: string;
  action: string;
  progress?: number;
  priority?: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface PhaseRequirements {
  minModulesCompleted?: number;
  minScoreRequired?: number;
}

export interface PhaseData {
  id: string;
  title: string;
  description?: string;
  order: number;
  modules: PathStructure['modules'];
  requirements?: PhaseRequirements;
}

export interface LearningPathData {
  title: string;
  description?: string;
  type?: string;
  category: LearningPathCategory;
  difficulty: string;
  estimatedDurationWeeks: number;
  structure: PathStructure;
}

export interface LearningItem {
  id: string;
  type: LearningResourceType;
  title?: string;
  progress?: number;
  reason?: string;
  prerequisites?: Prerequisite[];
  completedPrerequisites?: CompletedPrerequisite[];
  missingPrerequisites?: Prerequisite[];
}

export interface Module {
  id: string;
  type: LearningResourceType;
  title: string;
  description?: string;
  resourceId?: string;
  order: number;
  required?: boolean;
  estimatedMinutes?: number;
  passingScore?: number;
}

export interface Phase {
  id: string;
  title: string;
  description?: string;
  order: number;
  modules: Module[];
  requirements?: {
    minModulesCompleted?: number;
    minScoreRequired?: number;
    requiredModules?: string[];
  };
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  type: 'learningPath';
  progress?: number;
  reason?: string;
  prerequisites?: Prerequisite[];
  completedPrerequisites?: CompletedPrerequisite[];
  missingPrerequisites?: Prerequisite[];
  phases?: Phase[];
  metadata?: Record<string, any>;
}

export interface PathStructure {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  prerequisites?: string[];
  progress?: ProgressData[];
  metadata?: Record<string, any>;
  phases?: Phase[];
}

export interface PathModule {
  id: string;
  title: string;
  order: number;
  type: string;
  contentId: string;
  description?: string;
  estimatedMinutes?: number;
  required?: boolean;
}

export interface PathPhase {
  id: string;
  title: string;
  order: number;
  modules: PathModule[];
}

export enum LearningPathType {
  STANDARD = 'standard',
  CERTIFICATION = 'certification',
  SPECIALIZATION = 'specialization',
  CUSTOM = 'custom',
}
