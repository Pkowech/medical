import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AiAnalyticsService } from '../../../ai-analytics/services/ai-analytics.service';
import {
  Course,
  CourseEnrollment,
  EnrollmentStatus,
  Prisma,
  CourseStatus,
  ProgressStatus,
  PrerequisiteType,
} from '@prisma/client';
import {
  CreateCourseDto,
  CourseSearchDto,
  UpdateCourseDto,
  ExtendedCourse,
} from '#common/dto/course.dto';
import { PaginationDto } from '#common/dto/pagination.dto';
import { Role } from '#modules/auth/constants/role.constants';
import { UsersService } from '../../../auth/services/users.service';
import { FtsUtils } from '#common/utils/fts.utils';
import { WorkloadService } from './workload.service';
import { BridgingMaterialService } from './bridging-material.service';

import { GlobalSearchSyncService } from '../../../../infrastructure/search/services/global-search-sync.service';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);
  private readonly CACHE_PREFIX = 'course';
  private readonly CACHE_TTL = 3600; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AiAnalyticsService))
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly workloadService: WorkloadService,
    private readonly bridgingMaterialService: BridgingMaterialService,
    private readonly searchSync: GlobalSearchSyncService,
  ) {}

  private generateKey(field: string, value: string): string {
    return `${this.CACHE_PREFIX}:${field}:${value}`;
  }

  private isValidCache(cached: string | null): cached is string {
    return !!cached && typeof cached === 'string';
  }

  async create(
    createCourseDto: CreateCourseDto,
    creatorId: string,
  ): Promise<Course> {
    const logContext = { code: createCourseDto.code, creatorId };

    try {
      // Check if course code already exists
      if (createCourseDto.code) {
        const existingCourse = await this.prisma.course.findUnique({
          where: { code: createCourseDto.code },
        });
        if (existingCourse) {
          this.logger.warn(
            'Course creation failed: Code already exists',
            logContext,
          );
          throw new BadRequestException('Course code already exists');
        }
      }

      // Validate category if provided
      if (createCourseDto.categoryId) {
        const category = await this.prisma.courseCategory.findUnique({
          where: { id: createCourseDto.categoryId },
        });
        if (!category) {
          this.logger.warn('Course creation failed: Category not found', {
            ...logContext,
            categoryId: createCourseDto.categoryId,
          });
          throw new NotFoundException('Category not found');
        }
      }

      // Validate prerequisites
      if (createCourseDto.prerequisiteCourseIds?.length) {
        const prerequisiteIds = createCourseDto.prerequisiteCourseIds.map(
          (item) => (typeof item === 'string' ? item : item.courseId),
        );
        const prerequisites = await this.prisma.course.findMany({
          where: { id: { in: prerequisiteIds } },
        });
        if (prerequisites.length !== prerequisiteIds.length) {
          this.logger.warn('Invalid prerequisites', { ...logContext });
          throw new NotFoundException(
            'One or more prerequisite courses not found',
          );
        }
      }

      const course = await this.prisma.course.create({
        data: {
          ...createCourseDto,
          createdById: creatorId,
          status: createCourseDto.status || CourseStatus.draft,
          enrollmentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          prerequisites: createCourseDto.prerequisiteCourseIds
            ? {
                create: createCourseDto.prerequisiteCourseIds.map((item) => {
                  const prerequisiteId =
                    typeof item === 'string' ? item : item.courseId;
                  const type =
                    typeof item === 'string'
                      ? PrerequisiteType.required
                      : item.type;
                  return {
                    type,
                    prerequisite: { connect: { id: prerequisiteId } },
                  };
                }),
              }
            : undefined,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          prerequisites: {
            select: {
              type: true,
              prerequisite: { select: { id: true, title: true } },
            },
          },
        },
      });

      await this.setCache(course);

      // Explicitly update FTS vector (replacing DB trigger)
      await FtsUtils.updateFtsVector(this.prisma, 'courses', course.id);

      // Sync to global search index
      await this.searchSync.syncEntity('course', course.id);

      this.logger.log('Course created successfully', {
        ...logContext,
        courseId: course.id,
      });
      return course;
    } catch (error) {
      this.logger.error('Error creating course', {
        ...logContext,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async findAll(
    searchDto: CourseSearchDto,
    pagination: PaginationDto,
    userId?: string,
  ): Promise<{
    data: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      search,
      categoryId,
      difficulty,
      status,
      isFeatured,
      instructorId,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      minRating,
      maxPrice,
    } = searchDto;
    const skip = (page - 1) * limit;

    const cacheKey = this.generateKey(
      'search',
      JSON.stringify({ searchDto, pagination }),
    );
    try {
      const cached = await this.redisService.get(cacheKey);
      if (this.isValidCache(cached)) {
        this.logger.log('Courses fetched from cache', { cacheKey });
        const result = JSON.parse(cached);
        
        // Add enrollment status if userId is provided
        if (userId && result.data && result.data.length > 0) {
          const enrollments = await this.prisma.courseEnrollment.findMany({
            where: {
              userId,
              courseId: { in: result.data.map((c: any) => c.id) },
            },
            select: { courseId: true },
          });
          const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
          result.data.forEach((c: any) => {
            c.isEnrolled = enrolledCourseIds.has(c.id);
          });
        }
        
        return result;
      }
    } catch (error) {
      this.logger.warn('Redis get failed in findAll:', error);
    }

    try {
      // Use FTS (full-text search) if search term is provided (faster & ranked)
      if (search && search.trim().length > 2) {
        return await this.findAllWithFts(search, searchDto, pagination, userId);
      }

      const whereConditions: Prisma.CourseWhereInput[] = [];

      if (categoryId) {
        whereConditions.push({ categoryId });
      }

      if (difficulty) {
        whereConditions.push({ difficulty });
      }

      // Default to published courses if no status is explicitly provided
      whereConditions.push({ status: status || CourseStatus.published });


      if (isFeatured !== undefined) {
        whereConditions.push({ isFeatured });
      }

      if (instructorId) {
        whereConditions.push({ createdById: instructorId });
      }

      if (tags && tags.length > 0) {
        whereConditions.push({ tags: { hasSome: tags } });
      }

      if (minRating) {
        whereConditions.push({ rating: { gte: minRating } });
      }

      if (maxPrice !== undefined) {
        whereConditions.push({
          OR: [{ price: null }, { price: { lte: maxPrice } }],
        });
      }

      const where: Prisma.CourseWhereInput =
        whereConditions.length > 0 ? { AND: whereConditions } : {};

      const [courses, total] = await Promise.all([
        this.prisma.course.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: { select: { id: true, name: true, slug: true } },
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { [sortBy]: sortOrder.toLowerCase() as 'asc' | 'desc' },
        }),
        this.prisma.course.count({ where }),
      ]);

      const result = {
        data: courses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };

      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(result, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
          this.CACHE_TTL,
        );
      } catch (error) {
        this.logger.warn('Redis set failed in findAll:', error);
      }

      // Add enrollment status if userId is provided (after caching result without user-specific data)
      if (userId && result.data.length > 0) {
        const enrollments = await this.prisma.courseEnrollment.findMany({
          where: {
            userId,
            courseId: { in: result.data.map((c) => c.id) },
          },
          select: { courseId: true },
        });
        const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
        result.data.forEach((c: any) => {
          c.isEnrolled = enrolledCourseIds.has(c.id);
        });
      }

      this.logger.log('Courses fetched from database', { page, limit, total });
      return result;
    } catch (error) {
      this.logger.error('Error fetching courses', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Find courses using PostgreSQL full-text search (FTS) for better ranking & performance
   * @param search - Search term
   * @param searchDto - Search filters (category, difficulty, etc.)
   * @param pagination - Pagination params
   */
  private async findAllWithFts(
    search: string,
    searchDto: CourseSearchDto,
    pagination: PaginationDto,
    userId?: string,
  ): Promise<{
    data: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page = 1, limit = 20 } = pagination;
    const {
      categoryId,
      difficulty,
      status = CourseStatus.published,
      isFeatured,
      instructorId,
      tags,
      minRating,
      maxPrice,
    } = searchDto;
    const skip = (page - 1) * limit;

    try {
      // Build WHERE conditions for filters (applied after FTS)
      const filterConditions: string[] = [];

      if (status) {
        filterConditions.push(`c.status = '${status}'`);
      }
      if (categoryId) {
        filterConditions.push(`c."categoryId" = '${categoryId}'`);
      }
      if (difficulty) {
        filterConditions.push(`c.difficulty = '${difficulty}'`);
      }
      if (isFeatured !== undefined) {
        filterConditions.push(`c."isFeatured" = ${isFeatured}`);
      }
      if (instructorId) {
        filterConditions.push(`c."createdById" = '${instructorId}'`);
      }
      if (minRating) {
        filterConditions.push(`c.rating >= ${minRating}`);
      }
      if (maxPrice !== undefined) {
        filterConditions.push(`(c.price IS NULL OR c.price <= ${maxPrice})`);
      }
      if (tags && tags.length > 0) {
        filterConditions.push(`c.tags && '{${tags.join(',')}}'`);
      }

      const whereClause =
        filterConditions.length > 0
          ? ` AND ${filterConditions.join(' AND ')}`
          : '';

      // Count total results with FTS + filters
      const countResult = await this.prisma.$queryRawUnsafe<
        Array<{ total: number }>
      >(
        `SELECT COUNT(*)::int as total FROM "courses" c
         WHERE c.fts @@ plainto_tsquery('english', $1)${whereClause}`,
        search,
      );
      const total = countResult[0]?.total || 0;

      // Get paginated ranked results
      const courses = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT c.*, 
                ts_rank(c.fts, plainto_tsquery('english', $1))::float as relevance
         FROM "courses" c
         WHERE c.fts @@ plainto_tsquery('english', $1)${whereClause}
         ORDER BY relevance DESC, c."createdAt" DESC
         LIMIT $2 OFFSET $3`,
        search,
        limit,
        skip,
      );

      const result = {
        data: courses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };

      // Add enrollment status if userId is provided
      if (userId && result.data.length > 0) {
        const enrollments = await this.prisma.courseEnrollment.findMany({
          where: {
            userId,
            courseId: { in: result.data.map((c: any) => c.id) },
          },
          select: { courseId: true },
        });
        const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
        result.data.forEach((c: any) => {
          c.isEnrolled = enrolledCourseIds.has(c.id);
        });
      }

      this.logger.log('Courses fetched via FTS', {
        search,
        page,
        limit,
        total,
        resultCount: courses.length,
      });
      return result;
    } catch (error) {
      this.logger.warn('FTS query failed, falling back to basic search', {
        search,
        error: getErrorMessage(error),
      });
      // Fall back to basic search if FTS fails
      return this.findAll({ ...searchDto, search: undefined }, pagination, userId);
    }
  }

  async findOne(id: string, userId?: string): Promise<ExtendedCourse> {
    const cacheKey = this.generateKey('id', id);
    try {
      const cached = await this.redisService.get(cacheKey);
      if (this.isValidCache(cached)) {
        this.logger.log('Course fetched from cache', { courseId: id });
        return JSON.parse(cached) as ExtendedCourse;
      }
    } catch (error) {
      this.logger.warn('Redis get failed in findOne:', error);
    }

    try {
      const course = await this.prisma.course.findUnique({
        where: { id },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          materials: true,
          units: {
            include: { 
              materials: true,
              topics: {
                include: { materials: true },
                orderBy: { order: 'asc' },
              }
            },
            orderBy: { order: 'asc' },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialization: true,
            },
          },
          prerequisites: {
            select: {
              type: true,
              prerequisite: { select: { id: true, title: true } },
            },
          },
          enrollments: { select: { id: true } },
        },
      });

      if (!course) {
        this.logger.warn('Course not found', { courseId: id });
        throw new NotFoundException(`Course with ID ${id} not found`);
      }

      let isEnrolled = false;
      let userProgress: {
        progressPercentage: number | null;
        lastAccessedAt: Date | null;
      } | null = null;

      if (userId) {
        const enrollment = await this.prisma.courseEnrollment.findUnique({
          where: { userId_courseId: { userId, courseId: id } },
        });
        isEnrolled = !!enrollment;

        if (isEnrolled && enrollment) {
          const progress = await this.prisma.courseProgress.findUnique({
            where: { userId_courseId: { userId, courseId: id } },
            select: { progressPercentage: true, lastAccessedAt: true },
          });
          if (progress) {
            userProgress = {
              progressPercentage: progress.progressPercentage,
              lastAccessedAt: progress.lastAccessedAt,
            };
          }
        }
      }

      const normalizedPrereqs = (course.prerequisites || []).map((p) => ({
        prerequisite: {
          id: p.prerequisite.id,
          title: p.prerequisite.title ?? '',
        },
        type: p.type,
      }));

      const normalizedCategory = course.category
        ? {
            id: course.category.id,
            name: course.category.name,
            slug: course.category.slug,
            parentCategory: (course.category as any).parentCategory
              ? {
                  id: (course.category as any).parentCategory.id,
                  name: (course.category as any).parentCategory.name,
                }
              : undefined,
          }
        : undefined;

      const normalizedCreatedBy = course.createdBy
        ? {
            id: course.createdBy.id,
            firstName: course.createdBy.firstName ?? '',
            lastName: course.createdBy.lastName ?? '',
            expertise: (course.createdBy as any).expertise || [],
            rating: (course.createdBy as any).rating ?? undefined,
          }
        : undefined;

      const result: ExtendedCourse = {
        ...course,
        isEnrolled,
        userProgress,
        prerequisites: normalizedPrereqs,
        category: normalizedCategory,
        createdBy: normalizedCreatedBy,
      };

      await this.setCache(result);
      this.logger.log('Course fetched from database', { courseId: id });
      return result;
    } catch (error) {
      this.logger.error('Error fetching course', {
        courseId: id,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async update(
    id: string,
    updateCourseDto: UpdateCourseDto,
    userId: string,
  ): Promise<Course> {
    try {
      const existingCourse = await this.prisma.course.findUnique({
        where: { id },
        include: { createdBy: true },
      });

      if (!existingCourse) {
        this.logger.warn('Course not found for update', { courseId: id });
        throw new NotFoundException(`Course with ID ${id} not found`);
      }

      const user = await this.usersService.findOne(userId);
      if (!user) {
        this.logger.warn('User not found for course update', { userId });
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      const userRoles = user.userRoles.map((userRole) => userRole.role.name);
      const isAdmin = userRoles.includes(Role.admin);

      // Only the course creator or an admin can update the course
      if (existingCourse.createdById !== userId && !isAdmin) {
        this.logger.warn('Unauthorized course update attempt', {
          courseId: id,
          userId,
        });
        throw new ForbiddenException(
          'Only the instructor or an admin can update this course',
        );
      }

      if (updateCourseDto.categoryId) {
        const category = await this.prisma.courseCategory.findUnique({
          where: { id: updateCourseDto.categoryId },
        });
        if (!category) {
          this.logger.warn('Category not found for update', {
            courseId: id,
            categoryId: updateCourseDto.categoryId,
          });
          throw new NotFoundException('Category not found');
        }
      }

      if (updateCourseDto.prerequisiteCourseIds?.length) {
        const prerequisiteIds = updateCourseDto.prerequisiteCourseIds.map(
          (item) => (typeof item === 'string' ? item : item.courseId),
        );
        const prerequisites = await this.prisma.course.findMany({
          where: { id: { in: prerequisiteIds } },
        });
        if (prerequisites.length !== prerequisiteIds.length) {
          this.logger.warn('Invalid prerequisites for update', {
            courseId: id,
          });
          throw new NotFoundException(
            'One or more prerequisite courses not found',
          );
        }
      }

      const updatedCourse = await this.prisma.course.update({
        where: { id },
        data: {
          ...updateCourseDto,
          updatedAt: new Date(),
          prerequisites: updateCourseDto.prerequisiteCourseIds
            ? {
                deleteMany: {},
                create: updateCourseDto.prerequisiteCourseIds.map((item) => {
                  const prerequisiteId =
                    typeof item === 'string' ? item : item.courseId;
                  const type =
                    typeof item === 'string'
                      ? PrerequisiteType.required
                      : item.type;
                  return {
                    type,
                    prerequisite: { connect: { id: prerequisiteId } },
                  };
                }),
              }
            : undefined,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          units: { select: { id: true, name: true, order: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          prerequisites: {
            select: {
              type: true,
              prerequisite: { select: { id: true, title: true } },
            },
          },
        },
      });

      await this.clearCache(existingCourse);
      await this.setCache(updatedCourse);

      // Explicitly update FTS vector (replacing DB trigger)
      await FtsUtils.updateFtsVector(this.prisma, 'courses', updatedCourse.id);

      // Sync to global search index
      await this.searchSync.syncEntity('course', updatedCourse.id);

      this.logger.log('Course updated successfully', { courseId: id, userId });
      return updatedCourse;
    } catch (error) {
      this.logger.error('Error updating course', {
        courseId: id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    try {
      const existingCourse = await this.prisma.course.findUnique({
        where: { id },
        include: { createdBy: true },
      });

      if (!existingCourse) {
        this.logger.warn('Course not found for deletion', { courseId: id });
        throw new NotFoundException(`Course with ID ${id} not found`);
      }

      const user = await this.usersService.findOne(userId);
      if (!user) {
        this.logger.warn('User not found for course deletion', { userId });
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      const userRoles = user.userRoles.map((userRole) => userRole.role.name);
      const isAdmin = userRoles.includes(Role.admin);

      // Only the course creator or an admin can delete the course
      if (existingCourse.createdById !== userId && !isAdmin) {
        this.logger.warn('Unauthorized course deletion attempt', {
          courseId: id,
          userId,
        });
        throw new ForbiddenException(
          'Only the instructor or an admin can delete this course',
        );
      }

      await this.prisma.course.delete({ where: { id } });
      await this.clearCache(existingCourse);
      this.logger.log('Course deleted successfully', { courseId: id, userId });
      return { message: 'Course deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting course', {
        courseId: id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async enrollUser(
    courseId: string,
    userId: string,
  ): Promise<CourseEnrollment> {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId, status: CourseStatus.published },
        include: {
          units: true,
          prerequisites: {
            include: { prerequisite: { select: { id: true } } },
          },
        },
      });

      if (!course) {
        this.logger.warn('Course not found or not published', {
          courseId,
          userId,
        });
        throw new NotFoundException(
          'Course not found or not available for enrollment',
        );
      }

      const existingEnrollment = await this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });

      if (existingEnrollment) {
        this.logger.warn('User already enrolled', { courseId, userId });
        throw new BadRequestException('User already enrolled in this course');
      }

      // Check workload capacity
      await this.workloadService.validateWorkload(userId, courseId);

      // Check prerequisites
      await this.checkPrerequisites(course, userId);

      const enrollment = await this.prisma.courseEnrollment.create({
        data: {
          userId,
          courseId,
          totalUnits: course.units?.length || 0,
          status: EnrollmentStatus.active,
          enrolledAt: new Date(),
          progressPercentage: 0,
        },
      });

      // Initialize progress tracking in the unified Progress table
      await this.prisma.progress.create({
        data: {
          userId,
          topicId: null as any,
          materialId: null as any,
          unitId: null as any,
          courseId,
          status: ProgressStatus.notStarted,
          progressPercentage: 0,
          timeSpent: 0,
          lastAccessedAt: new Date(),
        },
      });

      // Update enrollment count
      await this.prisma.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      });

      await this.clearCache(course);
      this.logger.log('User enrolled successfully', { courseId, userId });
      return enrollment;
    } catch (error) {
      this.logger.error('Error enrolling user', {
        courseId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async unenroll(courseId: string, userId: string): Promise<void> {
    try {
      const enrollment = await this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });

      if (!enrollment) {
        this.logger.warn('Enrollment not found', { courseId, userId });
        throw new NotFoundException('Enrollment not found');
      }

      await this.prisma.courseEnrollment.update({
        where: { userId_courseId: { userId, courseId } },
        data: { status: EnrollmentStatus.dropped },
      });

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (course) {
        await this.prisma.course.update({
          where: { id: courseId },
          data: { enrollmentCount: { decrement: 1 } },
        });
        await this.clearCache(course);
      }

      this.logger.log('User unenrolled successfully', { courseId, userId });
    } catch (error) {
      this.logger.error('Error unenrolling user', {
        courseId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getPrerequisites(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        prerequisites: {
          include: {
            prerequisite: {
              select: { id: true, title: true, code: true },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return {
      courseIds: course.prerequisites.map((p) => p.prerequisite.id),
      prerequisiteCourses: course.prerequisites.map((p) => ({
        id: p.prerequisite.id,
        title: p.prerequisite.title || 'Untitled Course',
        code: p.prerequisite.code || '',
        type: p.type,
      })),
      skills: [], // TODO: Add skill prerequisites when supported by schema
      description: course.prerequisites.some(
        (p) => p.type === PrerequisiteType.required,
      )
        ? 'You must complete the following mandatory courses before enrolling:'
        : course.prerequisites.length > 0
          ? 'We recommend completing the following courses for a better experience:'
          : 'No prerequisites required.',
    };
  }

  async updateProgress(
    courseId: string,
    userId: string,
    unitId: string,
  ): Promise<void> {
    try {
      const enrollment = await this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });

      if (!enrollment) {
        this.logger.warn('Enrollment not found for progress update', {
          courseId,
          userId,
          unitId,
        });
        throw new NotFoundException('Enrollment not found');
      }

      const totalUnits = await this.prisma.unit.count({ where: { courseId } });
      const progress = await this.prisma.progress.findFirst({
        where: { userId, courseId, topicId: null, materialId: null },
      });

      if (!progress) {
        this.logger.warn('Progress not found', { courseId, userId });
        throw new NotFoundException('Progress not found');
      }

      // Calculate completed units via materials in the Progress table
      const units = await this.prisma.unit.findMany({
        where: { courseId },
        include: { materials: true },
      });
      let completedUnits = 0;
      for (const unit of units) {
        const materialCount = unit.materials.length;
        if (materialCount === 0) {
          continue;
        }
        const completedMaterials = await this.prisma.progress.count({
          where: { userId, material: { unitId: unit.id }, isCompleted: true },
        });
        if (completedMaterials === materialCount) {
          completedUnits++;
        }
      }
      const progressPercentage =
        totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;

      if (progress) {
        await this.prisma.progress.update({
          where: { id: progress.id },
          data: {
            progressPercentage: Math.round(progressPercentage),
            lastAccessedAt: new Date(),
          },
        });
      }

      await this.prisma.courseEnrollment.update({
        where: { userId_courseId: { userId, courseId } },
        data: {
          completedUnits,
          progressPercentage,
          lastAccessed: new Date(),
          ...(progressPercentage >= 100 && {
            status: EnrollmentStatus.completed,
            completedAt: new Date(),
          }),
        },
      });

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (course) {
        await this.clearCache(course);
      }

      this.logger.log('Progress updated successfully', {
        courseId,
        userId,
        unitId,
      });
    } catch (error) {
      this.logger.error('Error updating progress', {
        courseId,
        userId,
        unitId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getEnrollments(
    userId: string,
    status?: EnrollmentStatus,
    page = 1,
    limit = 20,
  ): Promise<{ items: CourseEnrollment[]; total: number; page: number; pageSize: number }> {
    try {
      const skip = (page - 1) * limit;
      const where: Prisma.CourseEnrollmentWhereInput = { userId };
      if (status) {
        where.status = status;
      }

      const [enrollments, total] = await Promise.all([
        this.prisma.courseEnrollment.findMany({
          where,
          skip,
          take: limit,
          include: {
            course: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
                createdBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
          orderBy: { enrolledAt: 'desc' },
        }),
        this.prisma.courseEnrollment.count({ where }),
      ]);

      this.logger.log('Enrollments fetched successfully', { userId, status, total });
      return {
        items: enrollments,
        total,
        page,
        pageSize: limit,
      };
    } catch (error) {
      this.logger.error('Error fetching enrollments', {
        userId,
        status,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getFeaturedCourses(limit = 10, userId?: string): Promise<Course[]> {
    const cacheKey = this.generateKey('featured', `limit:${limit}`);
    try {
      const cached = await this.redisService.get(cacheKey);
      if (this.isValidCache(cached)) {
        this.logger.log('Featured courses fetched from cache', { limit });
        const courses = JSON.parse(cached) as Course[];
        
        if (userId && courses.length > 0) {
          const enrollments = await this.prisma.courseEnrollment.findMany({
            where: {
              userId,
              courseId: { in: courses.map((c: any) => c.id) },
            },
            select: { courseId: true },
          });
          const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
          courses.forEach((c: any) => {
            c.isEnrolled = enrolledCourseIds.has(c.id);
          });
        }
        
        return courses;
      }
    } catch (error) {
      this.logger.warn('Redis get failed in getFeaturedCourses:', error);
    }

    try {
      const courses = await this.prisma.course.findMany({
        where: { status: CourseStatus.published, isFeatured: true },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ rating: 'desc' }, { enrollmentCount: 'desc' }],
        take: limit,
      });

      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(courses, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
          this.CACHE_TTL,
        );
      } catch (error) {
        this.logger.warn('Redis set failed in getFeaturedCourses:', error);
      }

      if (userId && courses.length > 0) {
        const enrollments = await this.prisma.courseEnrollment.findMany({
          where: {
            userId,
            courseId: { in: courses.map((c) => c.id) },
          },
          select: { courseId: true },
        });
        const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
        courses.forEach((c: any) => {
          c.isEnrolled = enrolledCourseIds.has(c.id);
        });
      }

      this.logger.log('Featured courses fetched from database', { limit });
      return courses;
    } catch (error) {
      this.logger.error('Error fetching featured courses', {
        limit,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Get recommended courses for a user.
   * Strategy: AI Recommendations (Rust) -> Heuristic (Categories) -> Featured
   */
  async getRecommendedCourses(userId: string, limit = 10): Promise<Course[]> {
    const cacheKey = this.generateKey(
      'recommended',
      `user:${userId}:limit:${limit}`,
    );

    try {
      const cached = await this.redisService.get(cacheKey);
      if (this.isValidCache(cached)) {
        return JSON.parse(cached) as Course[];
      }
    } catch (error) {
      this.logger.warn('Redis get failed in getRecommendedCourses:', error);
    }

    try {
      // 1. Try AI Recommendations
      const aiRecs = await this.aiAnalyticsService.getRecommendationsAI(userId);
      if (aiRecs && aiRecs.length > 0) {
        const recommendedCourseIds = aiRecs
          .map((rec: any) => rec.materialId || rec.material_id || rec.courseId)
          .filter(Boolean)
          .slice(0, limit);

        if (recommendedCourseIds.length > 0) {
          const courses = await this.prisma.course.findMany({
            where: { 
              id: { in: recommendedCourseIds },
              status: CourseStatus.published,
            },
            include: {
              category: { select: { id: true, name: true, slug: true } },
              createdBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            take: limit,
          });
          if (courses.length > 0) {
            await this.cacheRecommended(cacheKey, courses);
            return courses;
          }
        }
      }

      // 2. Fallback to category-based heuristic
      const userEnrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        include: { course: { include: { category: true } } },
      });

      const enrolledCategoryIds = userEnrollments
        .map((e): string | undefined => e.course.category?.id)
        .filter((id): id is string => !!id);
      const enrolledCourseIds = userEnrollments.map((e) => e.courseId);

      const where: Prisma.CourseWhereInput = {
        status: CourseStatus.published,
        ...(enrolledCourseIds.length > 0 && {
          id: { notIn: enrolledCourseIds },
        }),
      };

      if (enrolledCategoryIds.length > 0) {
        where.categoryId = { in: enrolledCategoryIds };
      }

      let courses = await this.prisma.course.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ rating: 'desc' }, { enrollmentCount: 'desc' }],
        take: limit,
      });

      // 3. Last fallback: Featured courses
      if (courses.length === 0) {
        courses = await this.prisma.course.findMany({
          where: { isFeatured: true, status: CourseStatus.published },
          include: {
            category: { select: { id: true, name: true, slug: true } },
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
      }

      await this.cacheRecommended(cacheKey, courses);
      return courses;
    } catch (error) {
      this.logger.error('Error in getRecommendedCourses', {
        userId,
        limit,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  private async cacheRecommended(key: string, courses: Course[]) {
    try {
      await this.redisService.set(
        key,
        JSON.stringify(courses, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.warn('Redis set failed in cacheRecommended:', error);
    }
  }

  private async checkPrerequisites(
    course: Course & {
      prerequisites: { type: PrerequisiteType; prerequisite: { id: string } }[];
    },
    userId: string,
  ): Promise<void> {
    try {
      if (!course.prerequisites || course.prerequisites.length === 0) {
        return;
      }

      const completedEnrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId, status: EnrollmentStatus.completed },
        select: { courseId: true },
      });

      const completedCourseIds = completedEnrollments.map((e) => e.courseId);
      const missingPrerequisites = course.prerequisites.filter(
        (prereq) =>
          prereq.type === PrerequisiteType.required &&
          !completedCourseIds.includes(prereq.prerequisite.id),
      );

      if (missingPrerequisites.length > 0) {
        const prerequisiteCourses = await this.prisma.course.findMany({
          where: {
            id: { in: missingPrerequisites.map((p) => p.prerequisite.id) },
          },
          select: { id: true, title: true },
        });

        this.logger.warn('Prerequisites not met', {
          courseId: course.id,
          userId,
          missingPrerequisites: missingPrerequisites.map(
            (p) => p.prerequisite.id,
          ),
        });
        throw new BadRequestException(
          `Prerequisites not met. Please complete: ${prerequisiteCourses.map((c) => c.title).join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error('Error checking prerequisites', {
        courseId: course.id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  private async setCache(course: Course | ExtendedCourse): Promise<void> {
    try {
      const courseString = JSON.stringify(course, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      const keys = [
        this.generateKey('id', course.id),
        ...(course.code ? [this.generateKey('code', course.code)] : []),
      ];
      await Promise.all(
        keys.map((k) => this.redisService.set(k, courseString, this.CACHE_TTL)),
      );
      this.logger.debug('Course cached', { courseId: course.id });
    } catch (error) {
      this.logger.error('Error setting cache', {
        courseId: course.id,
        error: getErrorMessage(error),
      });
    }
  }

  private async clearCache(course: Course): Promise<void> {
    try {
      if (!course) {
        return;
      }
      const keys = [
        this.generateKey('id', course.id),
        ...(course.code ? [this.generateKey('code', course.code)] : []),
      ];
      await Promise.all(keys.map((k) => this.redisService.del(k)));
      await this.redisService.delPattern(`${this.CACHE_PREFIX}:search:*`);
      await this.redisService.delPattern(`${this.CACHE_PREFIX}:featured:*`);
      await this.redisService.delPattern(`${this.CACHE_PREFIX}:recommended:*`);
      this.logger.debug('Course cache cleared', { courseId: course.id });
    } catch (error) {
      this.logger.error('Error clearing cache', {
        courseId: course?.id,
        error: getErrorMessage(error),
      });
    }
  }

  async assignInstructor(
    courseId: string,
    instructorId: string,
  ): Promise<void> {
    const logContext = { courseId, instructorId };
    this.logger.log('Attempting to assign instructor to course', logContext);

    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course) {
        this.logger.warn(
          'Assign instructor failed: Course not found',
          logContext,
        );
        throw new NotFoundException(`Course with ID ${courseId} not found`);
      }

      const instructor = await this.prisma.user.findUnique({
        where: { id: instructorId },
        include: { userRoles: { include: { role: true } } },
      });
      if (!instructor) {
        this.logger.warn(
          'Assign instructor failed: Instructor not found',
          logContext,
        );
        throw new NotFoundException(`User with ID ${instructorId} not found`);
      }

      const isInstructor = instructor.userRoles.some(
        (userRole) =>
          userRole.role.name === 'instructor' || userRole.role.name === 'admin',
      );

      if (!isInstructor) {
        this.logger.warn('User is not an instructor or admin', logContext);
        throw new ForbiddenException(
          'The specified user is not an instructor or admin.',
        );
      }

      const existingAssignment = await this.prisma.courseInstructor.findUnique({
        where: { courseId_userId: { courseId, userId: instructorId } },
      });

      if (existingAssignment) {
        this.logger.warn(
          'Instructor already assigned to this course',
          logContext,
        );
        throw new BadRequestException(
          'This instructor is already assigned to the course.',
        );
      }

      await this.prisma.courseInstructor.create({
        data: {
          courseId,
          userId: instructorId,
          assignedAt: new Date(),
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: instructorId,
          message: `You have been assigned as an instructor to the course: "${course.name}"`,
          type: 'course_assignment',
          priority: 'medium',
        },
      });

      await this.clearCache(course);
      this.logger.log('Successfully assigned instructor to course', logContext);
    } catch (error) {
      this.logger.error('Error assigning instructor to course', {
        ...logContext,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getUserCourseStats(userId: string): Promise<{
    totalEnrolled: number;
    completed: number;
    inProgress: number;
    avgScore: number;
    hoursSpent: number;
    streak: number;
  }> {
    try {
      // Get all user enrollments
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        include: { course: true },
      });

      // Get course progress from the unified table
      const progressRecords = await this.prisma.progress.findMany({
        where: {
          userId,
          courseId: { not: null },
          materialId: null,
          topicId: null,
        },
      });

      const completed = enrollments.filter(
        (e) => e.status === EnrollmentStatus.completed,
      ).length;

      const inProgress = enrollments.filter(
        (e) => e.status === EnrollmentStatus.active,
      ).length;

      const avgProgress =
        progressRecords.length > 0
          ? Math.round(
              progressRecords.reduce(
                (sum: number, p: any) => sum + (p.progressPercentage || 0),
                0,
              ) / progressRecords.length,
            )
          : 0;

      // Calculate total hours (sum of timeSpent)
      const hoursSpent = Math.round(
        progressRecords.reduce(
          (sum: number, p: any) => sum + (p.timeSpent || 0),
          0,
        ) / 60,
      );

      this.logger.log('Course stats retrieved successfully', {
        userId,
        totalEnrolled: enrollments.length,
        completed,
      });

      // Calculate streak from user activities (last 60 days)
      const recentActivities = await this.prisma.userActivity.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      // Get unique days sorted descending
      const uniqueDays = [
        ...new Set(recentActivities.map((a) => a.createdAt.toDateString())),
      ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      let streak = 0;
      const today = new Date().toDateString();
      for (let i = 0; i < uniqueDays.length; i++) {
        const dayDiff = Math.floor(
          (new Date(today).getTime() - new Date(uniqueDays[i]).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (dayDiff <= i) {
          streak++;
        } else {
          break;
        }
      }

      return {
        totalEnrolled: enrollments.length,
        completed,
        inProgress,
        avgScore: avgProgress,
        hoursSpent,
        streak,
      };
    } catch (error) {
      this.logger.error('Error getting user course stats', {
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async predictCourseSuccessForUser(
    userId: string,
    courseId: string,
  ): Promise<any> {
    try {
      const predictions =
        await this.aiAnalyticsService.generatePredictions(userId);
      const suggestions = await this.bridgingMaterialService.suggestMaterials(
        userId,
        courseId,
      );

      if (!predictions || typeof predictions !== 'object') {
        return {
          successProbability: 0.5,
          estimatedCompletionDays: 30,
          readyToEnroll: true,
          confidence: 0,
          bridgingMaterials: suggestions,
        };
      }

      const predictionsArray = Array.isArray(predictions)
        ? predictions
        : (predictions.predictions as any[]) || [];
      const coursePrediction = predictionsArray.find(
        (p: any) => p.assessmentId === courseId || p.courseId === courseId,
      );

      if (!coursePrediction) {
        return {
          successProbability: 0.5,
          estimatedCompletionDays: 30,
          readyToEnroll: true,
          confidence: 0,
          bridgingMaterials: suggestions,
        };
      }

      const probability = coursePrediction.probability || 0.5;

      return {
        successProbability: probability,
        estimatedCompletionDays: coursePrediction.estimatedTime || 30,
        readyToEnroll: probability > 0.6,
        confidence: coursePrediction.confidence || 0,
        bridgingMaterials: suggestions,
        recommendation:
          probability > 0.7
            ? 'You should be ready for this course'
            : suggestions.length > 0
              ? 'We recommend reviewing bridging materials to fill prerequisite gaps'
              : 'Consider completing prerequisites first',
      };
    } catch (error: any) {
      this.logger.error(`Error predicting success for course ${courseId}:`, {
        error: getErrorMessage(error),
      });
      return {
        successProbability: 0.5,
        estimatedCompletionDays: 30,
        readyToEnroll: true,
        confidence: 0,
      };
    }
  }

  async getTopic(
    courseId: string,
    unitId: string,
    topicId: string,
    userId?: string,
  ) {
    try {
      this.logger.log(
        `getTopic called with courseId=${courseId}, unitId=${unitId}, topicId=${topicId}`,
      );

      // Verify the course exists
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });

      if (!course) {
        throw new NotFoundException(`Course with ID ${courseId} not found`);
      }

      // Verify the unit exists and belongs to the course
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, courseId: true },
      });

      if (!unit) {
        throw new NotFoundException(`Unit with ID ${unitId} not found`);
      }

      if (unit.courseId !== courseId) {
        throw new NotFoundException(
          `Unit ${unitId} does not belong to course ${courseId}`,
        );
      }

      // Check if topic exists in unit
      const topicsInUnit = await this.prisma.topic.findMany({
        where: { unitId },
        select: { id: true, name: true },
      });
      this.logger.log(
        `Topics in unit ${unitId}: ${topicsInUnit.map((t) => `${t.name}(${t.id})`).join(', ')}`,
      );

      // Fetch the topic with its materials
      const topic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          materials: {
            select: {
              id: true,
              title: true,
              type: true,
              fileId: true,
              content: true,
              description: true,
              duration: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          quizzes: {
            select: {
              id: true,
              title: true,
              description: true,
              questionCount: true,
              timeLimit: true,
            },
          },
          unit: {
            select: { id: true, name: true, title: true },
          },
        },
      });

      if (!topic) {
        throw new NotFoundException(`Topic with ID ${topicId} not found`);
      }

      if (topic.unitId !== unitId) {
        throw new NotFoundException(
          `Topic ${topicId} does not belong to unit ${unitId}`,
        );
      }

      // Track topic access if user provided
      if (userId) {
        await this.prisma.progress.upsert({
          where: {
            userId_topicId_materialId_unitId_courseId: {
              userId,
              topicId,
              materialId: '00000000-0000-0000-0000-000000000000',
              unitId: '00000000-0000-0000-0000-000000000000',
              courseId: '00000000-0000-0000-0000-000000000000',
            },
          },
          update: {
            lastAccessedAt: new Date(),
          },
          create: {
            userId,
            topicId,
            courseId,
            unitId,
            status: ProgressStatus.inProgress,
            progressPercentage: 0,
          },
        }).catch(() => {
          // Ignore errors from access tracking
        });
      }

      return topic;
    } catch (error: any) {
      this.logger.error(
        `Error fetching topic ${topicId} from unit ${unitId} in course ${courseId}`,
        {
          error: getErrorMessage(error),
          courseId,
          unitId,
          topicId,
        },
      );
      throw error;
    }
  }
}
