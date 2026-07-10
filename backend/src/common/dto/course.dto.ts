import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import {
  CourseDifficulty,
  CourseStatus,
  PrerequisiteType,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Helper DTOs for nested objects to prevent Swagger circular dependencies
export class CourseUserProgressDto {
  @ApiProperty({ description: 'Progress percentage', nullable: true })
  progressPercentage!: number | null;

  @ApiProperty({ description: 'Last accessed date', nullable: true })
  lastAccessedAt!: Date | null;
}

export class CoursePrerequisiteDto {
  @ApiProperty({ description: 'Prerequisite course information' })
  prerequisite!: {
    id: string;
    title: string;
  };

  @ApiProperty({ description: 'Prerequisite type', enum: PrerequisiteType })
  type!: PrerequisiteType;
}

export class CourseCategoryDto {
  @ApiProperty({ description: 'Category ID' })
  id!: string;

  @ApiProperty({ description: 'Category name' })
  name!: string;

  @ApiProperty({ description: 'Category slug' })
  slug!: string;
}

export class CourseCreatedByDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'First name' })
  firstName!: string;

  @ApiProperty({ description: 'Last name' })
  lastName!: string;
}

// Note: Removed 'implements ExtendedCourse' to prevent Swagger circular dependency
// The DTO properties are explicitly defined below, matching ExtendedCourse structure
export class CourseResponseDto {
  @ApiProperty({ description: 'Unique identifier of the course' })
  id!: string;

  @ApiProperty({ description: 'Course name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Course title' })
  title!: string | null;

  @ApiPropertyOptional({ description: 'Unique course code' })
  code!: string | null;

  @ApiPropertyOptional({ description: 'Course description' })
  description!: string | null;

  @ApiPropertyOptional({ description: 'Category ID' })
  categoryId!: string | null;

  @ApiPropertyOptional({
    description: 'Course difficulty',
    enum: CourseDifficulty,
  })
  difficulty!: CourseDifficulty;

  @ApiProperty({ description: 'Course status', enum: CourseStatus })
  status!: CourseStatus;

  @ApiProperty({ description: 'Whether the course is featured' })
  isFeatured!: boolean;

  @ApiPropertyOptional({ description: 'Course rating' })
  rating!: number | null;

  @ApiPropertyOptional({ description: 'Course price' })
  price!: number | null;

  @ApiPropertyOptional({ description: 'Number of enrolled students' })
  enrollmentCount!: number | null;

  @ApiPropertyOptional({ description: 'Course tags', type: [String] })
  tags!: string[];

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last updated date' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Is enrolled' })
  isEnrolled!: boolean;

  @ApiProperty({
    description: 'User progress',
    type: () => CourseUserProgressDto,
    nullable: true,
  })
  userProgress!: CourseUserProgressDto | null;

  @ApiProperty({
    description: 'Prerequisites',
    type: () => [CoursePrerequisiteDto],
  })
  prerequisites!: CoursePrerequisiteDto[];

  @ApiProperty({
    description: 'Category',
    type: () => CourseCategoryDto,
    required: false,
  })
  category?: CourseCategoryDto;

  @ApiProperty({
    description: 'Created by',
    type: () => CourseCreatedByDto,
    required: false,
  })
  createdBy?: CourseCreatedByDto;

  @ApiPropertyOptional({ description: 'Created by user id' })
  createdById!: string | null;

  @ApiPropertyOptional({
    description: 'Estimated hours to complete the course',
  })
  estimatedHours!: number | null;
}

export class CourseSearchDto {
  @ApiPropertyOptional({
    description: 'Search query for title, description, or tags',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Course difficulty',
    enum: CourseDifficulty,
  })
  @IsOptional()
  @IsEnum(CourseDifficulty)
  difficulty?: CourseDifficulty;

  @ApiPropertyOptional({ description: 'Course status', enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ description: 'Whether the course is featured' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Course tags filter', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Instructor ID' })
  @IsOptional()
  @IsString()
  instructorId?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: [
      'name',
      'title',
      'rating',
      'enrollmentCount',
      'createdAt',
      'updatedAt',
    ],
  })
  @IsOptional()
  @IsString()
  sortBy?:
    | 'name'
    | 'title'
    | 'rating'
    | 'enrollmentCount'
    | 'createdAt'
    | 'updatedAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Minimum rating' })
  @IsOptional()
  @IsNumber()
  minRating?: number;

  @ApiPropertyOptional({ description: 'Maximum price' })
  @IsOptional()
  @IsNumber()
  maxPrice?: number;
}

export class CreateCourseDto {
  @ApiProperty({ description: 'Course name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Course title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Unique course code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Course description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Course difficulty',
    enum: CourseDifficulty,
  })
  @IsOptional()
  @IsEnum(CourseDifficulty)
  difficulty?: CourseDifficulty;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Course price' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({
    description: 'Whether the course is featured',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Course status',
    enum: CourseStatus,
    default: CourseStatus.draft,
  })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ description: 'Course tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Prerequisite course IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  prerequisiteCourseIds?: (
    | string
    | { courseId: string; type: PrerequisiteType }
  )[];

  @ApiPropertyOptional({
    description: 'Estimated hours to complete the course',
  })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}

export class UpdateCourseDto {
  @ApiPropertyOptional({ description: 'Course name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Course title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Course code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Course description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Course difficulty',
    enum: CourseDifficulty,
  })
  @IsOptional()
  @IsEnum(CourseDifficulty)
  difficulty?: CourseDifficulty;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Course price' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'Whether the course is featured' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Course status', enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ description: 'Course tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Prerequisite course IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  prerequisiteCourseIds?: (
    | string
    | { courseId: string; type: PrerequisiteType }
  )[];

  @ApiPropertyOptional({
    description: 'Estimated hours to complete the course',
  })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}

export class CourseListResponseDto {
  @ApiProperty({
    description: 'List of courses',
    type: () => CourseResponseDto,
    isArray: true,
  })
  courses!: CourseResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Extracted DTO classes for CourseStatisticsDto nested objects
export class CourseEngagementMetricsDto {
  @ApiProperty({ description: 'Number of active students in the last 30 days' })
  activeStudentsLast30Days!: number;

  @ApiProperty({ description: 'Average time per learning session (minutes)' })
  averageTimePerSession!: number;

  @ApiProperty({ description: 'Total study hours' })
  totalStudyHours!: number;
}

export class CoursePerformanceMetricsDto {
  @ApiProperty({ description: 'Average score across all students' })
  averageScore!: number;

  @ApiProperty({ description: 'Course pass rate (percentage)' })
  passRate!: number;

  @ApiProperty({ description: 'Student satisfaction rating' })
  studentSatisfaction!: number;
}

export class CourseCategoryStatisticsDto {
  @ApiProperty({ description: 'Category ID' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name' })
  name!: string;

  @ApiProperty({ description: 'Number of enrollments in this category' })
  enrollmentCount!: number;

  @ApiProperty({ description: 'Completion rate for this category' })
  completionRate!: number;
}

export class CourseEnrollmentTrendDto {
  @ApiProperty({ description: 'Time period (e.g., 2024-01, 2024-02)' })
  period!: string;

  @ApiProperty({ description: 'Number of enrollments in this period' })
  enrollments!: number;

  @ApiProperty({ description: 'Number of completions in this period' })
  completions!: number;

  @ApiProperty({ description: 'Revenue generated in this period' })
  revenue!: number;
}

/**
 * Course Statistics DTO
 * Contains aggregate platform-wide data ABOUT courses
 * Used for admin dashboards, platform analytics, and reporting
 *
 * Note: This is different from CourseProgress which tracks individual user progress
 */
export class CourseStatisticsDto {
  @ApiProperty({ description: 'Total number of courses on platform' })
  totalCourses!: number;

  @ApiProperty({
    description: 'Total number of students enrolled across all courses',
  })
  totalEnrolledStudents!: number;

  @ApiProperty({ description: 'Average course rating across all courses' })
  averageRating!: number;

  @ApiProperty({ description: 'Total number of completed course enrollments' })
  totalCompletedCourses!: number;

  @ApiProperty({ description: 'Total revenue generated from all courses' })
  totalRevenue!: number;

  @ApiPropertyOptional({
    description: 'Average completion time in days across all courses',
  })
  averageCompletionTime?: number;

  @ApiPropertyOptional({
    description: 'Overall course completion rate as percentage (0-100)',
  })
  completionRate?: number;

  @ApiPropertyOptional({
    description: 'Student engagement metrics',
    type: () => CourseEngagementMetricsDto,
  })
  engagement?: CourseEngagementMetricsDto;

  @ApiPropertyOptional({
    description: 'Performance metrics',
    type: () => CoursePerformanceMetricsDto,
  })
  performance?: CoursePerformanceMetricsDto;

  @ApiPropertyOptional({
    description: 'Top performing categories',
    type: () => [CourseCategoryStatisticsDto],
  })
  topCategories?: CourseCategoryStatisticsDto[];

  @ApiPropertyOptional({
    description: 'Enrollment trends',
    type: () => [CourseEnrollmentTrendDto],
  })
  trends?: CourseEnrollmentTrendDto[];
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Category slug' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiPropertyOptional({ description: 'Parent category ID' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Is category active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID (null to remove parent)',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Is category active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Extended Course Interface for service logic.
 * Note: Switched to type alias of DTO for consistency.
 */
export type ExtendedCourse = CourseResponseDto & {
  category?: {
    parentCategory?: {
      id: string;
      name: string;
    };
  };
  analytics?: {
    averageCompletionTime: number;
    successRate: number;
    avgRating: number;
    totalEnrollments: number;
    activeStudents: number;
  };
};
