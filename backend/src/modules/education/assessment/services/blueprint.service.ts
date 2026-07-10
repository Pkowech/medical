import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { LearningPathType, FocusContext } from '@prisma/client';

export interface TopicScore {
  topicId: string;
  topicName: string;
  rawScore: number; // 0-100
  weight: number;
  weightedScore: number;
  focusContext: FocusContext;
}

export interface BoardReadinessResult {
  learningPathId: string;
  learningPathTitle: string;
  pathType: LearningPathType;
  readinessScore: number; // 0-100 weighted average
  topicBreakdown: TopicScore[];
  totalWeight: number;
  assessedAt: Date;
}

@Injectable()
export class BlueprintService {
  private readonly logger = new Logger(BlueprintService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate Board Readiness score for a user on a specific exam blueprint.
   *
   * This aggregates quiz/assessment scores per topic, applies blueprint weights,
   * and returns a weighted average representing "readiness" for the exam.
   */
  async calculateBoardReadiness(
    userId: string,
    learningPathId: string,
  ): Promise<BoardReadinessResult> {
    // 1. Fetch the LearningPath and its BlueprintMappings
    const learningPath = await this.prisma.learningPath.findUnique({
      where: { id: learningPathId },
      include: {
        blueprintMappings: {
          include: {
            topic: true,
          },
        },
      },
    });

    if (!learningPath) {
      throw new NotFoundException(`LearningPath ${learningPathId} not found`);
    }

    if (learningPath.pathType !== LearningPathType.EXAM_BLUEPRINT) {
      this.logger.warn(
        `LearningPath ${learningPathId} is not an EXAM_BLUEPRINT, returning raw score`,
      );
    }

    // 2. For each mapped topic, get the user's score
    const topicBreakdown: TopicScore[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const mapping of learningPath.blueprintMappings) {
      // Get user's quiz performance for this topic
      // We aggregate from UserResponse joined with Question.topic_ids
      const topicScores = await this.prisma.userResponse.findMany({
        where: {
          userId,
          question: {
            topicIds: {
              has: mapping.topicId,
            },
          },
        },
        select: {
          isCorrect: true,
          score: true,
        },
      });

      // Calculate raw score for this topic (percentage correct)
      let rawScore = 0;
      if (topicScores.length > 0) {
        const correctCount = topicScores.filter((r) => r.isCorrect).length;
        rawScore = (correctCount / topicScores.length) * 100;
      }

      const weightedScore = rawScore * mapping.weight;
      totalWeightedScore += weightedScore;
      totalWeight += mapping.weight;

      topicBreakdown.push({
        topicId: mapping.topicId,
        topicName: mapping.topic.name,
        rawScore: Math.round(rawScore * 100) / 100,
        weight: mapping.weight,
        weightedScore: Math.round(weightedScore * 100) / 100,
        focusContext: mapping.focusContext,
      });
    }

    // 3. Calculate final weighted average
    const readinessScore =
      totalWeight > 0
        ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
        : 0;

    return {
      learningPathId,
      learningPathTitle: learningPath.title,
      pathType: learningPath.pathType,
      readinessScore,
      topicBreakdown,
      totalWeight,
      assessedAt: new Date(),
    };
  }

  /**
   * Get a summary of all exam blueprints for a user with their readiness scores.
   */
  async getUserBlueprintSummary(userId: string): Promise<
    {
      id: string;
      title: string;
      readinessScore: number;
      topicCount: number;
    }[]
  > {
    const blueprints = await this.prisma.learningPath.findMany({
      where: {
        pathType: LearningPathType.EXAM_BLUEPRINT,
      },
      include: {
        blueprintMappings: true,
      },
    });

    const summaries = await Promise.all(
      blueprints.map(async (bp) => {
        try {
          const result = await this.calculateBoardReadiness(userId, bp.id);
          return {
            id: bp.id,
            title: bp.title,
            readinessScore: result.readinessScore,
            topicCount: bp.blueprintMappings.length,
          };
        } catch {
          return {
            id: bp.id,
            title: bp.title,
            readinessScore: 0,
            topicCount: bp.blueprintMappings.length,
          };
        }
      }),
    );

    return summaries;
  }
}
