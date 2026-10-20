import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CompleteOnboardingDto,
  OnboardingStatusResponseDto,
} from '#common/dto/onboarding.dto';
import {
  Prisma,
  UserActivityType,
  ProgressStatus,
} from '@prisma/client';
import { getErrorMessage } from '#common/utils/error.utils';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Retrieves current onboarding & healthcare profile completeness for a user,
   * along with suggested starter paths tailored to their field.
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatusResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        healthcareField: true,
        careerStage: true,
        studyYear: true,
        yearOfExperience: true,
        specialization: true,
        preferences: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferences =
      user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
        ? (user.preferences as Prisma.JsonObject)
        : {};

    const targetExam = typeof preferences['targetExam'] === 'string' ? preferences['targetExam'] : null;
    const institution = typeof preferences['institution'] === 'string' ? preferences['institution'] : null;
    const dailyGoalMinutes = typeof preferences['dailyGoalMinutes'] === 'number' ? preferences['dailyGoalMinutes'] : null;
    const focusTopics = Array.isArray(preferences['focusTopics']) ? (preferences['focusTopics'] as string[]) : [];

    const isCompleted = Boolean(user.healthcareField && user.careerStage);

    // Calculate completeness %
    const totalChecks = 6;
    let completedChecks = 0;
    if (user.healthcareField) completedChecks++;
    if (user.careerStage) completedChecks++;
    if (user.studyYear || user.yearOfExperience !== null) completedChecks++;
    if (user.specialization) completedChecks++;
    if (targetExam || institution) completedChecks++;
    if (dailyGoalMinutes || focusTopics.length > 0) completedChecks++;

    const completionPercentage = Math.round((completedChecks / totalChecks) * 100);

    // Fetch suggested starter paths
    const suggestedStarterPaths = await this.getSuggestedStarterPaths(
      user.healthcareField,
      user.specialization,
    );

    return {
      isCompleted,
      completionPercentage,
      profile: {
        healthcareField: user.healthcareField,
        careerStage: user.careerStage,
        studyYear: user.studyYear,
        yearOfExperience: user.yearOfExperience,
        specialization: user.specialization,
        institution,
        targetExam,
        dailyGoalMinutes,
        focusTopics,
      },
      suggestedStarterPaths,
    };
  }

  /**
   * Completes onboarding by saving user's healthcare profile, preferences,
   * seeds a tailored starter learning goal, and emits completion events.
   */
  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<OnboardingStatusResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, preferences: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const existingPreferences =
        user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
          ? (user.preferences as Prisma.JsonObject)
          : {};

      const updatedPreferences: Prisma.JsonObject = {
        ...existingPreferences,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        ...(dto.institution ? { institution: dto.institution } : {}),
        ...(dto.targetExam ? { targetExam: dto.targetExam } : {}),
        ...(dto.focusTopics ? { focusTopics: dto.focusTopics } : {}),
        ...(dto.dailyGoalMinutes ? { dailyGoalMinutes: dto.dailyGoalMinutes } : {}),
      };

      // 1. Update User Record
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          healthcareField: dto.healthcareField.toLowerCase().trim(),
          careerStage: dto.careerStage.toLowerCase().trim(),
          studyYear: dto.studyYear ?? null,
          yearOfExperience: dto.yearOfExperience ?? null,
          specialization: dto.specialization?.trim() ?? null,
          preferences: updatedPreferences,
        },
      });

      // 2. Seed an initial Starter Learning Goal if user has none
      await this.seedStarterLearningGoal(userId, dto);

      // 3. Log Profile Update Activity
      await this.prisma.userActivity.create({
        data: {
          userId,
          type: UserActivityType.PROFILE_UPDATE,
          description: `Completed onboarding: ${dto.healthcareField} (${dto.careerStage})`,
          details: {
            healthcareField: dto.healthcareField,
            careerStage: dto.careerStage,
            studyYear: dto.studyYear,
            specialization: dto.specialization,
            targetExam: dto.targetExam,
          },
        },
      });

      // 4. Emit event for downstream streak, recommendation, or notification listeners
      this.eventEmitter.emit('user.onboarding.completed', {
        userId,
        timestamp: new Date(),
        data: dto,
      });

      this.logger.log(`User ${userId} completed onboarding as ${dto.healthcareField}`);

      return this.getOnboardingStatus(userId);
    } catch (error) {
      this.logger.error(`Error completing onboarding for user ${userId}:`, getErrorMessage(error));
      throw new BadRequestException(`Failed to complete onboarding: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Suggests top starter pathways matching user's field or fallback to top published.
   * Priority order:
   *   1. Exact seeded paths by stable ID (real-world curriculum anchors)
   *   2. Specialization match
   *   3. Category/field match
   *   4. Fallback: top published
   */
  async getSuggestedStarterPaths(
    healthcareField?: string | null,
    specialization?: string | null,
    limit: number = 4,
  ) {
    // Tier 1: Try stable real-world path IDs first
    const candidatePathIds = this.getCanonicalPathIds(healthcareField);
    if (candidatePathIds.length > 0) {
      const anchoredPaths = await this.prisma.learningPath.findMany({
        where: {
          id: { in: candidatePathIds },
          status: 'published',
        },
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          estimatedDurationWeeks: true,
          specialization: true,
          pathType: true,
          category: { select: { name: true } },
        },
        take: limit,
      });

      if (anchoredPaths.length > 0) {
        return anchoredPaths;
      }
    }

    // Tier 2: Dynamic match on specialization & field
    const conditions: Prisma.LearningPathWhereInput[] = [];

    if (specialization) {
      conditions.push({
        specialization: { contains: specialization, mode: 'insensitive' },
      });
    }

    if (healthcareField) {
      conditions.push({
        specialization: { contains: healthcareField, mode: 'insensitive' },
      });
      conditions.push({
        category: {
          name: { contains: healthcareField, mode: 'insensitive' },
        },
      });
    }

    if (conditions.length > 0) {
      const matched = await this.prisma.learningPath.findMany({
        where: {
          status: 'published',
          OR: conditions,
        },
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          estimatedDurationWeeks: true,
          specialization: true,
          pathType: true,
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      if (matched.length > 0) {
        return matched;
      }
    }

    // Tier 3: Fallback to top published paths
    return this.prisma.learningPath.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedDurationWeeks: true,
        specialization: true,
        pathType: true,
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Returns the stable canonical learning path IDs for known healthcare fields.
   * These IDs are seeded by learning-paths.seed.ts and correspond to real curricula.
   */
  private getCanonicalPathIds(healthcareField?: string | null): string[] {
    if (!healthcareField) return [];
    const field = healthcareField.toLowerCase();

    const canonicalMap: Record<string, string[]> = {
      pharmacy: [
        'path-bpharm-iv-clerkship',
        'path-bpharm-iv-pharmacotherapy',
      ],
      nursing: ['path-bsc-nursing-critical-care'],
      medicine: ['path-mbchb-internal-medicine'],
      'internal medicine': ['path-mbchb-internal-medicine'],
    };

    for (const [key, ids] of Object.entries(canonicalMap)) {
      if (field.includes(key) || key.includes(field)) {
        return ids;
      }
    }
    return [];
  }

  /**
   * Automatically creates a tailored starter LearningGoal for the new student/practitioner.
   */
  private async seedStarterLearningGoal(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<void> {
    try {
      const existingGoalCount = await this.prisma.learningGoal.count({
        where: { userId },
      });

      if (existingGoalCount > 0) {
        return; // Don't overwrite if they already have goals
      }

      const targetTitle = dto.targetExam
        ? `Prepare for ${dto.targetExam}`
        : dto.studyYear
        ? `Master ${dto.healthcareField.toUpperCase()} Year ${dto.studyYear} Core Competencies`
        : `Complete ${dto.healthcareField.toUpperCase()} Foundational Curriculum`;

      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + 3); // 3 months target (standard term/quarter)

      await this.prisma.learningGoal.create({
        data: {
          userId,
          title: targetTitle,
          description: `Initial goal established during onboarding to guide clinical study and milestones.`,
          category: dto.healthcareField,
          targetDate,
          progress: 0,
          status: ProgressStatus.notStarted,
          priority: 1,
          metadata: {
            createdFromOnboarding: true,
            institution: dto.institution ?? null,
            targetExam: dto.targetExam ?? null,
            focusTopics: dto.focusTopics ?? [],
          },
        },
      });

      this.logger.debug(`Seeded starter goal "${targetTitle}" for user ${userId}`);
    } catch (err) {
      this.logger.warn(`Failed to seed starter goal during onboarding: ${getErrorMessage(err)}`);
      // Non-blocking: continue
    }
  }
}
