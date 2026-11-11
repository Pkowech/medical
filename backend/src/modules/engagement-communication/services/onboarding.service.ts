import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  CompleteOnboardingDto,
  OnboardingStatusResponseDto,
} from '#common/dto/onboarding.dto';
import {
  Prisma,
  UserActivityType,
  ProgressStatus,
} from '@prisma/client';
import {
  CareerStage,
  normalizeCareerStage,
} from '#common/constants/career-stages';
import { createHash } from 'node:crypto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        ? user.preferences
        : {};

    const targetExam = typeof preferences['targetExam'] === 'string' ? preferences['targetExam'] : null;
    const institution = typeof preferences['institution'] === 'string' ? preferences['institution'] : null;
    const dailyGoalMinutes = typeof preferences['dailyGoalMinutes'] === 'number' ? preferences['dailyGoalMinutes'] : null;
    const focusTopics = Array.isArray(preferences['focusTopics']) ? (preferences['focusTopics'] as string[]) : [];

    const hasStageContext =
      user.careerStage === 'professional'
        ? user.yearOfExperience !== null
        : (user.careerStage === 'student' || user.careerStage === 'postgraduate') &&
          user.studyYear !== null;
    const isCompleted = Boolean(user.healthcareField && user.careerStage && hasStageContext);

    // Calculate completeness %
    const totalChecks = 6;
    let completedChecks = 0;
    if (user.healthcareField) completedChecks++;
    if (user.careerStage) completedChecks++;
    if (hasStageContext) completedChecks++;
    if (user.specialization) completedChecks++;
    if (targetExam || institution) completedChecks++;
    if (dailyGoalMinutes || focusTopics.length > 0) completedChecks++;

    const completionPercentage = Math.round((completedChecks / totalChecks) * 100);

    // Fetch suggested starter paths
    const suggestedStarterPaths = await this.getSuggestedStarterPaths(
      user.healthcareField,
      user.specialization,
      4,
      user.careerStage,
      targetExam,
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
   * seeds a tailored starter learning goal, and queues a completion event.
   */
  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<OnboardingStatusResponseDto> {
    const careerStage = normalizeCareerStage(dto.careerStage);
    if (!careerStage) {
      throw new BadRequestException('Career stage must be student, postgraduate, or professional');
    }
    const isInTraining = careerStage === 'student' || careerStage === 'postgraduate';
    if (!dto.healthcareField.trim()) {
      throw new BadRequestException('Healthcare field is required');
    }
    if (isInTraining && dto.studyYear == null) {
      throw new BadRequestException('Study or training year is required for this career stage');
    }
    if (isInTraining && dto.yearOfExperience != null) {
      throw new BadRequestException('Years in practice only applies to practicing professionals');
    }
    if (careerStage === 'professional' && dto.yearOfExperience == null) {
      throw new BadRequestException('Years in practice is required for practicing professionals');
    }
    if (careerStage === 'professional' && dto.studyYear != null) {
      throw new BadRequestException('Study year does not apply to practicing professionals');
    }

    await this.prisma.$transaction(async transaction => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, preferences: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const existingPreferences =
        user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
          ? user.preferences
          : {};
      const existingCompletionTime = existingPreferences.onboardingCompletedAt;
      const onboardingCompletedAt =
        typeof existingCompletionTime === 'string'
          ? existingCompletionTime
          : new Date().toISOString();

      const updatedPreferences: Prisma.JsonObject = {
        ...existingPreferences,
        onboardingCompleted: true,
        onboardingCompletedAt,
        institution: dto.institution?.trim() || null,
        targetExam: dto.targetExam?.trim() || null,
        ...(dto.focusTopics ? { focusTopics: dto.focusTopics } : {}),
        ...(dto.dailyGoalMinutes ? { dailyGoalMinutes: dto.dailyGoalMinutes } : {}),
      };

      await transaction.user.update({
        where: { id: userId },
        data: {
          healthcareField: dto.healthcareField.toLowerCase().trim(),
          careerStage,
          studyYear: dto.studyYear ?? null,
          yearOfExperience: dto.yearOfExperience ?? null,
          specialization: dto.specialization?.trim() ?? null,
          preferences: updatedPreferences,
        },
      });

      await this.seedStarterLearningGoal(transaction, userId, dto, careerStage);

      await transaction.userActivity.upsert({
        where: { sourceKey: `onboarding-completed:${userId}` },
        create: {
          userId,
          sourceKey: `onboarding-completed:${userId}`,
          type: UserActivityType.PROFILE_UPDATE,
          description: `Completed onboarding: ${dto.healthcareField} (${careerStage})`,
          details: {
            healthcareField: dto.healthcareField,
            careerStage,
            studyYear: dto.studyYear ?? null,
            specialization: dto.specialization ?? null,
            targetExam: dto.targetExam ?? null,
          },
        },
        update: {},
      });

      const eventPayload: Prisma.InputJsonObject = {
        userId,
        timestamp: onboardingCompletedAt,
        data: {
          healthcareField: dto.healthcareField,
          careerStage,
          studyYear: dto.studyYear ?? null,
          yearOfExperience: dto.yearOfExperience ?? null,
          specialization: dto.specialization ?? null,
          institution: dto.institution ?? null,
          targetExam: dto.targetExam ?? null,
          focusTopics: dto.focusTopics ?? [],
          dailyGoalMinutes: dto.dailyGoalMinutes ?? null,
        },
      };
      const eventDedupeKey = createHash('sha256')
        .update(`user.onboarding.completed:${userId}`)
        .digest('hex');
      await transaction.applicationOutboxEvent.upsert({
        where: { dedupeKey: eventDedupeKey },
        create: {
          eventType: 'user.onboarding.completed',
          aggregateId: userId,
          dedupeKey: eventDedupeKey,
          payload: eventPayload,
        },
        update: {},
      });
    });

    this.logger.log(`User ${userId} completed onboarding as ${dto.healthcareField}`);
    return this.getOnboardingStatus(userId);
  }

  /** Suggests published paths relevant to the learner's field and goals. */
  async getSuggestedStarterPaths(
    healthcareField?: string | null,
    specialization?: string | null,
    limit: number = 4,
    careerStage?: string | null,
    targetExam?: string | null,
  ) {
    const normalizedField = healthcareField?.toLowerCase().replace(/[_-]/g, ' ').trim();
    const normalizedSpecialization = specialization?.toLowerCase().trim();
    const normalizedTargetExam = targetExam?.toLowerCase().trim();
    const normalizedStage = normalizeCareerStage(careerStage);
    if (!normalizedStage) {
      return [];
    }
    const resultLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 12)
      : 4;
    const candidatePathIds = this.getCanonicalPathIds(healthcareField);

    const fieldConditions: Prisma.LearningPathWhereInput[] = [];
    if (normalizedField) {
      fieldConditions.push(
        { title: { contains: normalizedField, mode: 'insensitive' } },
        { description: { contains: normalizedField, mode: 'insensitive' } },
        { specialization: { contains: normalizedField, mode: 'insensitive' } },
        { category: { name: { contains: normalizedField, mode: 'insensitive' } } },
      );
    }

    const candidateConditions: Prisma.LearningPathWhereInput[] = [
      ...fieldConditions,
      ...(candidatePathIds.length > 0 ? [{ id: { in: candidatePathIds } }] : []),
    ];

    if (candidateConditions.length === 0) {
      return [];
    }

    const candidates = await this.prisma.learningPath.findMany({
      where: {
        status: 'published',
        OR: candidateConditions,
        ...(normalizedStage ? { targetCareerStages: { has: normalizedStage } } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedDurationWeeks: true,
        estimatedHoursPerWeek: true,
        specialization: true,
        targetCareerStages: true,
        pathType: true,
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const stagePreferredTypes: Record<string, string[]> = {
      student: ['STANDARD_STUDY', 'CLINICAL_COMPETENCY', 'EXAM_BLUEPRINT'],
      postgraduate: ['CLINICAL_COMPETENCY', 'EXAM_BLUEPRINT', 'STANDARD_STUDY'],
      professional: ['CLINICAL_COMPETENCY', 'EXAM_BLUEPRINT', 'STANDARD_STUDY'],
    };
    const preferredTypes = stagePreferredTypes[normalizedStage ?? ''] ?? [];

    return candidates
      .map(path => {
        const pathText = [
          path.title,
          path.description,
          path.specialization,
          path.category?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        let score = candidatePathIds.includes(path.id) ? 20 : 0;

        if (normalizedField && pathText.includes(normalizedField)) score += 10;
        if (normalizedSpecialization && pathText.includes(normalizedSpecialization)) score += 30;
        if (normalizedTargetExam && pathText.includes(normalizedTargetExam)) score += 40;

        const stageRank = preferredTypes.indexOf(path.pathType);
        if (stageRank >= 0) score += (preferredTypes.length - stageRank) * 2;

        return { path, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, resultLimit)
      .map(({ path }) => path);
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
    transaction: Prisma.TransactionClient,
    userId: string,
    dto: CompleteOnboardingDto,
    careerStage: CareerStage,
  ): Promise<void> {
    const existingGoalCount = await transaction.learningGoal.count({
      where: { userId },
    });

    if (existingGoalCount > 0) {
      return;
    }

    const targetTitle = dto.targetExam
      ? `Prepare for ${dto.targetExam}`
      : careerStage === 'professional'
        ? `Advance ${dto.healthcareField.toUpperCase()} Clinical Practice`
        : careerStage === 'postgraduate'
          ? `Complete ${dto.healthcareField.toUpperCase()} Specialty Training`
          : dto.studyYear
            ? `Master ${dto.healthcareField.toUpperCase()} Year ${dto.studyYear} Core Competencies`
            : `Complete ${dto.healthcareField.toUpperCase()} Foundational Curriculum`;

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 3);

    await transaction.learningGoal.upsert({
      where: { sourceKey: `onboarding-starter-goal:${userId}` },
      create: {
        userId,
        sourceKey: `onboarding-starter-goal:${userId}`,
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
      update: {},
    });

    this.logger.debug(`Seeded starter goal "${targetTitle}" for user ${userId}`);
  }
}
