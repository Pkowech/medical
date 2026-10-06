import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  Topic,
  StudySession,
  User,
  Progress,
  UserActivityType,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';
import { ProgressService } from '../services/progress.service';
import { StudyAnalyticsService } from '#modules/ai-analytics/services/study-analytics.service';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import {
  LearningRecommendation,
  StudyActivity,
  QuizScore,
  StudyStats,
  ProgressUpdateDto,
} from '#common/dto';

@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly studyAnalyticsService: StudyAnalyticsService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
  ) {}

  async getTopicsByCategory(category: string): Promise<Topic[]> {
    if (!category) {
      throw new BadRequestException('Category is required');
    }

    return this.prisma.topic.findMany({
      where: { categoryId: category },
      include: {
        unit: {
          include: { materials: true },
        },
      },
    });
  }

  async getTopicProgress(
    userId: string,
    topicId: string,
  ): Promise<Progress | null> {
    return this.prisma.progress.findFirst({
      where: {
        userId,
        topicId,
      },
      include: { topic: true },
    });
  }

  async startStudySession(
    userId: string,
    context?: { type: 'course' | 'unit' | 'topic' | 'material'; id: string },
    topicId?: string, // Legacy support
  ): Promise<StudySession> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    let resolvedTopicId = topicId;
    let resolvedMaterialId: string | undefined;
    const metadata: any = {};

    if (context) {
      metadata.context = context;
      if (context.type === 'topic') {
        resolvedTopicId = context.id;
      } else if (context.type === 'material') {
        const material = await this.prisma.material.findUnique({
          where: { id: context.id },
          select: { topicId: true },
        });
        if (!material) throw new NotFoundException('Material not found');
        resolvedMaterialId = context.id;
        resolvedTopicId = material.topicId ?? resolvedTopicId;
      } else if (context.type === 'unit') {
        const unit = await this.prisma.unit.findUnique({
          where: { id: context.id },
          select: { id: true },
        });
        if (!unit) throw new NotFoundException('Unit not found');
        resolvedTopicId = await this.getNextTopicForUnit(userId, context.id);
      } else if (context.type === 'course') {
        const course = await this.prisma.course.findUnique({
          where: { id: context.id },
          select: { id: true },
        });
        if (!course) throw new NotFoundException('Course not found');
        resolvedTopicId = await this.getNextTopicForCourse(userId, context.id);
      }
    }

    if (resolvedTopicId) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: resolvedTopicId },
        select: { id: true },
      });
      if (!topic) throw new NotFoundException('Topic not found');
    }

    return this.prisma.studySession.create({
      data: {
        userId,
        topicId: resolvedTopicId,
        materialId: resolvedMaterialId,
        startTime: new Date(),
        duration: 0,
        focusScore: 0,
        activities: [] as any,
        metadata,
      },
    });
  }

  private async getNextTopicForUnit(
    userId: string,
    unitId: string,
  ): Promise<string | undefined> {
    // 1. Get all topics for the unit, ordered
    const topics = await this.prisma.topic.findMany({
      where: { unitId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });

    this.logger.log(`Unit ${unitId} has ${topics.length} topics: ${topics.map((t) => t.id).join(', ')}`);

    if (!topics.length) {
      this.logger.warn(`No topics found for unit ${unitId}, returning undefined`);
      return undefined;
    }

    // 2. Get progress for these topics
    const topicIds = topics.map((t) => t.id);
    const progress = await this.prisma.progress.findMany({
      where: {
        userId,
        topicId: { in: topicIds },
      },
      select: { topicId: true, status: true, quizScores: true },
    });

    // 3. Resume from the first topic whose mastery quiz has not unlocked progression.
    const completedSet = new Set(
      progress
        .filter((record) => {
          const quizScores = record.quizScores as Record<string, unknown> | null;
          return (
            record.status === 'completed' ||
            quizScores?.nextTopicUnlocked === true
          );
        })
        .map((record) => record.topicId),
    );
    const nextTopic = topics.find((t) => !completedSet.has(t.id));
    const result = nextTopic?.id || topics[0]?.id;

    this.logger.log(`getNextTopicForUnit returning: ${result}`);
    return result;
  }

  async recordFocusEvent(
    userId: string,
    sessionId: string,
    event: { type: 'gained' | 'lost'; timestamp: Date },
  ): Promise<void> {
    const session = await this.prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      select: { activities: true },
    });

    if (!session) {
      throw new NotFoundException('Study session not found');
    }

    const activities = (session.activities as any[]) || [];
    activities.push({
      type: 'focus_change',
      status: event.type,
      timestamp: event.timestamp || new Date(),
    });

    await this.prisma.studySession.update({
      where: { id: sessionId },
      data: { activities: activities as any },
    });
  }

  private async getNextTopicForCourse(
    userId: string,
    courseId: string,
  ): Promise<string | undefined> {
    // 1. Get all units for course
    const units = await this.prisma.unit.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });

    this.logger.log(`getNextTopicForCourse: Course ${courseId} has ${units.length} units`);

    for (const unit of units) {
      const unitProgress = await this.progressService.calculateUnitProgress(
        userId,
        unit.id,
      );

      if (!unitProgress.isCompleted) {
        // This unit is not fully done, check its topics
        this.logger.log(`Unit ${unit.id} not complete, checking topics`);
        const topicId = await this.getNextTopicForUnit(userId, unit.id);
        if (topicId) {
          this.logger.log(`Found topic ${topicId} in unit ${unit.id}`);
          return topicId;
        }
      }
    }

    // If all units done, return first topic of first unit (Review mode)
    if (units.length > 0) {
      this.logger.log(`All units complete, returning first topic of first unit`);
      return this.getNextTopicForUnit(userId, units[0].id);
    }

    this.logger.warn(`No topics found for course ${courseId}`);
    return undefined;
  }

  async endStudySession(
    userId: string,
    sessionId: string,
    activities: StudyActivity[],
    notes?: string,
    durationSeconds?: number,
  ): Promise<StudySession> {
    const session = await this.prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { user: true, topic: { include: { unit: true } } },
    });

    if (!session) throw new NotFoundException('Study session not found');
    if (session.endTime) {
      return this.prisma.studySession.findUniqueOrThrow({
        where: { id: session.id },
      });
    }

    const endTime = new Date();
    const wallDurationSeconds = Math.max(
      0,
      (endTime.getTime() - session.startTime.getTime()) / 1000,
    );
    const activeDurationSeconds =
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
        ? Math.min(Math.max(0, durationSeconds), wallDurationSeconds)
        : wallDurationSeconds;
    const duration = Math.round(activeDurationSeconds / 60);

    const focusScore = wallDurationSeconds > 0
      ? Math.round((activeDurationSeconds / wallDurationSeconds) * 100)
      : this.calculateFocusScore(activities);

    // SESS-001: Session outcome tracking
    const MIN_VALID_DURATION = 5; // minutes
    const quizActivities = (activities as any[]).filter(
      (a) => a?.type === 'quiz',
    );
    const quizAttemptIds: string[] = quizActivities
      .map((a) => a?.attemptId)
      .filter(Boolean);

    const isValid = duration >= MIN_VALID_DURATION;
    const invalidReason = isValid
      ? null
      : `Session too short (${duration} min < ${MIN_VALID_DURATION} min minimum)`;

    // LearningGain: focus score improvement relative to baseline (0.5 expected)
    const learningGain = isValid
      ? Math.max(0, (focusScore - 50) / 50) // Normalized 0–1 relative to 50% baseline
      : 0;

    if (isValid) {
      if (session.topic) {
        await this.updateTopicProgress({
          ...session,
          topic: session.topic,
          activities: activities as any,
        });
      }

      if (session.topic?.unitId) {
        const progressUpdateDto: ProgressUpdateDto = {
          courseId: session.topic.unit.courseId,
          unitId: session.topic.unitId,
          timeSpent: duration,
        };
        await this.progressService.updateUnitMaterialTopicProgress(
          session.userId,
          progressUpdateDto,
        );
      } else {
        await this.prisma.userActivity.create({
          data: {
            userId: session.userId,
            type: UserActivityType.LEARNING,
            description: `Completed a ${duration}-minute study session`,
            details: {
              sessionId: session.id,
              topicId: session.topicId,
              duration,
            },
          },
        });
      }
    }

    const endedSession = await this.prisma.studySession.update({
      where: { id: sessionId },
      data: {
        endTime,
        duration,
        notes,
        activities: activities as any,
        focusScore,
        isValid,
        invalidReason,
        learningGain,
        quizAttemptIds,
      },
    });
    await this.progressService.invalidateUserProgressCache(userId);
    return endedSession;
  }

  private calculateFocusScore(activities: StudyActivity[]): number {
    if (!activities.length) {
      return 0;
    }

    const totalDuration = activities.reduce(
      (sum, act) => sum + (act.duration || 0),
      0,
    );
    const maxDuration = Math.max(...activities.map((act) => act.duration || 0));
    return totalDuration ? Math.round((maxDuration / totalDuration) * 100) : 0;
  }

  private async updateTopicProgress(
    session: StudySession & {
      user: User;
      topic: Topic;
      activities: StudyActivity[];
    },
  ): Promise<void> {
    let progress = await this.prisma.progress.findFirst({
      where: {
        userId: session.userId,
        topicId: session.topicId,
      },
    });

    if (!progress) {
      progress = await this.prisma.progress.create({
        data: {
          userId: session.userId,
          topicId: session.topicId,
          timeSpent: 0,
          completionPercentage: 0,
          streakDays: 0,
          lastStudiedAt: new Date(),
          quizScores: [],
        },
      });
    }

    const timeSpent = (progress.timeSpent || 0) + (session.duration || 0);
    const lastStudiedAt = new Date();

    const quizScores: QuizScore[] = (
      (session.activities as StudyActivity[]) || []
    )
      .filter((act) => act?.type === 'quiz')
      .map((act) => ({
        quizId: (act as any).quizId || (act as any).type,
        score: (act as any).score || 0,
        date: new Date(),
      }));

    const existingScores: QuizScore[] = Array.isArray(progress.quizScores)
      ? (progress.quizScores as unknown as QuizScore[])
      : [];
    const updatedQuizScores = [...existingScores, ...quizScores];
    const completionPercentage = Math.min(
      100,
      (progress.completionPercentage || 0) + quizScores.length * 10,
    );

    let streakDays = progress.streakDays || 0;
    const lastStudied = progress.lastStudiedAt;
    if (lastStudied && this.isConsecutiveDay(lastStudied, lastStudiedAt)) {
      streakDays += 1;
    }

    await this.prisma.progress.update({
      where: { id: progress.id },
      data: {
        timeSpent,
        lastStudiedAt,
        quizScores: updatedQuizScores as any,
        completionPercentage,
        streakDays,
      },
    });
  }

  private isConsecutiveDay(lastDate: Date, currentDate: Date): boolean {
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }

  async getStudyStats(userId: string): Promise<StudyStats> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const [totalTimeResult, totalSessions] = await Promise.all([
      this.prisma.studySession.aggregate({
        where: { userId },
        _sum: { duration: true },
      }),
      this.prisma.studySession.count({
        where: { userId },
      }),
    ]);

    return {
      totalTime: totalTimeResult._sum.duration || 0,
      coursesStudied: totalSessions,
      assessmentsCompleted: 0,
      averageScore: 0,
    };
  }

  async getUserSessions(
    userId: string,
    options?: {
      courseId?: string;
      startDate?: Date;
      endDate?: Date;
      period?: string;
    },
  ): Promise<StudySession[]> {
    const where: any = { userId };

    if (options?.startDate || options?.endDate) {
      where.startTime = {};
      if (options.startDate) {
        where.startTime.gte = options.startDate;
      }
      if (options.endDate) {
        where.startTime.lte = options.endDate;
      }
    }

    return this.prisma.studySession.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 50,
    });
  }

  async getLegacyStudyStatistics(
    userId: string,
    period: 'week' | 'month' | 'year' = 'month',
  ): Promise<any> {
    const now = new Date();
    const startDate = new Date(now);
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 6);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    startDate.setHours(0, 0, 0, 0);

    const summary = await this.prisma.studySession.aggregate({
      where: {
        userId,
        isValid: true,
        endTime: { not: null },
        startTime: { gte: startDate, lte: now },
      },
      _sum: { duration: true },
      _avg: { duration: true, focusScore: true },
      _count: { id: true },
    });
    const totalSessions = summary._count.id;
    const totalMinutes = summary._sum.duration ?? 0;
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const avgSessionLength = Math.round((summary._avg.duration ?? 0) * 10) / 10;
    const avgFocusScore = Math.round(summary._avg.focusScore ?? 0);

    return {
      totalSessions,
      totalHours,
      avgSessionLength,
      avgFocusScore: Math.round(avgFocusScore),
      period,
    };
  }

  async trackActivity(
    user: User,
    activity: { type: string; duration: number; score?: number },
  ): Promise<void> {
    await this.prisma.progress.create({
      data: {
        userId: user.id,
        topicId: activity.type, // Assumes activity.type is a valid topic ID
        completionPercentage: 0,
        timeSpent: activity.duration,
        isCompleted: false,
        streakDays: 0,
        lastStudiedAt: new Date(),
        quizScores: activity.score
          ? [
              {
                quizId: activity.type,
                score: activity.score,
                date: new Date(),
              } as any,
            ]
          : [],
      },
    });
  }

  async getRecommendations(userId: string): Promise<LearningRecommendation[]> {
    // Get learning path recommendations from analytics
    const pathRecs =
      await this.learningAnalyticsService.getPathRecommendations(userId);

    // Map to LearningRecommendation interface
    return pathRecs.map((rec) => ({
      type: 'course', // Assuming paths map to courses/paths in UI
      id: rec.pathId,
      title: 'Recommended Learning Path', // Title would ideally come from DB lookup
      action: 'Start Path',
      reason: rec.reasons[0] || 'Recommended based on your study history',
      priority: Math.round(rec.score * 100),
    }));
  }

  async getDueReviews(userId: string) {
    return this.studyAnalyticsService.getDueCards(userId);
  }

  async getFocusRecommendations(userId: string) {
    return this.studyAnalyticsService.getFocusRecommendations(userId);
  }

  async getDeadlines(userId: string) {
    const today = new Date();

    // 1. Fetch system deadlines (Exams, Assignments)
    const systemDeadlines = await this.prisma.deadline.findMany({
      where: {
        userId,
        dueDate: { gte: today },
      },
      include: {
        course: { select: { title: true } },
      },
    });

    // 2. Fetch user learning goals (Milestones)
    const goalDeadlines = await this.prisma.learningGoal.findMany({
      where: {
        userId,
        targetDate: { gte: today },
        status: { not: 'completed' },
      },
      include: {
        course: { select: { title: true } },
      },
    });

    // 2.5 Fetch schedule events (study sessions, exams)
    const scheduleEvents = await this.prisma.scheduleEvent.findMany({
      where: {
        userId,
        date: { gte: today },
        status: { notIn: ['completed', 'cancelled'] },
        completed: false,
      },
      include: {
        course: { select: { title: true } },
      },
    });

    // 3. Normalize and Merge
    const combined = [
      ...systemDeadlines.map((d) => ({
        id: d.id,
        title: d.title,
        dueDate: d.dueDate,
        type: (d.metadata as any)?.type || 'deadline', // use metadata type if available
        courseId: d.courseId,
        course: (d.course)?.title || 'General',
        priority: d.priority || 'medium',
      })),
      ...goalDeadlines.map((g) => ({
        id: g.id,
        title: g.title,
        dueDate: g.targetDate,
        type: 'goal',
        courseId: g.courseId,
        course: (g.course)?.title || 'General Learning',
        priority: g.priority ? String(g.priority) : 'medium',
      })),
      ...scheduleEvents.map((e) => ({
        id: e.id,
        title: e.title,
        dueDate: e.date,
        type: e.type || 'schedule',
        courseId: e.courseId,
        course: (e.course)?.title || 'Academic',
        priority:
          e.priority === 3 ? 'high' : e.priority === 2 ? 'medium' : 'low',
      })),
    ];

    // 4. Sort by date ascending
    return combined.sort(
      (a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime(),
    );
  }

  async getResumePoint(userId: string, courseId: string) {
    const topicId = await this.getNextTopicForCourse(userId, courseId);

    if (!topicId) {
      // Course likely complete or empty. Return generic info.
      this.logger.log(`No topic found for course ${courseId}, returning completed`);
      return { completed: true, message: 'Course completed!' };
    }

    this.logger.log(`getResumePoint: topicId=${topicId}`);

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: true },
    });

    if (!topic) {
      this.logger.error(`Topic ${topicId} not found in database`);
      return { completed: true, message: 'Course completed!' };
    }

    const result = {
      type: 'topic',
      id: topicId,
      title: topic?.name,
      unitId: topic?.unitId,
      unitTitle: topic?.unit?.name,
    };

    this.logger.log(`getResumePoint returning: ${JSON.stringify(result)}`);
    return result;
  }
}
