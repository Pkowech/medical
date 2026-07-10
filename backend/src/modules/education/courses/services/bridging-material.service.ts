import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { AiAnalyticsService } from '../../../ai-analytics/services/ai-analytics.service';

@Injectable()
export class BridgingMaterialService {
  private readonly logger = new Logger(BridgingMaterialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAnalyticsService: AiAnalyticsService,
  ) {}

  /**
   * Identifies weak prerequisite topics for a user and suggests bridging materials.
   */
  async suggestMaterials(userId: string, courseId: string): Promise<any[]> {
    // 1. Fetch course prerequisites (topics or units)
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        prerequisites: {
          include: {
            prerequisite: {
              include: {
                units: {
                  include: {
                    topics: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return [];
    }

    // 2. Extract relative topics from prerequisites
    const prerequisiteTopicIds: string[] = [];
    course.prerequisites.forEach((pre: any) => {
      pre.prerequisite.units.forEach((unit: any) => {
        unit.topics.forEach((topic: any) => {
          prerequisiteTopicIds.push(topic.id);
        });
      });
    });

    if (prerequisiteTopicIds.length === 0) {
      return [];
    }

    // 3. Get user ability (p_known) for these topics from AI Analytics (simulated logic here)
    // In a real scenario, we'd call a method that returns p_known per topic
    const weakTopics: string[] = [];

    // For each topic, check if the student mastery is below threshold (0.7)
    // Using a simplified check here: if they haven't completed it or have low scores
    for (const topicId of prerequisiteTopicIds) {
      const progress = await this.prisma.progress.findFirst({
        where: { userId, topicId },
        select: { status: true, completionPercentage: true },
      });

      if (!progress || progress.completionPercentage < 70) {
        weakTopics.push(topicId);
      }
    }

    if (weakTopics.length === 0) {
      return [];
    }

    // 4. Find materials tagged as 'bridging' for these weak topics
    // We treat 'bridging' category or metadata tag
    const suggestions = await this.prisma.material.findMany({
      where: {
        topicId: { in: weakTopics },
        OR: [
          { category: { contains: 'bridging', mode: 'insensitive' } },
          { metadata: { path: ['tags'], array_contains: 'bridging' } },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        topic: { select: { name: true } },
      },
      take: 5,
    });

    this.logger.log(
      `Suggested ${suggestions.length} bridging materials for user ${userId} in course ${courseId}`,
    );

    return suggestions.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      topicName: s.topic?.name,
      reason: `Strengthen your knowledge in ${s.topic?.name}`,
    }));
  }
}
