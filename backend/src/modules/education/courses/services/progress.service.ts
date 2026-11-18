import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  Progress,
  UserActivity,
  ProgressStatus,
  UserActivityType,
  EnrollmentStatus,
  MemberStatus,
  RoleName,
  StudyGroupStatus,
} from '@prisma/client';
import { handleServiceError, getErrorMessage } from '#common/utils/error.utils';
import { cacheKeys } from '#common/constants/cache-keys';
import { ProgressUpdateDto } from '#common/dto/progress.dto';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { CourseAnalyticsService } from '#modules/ai-analytics/services/course-analytics.service';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import { calculateLearningStreaks } from '../utils/learning-streak';
import { getReadinessSignal } from '../types/mastery.types';
import { writeApplicationOutboxEvent } from '#infrastructure/outbox/application-outbox-event';
import {
  UserProgressDetails,
  OverallProgress,
  CourseProgress,
  UserStats,
  LearningActivityDetails,
} from '#common/dto';
import type { UserEnrollment } from '#common/dto/progress.dto';

function getProgressStatus(percentage: number): ProgressStatus {
  const roundedPercentage = Math.round(percentage);
  if (roundedPercentage >= 100) return ProgressStatus.completed;
  if (roundedPercentage <= 0) return ProgressStatus.notStarted;
  return ProgressStatus.inProgress;
}

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

  private getOccurrenceTime(clientTimestamp?: number | bigint): Date {
    if (clientTimestamp === undefined) return new Date();

    const milliseconds = Number(clientTimestamp);
    const occurredAt = new Date(milliseconds);
    if (
      !Number.isSafeInteger(milliseconds) ||
      Number.isNaN(occurredAt.getTime())
    ) {
      throw new BadRequestException(
        'Client timestamp must be valid milliseconds.',
      );
    }
    if (milliseconds > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException(
        'Client timestamp cannot be more than five minutes in the future.',
      );
    }
    return occurredAt;
  }

  async invalidateUserProgressCache(userId: string): Promise<void> {
    await this.clearCache(userId);
  }

  private async authorizeMaterialProgress(
    userId: string,
    materialId: string,
    associations: { courseId?: string; unitId?: string; topicId?: string },
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        userId: true,
        courseId: true,
        unitId: true,
        topicId: true,
        metadata: true,
        unit: { select: { courseId: true } },
      },
    });
    if (!material) {
      throw new NotFoundException(`Material with ID ${materialId} not found`);
    }

    const materialCourseId =
      material.courseId ?? material.unit?.courseId ?? undefined;
    if (
      (associations.courseId && associations.courseId !== materialCourseId) ||
      (associations.unitId && associations.unitId !== material.unitId) ||
      (associations.topicId && associations.topicId !== material.topicId)
    ) {
      throw new ForbiddenException(
        'Progress associations do not match the selected material.',
      );
    }

    if (material.userId === userId) return;

    const directShare = await this.prisma.materialShare.findUnique({
      where: { materialId_userId: { materialId, userId } },
      select: { id: true },
    });
    if (directShare) return;

    const metadata =
      material.metadata &&
      typeof material.metadata === 'object' &&
      !Array.isArray(material.metadata)
        ? (material.metadata as Record<string, unknown>)
        : {};
    if (metadata.shareWithCourse === false || !materialCourseId) {
      throw new ForbiddenException(
        'This material has not been shared with you.',
      );
    }

    const [course, instructorAssignment, enrollment, groupMemberships, roles] =
      await Promise.all([
        this.prisma.course.findUnique({
          where: { id: materialCourseId },
          select: { createdById: true },
        }),
        this.prisma.courseInstructor.findUnique({
          where: {
            courseId_userId: { courseId: materialCourseId, userId },
          },
          select: { id: true },
        }),
        this.prisma.courseEnrollment.findUnique({
          where: {
            userId_courseId: { userId, courseId: materialCourseId },
          },
          select: { status: true },
        }),
        this.prisma.studyGroupMember.findMany({
          where: {
            userId,
            status: MemberStatus.active,
            studyGroup: { is: { status: StudyGroupStatus.active } },
          },
          select: { studyGroup: { select: { metadata: true } } },
        }),
        this.prisma.userRole.findMany({
          where: { userId },
          select: { role: { select: { name: true } } },
        }),
      ]);

    const isAdmin = roles.some(({ role }) => role.name === RoleName.admin);
    const isInstructor =
      course?.createdById === userId || Boolean(instructorAssignment);
    const isEnrolled =
      enrollment?.status === EnrollmentStatus.active ||
      enrollment?.status === EnrollmentStatus.completed;
    const isCourseGroupMember = groupMemberships.some(({ studyGroup }) => {
      const groupMetadata = studyGroup.metadata;
      return (
        groupMetadata !== null &&
        typeof groupMetadata === 'object' &&
        !Array.isArray(groupMetadata) &&
        (groupMetadata as Record<string, unknown>).courseId === materialCourseId
      );
    });

    if (!isAdmin && !isInstructor && !(isEnrolled || isCourseGroupMember)) {
      throw new ForbiddenException(
        'Enroll in this course to access its materials.',
      );
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
        idempotencyKey,
        expectedRevision,
      } = updateDto;
      const progressValue = Number.isFinite(progressPercentage)
        ? Math.max(0, Math.min(100, Math.floor(progressPercentage ?? 0)))
        : 0;
      const timeSpentDelta = Number.isFinite(timeSpent)
        ? Math.max(0, Math.min(1440, Math.floor(timeSpent ?? 0)))
        : 0;
      const occurredAt = this.getOccurrenceTime(clientTimestamp);

      if (
        typeof idempotencyKey !== 'string' ||
        idempotencyKey.trim().length === 0 ||
        idempotencyKey.length > 200
      ) {
        throw new BadRequestException(
          'An idempotency key of at most 200 characters is required for content progress updates.',
        );
      }

      if (materialId) {
        await this.authorizeMaterialProgress(userId, materialId, {
          courseId,
          unitId,
          topicId,
        });
      } else if (courseId) {
        const enrollment = await this.prisma.courseEnrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        });

        if (
          !enrollment ||
          (enrollment.status !== EnrollmentStatus.active &&
            enrollment.status !== EnrollmentStatus.completed)
        ) {
          throw new ForbiddenException(
            'An active course enrollment is required to update progress.',
          );
        }
      }

      if (topicId) {
        const topic = await this.prisma.topic.findUnique({
          where: { id: topicId },
          select: {
            unitId: true,
            unit: { select: { courseId: true } },
          },
        });
        if (!topic) {
          throw new NotFoundException(`Topic with ID ${topicId} not found`);
        }
        if (
          (unitId && topic.unitId !== unitId) ||
          (courseId && topic.unit?.courseId !== courseId)
        ) {
          throw new ForbiddenException(
            'Progress associations do not match the selected topic.',
          );
        }
      } else if (unitId && courseId && !materialId) {
        const unit = await this.prisma.unit.findUnique({
          where: { id: unitId },
          select: { courseId: true },
        });
        if (!unit) {
          throw new NotFoundException(`Unit with ID ${unitId} not found`);
        }
        if (unit.courseId !== courseId) {
          throw new ForbiddenException(
            'Progress associations do not match the selected unit.',
          );
        }
      }

      let updatedCourseProgress: any = null;
      let duplicateRequest = false;
      const sourceKey = `progress-sync:${userId}:${idempotencyKey}`;
      const sourceFingerprint = JSON.stringify({
        courseId: courseId ?? null,
        unitId: unitId ?? null,
        materialId: materialId ?? null,
        topicId: topicId ?? null,
        status: status ?? null,
        progressPercentage: progressValue,
        timeSpentMinutes: timeSpentDelta,
        expectedRevision: expectedRevision ?? null,
        occurredAt: occurredAt.toISOString(),
      });

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const activity = await tx.userActivity.createMany({
          data: [
            {
              userId,
              sourceKey,
              type: UserActivityType.LEARNING,
              description: 'Synced learning progress',
              details: {
                sourceType: 'progress_sync',
                sourceId: idempotencyKey,
                courseId,
                unitId,
                materialId,
                topicId,
                timeSpentMinutes: timeSpentDelta,
                occurredAt: occurredAt.toISOString(),
                sourceFingerprint,
              },
              createdAt: occurredAt,
            },
          ],
          skipDuplicates: true,
        });
        if (activity.count === 0) {
          const previousActivity = await tx.userActivity.findUnique({
            where: { sourceKey },
            select: { details: true },
          });
          const previousDetails = previousActivity?.details;
          if (
            !previousDetails ||
            typeof previousDetails !== 'object' ||
            !('sourceFingerprint' in previousDetails) ||
            previousDetails.sourceFingerprint !== sourceFingerprint
          ) {
            throw new ConflictException(
              'The idempotency key was already used for a different progress update.',
            );
          }
          duplicateRequest = true;
          return;
        }

        const canonicalProgressWhere = {
          userId,
          materialId: materialId ?? null,
          topicId: topicId ?? null,
          unitId: unitId ?? null,
          courseId: courseId ?? null,
        };
        const existingProgress =
          topicId || materialId
            ? await tx.progress.findFirst({ where: canonicalProgressWhere })
            : null;
        const existingQuizScores =
          existingProgress?.quizScores &&
          typeof existingProgress.quizScores === 'object' &&
          !Array.isArray(existingProgress.quizScores)
            ? (existingProgress.quizScores as Record<string, unknown>)
            : {};
        const topicMasteryUnlocked = existingQuizScores.masteryUnlocked === true;
        const currentRevision = existingProgress?.revision ?? 0;
        if (
          expectedRevision !== undefined &&
          expectedRevision !== currentRevision
        ) {
          throw new ConflictException({
            message:
              'Progress changed on another device. Refresh before retrying.',
            expectedRevision,
            currentRevision,
          });
        }
        if (
          topicId &&
          !materialId &&
          !topicMasteryUnlocked &&
          (status === ProgressStatus.completed || progressValue >= 100)
        ) {
          throw new ForbiddenException(
            'A topic can only be completed by passing its assessment.',
          );
        }
        const nextRevision = currentRevision + 1;
        if (nextRevision > 2_147_483_647) {
          throw new ConflictException(
            'Progress revision limit reached. Contact support.',
          );
        }

        // Unit progress - NOT PERSISTED ANYMORE.
        // We will return a mock or derived value if needed, but the plan is to remove the table.

        // Topic/Material progress - THE SSOT
        // Only create if we have at least topic or material, and validate they exist
        if (topicId || materialId) {
          const now = new Date();
          const currentTimestamp = BigInt(occurredAt.getTime());

          // Validate that referenced entities exist
          const validationPromises = [];
          if (topicId) {
            validationPromises.push(
              tx.topic
                .findUnique({ where: { id: topicId } })
                .then((t) => ({ topic: t })),
            );
          }
          if (materialId) {
            validationPromises.push(
              tx.material
                .findUnique({ where: { id: materialId } })
                .then((m) => ({ material: m })),
            );
          }
          if (unitId) {
            validationPromises.push(
              tx.unit
                .findUnique({ where: { id: unitId } })
                .then((u) => ({ unit: u })),
            );
          }
          if (courseId) {
            validationPromises.push(
              tx.course
                .findUnique({ where: { id: courseId } })
                .then((c) => ({ course: c })),
            );
          }

          const validationResults = await Promise.all(validationPromises);

          // Check if all required entities exist
          const hasErrors = validationResults.some((result) => {
            const key = Object.keys(result)[0];
            const entity = result[key as keyof typeof result];
            return entity === null;
          });

          if (hasErrors) {
            throw new NotFoundException(
              'Progress references a missing course, unit, topic, or material.',
            );
          }

          // Use findFirst + update/create instead of upsert because upsert doesn't
          // support null values in composite unique constraint lookups
          // NOTE: `timeSpent` is intentionally NOT included in this shared object.
          // Prisma's `{ increment: N }` write operator is only valid inside
          // update()/upsert().update — passing it to create() throws a
          // PrismaClientValidationError ("Expected Int, provided Object"),
          // since create() has no existing row to increment from.
          const preserveCompletion =
            topicId && !materialId
              ? topicMasteryUnlocked
              : Boolean(existingProgress?.isCompleted) &&
                status !== ProgressStatus.notStarted;
          const isCompleted = topicId && !materialId
            ? topicMasteryUnlocked
            : status === ProgressStatus.completed || preserveCompletion;
          const effectiveStatus = isCompleted
            ? ProgressStatus.completed
            : (status ?? ProgressStatus.inProgress);
          const effectiveProgressPercentage = isCompleted
            ? 100
            : status === ProgressStatus.notStarted
              ? 0
              : Math.max(
                  existingProgress?.progressPercentage ?? 0,
                  progressValue,
                );
          const baseData = {
            progressPercentage: effectiveProgressPercentage,
            completionPercentage: effectiveProgressPercentage,
            isCompleted,
            lastAccessedAt: now,
            lastUpdated: currentTimestamp,
            status: effectiveStatus,
            completedAt: isCompleted
              ? (existingProgress?.completedAt ?? now)
              : null,
            revision: nextRevision,
          };

          if (existingProgress) {
            await tx.progress.update({
              where: { id: existingProgress.id },
              data: {
                ...baseData,
                timeSpent: { increment: timeSpentDelta },
              },
            });
          } else {
            await tx.progress.create({
              data: {
                ...canonicalProgressWhere,
                ...baseData,
                timeSpent: timeSpentDelta,
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
              progressRevision: nextRevision,
              completedUnits: courseProgress.completedUnits,
              status: getProgressStatus(courseProgress.percentage),
              timeSpent: 0,
              lastAccessedAt: new Date(),
            };
            const progressData = {
              progressPercentage: updatedCourseProgress.progressPercentage,
              timeSpentMinutes: timeSpentDelta,
              status: updatedCourseProgress.status,
              completed:
                updatedCourseProgress.status === ProgressStatus.completed,
              timestamp: occurredAt.toISOString(),
              sourceId: idempotencyKey,
            };
            await writeApplicationOutboxEvent(tx, {
              eventType: progressData.completed
                ? 'course.completed'
                : 'course.progress.updated',
              aggregateId: `${userId}:${courseId}`,
              dedupeKey: `course-progress:sync:${userId}:${courseId}:${idempotencyKey}`,
              payload: progressData.completed
                ? { userId, courseId, completionData: progressData }
                : { userId, courseId, progressData },
            });
          }
        }

      });

      if (duplicateRequest) return updatedCourseProgress;

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
      if (error?.code === 'P2034') {
        throw new ConflictException(
          'Progress changed concurrently. Refresh before retrying.',
        );
      }
      handleServiceError(error, this.logger, 'updateProgress');
      return null;
    }
  }

  async markMaterialAsRead(
    userId: string,
    materialId: string,
    clientTimestamp?: bigint,
    idempotencyKey?: string,
    expectedRevision?: number,
  ): Promise<Progress | undefined> {
    try {
      if (
        typeof idempotencyKey !== 'string' ||
        idempotencyKey.trim().length === 0 ||
        idempotencyKey.length > 200
      ) {
        throw new BadRequestException(
          'An idempotency key of at most 200 characters is required for material progress updates.',
        );
      }
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
      const topicId = material.topicId ?? undefined;
      await this.authorizeMaterialProgress(userId, materialId, {
        courseId,
        unitId: material.unitId ?? undefined,
        topicId: topicId ?? undefined,
      });
      if (clientTimestamp === undefined) {
        throw new BadRequestException(
          'A client timestamp is required for material progress updates.',
        );
      }
      const occurredAt = this.getOccurrenceTime(clientTimestamp);
      const sourceFingerprint = JSON.stringify({
        materialId,
        occurredAt: occurredAt.toISOString(),
        expectedRevision: expectedRevision ?? null,
      });

      let materialProgress: Progress | undefined;
      let duplicateRequest = false;
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const activityData = {
          userId,
          sourceKey: `material-read:${userId}:${idempotencyKey}`,
          type: UserActivityType.LEARNING,
          description: `Marked material as read: ${materialId}`,
          details: {
            sourceType: 'material_read',
            sourceId: idempotencyKey,
            sourceFingerprint,
            occurredAt: occurredAt.toISOString(),
            materialId,
            unitId: material.unitId,
            topicId: material.topicId,
            courseId,
          },
          createdAt: occurredAt,
        };
        const activity = await tx.userActivity.createMany({
          data: [activityData],
          skipDuplicates: true,
        });
        if (activity.count === 0) {
          const previousActivity = await tx.userActivity.findUnique({
            where: { sourceKey: activityData.sourceKey },
            select: { details: true },
          });
          const previousDetails = previousActivity?.details;
          if (
            !previousDetails ||
            typeof previousDetails !== 'object' ||
            !('sourceFingerprint' in previousDetails) ||
            previousDetails.sourceFingerprint !== sourceFingerprint
          ) {
            throw new ConflictException(
              'The idempotency key was already used for a different material update.',
            );
          }
          duplicateRequest = true;
          materialProgress =
            (await tx.progress.findFirst({
              where: {
                userId,
                materialId,
                topicId: topicId ?? null,
                unitId: material.unitId,
                courseId: courseId ?? null,
              },
            })) ?? undefined;
          return;
        }

        const whereData = {
          userId,
          materialId,
          topicId: topicId ?? null,
          unitId: material.unitId,
          courseId: courseId ?? null,
        };
        const existingProgress = await tx.progress.findFirst({
          where: whereData,
        });

        if (
          expectedRevision !== undefined &&
          expectedRevision !== (existingProgress?.revision ?? 0)
        ) {
          throw new ConflictException({
            message:
              'Progress changed on another device. Refresh before retrying.',
            expectedRevision,
            currentRevision: existingProgress?.revision ?? 0,
          });
        }

        const nextRevision = (existingProgress?.revision ?? 0) + 1;
        if (nextRevision > 2_147_483_647) {
          throw new ConflictException(
            'Progress revision limit reached. Contact support.',
          );
        }
        const now = new Date();

        const progressData = {
          isCompleted: true,
          completedAt: now,
          status: ProgressStatus.completed,
          progressPercentage: 100,
          completionPercentage: 100,
          lastAccessedAt: now,
          lastUpdated: BigInt(occurredAt.getTime()),
          revision: nextRevision,
        };

        materialProgress = existingProgress
          ? await tx.progress.update({
              where: { id: existingProgress.id },
              data: progressData,
            })
          : await tx.progress.create({
              data: {
                ...whereData,
                ...progressData,
              },
            });

        const courseProgress = await this.calculateCourseProgress(
          userId,
          courseId,
          tx,
        );
        if (courseProgress) {
          const progressData = {
            progressPercentage: Math.round(courseProgress.percentage),
            timeSpentMinutes: 0,
            status: getProgressStatus(courseProgress.percentage),
            completed:
              getProgressStatus(courseProgress.percentage) ===
              ProgressStatus.completed,
            timestamp: occurredAt.toISOString(),
            sourceId: idempotencyKey,
          };
          await writeApplicationOutboxEvent(tx, {
            eventType: progressData.completed
              ? 'course.completed'
              : 'course.progress.updated',
            aggregateId: `${userId}:${courseId}`,
            dedupeKey: `course-progress:material-read:${userId}:${courseId}:${idempotencyKey}`,
            payload: progressData.completed
              ? { userId, courseId, completionData: progressData }
              : { userId, courseId, progressData },
          });
        }

      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if (duplicateRequest) return materialProgress;
      this.events.emit('progress.updated', {
        userId,
        materialId,
        unitId: material.unitId,
        topicId: material.topicId,
        courseId,
        status: ProgressStatus.completed,
        progressPercentage: 100,
        occurredAt,
      });
      await this.clearCache(userId, courseId);
      this.logger.log('Material marked as read successfully', {
        userId,
        materialId,
      });

      return materialProgress;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Progress changed concurrently. Refresh before retrying.',
        );
      }
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
          orderBy: { updatedAt: 'desc' },
          include: { topic: true },
        }),
        this.prisma.unit.findMany({
          where: { courseId },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            topics: {
              where: { status: 'published' },
              select: { id: true },
            },
          },
        }),
        this.prisma.material.findMany({
          where: { unit: { courseId } },
          select: { id: true, unitId: true },
        }),
      ]);

      const masteryByTopicId = new Map<string, boolean>();
      for (const progress of allProgress) {
        if (!progress.topicId || progress.materialId !== null) continue;
        const quizScores =
          progress.quizScores &&
          typeof progress.quizScores === 'object' &&
          !Array.isArray(progress.quizScores)
            ? (progress.quizScores as Record<string, unknown>)
            : {};
        masteryByTopicId.set(
          progress.topicId,
          quizScores.masteryUnlocked === true,
        );
      }

      // Calculate unit progress efficiently using the fetched data
      const unitProgress = units.map((unit) => {
        if (unit.topics.length > 0) {
          const completedTopics = unit.topics.filter((topic) =>
            masteryByTopicId.get(topic.id),
          ).length;
          const percentage = Math.round(
            (completedTopics / unit.topics.length) * 100,
          );
          return {
            id: unit.id,
            userId,
            unitId: unit.id,
            status: getProgressStatus(percentage),
            progressPercentage: percentage,
            timeSpent: 0,
            lastAccessedAt: new Date(),
            unit: {
              id: unit.id,
              title: unit.title ?? '',
              order: unit.order,
            },
          };
        }

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
          status: getProgressStatus(percentage),
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

      const topicProgressById = new Map<string, (typeof allProgress)[number]>();
      for (const progress of allProgress) {
        if (
          progress.topicId &&
          progress.materialId === null &&
          !topicProgressById.has(progress.topicId)
        ) {
          topicProgressById.set(progress.topicId, progress);
        }
      }
      const topicProgress = Array.from(topicProgressById.values()).map(
        (progress) => {
          const quizScores =
            (progress.quizScores as Record<string, unknown> | null) ?? {};
          const masteryUnlocked = quizScores.masteryUnlocked === true;
          return {
            ...progress,
            masteryUnlocked,
            isCompleted: masteryUnlocked,
            status: masteryUnlocked
              ? ProgressStatus.completed
              : progress.status === ProgressStatus.completed
                ? ProgressStatus.inProgress
                : progress.status,
            progressPercentage: masteryUnlocked ? 100 : 0,
            nextTopicUnlocked: quizScores.nextTopicUnlocked === true,
            failedAttempts: Number(quizScores.failedAttempts ?? 0),
            readinessSignal: getReadinessSignal(
              Number(quizScores.bestScore ?? quizScores.lastScore ?? 0),
            ),
          };
        },
      );
      const materialProgressById = new Map<
        string,
        UserProgressDetails['materialProgress'][number]
      >();
      for (const progress of allProgress) {
        if (!progress.materialId) continue;
        const existing = materialProgressById.get(progress.materialId);
        materialProgressById.set(progress.materialId, {
          materialId: progress.materialId,
          topicId: progress.topicId ?? existing?.topicId ?? null,
          isCompleted:
            Boolean(existing?.isCompleted) ||
            progress.isCompleted ||
            progress.status === ProgressStatus.completed,
          progressPercentage: Math.max(
            existing?.progressPercentage ?? 0,
            Math.min(100, Math.max(0, progress.progressPercentage)),
          ),
          revision: progress.topicId
            ? progress.revision
            : (existing?.revision ?? progress.revision),
        });
      }

      const result: UserProgressDetails = {
        id: 'derived',
        userId,
        courseId,
        status: getProgressStatus(analytics?.percentage ?? 0),
        progressPercentage: Math.round(analytics?.percentage ?? 0),
        completedUnits: analytics?.completedUnits ?? 0,
        timeSpent: 0,
        lastAccessedAt: new Date(),
        unitProgress,
        topicProgress,
        materialProgress: Array.from(materialProgressById.values()),
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

  async getUserOverallProgress(userId: string): Promise<OverallProgress> {
    const cacheKey = cacheKeys.progressOverall(userId);
    const cached = await this.redisService.get<OverallProgress>(cacheKey);
    if (cached) {
      this.logger.log('Overall progress fetched from cache', { userId });
      return cached;
    }

    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: {
          userId,
          status: { in: [EnrollmentStatus.active, EnrollmentStatus.completed] },
        },
        include: {
          course: { select: { id: true, title: true } },
        },
      });

      const progressEnrollments = await Promise.all(
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
      );
      const baseStats = await this.calculateUserStats(userId);
      const completedCourses = progressEnrollments.filter(
        enrollment => enrollment.isCompleted,
      ).length;
      const averageCourseProgress = progressEnrollments.length
        ? Math.round(
            progressEnrollments.reduce(
              (total, enrollment) => total + enrollment.progressPercentage,
              0,
            ) / progressEnrollments.length,
          )
        : 0;
      const stats = baseStats
        ? {
            ...baseStats,
            totalCourses: progressEnrollments.length,
            completedCourses,
            inProgressCourses: progressEnrollments.length - completedCourses,
            averageCourseProgress,
          }
        : undefined;

      const result: OverallProgress = {
        enrollments: progressEnrollments,
        stats,
      };

      await this.redisService.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log('Overall progress fetched from database', { userId });
      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'getUserOverallProgress');
      throw error;
    }
  }

  async getCourseProgress(userId: string): Promise<CourseProgress[]> {
    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: {
          userId,
          status: { in: [EnrollmentStatus.active, EnrollmentStatus.completed] },
        },
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
            status: getProgressStatus(analytics?.percentage ?? 0),
            progressPercentage: Math.round(analytics?.percentage ?? 0),
            completedUnits: analytics?.completedUnits ?? 0,
            timeSpent: 0,
            lastAccessedAt: e.enrolledAt,
            totalUnits: analytics?.totalUnits ?? 0,
          };
        }),
      );

      const result: CourseProgress[] = [];
      for (const item of progressItems) {
        if (item) {
          result.push(item);
        }
      }

      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'getCourseProgress');
      throw error;
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
            status:
              progress.status === ProgressStatus.notStarted
                ? ProgressStatus.inProgress
                : progress.status,
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
      const [enrollments, unitProgressRows] = await Promise.all([
        this.prisma.courseEnrollment.findMany({
          where: {
            userId,
            status: {
              in: [EnrollmentStatus.active, EnrollmentStatus.completed],
            },
          },
          select: { courseId: true },
        }),
        this.prisma.progress.findMany({
          where: {
            userId,
            unitId: { not: null },
            topicId: null,
            materialId: null,
            status: {
              in: [
                ProgressStatus.inProgress,
                ProgressStatus.completed,
                ProgressStatus.dropped,
              ],
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { lastAccessedAt: 'desc' }],
          select: {
            unitId: true,
            status: true,
            progressPercentage: true,
            lastAccessedAt: true,
          },
        }),
      ]);

      const courseIds = enrollments.map((enrollment) => enrollment.courseId);
      const activeUnitIds = unitProgressRows
        .map((progress) => progress.unitId)
        .filter((id): id is string => Boolean(id));
      const units = await this.prisma.unit.findMany({
        where: {
          OR: [
            ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
            ...(activeUnitIds.length ? [{ id: { in: activeUnitIds } }] : []),
          ],
        },
        include: {
          course: { select: { id: true, title: true, name: true } },
          topics: {
            orderBy: { order: 'asc' },
            select: { id: true, name: true, order: true },
          },
        },
      });

      const unitProgressById = new Map<
        string,
        (typeof unitProgressRows)[number]
      >();
      for (const progress of unitProgressRows) {
        if (progress.unitId && !unitProgressById.has(progress.unitId)) {
          unitProgressById.set(progress.unitId, progress);
        }
      }

      const topics = units.flatMap((unit) => unit.topics);
      const topicProgress =
        topics.length > 0
          ? await this.prisma.progress.findMany({
              where: {
                userId,
                topicId: { in: topics.map((topic) => topic.id) },
                materialId: null,
              },
              orderBy: { updatedAt: 'desc' },
              select: {
                topicId: true,
                status: true,
                isCompleted: true,
                quizScores: true,
                updatedAt: true,
              },
            })
          : [];

      const progressByTopicId = new Map<
        string,
        (typeof topicProgress)[number]
      >();
      for (const progress of topicProgress) {
        if (progress.topicId && !progressByTopicId.has(progress.topicId)) {
          const quizScores =
            progress.quizScores &&
            typeof progress.quizScores === 'object' &&
            !Array.isArray(progress.quizScores)
              ? (progress.quizScores as Record<string, unknown>)
              : {};
          const masteryUnlocked = quizScores.masteryUnlocked === true;
          progressByTopicId.set(progress.topicId, {
            ...progress,
            isCompleted: masteryUnlocked,
            status: masteryUnlocked
              ? ProgressStatus.completed
              : progress.status === ProgressStatus.completed
                ? ProgressStatus.inProgress
                : progress.status,
          });
        }
      }

      return units
        .map((unit) => {
          const unitProgress = unitProgressById.get(unit.id);
          if (unitProgress?.status === ProgressStatus.dropped) return null;

          const completedTopics = unit.topics.filter((topic) => {
            const topicRecord = progressByTopicId.get(topic.id);
            return (
              topicRecord?.isCompleted ||
              topicRecord?.status === ProgressStatus.completed
            );
          }).length;
          const totalTopics = unit.topics.length;
          const hasTopicProgress = unit.topics.some((topic) => {
            const topicRecord = progressByTopicId.get(topic.id);
            return (
              topicRecord?.isCompleted ||
              topicRecord?.status === ProgressStatus.inProgress ||
              topicRecord?.status === ProgressStatus.completed
            );
          });
          const isCompleted = totalTopics > 0
            ? completedTopics === totalTopics
            : unitProgress?.status === ProgressStatus.completed;
          if (!unitProgress && !hasTopicProgress) return null;

          const nextTopic = unit.topics.find((topic) => {
            const topicRecord = progressByTopicId.get(topic.id);
            return (
              !topicRecord?.isCompleted &&
              topicRecord?.status !== ProgressStatus.completed
            );
          });

          return {
            courseId: unit.courseId,
            courseTitle:
              unit.course.title || unit.course.name || 'Untitled Course',
            unitId: unit.id,
            unitTitle: unit.title || unit.name,
            unitDescription: unit.description,
            progressPercentage: isCompleted
              ? 100
              : totalTopics > 0
                ? Math.round((completedTopics / totalTopics) * 100)
                : (unitProgress?.progressPercentage ?? 0),
            status: isCompleted
              ? ProgressStatus.completed
              : ProgressStatus.inProgress,
            isCompleted,
            nextTopicId: nextTopic?.id,
            nextTopicName: nextTopic?.name,
            completedTopics,
            totalTopics,
            lastAccessedAt: unitProgress?.lastAccessedAt ?? null,
          };
        })
        .filter((unit): unit is NonNullable<typeof unit> => unit !== null);
    } catch (error) {
      handleServiceError(error, this.logger, 'getEnrolledUnitsDashboard');
      throw error;
    }
  }

  async getUserActivities(userId: string): Promise<UserActivity[]> {
    return this.prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Limit to recent activities
    });
  }

  async getStudyTimeSummary(userId: string): Promise<{
    totalMinutes: number;
    weeklyStudyTime: Array<{ date: string; minutes: number }>;
  }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    const [totalSummary, sessions] = await Promise.all([
      this.prisma.studySession.aggregate({
        where: {
          userId,
          isValid: true,
          endTime: { not: null },
        },
        _sum: { duration: true },
      }),
      this.prisma.studySession.findMany({
        where: {
          userId,
          isValid: true,
          endTime: { gte: startDate, lt: endDate, not: null },
        },
        select: { duration: true, endTime: true },
      }),
    ]);

    const minutesByDate = new Map<string, number>();
    for (const session of sessions) {
      if (!session.endTime) continue;
      const date = session.endTime.toISOString().slice(0, 10);
      minutesByDate.set(
        date,
        (minutesByDate.get(date) ?? 0) + Math.max(0, session.duration ?? 0),
      );
    }

    const weeklyStudyTime = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, minutes: minutesByDate.get(key) ?? 0 };
    });

    return {
      totalMinutes: totalSummary._sum.duration ?? 0,
      weeklyStudyTime,
    };
  }

  async getUserAchievements(userId: string): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
      dateEarned: string;
    }>
  > {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: {
          select: { name: true, description: true, imageUrl: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
    });

    return userBadges.map((userBadge) => ({
      id: userBadge.badgeId,
      title: userBadge.badge.name,
      description: userBadge.badge.description ?? '',
      icon: userBadge.badge.imageUrl ?? 'trophy',
      dateEarned: userBadge.awardedAt.toISOString(),
    }));
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

  private async calculateCourseProgressFromDatabase(
    userId: string,
    courseId: string,
    client: Pick<
      Prisma.TransactionClient,
      'unit' | 'progress' | 'material'
    > = this.prisma,
  ): Promise<
    | { percentage: number; completedUnits: number; totalUnits: number }
    | undefined
  > {
    try {
      const [units, topicProgressRows, unitProgressRows, materials] =
        await Promise.all([
          client.unit.findMany({
            where: { courseId },
            select: {
              id: true,
              topics: {
                where: { status: 'published' },
                select: { id: true },
              },
            },
          }),
          client.progress.findMany({
            where: {
              userId,
              courseId,
              topicId: { not: null },
              materialId: null,
            },
            select: {
              topicId: true,
              quizScores: true,
            },
          }),
          client.progress.findMany({
            where: {
              userId,
              courseId,
              unitId: { not: null },
              topicId: null,
              materialId: null,
            },
            select: {
              unitId: true,
              progressPercentage: true,
              isCompleted: true,
              status: true,
            },
          }),
          client.material.findMany({
            where: { unit: { courseId } },
            select: { id: true, unitId: true },
          }),
        ]);
      const materialIds = materials.map((material) => material.id);
      const materialProgressRows = materialIds.length
        ? await client.progress.findMany({
            where: { userId, materialId: { in: materialIds } },
            select: {
              materialId: true,
              progressPercentage: true,
              isCompleted: true,
              status: true,
            },
          })
        : [];

      const topicProgressById = new Map<string, number>();
      for (const progress of topicProgressRows) {
        if (!progress.topicId) continue;
        const quizScores =
          progress.quizScores &&
          typeof progress.quizScores === 'object' &&
          !Array.isArray(progress.quizScores)
            ? (progress.quizScores as Record<string, unknown>)
            : {};
        const percentage = quizScores.masteryUnlocked === true ? 100 : 0;
        topicProgressById.set(
          progress.topicId,
          Math.max(topicProgressById.get(progress.topicId) ?? 0, percentage),
        );
      }

      const unitProgressById = new Map<
        string,
        { percentage: number; completed: boolean }
      >();
      for (const progress of unitProgressRows) {
        if (!progress.unitId) continue;
        const previous = unitProgressById.get(progress.unitId);
        unitProgressById.set(progress.unitId, {
          percentage: Math.max(
            previous?.percentage ?? 0,
            Math.min(100, Math.max(0, progress.progressPercentage)),
          ),
          completed:
            previous?.completed === true ||
            progress.isCompleted ||
            progress.status === ProgressStatus.completed,
        });
      }

      const completedMaterialIds = new Set(
        materialProgressRows
          .filter(
            (progress) =>
              progress.isCompleted ||
              progress.status === ProgressStatus.completed ||
              progress.progressPercentage >= 100,
          )
          .map((progress) => progress.materialId)
          .filter((materialId): materialId is string => Boolean(materialId)),
      );

      let totalUnitPercentage = 0;
      let completedUnits = 0;
      for (const unit of units) {
        const unitProgress = unitProgressById.get(unit.id);
        const topicPercentages = unit.topics.map(
          (topic) => topicProgressById.get(topic.id) ?? 0,
        );
        const topicPercentage = topicPercentages.length
          ? topicPercentages.reduce((sum, percentage) => sum + percentage, 0) /
            topicPercentages.length
          : 0;
        const unitMaterials = materials.filter(
          (material) => material.unitId === unit.id,
        );
        const completedMaterials = unitMaterials.filter((material) =>
          completedMaterialIds.has(material.id),
        ).length;
        const materialPercentage = unitMaterials.length
          ? (completedMaterials / unitMaterials.length) * 100
          : 0;
        const isCompleted = topicPercentages.length
          ? topicPercentages.every((value) => value === 100)
          : unitMaterials.length
            ? completedMaterials === unitMaterials.length
            : Boolean(unitProgress?.completed);
        const unitPercentage = topicPercentages.length
          ? topicPercentage
          : unitMaterials.length
            ? materialPercentage
            : isCompleted
              ? 100
              : (unitProgress?.percentage ?? 0);

        totalUnitPercentage += unitPercentage;
        if (isCompleted) completedUnits += 1;
      }

      const totalUnits = units.length;
      const percentage = totalUnits
        ? Math.round(totalUnitPercentage / totalUnits)
        : 0;

      return {
        percentage,
        completedUnits,
        totalUnits,
      };
    } catch (error) {
      if (client !== this.prisma) {
        throw error;
      }
      this.logger.warn(
        'Failed to derive course progress from database',
        { userId, courseId, error: getErrorMessage(error) },
      );
      return undefined;
    }
  }

  async calculateCourseProgress(
    userId: string,
    courseId: string,
    client?: Prisma.TransactionClient,
  ): Promise<
    | { percentage: number; completedUnits: number; totalUnits: number }
    | undefined
  > {
    if (client) {
      return this.calculateCourseProgressFromDatabase(
        userId,
        courseId,
        client,
      );
    }

    const databaseProgress = await this.calculateCourseProgressFromDatabase(
      userId,
      courseId,
    );
    if (databaseProgress) return databaseProgress;

    try {
      // Analytics is a fallback only; saved assessment/material progress is the
      // source of truth for user-facing course completion.
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

      return undefined;
    } catch (error) {
      this.logger.warn(
        'Course progress analytics fallback failed',
        { userId, courseId, error: getErrorMessage(error) },
      );
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
        studyTimeSummary,
        recentActivities,
        detailedAnalytics,
      ] = await Promise.all([
        this.prisma.courseEnrollment.count({
          where: {
            userId,
            status: { in: [EnrollmentStatus.active, EnrollmentStatus.completed] },
          },
        }),
        this.prisma.courseEnrollment.count({
          where: { userId, status: EnrollmentStatus.completed },
        }),
        this.getStudyTimeSummary(userId),
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
        totalStudyTime: studyTimeSummary.totalMinutes,
        weeklyStudyTime: studyTimeSummary.weeklyStudyTime,
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
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          healthcareField: true,
          studyYear: true,
          preferences: true,
        },
      });

      // Get user's average score from enrollments
      const userProgress = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        select: { progressPercentage: true, courseId: true },
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

      const userCourseIds = userProgress.map((p) => p.courseId);

      const prefs =
        user?.preferences &&
        typeof user.preferences === 'object' &&
        !Array.isArray(user.preferences)
          ? (user.preferences as Record<string, any>)
          : null;
      const institution =
        typeof prefs?.institution === 'string' && prefs.institution.trim()
          ? prefs.institution.trim()
          : null;
      const field = user?.healthcareField?.trim() || null;
      const year = user?.studyYear || null;

      let cohortEnrollments: Array<{
        progressPercentage: number | null;
        userId: string;
      }> = [];
      let cohortLabel = 'Platform-Wide Medical Learners';
      let cohortTier = 'GLOBAL';

      // Tier 1 & 2: Discipline + Study Year (+ optional Institution)
      if (field && year) {
        const disciplineYearEnrollments =
          await this.prisma.courseEnrollment.findMany({
            where: {
              user: {
                healthcareField: { equals: field, mode: 'insensitive' },
                studyYear: year,
              },
            },
            select: {
              progressPercentage: true,
              userId: true,
              user: { select: { preferences: true } },
            },
          });

        const distinctUsers = new Set(
          disciplineYearEnrollments.map((e) => e.userId),
        );

        if (institution && distinctUsers.size >= 2) {
          const instEnrollments = disciplineYearEnrollments.filter((e) => {
            const uPrefs = e.user?.preferences as Record<string, any> | null;
            return (
              uPrefs?.institution &&
              typeof uPrefs.institution === 'string' &&
              uPrefs.institution
                .toLowerCase()
                .includes(institution.toLowerCase())
            );
          });
          const instUsers = new Set(instEnrollments.map((e) => e.userId));
          if (instUsers.size >= 2) {
            cohortEnrollments = instEnrollments;
            cohortLabel = `${institution} - ${field.charAt(0).toUpperCase() + field.slice(1)} Year ${year}`;
            cohortTier = 'INSTITUTION';
          }
        }

        if (cohortEnrollments.length === 0 && distinctUsers.size >= 2) {
          cohortEnrollments = disciplineYearEnrollments;
          cohortLabel = `${field.charAt(0).toUpperCase() + field.slice(1)} Year ${year} Cohort`;
          cohortTier = 'DISCIPLINE_YEAR';
        }
      }

      // Tier 3: Discipline wide
      if (cohortEnrollments.length === 0 && field) {
        const disciplineEnrollments =
          await this.prisma.courseEnrollment.findMany({
            where: {
              user: {
                healthcareField: { equals: field, mode: 'insensitive' },
              },
            },
            select: { progressPercentage: true, userId: true },
          });
        const distinctUsers = new Set(
          disciplineEnrollments.map((e) => e.userId),
        );
        if (distinctUsers.size >= 2) {
          cohortEnrollments = disciplineEnrollments;
          cohortLabel = `${field.charAt(0).toUpperCase() + field.slice(1)} Students`;
          cohortTier = 'DISCIPLINE';
        }
      }

      // Tier 4: Enrolled Course Peers
      if (cohortEnrollments.length === 0 && userCourseIds.length > 0) {
        const coursePeerEnrollments =
          await this.prisma.courseEnrollment.findMany({
            where: {
              courseId: { in: userCourseIds },
            },
            select: { progressPercentage: true, userId: true },
          });
        const distinctUsers = new Set(
          coursePeerEnrollments.map((e) => e.userId),
        );
        if (distinctUsers.size >= 2) {
          cohortEnrollments = coursePeerEnrollments;
          cohortLabel = 'Classmates in Your Enrolled Courses';
          cohortTier = 'COURSE';
        }
      }

      // Tier 5: Global Platform Fallback
      if (cohortEnrollments.length === 0) {
        cohortEnrollments = await this.prisma.courseEnrollment.findMany({
          select: { progressPercentage: true, userId: true },
        });
        cohortLabel = 'Platform-Wide Medical Learners';
        cohortTier = 'GLOBAL';
      }

      const cohortUserIds = new Set(cohortEnrollments.map((e) => e.userId));
      const totalStudents = Math.max(
        cohortUserIds.size,
        userProgress.length > 0 ? 1 : 0,
      );

      const cohortAverage =
        cohortEnrollments.length > 0
          ? Math.round(
              cohortEnrollments.reduce(
                (sum, e) => sum + (e.progressPercentage || 0),
                0,
              ) / cohortEnrollments.length,
            )
          : 0;

      // Aggregate per-user average for cohort ranking
      const userAveragesMap = new Map<string, { sum: number; count: number }>();
      for (const e of cohortEnrollments) {
        const cur = userAveragesMap.get(e.userId) || { sum: 0, count: 0 };
        cur.sum += e.progressPercentage || 0;
        cur.count += 1;
        userAveragesMap.set(e.userId, cur);
      }

      if (userProgress.length > 0 && !userAveragesMap.has(userId)) {
        userAveragesMap.set(userId, { sum: userAverage, count: 1 });
      }

      const allUserAverages = Array.from(userAveragesMap.values()).map((v) =>
        Math.round(v.sum / v.count),
      );

      const topPerformer =
        allUserAverages.length > 0 ? Math.max(...allUserAverages) : 0;

      const usersAhead = allUserAverages.filter(
        (avg) => avg > userAverage,
      ).length;
      const userRank = userProgress.length > 0 ? usersAhead + 1 : 0;
      const percentile =
        allUserAverages.length > 0 && userProgress.length > 0
          ? Math.max(
              1,
              Math.min(
                100,
                Math.round(
                  ((allUserAverages.length - usersAhead) /
                    allUserAverages.length) *
                    100,
                ),
              ),
            )
          : 0;

      return {
        yourAverage: userAverage,
        cohortAverage,
        topPerformer,
        rank: userRank,
        totalStudents,
        percentile,
        cohortLabel,
        cohortTier,
      };
    } catch (error) {
      this.logger.error(
        `Error getting peer comparison for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user streak information (current and longest)
   */
  async getUserStreaks(
    userId: string,
    now: Date = new Date(),
  ): Promise<{
    userId: string;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
  }> {
    try {
      const learningActivities = await this.prisma.userActivity.findMany({
        where: {
          userId,
          type: {
            in: [
              UserActivityType.LEARNING,
              UserActivityType.QUIZ_ATTEMPT,
              UserActivityType.STUDY_SESSION,
              UserActivityType.FLASHCARD_REVIEW,
              UserActivityType.FLASHCARD_SESSION,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (learningActivities.length === 0) {
        return {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
        };
      }

      const lastActivityDate = learningActivities[0].createdAt;
      const lastActivityDateLabel = lastActivityDate?.toDateString();
      this.logger.debug(
        `User ${userId} last activity label: ${lastActivityDateLabel ?? 'n/a'}`,
      );
      const { currentStreak, longestStreak } = calculateLearningStreaks(
        learningActivities.map((activity) => activity.createdAt),
        now,
      );

      return {
        userId,
        currentStreak,
        longestStreak,
        lastActivityDate,
      };
    } catch (error) {
      this.logger.error(`Error getting user streaks for ${userId}:`, error);
      throw error;
    }
  }

  async calculateUnitProgress(
    userId: string,
    unitId: string,
  ): Promise<{ progressPercentage: number; isCompleted: boolean }> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: {
          topics: {
            where: { status: 'published' },
            select: { id: true },
          },
        },
      });
      if (!unit) {
        throw new NotFoundException(`Unit with ID ${unitId} not found`);
      }

      if (unit.topics.length) {
        const topicProgress = await this.prisma.progress.findMany({
          where: {
            userId,
            topicId: { in: unit.topics.map((topic) => topic.id) },
            materialId: null,
          },
          select: { topicId: true, quizScores: true },
        });
        const masteredTopicIds = new Set(
          topicProgress.flatMap((progress) => {
            const quizScores =
              progress.quizScores &&
              typeof progress.quizScores === 'object' &&
              !Array.isArray(progress.quizScores)
                ? (progress.quizScores as Record<string, unknown>)
                : {};
            return quizScores.masteryUnlocked === true && progress.topicId
              ? [progress.topicId]
              : [];
          }),
        );
        const completedTopics = unit.topics.filter((topic) =>
          masteredTopicIds.has(topic.id),
        ).length;
        const progressPercentage = Math.round(
          (completedTopics / unit.topics.length) * 100,
        );
        return {
          progressPercentage,
          isCompleted: completedTopics === unit.topics.length,
        };
      }

      const [materialCount, completedMaterials] = await Promise.all([
        this.prisma.material.count({ where: { unitId } }),
        this.prisma.progress.count({
          where: { userId, material: { unitId }, isCompleted: true },
        }),
      ]);
      const progressPercentage = materialCount
        ? Math.round((completedMaterials / materialCount) * 100)
        : 0;
      return {
        progressPercentage,
        isCompleted: materialCount > 0 && completedMaterials === materialCount,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating unit progress for ${unitId}:`,
        error,
      );
      throw error;
    }
  }

  private async writeUnitProgress(
    userId: string,
    unitId: string,
    courseId: string,
    update: Prisma.ProgressUpdateInput,
    create: Prisma.ProgressUncheckedCreateInput,
  ): Promise<void> {
    const existing = await this.prisma.progress.findFirst({
      where: { userId, topicId: null, materialId: null, unitId, courseId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.progress.update({
        where: { id: existing.id },
        data: update,
      });
    } else {
      await this.prisma.progress.create({ data: create });
    }
  }

  async trackUnitAccess(userId: string, unitId: string): Promise<void> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { courseId: true },
      });

      if (unit?.courseId) {
        const lastAccessedAt = new Date();
        await this.writeUnitProgress(
          userId,
          unitId,
          unit.courseId,
          { lastAccessedAt },
          {
            userId,
            topicId: null,
            materialId: null,
            unitId,
            courseId: unit.courseId,
            status: ProgressStatus.inProgress,
            progressPercentage: 0,
          },
        );
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
        const completedAt = new Date();
        await this.writeUnitProgress(
          userId,
          unitId,
          unit.courseId,
          {
            status: ProgressStatus.completed,
            progressPercentage: 100,
            isCompleted: true,
            completedAt,
          },
          {
            userId,
            topicId: null,
            materialId: null,
            unitId,
            courseId: unit.courseId,
            status: ProgressStatus.completed,
            progressPercentage: 100,
            isCompleted: true,
          },
        );
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
