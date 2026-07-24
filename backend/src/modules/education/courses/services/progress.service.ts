import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  Progress,
  UserActivity,
  ProgressStatus,
  UserActivityType,
  EnrollmentStatus,
} from '@prisma/client';
import { handleServiceError, getErrorMessage } from '#common/utils/error.utils';
import { cacheKeys } from '#common/constants/cache-keys';
import { ProgressUpdateDto } from '#common/dto/progress.dto';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { CourseAnalyticsService } from '#modules/ai-analytics/services/course-analytics.service';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import {
  UserProgressDetails,
  OverallProgress,
  CourseProgressWithCourse,
  CourseProgress,
  PrismaClientLike,
  UserStats,
  LearningActivityDetails,
} from '#common/dto';
import type { UserEnrollment } from '#common/dto/progress.dto';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  private readonly CACHE_TTL = 3600; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly events: EventEmitter2,
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly courseAnalyticsService: CourseAnalyticsService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
  ) {}

  private async clearCache(userId: string, courseId?: string): Promise<void> {
    try {
      const keys = [cacheKeys.progressByUser(userId)];
      if (courseId) {
        keys.push(cacheKeys.progressByUserCourse(userId, courseId));
      }
      keys.push(cacheKeys.progressOverall(userId));
      await Promise.all(keys.map((k) => this.redisService.del(k)));
    } catch (error: any) {
      this.logger.error('Error clearing cache:', {
        userId,
        courseId,
        error: getErrorMessage(error),
      });
    }
  }

  async updateUnitMaterialTopicProgress(
    userId: string,
    updateDto: ProgressUpdateDto,
  ): Promise<any> {
    try {
      const {
        courseId,
        unitId,
        materialId,
        topicId,
        status,
        progressPercentage,
        timeSpent,
        clientTimestamp,
      } = updateDto;

      if (courseId) {
        const enrollment = await this.prisma.courseEnrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        });

        if (!enrollment) {
          throw new NotFoundException('User not enrolled in this course');
        }
      }

      let updatedCourseProgress: any = null;

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Material progress - only if material exists
        if (materialId) {
          // Validate material exists
          const materialExists = await tx.material.findUnique({
            where: { id: materialId },
          });

          if (!materialExists) {
            this.logger.warn(
              `Material ${materialId} not found, skipping progress creation`,
            );
          } else {
            // Check for conflict if clientTimestamp provided
            if (clientTimestamp !== undefined) {
              const existing = await tx.progress.findFirst({
                where: { userId, materialId },
              });

              if (existing && existing.lastUpdated > clientTimestamp) {
                throw new ConflictException(
                  'Server has newer data. Please refresh and retry.',
                );
              }
            }

            const isCompleted = status === ProgressStatus.completed;
            const existing = await tx.progress.findFirst({
              where: { userId, materialId },
            });

            const now = new Date();
            const currentTimestamp = clientTimestamp ?? BigInt(now.getTime());

            if (existing) {
              await tx.progress.update({
                where: { id: existing.id },
                data: {
                  isCompleted,
                  completedAt: isCompleted ? now : null,
                  lastUpdated: currentTimestamp,
                },
              });
            } else {
              await tx.progress.create({
                data: {
                  userId,
                  materialId,
                  isCompleted,
                  completedAt: isCompleted ? new Date() : undefined,
                },
              });
            }
          }
        }

        // Unit progress - NOT PERSISTED ANYMORE.
        // We will return a mock or derived value if needed, but the plan is to remove the table.

        // Topic/Material progress - THE SSOT
        // Only create if we have at least topic or material, and validate they exist
        if (topicId || materialId) {
          const now = new Date();
          const currentTimestamp = clientTimestamp ?? BigInt(now.getTime());

          // Validate that referenced entities exist
          const validationPromises = [];
          if (topicId) {
            validationPromises.push(
              tx.topic.findUnique({ where: { id: topicId } }).then(t => ({ topic: t })),
            );
          }
          if (materialId) {
            validationPromises.push(
              tx.material.findUnique({ where: { id: materialId } }).then(m => ({ material: m })),
            );
          }
          if (unitId) {
            validationPromises.push(
              tx.unit.findUnique({ where: { id: unitId } }).then(u => ({ unit: u })),
            );
          }
          if (courseId) {
            validationPromises.push(
              tx.course.findUnique({ where: { id: courseId } }).then(c => ({ course: c })),
            );
          }

          const validationResults = await Promise.all(validationPromises);

          // Check if all required entities exist
          const hasErrors = validationResults.some(result => {
            const key = Object.keys(result)[0];
            const entity = result[key as keyof typeof result];
            return entity === null;
          });

          if (hasErrors) {
            this.logger.warn(
              `Progress validation failed - some entities do not exist`,
              { userId, topicId, materialId, unitId, courseId },
            );
            // Skip progress creation if validation fails
            return;
          }

          // Use findFirst + update/create instead of upsert because upsert doesn't
          // support null values in composite unique constraint lookups
          const findWhere: any = {
            userId,
            materialId: materialId ?? null,
            topicId: topicId ?? null,
            unitId: unitId ?? null,
            courseId: courseId ?? null,
          };

          const existingProgress = await tx.progress.findFirst({
            where: findWhere,
          });

          // NOTE: `timeSpent` is intentionally NOT included in this shared object.
          // Prisma's `{ increment: N }` write operator is only valid inside
          // update()/upsert().update — passing it to create() throws a
          // PrismaClientValidationError ("Expected Int, provided Object"),
          // since create() has no existing row to increment from.
          const baseData = {
            progressPercentage: progressPercentage ?? 0,
            lastAccessedAt: now,
            lastUpdated: currentTimestamp,
            status:
              status === ProgressStatus.completed
                ? ProgressStatus.completed
                : ProgressStatus.inProgress,
            completedAt: status === ProgressStatus.completed ? now : null,
          };

          if (existingProgress) {
            await tx.progress.update({
              where: { id: existingProgress.id },
              data: {
                ...baseData,
                timeSpent: { increment: timeSpent ?? 0 },
              },
            });
          } else {
            await tx.progress.create({
              data: {
                userId,
                topicId: topicId ?? null,
                materialId: materialId ?? null,
                unitId: unitId ?? null,
                courseId: courseId ?? null,
                ...baseData,
                timeSpent: timeSpent ?? 0,
              },
            });
          }
        }

        // Course rollup - NOT PERSISTED IN CourseProgress ANYMORE.
        // We calculate it on-the-fly when requested.
        if (courseId) {
          const courseProgress = await this.calculateCourseProgress(
            userId,
            courseId,
            tx,
          );
          if (courseProgress) {
            updatedCourseProgress = {
              id: 'derived',
              userId,
              courseId,
              progressPercentage: Math.round(courseProgress.percentage),
              completedUnits: courseProgress.completedUnits,
              status:
                courseProgress.percentage >= 100
                  ? ProgressStatus.completed
                  : ProgressStatus.inProgress,
              timeSpent: 0,
              lastAccessedAt: new Date(),
            };
          }
        }

        // Activity
        await tx.userActivity.create({
          data: {
            userId,
            type: UserActivityType.LEARNING,
            description: `Studied ${materialId ? 'material' : unitId ? 'unit' : topicId ? 'topic' : 'course'}: ${timeSpent ?? 0} minutes`,
            details: {
              courseId,
              unitId,
              materialId,
              topicId,
              timeSpent,
              progressPercentage,
            },
          },
        });
      });

      await this.clearCache(userId, courseId);
      this.logger.log('Progress updated successfully', {
        userId,
        courseId,
        unitId,
        materialId,
        topicId,
      });

      // Track analytics event (fire and forget)
      this.aiAnalyticsService
        .trackEvent(
          userId,
          'progress_updated',
          {
            courseId,
            unitId,
            materialId,
            topicId,
            status,
            progressPercentage,
            timeSpent,
          },
          new Date().toISOString(),
        )
        .catch((err: any) => {
          this.logger.error('Failed to track progress event', {
            userId,
            error: getErrorMessage(err),
          });
        });

      return updatedCourseProgress;
    } catch (error: any) {
      handleServiceError(error, this.logger, 'updateProgress');
      return null;
    }
  }

  async markMaterialAsRead(
    userId: string,
    materialId: string,
    clientTimestamp?: bigint,
  ): Promise<Progress | undefined> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id: materialId },
        select: { id: true, unitId: true, topicId: true },
      });
      if (!material || !material.unitId) {
        throw new NotFoundException(
          `Material with ID ${materialId} not found or not associated with a unit`,
        );
      }

      const unit = await this.prisma.unit.findUnique({
        where: { id: material.unitId },
        select: { id: true, courseId: true },
      });
      if (!unit) {
        throw new NotFoundException(
          `Unit not found for material ID ${materialId}`,
        );
      }

      const courseId = unit.courseId;
      const topicId = material.topicId;

      let materialProgress: Progress | undefined;
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Check for conflict if clientTimestamp provided
        if (clientTimestamp !== undefined) {
          const existing = await tx.progress.findFirst({
            where: {
              userId,
              materialId,
              topicId: topicId ?? null,
            },
          });

          if (existing && existing.lastUpdated > clientTimestamp) {
            throw new ConflictException(
              'Server has newer data. Please refresh and retry.',
            );
          }
        }

        const now = new Date();
        const currentTimestamp = clientTimestamp ?? BigInt(now.getTime());

        // Build where clause with only actual IDs to avoid foreign key violations
        const whereData: any = {
          userId,
          materialId,
          topicId: topicId || null,
          unitId: material.unitId || null,
          courseId: courseId || null,
        };

        const createData: any = {
          userId,
          materialId,
          topicId: topicId || null,
          unitId: material.unitId || null,
          courseId: courseId || null,
          isCompleted: true,
          completedAt: now,
          lastUpdated: currentTimestamp,
        };

        materialProgress = await tx.progress.upsert({
          where: {
            userId_topicId_materialId_unitId_courseId: whereData,
          },
          update: {
            isCompleted: true,
            completedAt: now,
            lastUpdated: currentTimestamp,
          },
          create: createData,
        });

        // Unit and Course progress updates are removed here as they are now derived aggregates.

        await tx.userActivity.create({
          data: {
            userId,
            type: UserActivityType.LEARNING,
            description: `Marked material as read: ${materialId}`,
            details: {
              materialId,
              unitId: material.unitId,
              topicId: material.topicId,
              courseId,
            },
          },
        });
      });

      this.events.emit('progress.updated', {
        userId,
        materialId,
        unitId: material.unitId,
        topicId: material.topicId,
        courseId,
        status: ProgressStatus.completed,
        progressPercentage: 100,
        occurredAt: new Date(),
      });
      await this.clearCache(userId, courseId);
      this.logger.log('Material marked as read successfully', {
        userId,
        materialId,
      });

      return materialProgress;
    } catch (error) {
      handleServiceError(error, this.logger, 'markMaterialAsRead');
      return undefined;
    }
  }

  async getProgressByUser(userId: string): Promise<Progress[] | undefined> {
    const cacheKey = cacheKeys.progressByUser(userId);
    const cached = await this.redisService.get<Progress[]>(cacheKey);
    if (cached) {
      this.logger.log('User progress fetched from cache', { userId });
      return cached;
    }

    try {
      const progress = await this.prisma.progress.findMany({
        where: { userId },
        include: {
          material: {
            include: {
              unit: {
                include: { course: { select: { id: true, title: true } } },
              },
            },
          },
          topic: true,
        },
      });

      await this.redisService.set(cacheKey, progress, this.CACHE_TTL);
      this.logger.log('User progress fetched from database', { userId });
      return progress;
    } catch (error) {
      handleServiceError(error, this.logger, 'getProgressByUser');
      return undefined;
    }
  }

  async getUserProgress(
    userId: string,
    courseId: string,
  ): Promise<UserProgressDetails | null> {
    const cacheKey = cacheKeys.progressByUserCourse(userId, courseId);

    try {
      const cached = await this.redisService.get<UserProgressDetails>(cacheKey);
      if (cached) {
        this.logger.log('Course progress fetched from cache', {
          userId,
          courseId,
        });
        return cached;
      }
    } catch (cacheError) {
      this.logger.warn('Failed to fetch from cache, proceeding with DB', {
        userId,
        courseId,
        error: getErrorMessage(cacheError),
      });
    }

    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });

      if (!course) {
        this.logger.warn('Course not found for progress lookup', { courseId });
        return null;
      }

      // Authoritative analytics from Rust service
      const analytics = await this.calculateCourseProgress(userId, courseId);

      // Optimize: Fetch all relevant progress records for this user and course in one go
      // Then we can filter/map them in memory instead of deep nested JOINS if those are buggy
      const [allProgress, units, allMaterials] = await Promise.all([
        this.prisma.progress.findMany({
          where: { userId, courseId },
          include: { topic: true },
        }),
        this.prisma.unit.findMany({
          where: { courseId },
          orderBy: { order: 'asc' },
          select: { id: true, title: true, order: true },
        }),
        this.prisma.material.findMany({
          where: { unit: { courseId } },
          select: { id: true, unitId: true },
        }),
      ]);

      // Calculate unit progress efficiently using the fetched data
      const unitProgress = units.map((unit) => {
        const unitMaterials = allMaterials.filter((m) => m.unitId === unit.id);
        const materialIds = unitMaterials.map((m) => m.id);

        const completedMaterialsInUnit = allProgress.filter(
          (p) =>
            p.materialId &&
            materialIds.includes(p.materialId) &&
            p.isCompleted === true,
        );

        const materialCount = unitMaterials.length;
        const completedCount = completedMaterialsInUnit.length;
        const percentage =
          materialCount > 0 ? (completedCount / materialCount) * 100 : 0;

        return {
          id: unit.id,
          userId,
          unitId: unit.id,
          status:
            percentage >= 100
              ? ProgressStatus.completed
              : ProgressStatus.inProgress,
          progressPercentage: Math.round(percentage),
          timeSpent: 0,
          lastAccessedAt: new Date(),
          unit: {
            id: unit.id,
            title: unit.title ?? '',
            order: unit.order,
          },
        };
      });

      const topicProgress = allProgress.filter((p) => p.topicId !== null);

      const result: UserProgressDetails = {
        id: 'derived',
        userId,
        courseId,
        status:
          (analytics?.percentage ?? 0) >= 100
            ? ProgressStatus.completed
            : ProgressStatus.inProgress,
        progressPercentage: Math.round(analytics?.percentage ?? 0),
        completedUnits: analytics?.completedUnits ?? 0,
        timeSpent: 0,
        lastAccessedAt: new Date(),
        unitProgress,
        topicProgress,
      };

      try {
        await this.redisService.set(cacheKey, result, this.CACHE_TTL);
      } catch (cacheError) {
        this.logger.warn('Failed to cache course progress', {
          userId,
          courseId,
          error: getErrorMessage(cacheError),
        });
      }

      return result;
    } catch (error: any) {
      this.logger.error('Database error in getUserProgress:', {
        userId,
        courseId,
        errorCode: error.code,
        errorMessage: error.message,
        stack: error.stack,
      });

      // Special handling for BigInt serialization just in case
      if (error.message?.includes('Do not know how to serialize a BigInt')) {
        this.logger.error('BigInt serialization error detected');
      }

      handleServiceError(error, this.logger, 'getUserProgress');
      return null;
    }
  }

  async getUserOverallProgress(
    userId: string,
  ): Promise<OverallProgress | undefined> {
    const cacheKey = cacheKeys.progressOverall(userId);
    const cached = await this.redisService.get<OverallProgress>(cacheKey);
    if (cached) {
      this.logger.log('Overall progress fetched from cache', { userId });
      return cached;
    }

    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          course: { select: { id: true, title: true } },
        },
      });

      const stats = await this.calculateUserStats(userId);

      const result: OverallProgress = {
        enrollments: await Promise.all(
          enrollments.map(async (e): Promise<UserEnrollment> => {
            const progress = await this.calculateCourseProgress(
              userId,
              e.courseId,
            );
            return {
              courseId: e.courseId,
              courseTitle: e.course?.title ?? undefined,
              progressPercentage: Math.round(progress?.percentage ?? 0),
              lastAccessedAt: e.enrolledAt,
              isCompleted: (progress?.percentage ?? 0) >= 100,
            };
          }),
        ),
        stats,
      };

      await this.redisService.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log('Overall progress fetched from database', { userId });
      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'getUserOverallProgress');
      return undefined;
    }
  }

  async getCourseProgress(userId: string): Promise<CourseProgress[]> {
    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              title: true,
              code: true,
              description: true,
              difficulty: true,
              status: true,
              categoryId: true,
              createdById: true,
              estimatedHours: true,
              tags: true,
              rating: true,
              price: true,
              enrollmentCount: true,
              isFeatured: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      const progressItems = await Promise.all(
        enrollments.map(async (e) => {
          if (!e.course) {
            return null;
          }
          const analytics = await this.calculateCourseProgress(
            userId,
            e.courseId,
          );
          return {
            id: e.courseId,
            userId: e.userId,
            courseId: e.courseId,
            title: e.course?.title || e.course?.name || 'Untitled Course',
            courseName: e.course?.name || e.course?.title || 'Untitled Course',
            status:
              (analytics?.percentage ?? 0) >= 100
                ? ProgressStatus.completed
                : ProgressStatus.inProgress,
            progressPercentage: Math.round(analytics?.percentage ?? 0),
            completedUnits: analytics?.completedUnits ?? 0,
            timeSpent: 0,
            lastAccessedAt: e.enrolledAt,
            totalUnits: analytics?.totalUnits ?? 0,
          };
        }),
      );

      const result: CourseProgress[] = progressItems.filter(
        (item) => item !== null,
      ) as CourseProgress[];

      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'getCourseProgress');
      return [];
    }
  }

  async startUnit(userId: string, unitId: string): Promise<any> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
      });
      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      let progress = await this.prisma.progress.findFirst({
        where: {
          userId,
          unitId,
          topicId: null,
          materialId: null,
        },
      });

      if (!progress) {
        progress = await this.prisma.progress.create({
          data: {
            userId,
            topicId: null as any,
            materialId: null as any,
            unitId,
            courseId: unit.courseId,
            status: ProgressStatus.inProgress,
            startedAt: new Date(),
            lastAccessedAt: new Date(),
          },
        });
      } else {
        progress = await this.prisma.progress.update({
          where: { id: progress.id },
          data: {
            status: progress.status === ProgressStatus.notStarted ? ProgressStatus.inProgress : progress.status,
            lastAccessedAt: new Date(),
          },
        });
      }

      return progress;
    } catch (error) {
      handleServiceError(error, this.logger, 'startUnit');
    }
  }

  async getEnrolledUnitsDashboard(userId: string): Promise<any[]> {
    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId, status: EnrollmentStatus.active },
        include: {
          course: {
            select: { id: true, title: true, name: true }
          }
        }
      });

      const enrolledUnits = [];
      for (const e of enrollments) {
        // get detailed progress for the course
        const detailedProgress = await this.getUserProgress(userId, e.courseId);

        let activeUnit: any = null;
        let nextTopic: any = null;
        let completedTopicsCount = 0;
        let totalTopicsCount = 0;

        if (detailedProgress && detailedProgress.unitProgress && detailedProgress.unitProgress.length > 0) {
          // Find the active unit (first inProgress or notStarted, or last completed)
          activeUnit = detailedProgress.unitProgress.find(u => u.status === ProgressStatus.inProgress);
          if (!activeUnit) {
             activeUnit = detailedProgress.unitProgress.find(u => u.status === ProgressStatus.notStarted);
          }
          if (!activeUnit) {
             activeUnit = detailedProgress.unitProgress[detailedProgress.unitProgress.length - 1];
          }

          if (activeUnit) {
             // Find next topic
             const topics = await this.prisma.topic.findMany({
               where: { unitId: activeUnit.unitId },
               orderBy: { order: 'asc' },
               select: { id: true, name: true, order: true }
             });

             totalTopicsCount = topics.length;

             for (const topic of topics) {
                const topicProg = detailedProgress.topicProgress.find(p => p.topicId === topic.id);
                if (topicProg && topicProg.isCompleted) {
                   completedTopicsCount++;
                } else if (!nextTopic) {
                   nextTopic = topic;
                }
             }
          }
        }

        enrolledUnits.push({
          courseId: e.courseId,
          courseTitle: (e.course)?.title || (e.course)?.name || 'Untitled Course',
          unitId: activeUnit?.unitId || `placeholder-${e.courseId}`,
          unitTitle: activeUnit?.unit?.title || 'Getting Started',
          progressPercentage: activeUnit?.progressPercentage || 0,
          status: activeUnit?.status || ProgressStatus.notStarted,
          nextTopicId: nextTopic?.id,
          nextTopicName: nextTopic?.name,
          completedTopics: completedTopicsCount,
          totalTopics: totalTopicsCount,
          lastAccessedAt: activeUnit?.lastAccessedAt || e.enrolledAt || new Date()
        });
      }
      return enrolledUnits;
    } catch (error) {
      handleServiceError(error, this.logger, 'getEnrolledUnitsDashboard');
      return [];
    }
  }

  async getUserActivities(userId: string): Promise<UserActivity[]> {
    return this.prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Limit to recent activities
    });
  }

  getUserAchievements(): any[] {
    // Assuming an Achievement model or similar for achievements
    // For now, returning a mock or empty array if no Achievement model exists
    // You would replace this with actual database queries for achievements
    return [];
  }

  async calculateOverallProgress(userId: string): Promise<number | undefined> {
    try {
      // Delegate high-level overall progress computation to the Rust analytics service.
      // Use average course progress from course statistics as a proxy for overall progress.
      const stats =
        await this.courseAnalyticsService.getCourseStatistics(userId);
      if (stats && typeof stats.averageCourseProgress === 'number') {
        this.logger.debug(
          'Delegated overall progress to CourseAnalyticsService',
          { userId, percentage: stats.averageCourseProgress },
        );
        return Math.round(stats.averageCourseProgress);
      }
      return 0;
    } catch (error) {
      handleServiceError(error, this.logger, 'calculateOverallProgress');
      return undefined;
    }
  }

  async calculateCourseProgress(
    userId: string,
    courseId: string,
    _client?: Prisma.TransactionClient | PrismaClientLike,
  ): Promise<
    | { percentage: number; completedUnits: number; totalUnits: number }
    | undefined
  > {
    try {
      // Delegate to Rust analytics service (gRPC) as the authoritative computation engine.
      // NOTE: Local DB fallback removed to avoid duplicated logic between backend and Rust.
      // If Rust is unavailable, callers should handle the undefined result appropriately.
      const analytics: any =
        await this.courseAnalyticsService.calculateCourseProgress(
          userId,
          courseId,
        );
      if (analytics) {
        return {
          percentage: analytics.progressPercentage,
          completedUnits: analytics.completedUnits,
          totalUnits: analytics.totalUnits,
        };
      }

      this.logger.warn(
        'Course analytics returned null; cannot compute course progress',
        { userId, courseId },
      );
      return undefined;
    } catch (error) {
      handleServiceError(error, this.logger, 'calculateCourseProgress');
      return undefined;
    }
  }

  private async calculateUserStats(
    userId: string,
  ): Promise<UserStats | undefined> {
    try {
      const [
        totalCourses,
        completedCourses,
        totalStudyTime,
        recentActivities,
        detailedAnalytics,
      ] = await Promise.all([
        this.prisma.courseEnrollment.count({ where: { userId } }),
        this.prisma.courseEnrollment.count({
          where: { userId, progressPercentage: { gte: 100 } },
        }),
        this.prisma.progress.aggregate({
          where: { userId },
          _sum: { timeSpent: true },
        }),
        // Fetch activities for the last 30 days to allow streak calculation
        this.prisma.userActivity.findMany({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.learningAnalyticsService
          .getDetailedLearningAnalytics(userId)
          .catch(() => undefined),
      ]);

      const total = totalStudyTime._sum?.timeSpent || 0;
      const avg = this.calculateAverageSessionDuration(recentActivities);

      // Map from LearningAnalyticsService (authoritative gRPC data)
      const analytics = detailedAnalytics;

      return {
        userId,
        totalCourses,
        completedCourses,
        inProgressCourses: totalCourses - completedCourses,
        totalLearningPaths: analytics?.pathStats?.totalLearningPaths || 0,
        completedLearningPaths:
          analytics?.pathStats?.completedLearningPaths || 0,
        totalStudyTime: analytics?.userLearningSummary?.totalStudyTime || total,
        averageCourseProgress:
          analytics?.courseStats?.averageCourseProgress || 0,
        averagePathProgress: analytics?.pathStats?.averagePathProgress || 0,
        sessionsThisWeek:
          analytics?.engagementMetrics?.sessionCount || recentActivities.length,
        averageSessionDuration:
          analytics?.engagementMetrics?.averageSessionDuration || avg,
        // Provide both keys for compatibility with frontend expectations
        streakDays: analytics?.userLearningSummary?.currentStreak || 0,
        streak: analytics?.userLearningSummary?.currentStreak || 0,
        engagementMetrics: analytics?.engagementMetrics || ({} as any),
        performanceMetrics: analytics?.performanceMetrics || ({} as any),
        progressTrends: (analytics?.progressTrends || []).map((trend: any) => ({
          ...trend,
          date: trend.date ? new Date(trend.date) : undefined,
          metadata:
            typeof trend.metadata === 'string'
              ? (() => {
                  try {
                    return JSON.parse(trend.metadata);
                  } catch {
                    return {};
                  }
                })()
              : trend.metadata,
        })),
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'calculateUserStats');
      return undefined;
    }
  }

  private calculateAverageSessionDuration(activities: UserActivity[]): number {
    if (!activities || activities.length === 0) {
      return 0;
    }
    const totalTime = activities.reduce(
      (sum, a) =>
        sum +
        ((a.details as unknown as LearningActivityDetails)?.timeSpent ?? 0),
      0,
    );
    return Math.round(totalTime / activities.length);
  }

  async getPeerComparison(userId: string): Promise<any> {
    try {
      // Get user's average score from enrollments
      const userProgress = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        select: { progressPercentage: true },
      });

      const userAverage =
        userProgress.length > 0
          ? Math.round(
              userProgress.reduce(
                (sum, p) => sum + (p.progressPercentage || 0),
                0,
              ) / userProgress.length,
            )
          : 0;

      // Get cohort statistics from all users
      const allEnrollments = await this.prisma.courseEnrollment.findMany({
        select: { progressPercentage: true, userId: true },
      });

      const uniqueUsers = new Set(allEnrollments.map((e) => e.userId));
      const totalStudents = uniqueUsers.size;

      const cohortAverage =
        allEnrollments.length > 0
          ? Math.round(
              allEnrollments.reduce(
                (sum, e) => sum + (e.progressPercentage || 0),
                0,
              ) / allEnrollments.length,
            )
          : 0;

      // Get top performer
      const topPerformer = Math.max(
        0,
        ...allEnrollments.map((e) => e.progressPercentage || 0),
      );

      // Calculate rank (percentile rank)
      const userScores = allEnrollments
        .filter((e) => e.userId === userId)
        .map((e) => e.progressPercentage || 0);

      const userRank =
        userScores.length > 0
          ? allEnrollments.filter(
              (e) => (e.progressPercentage || 0) > userAverage,
            ).length + 1
          : 0;

      return {
        yourAverage: userAverage,
        cohortAverage,
        topPerformer,
        rank: userRank,
        totalStudents,
      };
    } catch (error) {
      this.logger.error(
        `Error getting peer comparison for user ${userId}:`,
        error,
      );
      return {
        yourAverage: 0,
        cohortAverage: 0,
        topPerformer: 0,
        rank: 0,
        totalStudents: 0,
      };
    }
  }

  /**
   * Get user streak information (current and longest)
   */
  async getUserStreaks(userId: string): Promise<
    | {
        userId: string;
        currentStreak: number;
        longestStreak: number;
        lastActivityDate: Date | null;
      }
    | undefined
  > {
    try {
      // Fetch activities from last 90 days to calculate streaks
      const recentActivities = await this.prisma.userActivity.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (recentActivities.length === 0) {
        return {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
        };
      }

      const lastActivityDate = recentActivities[0].createdAt;

      // Get unique days sorted descending
      const uniqueDays = [
        ...new Set(recentActivities.map((a) => a.createdAt.toDateString())),
      ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date().toDateString();
      for (let i = 0; i < uniqueDays.length; i++) {
        const dayDiff = Math.floor(
          (new Date(today).getTime() - new Date(uniqueDays[i]).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (dayDiff <= i) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Calculate longest streak (simple method: look for consecutive sequences)
      let longestStreak = 1;
      let tempStreak = 1;
      for (let i = 1; i < uniqueDays.length; i++) {
        const prevDate = new Date(uniqueDays[i - 1]);
        const currDate = new Date(uniqueDays[i]);
        const daysDiff = Math.floor(
          (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }

      return {
        userId,
        currentStreak,
        longestStreak,
        lastActivityDate,
      };
    } catch (error) {
      this.logger.error(`Error getting user streaks for ${userId}:`, error);
      return undefined;
    }
  }

  async calculateUnitProgress(
    userId: string,
    unitId: string,
  ): Promise<{ progressPercentage: number; isCompleted: boolean }> {
    try {
      const materialCount = await this.prisma.material.count({
        where: { unitId },
      });
      if (materialCount === 0) {
        return { progressPercentage: 100, isCompleted: true };
      }

      const completedMaterials = await this.prisma.progress.count({
        where: { userId, material: { unitId }, isCompleted: true },
      });

      const progressPercentage = Math.round(
        (completedMaterials / materialCount) * 100,
      );
      return {
        progressPercentage,
        isCompleted: progressPercentage >= 100,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating unit progress for ${unitId}:`,
        error,
      );
      return { progressPercentage: 0, isCompleted: false };
    }
  }

  async trackUnitAccess(userId: string, unitId: string): Promise<void> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { courseId: true },
      });

      if (unit?.courseId) {
        await this.prisma.progress.upsert({
          where: {
            userId_topicId_materialId_unitId_courseId: {
              userId,
              topicId: null as any,
              materialId: null as any,
              unitId,
              courseId: unit.courseId,
            },
          },
          update: { lastAccessedAt: new Date() },
          create: {
            userId,
            topicId: null as any,
            materialId: null as any,
            unitId,
            courseId: unit.courseId,
            status: ProgressStatus.inProgress,
            progressPercentage: 0,
            lastAccessedAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error tracking unit access for ${unitId}:`, error);
    }
  }

  async trackUnitCompletion(userId: string, unitId: string): Promise<void> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { courseId: true },
      });

      if (unit?.courseId) {
        await this.prisma.progress.upsert({
          where: {
            userId_topicId_materialId_unitId_courseId: {
              userId,
              topicId: null as any,
              materialId: null as any,
              unitId,
              courseId: unit.courseId,
            },
          },
          update: {
            status: ProgressStatus.completed,
            progressPercentage: 100,
            isCompleted: true,
            completedAt: new Date(),
          },
          create: {
            userId,
            topicId: null as any,
            materialId: null as any,
            unitId,
            courseId: unit.courseId,
            status: ProgressStatus.completed,
            progressPercentage: 100,
            isCompleted: true,
            completedAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error tracking unit completion for ${unitId}:`, error);
    }
  }

  /**
   * PERF-002: Calculate current competence considering time decay
   * Uses exponential decay model with 30-day half-life
   */
  async calculateCurrentCompetence(
    userId: string,
    topicId: string,
  ): Promise<{
    competence: number;
    decayFactor: number;
    daysSinceLastPractice: number;
  }> {
    const HALF_LIFE_DAYS = 30; // Competence halves every 30 days without practice
    const DECAY_CONSTANT = Math.log(2) / HALF_LIFE_DAYS;

    try {
      // Get user's latest quiz/assessment for this topic
      const latestAttempt = await this.prisma.quizAttempt.findFirst({
        where: {
          userId,
          quiz: {
            topicId,
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
      });

      if (!latestAttempt || !latestAttempt.completedAt) {
        return {
          competence: 0,
          decayFactor: 1,
          daysSinceLastPractice: Infinity,
        };
      }

      const initialScore = latestAttempt.score ?? 0;
      const daysSince = Math.floor(
        (Date.now() - latestAttempt.completedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Exponential decay: competence = initialScore * e^(-λt)
      const decayFactor = Math.exp(-DECAY_CONSTANT * daysSince);
      const competence = initialScore * decayFactor;

      this.logger.debug('Competence calculated with decay', {
        userId,
        topicId,
        initialScore,
        daysSince,
        decayFactor,
        competence,
      });

      return {
        competence: Math.round(competence * 100) / 100,
        decayFactor: Math.round(decayFactor * 100) / 100,
        daysSinceLastPractice: daysSince,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating competence decay for topic ${topicId}:`,
        error,
      );
      return { competence: 0, decayFactor: 1, daysSinceLastPractice: 0 };
    }
  }
}