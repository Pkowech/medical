// src/modules/progress/services/learning-path-progress.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  LearningPathProgress,
  LearningPathMilestone,
  Prisma,
  ProgressStatus,
} from '@prisma/client';
import {
  LearningPathStartDto,
  LearningPathUpdateDto,
} from '#common/dto/learning-paths.dto';
import { PathStructure, Phase, Module } from '#common/dto/learning.dto';
import {
  PhaseProgress,
  ModuleProgress,
  MilestoneAchieved,
  LearningPathAnalytics,
} from '#common/dto/progress.dto';
@Injectable()
export class LearningPathProgressService {
  constructor(private prisma: PrismaService) {}

  async startLearningPath(
    userId: string,
    startDto: LearningPathStartDto,
  ): Promise<LearningPathProgress> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const learningPath = await this.prisma.learningPath.findUnique({
      where: { id: startDto.learningPathId },
      include: { milestones: true },
    });
    if (!learningPath) {
      throw new NotFoundException('Learning path not found');
    }

    const existing = await this.prisma.learningPathProgress.findFirst({
      where: { userId, learningPathId: startDto.learningPathId },
    });
    if (existing) {
      throw new BadRequestException(
        'User is already enrolled in this learning path',
      );
    }

    const pathStructure =
      learningPath.pathStructure as unknown as PathStructure;
    const phases = pathStructure.phases || [];
    const phaseProgress: PhaseProgress[] = phases.map((phase: Phase) => ({
      phaseId: phase.id,
      title: phase.title,
      status: 'notStarted',
      progressPercentage: 0,
      modulesCompleted: [] as string[],
      modules: [] as { id: string; status: string }[],
      completed: false,
      currentModuleId: phase.modules[0]?.id,
    }));

    const moduleProgress: ModuleProgress[] = phases.flatMap((phase: Phase) =>
      phase.modules.map((module: Module) => ({
        moduleId: module.id,
        phaseId: phase.id,
        status: 'notStarted',
        progressPercentage: 0,
        timeSpentMinutes: 0,
        attempts: 0,
      })),
    );

    const progress = await this.prisma.learningPathProgress.create({
      data: {
        user: { connect: { id: userId } },
        learningPath: { connect: { id: startDto.learningPathId } },
        status: ProgressStatus.inProgress,
        overallProgressPercentage: 0,
        phaseProgress: phaseProgress as unknown as Prisma.JsonArray,
        moduleProgress: moduleProgress as unknown as Prisma.JsonArray,
        milestonesAchieved: [],
        totalTimeSpentMinutes: 0,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        streakDays: 0,
        lastActivityDate: new Date(),
        analytics: {
          study_sessions: [],
          performance_trends: [],
          preferences: startDto.preferences
            ? (startDto.preferences as Prisma.JsonObject)
            : {},
          learning_velocity: {
            modules_per_week: 0,
            hours_per_week: 0,
            consistency_score: 0,
          },
        } as Prisma.JsonObject,
      },
    });

    // analytics (enrollment count)
    await this.updateLearningPathEnrollmentCount(startDto.learningPathId);
    return progress;
  }

  async updateProgress(
    userId: string,
    learningPathId: string,
    dto: LearningPathUpdateDto,
  ): Promise<LearningPathProgress> {
    const progress = await this.prisma.learningPathProgress.findFirst({
      where: { userId, learningPathId },
      include: { learningPath: true },
    });
    if (!progress) {
      throw new NotFoundException('Learning path progress not found');
    }

    const now = new Date();
    let progressChanged = false;

    if (dto.moduleId) {
      const moduleProgress =
        progress.moduleProgress as unknown as ModuleProgress[];
      const m = moduleProgress.find((x) => x.moduleId === dto.moduleId);
      if (m) {
        if (dto.moduleStatus) {
          if (dto.moduleStatus === 'notStarted') {
            m.status = 'notStarted';
          } else if (dto.moduleStatus === 'inProgress') {
            m.status = 'inProgress';
          } else {
            m.status = dto.moduleStatus;
          }
        }
        if (dto.progressPercentage !== undefined) {
          m.progressPercentage = dto.progressPercentage;
        }
        if (dto.timeSpentMinutes) {
          m.timeSpentMinutes = (m.timeSpentMinutes ?? 0) + dto.timeSpentMinutes;
          progress.totalTimeSpentMinutes += dto.timeSpentMinutes;
        }
        if (dto.score !== undefined) {
          m.best_score = Math.max(m.best_score || 0, dto.score);
        }
        if (dto.notes) {
          m.notes = dto.notes;
        }
        m.attempts = (m.attempts || 0) + 1;
        progressChanged = true;

        await this.updatePhaseProgress(
          progress,
          dto.phaseId || this.getPhaseIdForModule(progress, dto.moduleId),
        );
      }
    }

    if (progressChanged) {
      progress.overallProgressPercentage =
        this.calculateOverallProgress(progress);
      progress.lastAccessedAt = now;
      this.updateStreak(progress);
      await this.checkMilestoneAchievements(progress);
      this.addStudySession(progress, dto.timeSpentMinutes || 0, dto.moduleId);
    }

    return this.prisma.learningPathProgress.update({
      where: { id: progress.id },
      data: {
        overallProgressPercentage: progress.overallProgressPercentage,
        lastAccessedAt: progress.lastAccessedAt,
        moduleProgress: progress.moduleProgress || Prisma.DbNull,
        phaseProgress: progress.phaseProgress || Prisma.DbNull,
        totalTimeSpentMinutes: progress.totalTimeSpentMinutes,
        streakDays: progress.streakDays,
        lastActivityDate: progress.lastActivityDate,
        milestonesAchieved: progress.milestonesAchieved || Prisma.DbNull,
        analytics: progress.analytics || Prisma.DbNull,
      },
    });
  }

  async getProgress(
    userId: string,
    learningPathId: string,
  ): Promise<LearningPathProgress> {
    const progress = await this.prisma.learningPathProgress.findFirst({
      where: { userId, learningPathId },
      include: { learningPath: { include: { milestones: true } } },
    });
    if (!progress) {
      throw new NotFoundException('Learning path progress not found');
    }
    return progress;
  }

  async getUserProgress(userId: string): Promise<LearningPathProgress[]> {
    return this.prisma.learningPathProgress.findMany({
      where: { userId },
      include: { learningPath: true },
      orderBy: { lastAccessedAt: 'desc' },
    });
  }

  async getProgressAnalytics(
    userId: string,
    learningPathId: string,
  ): Promise<any> {
    const progress = await this.getProgress(userId, learningPathId);

    const moduleProgressArray =
      progress.moduleProgress as unknown as ModuleProgress[];
    const totalModules = moduleProgressArray.length;
    const completedModules = moduleProgressArray.filter(
      (m) => m.status === 'completed',
    ).length;

    const phaseProgressArray =
      progress.phaseProgress as unknown as PhaseProgress[];
    const totalPhases = phaseProgressArray.length;
    const completedPhases = phaseProgressArray.filter(
      (p) => p.status === 'completed',
    ).length;

    const totalMilestones = 0;
    const achievedMilestones = (
      progress.milestonesAchieved as unknown as MilestoneAchieved[]
    ).length;

    const estimatedCompletionDate = await this.calculateEstimatedCompletion(
      progress.id,
    );

    return {
      overallProgress: progress.overallProgressPercentage,
      timeSpentTotal: progress.totalTimeSpentMinutes,
      currentStreak: progress.streakDays,
      modulesCompleted: completedModules,
      modulesTotal: totalModules,
      phasesCompleted: completedPhases,
      phasesTotal: totalPhases,
      milestonesAchieved: achievedMilestones,
      milestonesTotal: totalMilestones,
      estimatedCompletionDate,
      learningVelocity: (progress.analytics as unknown as LearningPathAnalytics)
        ?.learning_velocity || {
        modules_per_week: 0,
        hours_per_week: 0,
        consistency_score: 0,
      },
    };
  }

  async pauseLearningPath(
    userId: string,
    learningPathId: string,
  ): Promise<LearningPathProgress> {
    const progress = await this.getProgress(userId, learningPathId);
    return this.prisma.learningPathProgress.update({
      where: { id: progress.id },
      data: { status: 'dropped' }, // Using valid enum value
    });
  }

  async resumeLearningPath(
    userId: string,
    learningPathId: string,
  ): Promise<LearningPathProgress> {
    const progress = await this.getProgress(userId, learningPathId);
    return this.prisma.learningPathProgress.update({
      where: { id: progress.id },
      data: { status: ProgressStatus.inProgress, lastAccessedAt: new Date() },
    });
  }

  async completeLearningPath(
    userId: string,
    learningPathId: string,
  ): Promise<LearningPathProgress> {
    const progress = await this.getProgress(userId, learningPathId);
    const updated = await this.prisma.learningPathProgress.update({
      where: { id: progress.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        overallProgressPercentage: 100,
      },
    });
    await this.updateLearningPathCompletionStats(learningPathId);
    return updated;
  }

  private async updatePhaseProgress(
    progress: LearningPathProgress,
    phaseId: string,
  ): Promise<void> {
    if (!phaseId) {
      return;
    }
    const phaseProgress = progress.phaseProgress as unknown as PhaseProgress[];
    const phase = phaseProgress.find((p) => p.phaseId === phaseId);
    if (!phase) {
      return;
    }

    const moduleProgress =
      progress.moduleProgress as unknown as ModuleProgress[];
    const inPhase = moduleProgress.filter((m) => m.phaseId === phaseId);
    const completed = inPhase.filter((m) => m.status === 'completed');
    const total = inPhase.length;

    phase.progressPercentage = total > 0 ? (completed.length / total) * 100 : 0;
    phase.modulesCompleted = completed.map((m) => m.moduleId);

    if (phase.progressPercentage === 100 && phase.status !== 'completed') {
      phase.status = 'completed';
      phase.completedAt = new Date();
    } else if (phase.progressPercentage > 0 && phase.status === 'notStarted') {
      phase.status = 'inProgress';
      phase.startedAt = new Date();
    }

    await this.prisma.learningPathProgress.update({
      where: { id: progress.id },
      data: { phaseProgress: phaseProgress as unknown as Prisma.JsonArray },
    });
  }

  private calculateOverallProgress(progress: LearningPathProgress): number {
    const moduleProgress =
      progress.moduleProgress as unknown as ModuleProgress[];
    const total = moduleProgress.length;
    if (total === 0) {
      return 0;
    }
    const sum = moduleProgress.reduce(
      (s, m) => s + (m.progressPercentage || 0),
      0,
    );
    return Math.round(sum / total);
  }

  private updateStreak(progress: LearningPathProgress): void {
    const today = new Date();
    const last = progress.lastActivityDate;
    if (!last) {
      progress.streakDays = 1;
      progress.lastActivityDate = today;
      return;
    }
    const daysDiff = Math.floor(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff === 1) {
      progress.streakDays = (progress.streakDays || 0) + 1;
    } else if (daysDiff > 1) {
      progress.streakDays = 1;
    }
    progress.lastActivityDate = today;
  }

  private async checkMilestoneAchievements(
    progress: LearningPathProgress,
  ): Promise<void> {
    const milestones = await this.prisma.learningPathMilestone.findMany({
      where: { learningPathId: progress.learningPathId, status: 'active' },
    });

    const milestonesAchieved =
      progress.milestonesAchieved as unknown as MilestoneAchieved[];

    for (const milestone of milestones) {
      const already = milestonesAchieved.some(
        (m) => m.milestone_id === milestone.id,
      );
      if (already) {
        continue;
      }
      const isAchieved = this.evaluateMilestoneCriteria(milestone, progress);
      if (isAchieved) {
        milestonesAchieved.push({
          milestone_id: milestone.id,
          achieved_at: new Date(),
          notes: `Milestone achieved: ${milestone.title}`,
        });
      }
    }
  }

  private evaluateMilestoneCriteria(
    m: LearningPathMilestone,
    p: LearningPathProgress,
  ): boolean {
    const c = m.criteria as Prisma.JsonObject;
    if (!c) {
      return false;
    }

    switch (c['type']) {
      case 'phase_completion':
        return (p.phaseProgress as unknown as PhaseProgress[]).some(
          (x) =>
            x.phaseId === (c['conditions'] as Prisma.JsonObject)['phase_id'] &&
            x.status === 'completed',
        );
      case 'time_based':
        return (
          p.totalTimeSpentMinutes >=
          (((c['conditions'] as Prisma.JsonObject)[
            'time_period_days'
          ] as number) || 0) *
            60
        );
      case 'streak':
        return (
          p.streakDays >=
          (((c['conditions'] as Prisma.JsonObject)['streak_days'] as number) ||
            0)
        );
      default:
        return false;
    }
  }

  private addStudySession(
    p: LearningPathProgress,
    duration: number,
    moduleId?: string,
  ): void {
    const session = {
      date: new Date(),
      duration_minutes: duration,
      modules_covered: moduleId ? [moduleId] : [],
    };
    const analytics = p.analytics as unknown as LearningPathAnalytics;
    if (!analytics.study_sessions) {
      analytics.study_sessions = [];
    }
    analytics.study_sessions.push(session);
    if (analytics.study_sessions.length > 100) {
      analytics.study_sessions = analytics.study_sessions.slice(-100);
    }
    p.analytics = analytics as any;
  }

  private async calculateEstimatedCompletion(
    progressId: string,
  ): Promise<Date | undefined> {
    const progress = await this.prisma.learningPathProgress.findUnique({
      where: { id: progressId },
      include: { learningPath: true },
    });
    if (!progress || !progress.learningPath) {
      return;
    }

    const remaining = 100 - progress.overallProgressPercentage;
    if (remaining <= 0) {
      return;
    }
    const analytics = progress.analytics as unknown as LearningPathAnalytics;
    if (!analytics?.study_sessions?.length) {
      return;
    }

    const recent = analytics.study_sessions.slice(-10);
    if (recent.length === 0) {
      return;
    }

    const avgMin =
      recent.reduce((s: number, x) => s + x.duration_minutes, 0) /
      recent.length;
    const estHours =
      (remaining / 100) *
      (progress.learningPath.estimatedDurationWeeks || 12) *
      (progress.learningPath.estimatedHoursPerWeek || 10);
    const estMinutes = estHours * 60;
    const sessionsNeeded = Math.ceil(estMinutes / avgMin);
    const weeks = Math.ceil(sessionsNeeded / 3); // assume 3 sessions/week

    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    return date;
  }

  private getPhaseIdForModule(
    p: LearningPathProgress,
    moduleId: string,
  ): string {
    const moduleProgress = p.moduleProgress as unknown as ModuleProgress[];
    const mod = moduleProgress.find((m) => m.moduleId === moduleId);
    return mod?.phaseId || '';
  }

  private async updateLearningPathEnrollmentCount(
    learningPathId: string,
  ): Promise<void> {
    const enrollmentCount = await this.prisma.learningPathProgress.count({
      where: { learningPathId },
    });
    await this.prisma.learningPath.update({
      where: { id: learningPathId },
      data: { analytics: { update: { total_enrollments: enrollmentCount } } },
    });
  }

  private async updateLearningPathCompletionStats(
    learningPathId: string,
  ): Promise<void> {
    const total = await this.prisma.learningPathProgress.count({
      where: { learningPathId },
    });
    const completed = await this.prisma.learningPathProgress.count({
      where: { learningPathId, status: 'completed' },
    });
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const completedProgresses = await this.prisma.learningPathProgress.findMany(
      {
        where: { learningPathId, status: 'completed' },
      },
    );

    let avgWeeks = 0;
    if (completedProgresses.length > 0) {
      const totalWeeks = completedProgresses.reduce((sum, p) => {
        if (p.startedAt && p.completedAt) {
          return (
            sum +
            (p.completedAt.getTime() - p.startedAt.getTime()) /
              (1000 * 60 * 60 * 24 * 7)
          );
        }
        return sum;
      }, 0);
      avgWeeks = totalWeeks / completedProgresses.length;
    }

    await this.prisma.learningPath.update({
      where: { id: learningPathId },
      data: {
        analytics: {
          update: {
            completion_rate: completionRate,
            average_completion_time_weeks: avgWeeks,
          },
        },
      },
    });
  }
}
