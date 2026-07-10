import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { QuestionBankService } from './question-bank.service';
import { QuizService } from './quiz.service';
import { Question, Quiz } from '@prisma/client';

export interface WeaknessChain {
  weakTopic: { id: string; name: string; pKnown: number };
  dependentTopics: Array<{ id: string; name: string; unitName: string }>;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

@Injectable()
export class QuizGenerationService {
  private readonly logger = new Logger(QuizGenerationService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private questionBankService: QuestionBankService,
    private quizService: QuizService,
  ) {}

  /**
   * Generates a custom quiz targeting specific weak topics
   * Input: WeaknessChain
   * Output: Quiz with targeted questions
   */
  async generateQuizForWeakness(
    userId: string,
    weaknessChain: WeaknessChain,
    questionCount: number = 5,
  ): Promise<Quiz> {
    const cacheKey = `auto-quiz:${userId}:${weaknessChain.weakTopic.id}`;

    try {
      // 1. Get questions for weak topic
      const questions = await this.selectTargetedQuestions(
        weaknessChain.weakTopic.id,
        questionCount,
        userId,
      );

      if (questions.length === 0) {
        throw new NotFoundException(
          `No questions found for topic ${weaknessChain.weakTopic.id}`,
        );
      }

      // 2. Create Quiz record with special tagging
      const quiz = await this.prisma.quiz.create({
        data: {
          title: `AI-Generated: ${weaknessChain.weakTopic.name}`,
          description: `Auto-generated quiz targeting weakness in ${weaknessChain.weakTopic.name}. Your mastery: ${(weaknessChain.weakTopic.pKnown * 100).toFixed(0)}%`,
          unitId: questions[0].unitId, // Get from first question's unit
          topicId: weaknessChain.weakTopic.id,
          questionCount: questions.length,
          timeLimit: 15 * questionCount, // 15 minutes per question
          createdBy: 'system-auto-generation',
          questions: {
            create: questions.map((q, index) => ({
              questionId: q.id,
              order: index,
            })),
          },
        },
        include: {
          questions: true,
        },
      });

      // 3. Cache it
      await this.redisService.set(cacheKey, JSON.stringify(quiz), 3600); // 1 hour

      this.logger.log(
        `Created auto-generated quiz ${quiz.id} for user ${userId} targeting weakness in ${weaknessChain.weakTopic.name}`,
      );

      return quiz;
    } catch (error) {
      this.logger.error(
        `Failed to generate quiz for weakness: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Select targeted questions for weak topic
   * Criteria:
   * - Topic match (topicId)
   * - Progressive difficulty (easy → hard)
   * - Avoid recent attempts
   */
  private async selectTargetedQuestions(
    topicId: string,
    count: number,
    userId: string,
  ): Promise<Question[]> {
    // 1. Get recently attempted question IDs (avoid duplicates)
    const recentAttempts = await this.prisma.userResponse.findMany({
      where: {
        userId,
        question: {
          topicIds: {
            has: topicId,
          },
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        questionId: true,
      },
      take: 100,
    });

    const recentQuestionIds = recentAttempts.map(r => r.questionId);

    // 2. Query for questions matching topic, not recently attempted
    const questions = await this.prisma.question.findMany({
      where: {
        topicIds: {
          has: topicId,
        },
        id: {
          notIn: recentQuestionIds,
        },
        isActive: true,
      },
      orderBy: [
        { difficulty: 'asc' }, // Easy to hard progression
        { averageScore: 'desc' }, // Higher quality questions first
      ],
      take: count,
    });

    // 3. If not enough questions, fall back to recent ones (but different ones)
    if (questions.length < count) {
      const fallbackQuestions = await this.prisma.question.findMany({
        where: {
          topicIds: {
            has: topicId,
          },
          isActive: true,
        },
        orderBy: [
          { successRate: 'desc' }, // Most successful questions
          { averageTime: 'asc' }, // Reasonable time commitment
        ],
        take: count - questions.length,
      });

      return [...questions, ...fallbackQuestions];
    }

    return questions;
  }
}
