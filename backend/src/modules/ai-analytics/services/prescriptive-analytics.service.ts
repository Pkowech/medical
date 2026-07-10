import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { firstValueFrom, timeout } from 'rxjs';
import { retry } from 'rxjs/operators';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { AutonomyLevelService } from '#modules/education/courses/services/autonomy-level.service';
import { GuidanceLevel } from '@prisma/client';
import { getErrorMessage } from '#common/utils/error.utils';
import { MetricsService } from '#infrastructure/metrics/metrics.service';

export interface SupportOption {
  type: 'bridging_material' | 'study_group' | 'office_hours' | 'tutor';
  label: string;
  link?: string;
  description: string;
}

export interface GateDecision {
  canProceed: boolean;
  reason: string;
  pKnown: number;
  recommendations?: string[];
  // ANAL-001: Prediction explainability
  explanation?: string[];
  // ETH-002: Every "at risk" prediction must include support options
  supportOptions?: SupportOption[];
}

@Injectable()
export class PrescriptiveAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(PrescriptiveAnalyticsService.name);
  private analyticsServiceGrpc!: AnalyticsService;
  private readonly grpcTimeoutMs = 500;
  private readonly grpcRetries = 1;

  // Thresholds map based on guidance level
  private readonly thresholds: Record<GuidanceLevel, number> = {
    [GuidanceLevel.HIGH]: 0.8,
    [GuidanceLevel.MEDIUM]: 0.7,
    [GuidanceLevel.LOW]: 0.6,
  };

  constructor(
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly prisma: PrismaService,
    private readonly autonomyService: AutonomyLevelService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  /**
   * Evaluate if a user can proceed to the next topic based on BKT knowledge state.
   */
  async evaluateGates(userId: string, topicId: string): Promise<GateDecision> {
    try {
      // Fetch knowledge states from Rust Analytics service
      const response = await firstValueFrom(
        this.analyticsServiceGrpc
          .getUserAbility({ user_id: userId })
          .pipe(
            timeout(this.grpcTimeoutMs),
            retry({ count: this.grpcRetries, delay: 200 }),
          ),
      );

      const pKnown = response.p_known_by_skill?.[topicId] ?? 0;

      // Increment metrics
      this.metrics.recordAnalyticsEvaluation('success');

      // Cache the successful result
      await this.updateSkillStateCache(userId, topicId, pKnown);

      return this.makeDecision(
        userId,
        topicId,
        pKnown,
        'Mastery threshold met',
      );
    } catch (error) {
      return this.handleDegradation(userId, topicId, error);
    }
  }

  private async makeDecision(
    userId: string,
    topicId: string,
    pKnown: number,
    successReason: string,
  ): Promise<GateDecision> {
    const guidanceLevel =
      await this.autonomyService.getEffectiveGuidanceLevel(userId);
    const threshold = this.thresholds[guidanceLevel];

    // ANAL-001: Build human-readable explanation
    const explanation = this.buildExplanation(pKnown, threshold, guidanceLevel);

    if (pKnown >= threshold) {
      return {
        canProceed: true,
        reason: successReason,
        pKnown,
        explanation,
      };
    }

    const recommendations = await this.getRecommendations(topicId);
    // ETH-002: Always provide support options when not proceeding
    const supportOptions = await this.buildSupportOptions(topicId);

    return {
      canProceed: false,
      reason: `Mastery threshold (${threshold * 100}%) not met for ${guidanceLevel} guidance level`,
      pKnown,
      recommendations,
      explanation,
      supportOptions,
    };
  }

  private async updateSkillStateCache(
    userId: string,
    topicId: string,
    pKnown: number,
  ) {
    try {
      await this.prisma.userSkillState.upsert({
        where: {
          userId_skillId: {
            userId,
            skillId: topicId,
          },
        },
        update: {
          pKnown,
          lastUpdated: new Date(),
          attempts: { increment: 1 },
        },
        create: {
          userId,
          skillId: topicId,
          pKnown,
          lastUpdated: new Date(),
          attempts: 1,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to update skill state cache for user ${userId}: ${getErrorMessage(error)}`,
      );
    }
  }

  private async handleDegradation(
    userId: string,
    topicId: string,
    error: any,
  ): Promise<GateDecision> {
    this.logger.warn(
      `Analytics service degraded for user ${userId}, topic ${topicId}: ${getErrorMessage(error)}`,
    );

    // Record degradation metric
    this.metrics.recordAnalyticsEvaluation('degraded');

    // 1. Try Cache Fallback (<= 24h)
    const cachedState = await this.prisma.userSkillState.findUnique({
      where: {
        userId_skillId: { userId, skillId: topicId },
      },
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (cachedState && cachedState.lastUpdated >= oneDayAgo) {
      await this.logDegradation(
        userId,
        topicId,
        'cache',
        getErrorMessage(error),
      );
      return this.makeDecision(
        userId,
        topicId,
        cachedState.pKnown,
        'Mastery threshold met (via cache fallback)',
      );
    }

    // 2. Cohort/Topic Average Fallback (Simulated with 0.5)
    // In a real scenario, we might query the topic's average success rate
    const topicAvg = 0.5;
    await this.logDegradation(
      userId,
      topicId,
      'cohort_default',
      getErrorMessage(error),
    );

    // If we use cohort default and it meets threshold, we allow with warning
    // However, if it's below threshold (which 0.5 usually is for High/Med), we might block or fail open.
    // Requirement says: "Never block user infinitely — always provide escape hatch"
    // So if cohort fallback fails, we "Fail Open" with a warning.

    const decision = await this.makeDecision(
      userId,
      topicId,
      topicAvg,
      'Gate check bypassed using cohort default due to service error',
    );

    if (!decision.canProceed) {
      // Escape hatch: Allow anyway but with high visibility warning
      return {
        canProceed: true,
        reason: 'Service unavailable. Access allowed via escape hatch.',
        pKnown: topicAvg,
        recommendations: [
          'Warning: Analytics service is currently offline. Verification of your mastery level is limited.',
          ...(decision.recommendations || []),
        ],
      };
    }

    return decision;
  }

  private async logDegradation(
    userId: string,
    topicId: string,
    fallbackMethod: string,
    reason: string,
  ) {
    try {
      await this.prisma.analyticsDegradationLog.create({
        data: {
          userId,
          topicId,
          action: 'evaluate_gates',
          fallbackMethod,
          reason: reason.substring(0, 500),
        },
      });
    } catch (logError) {
      this.logger.error(
        `Failed to log analytics degradation: ${getErrorMessage(logError)}`,
      );
    }
  }

  private async getRecommendations(topicId: string): Promise<string[]> {
    // Basic logic: recommend reviewing materials for the current topic
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { materials: true },
    });

    if (!topic || !topic.materials.length) {
      return ['Review the topic core concepts'];
    }

    return topic.materials.map((m: any) => `Review material: ${m.title}`);
  }

  // ANAL-001: Build human-readable explanation for the gate decision
  private buildExplanation(
    pKnown: number,
    threshold: number,
    guidanceLevel: string,
  ): string[] {
    const lines: string[] = [];
    const pct = Math.round(pKnown * 100);
    const thresholdPct = Math.round(threshold * 100);

    lines.push(`Your predicted knowledge state for this topic is ${pct}%.`);
    lines.push(
      `The required mastery threshold for your guidance level (${guidanceLevel}) is ${thresholdPct}%.`,
    );

    if (pKnown < threshold) {
      const gap = thresholdPct - pct;
      lines.push(
        `You need to improve by ${gap} percentage points to unlock the next topic.`,
      );
      lines.push(
        'This is based on your recent quiz performance and BKT knowledge state.',
      );
    } else {
      lines.push(
        'Your knowledge state meets the mastery threshold — you may proceed.',
      );
    }

    return lines;
  }

  // ETH-002: Always include actionable support options with at-risk decisions
  private async buildSupportOptions(topicId: string): Promise<SupportOption[]> {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { name: true },
    });

    const topicName = topic?.name ?? 'this topic';

    return [
      {
        type: 'bridging_material',
        label: 'Review bridging materials',
        description: `Foundational materials to strengthen your understanding of ${topicName}.`,
        link: `/courses/topics/${topicId}/materials?filter=bridging`,
      },
      {
        type: 'study_group',
        label: 'Join a study group',
        description: `Connect with peers studying ${topicName} to improve together.`,
        link: `/study-groups?topic=${topicId}`,
      },
      {
        type: 'tutor',
        label: 'Request tutor support',
        description: 'Get one-on-one help from an instructor or tutor.',
        link: `/support/tutor-request?topic=${topicId}`,
      },
      {
        type: 'office_hours',
        label: 'Attend office hours',
        description: 'Join instructor office hours for personalized guidance.',
        link: `/schedule?filter=office_hours`,
      },
    ];
  }
}
