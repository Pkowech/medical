import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AssessmentProgressService } from './assessment-progress.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { MasteryGateService } from '../../courses/services/mastery-gate.service';
import {
  DEFAULT_MASTERY_PASSING_THRESHOLD,
  type GateDecision,
} from '../../courses/types/mastery.types';
import {
  Option,
  Question,
  Quiz,
  QuizAttempt,
  UserActivityType,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QuizUtils } from '#common/utils/quiz.utils';
import {
  QuizAnswerDto,
  CreateQuizDto,
  UpdateQuizDto,
} from '#common/dto/assessment.dto';
import {
  ImportQuizDto,
  QuestionBankFilters,
} from '#common/dto/question-bank.dto';
import { QuestionBankService } from './question-bank.service';
import { FlashcardsService } from './flashcards.service';
import {
  AssessmentRecommendationService,
  QuizPerformanceRecommendations,
} from './assessment-recommendation.service';

import { GlobalSearchSyncService } from '../../../../infrastructure/search/services/global-search-sync.service';
import { MaxAttemptsExceededException } from '#common/exceptions/quiz.exception';
import { writeApplicationOutboxEvent } from '#infrastructure/outbox/application-outbox-event';

type PublicQuizQuestion = Omit<
  Question,
  'options' | 'explanation' | 'choices' | 'metadata'
> & {
  options: Array<Pick<Option, 'id' | 'text' | 'order'>>;
};

type AttemptQuestionSnapshotQuestion = {
  questionId: string;
  order: number;
  points: number;
  isRequired: boolean;
  question: Pick<Question, 'id' | 'text' | 'type' | 'points' | 'topicIds'> & {
    options: Array<Pick<Option, 'id' | 'text' | 'isCorrect' | 'order'>>;
  };
};

type AttemptQuestionSnapshot = {
  version: 1;
  quizId: string;
  passingScore: number | null;
  questions: AttemptQuestionSnapshotQuestion[];
};

const KNOWN_QUESTION_TYPES = new Set([
  'multiple_choice',
  'multiple_select',
  'true_false',
  'short_answer',
  'essay',
  'fill_in_blank',
  'matching',
  'ordering',
]);

const LEARNER_SUPPORTED_QUESTION_TYPES = new Set<Question['type']>([
  'multiple_choice',
  'multiple_select',
  'true_false',
]);

function assertLearnerSupportedQuestionTypes(
  questions: Array<{ type: Question['type'] }>,
): void {
  if (
    questions.some(({ type }) => !LEARNER_SUPPORTED_QUESTION_TYPES.has(type))
  ) {
    throw new BadRequestException(
      'Quizzes currently support multiple-choice, multiple-select, and true/false questions only',
    );
  }
}

type AttemptStartQuestion = Pick<
  Question,
  'id' | 'text' | 'type' | 'points' | 'topicIds'
> & {
  options: Array<Pick<Option, 'id' | 'text' | 'order'>>;
};

type StoredQuizAnswer = {
  questionId: string;
  selectedOption: unknown;
};

type QuizAttemptStartResult = {
  attemptId: string;
  startedAt: Date;
  completedAt: Date | null;
  questionIds: string[];
  questions?: AttemptStartQuestion[];
  answers: StoredQuizAnswer[];
  timeLimit: number | null;
  expiresAt: Date | null;
  showResults: boolean;
};

type QuizSubmissionResult =
  | (QuizAttempt & {
      resultsAvailable: true;
      recommendations?: QuizPerformanceRecommendations;
      recommendationsAvailable: boolean;
    })
  | {
      id: string;
      completedAt: Date | null;
      resultsAvailable: false;
    };

function parseAttemptQuestionSnapshot(value: unknown): AttemptQuestionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConflictException('Stored quiz question snapshot is invalid');
  }
  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.version !== 1 ||
    typeof snapshot.quizId !== 'string' ||
    (snapshot.passingScore !== null &&
      (typeof snapshot.passingScore !== 'number' ||
        !Number.isFinite(snapshot.passingScore) ||
        snapshot.passingScore < 0 ||
        snapshot.passingScore > 100)) ||
    !Array.isArray(snapshot.questions) ||
    snapshot.questions.length === 0
  ) {
    throw new ConflictException('Stored quiz question snapshot is invalid');
  }

  const questions = snapshot.questions.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ConflictException('Stored quiz question snapshot is invalid');
    }
    const item = entry as Record<string, unknown>;
    const question = item.question;
    if (
      typeof item.questionId !== 'string' ||
      typeof item.order !== 'number' ||
      !Number.isInteger(item.order) ||
      item.order < 0 ||
      typeof item.points !== 'number' ||
      !Number.isInteger(item.points) ||
      item.points < 0 ||
      typeof item.isRequired !== 'boolean' ||
      !question ||
      typeof question !== 'object' ||
      Array.isArray(question)
    ) {
      throw new ConflictException('Stored quiz question snapshot is invalid');
    }
    const questionData = question as Record<string, unknown>;
    if (
      questionData.id !== item.questionId ||
      typeof questionData.text !== 'string' ||
      typeof questionData.type !== 'string' ||
      !KNOWN_QUESTION_TYPES.has(questionData.type) ||
      typeof questionData.points !== 'number' ||
      !Array.isArray(questionData.topicIds) ||
      questionData.topicIds.some((topicId) => typeof topicId !== 'string') ||
      !Array.isArray(questionData.options)
    ) {
      throw new ConflictException('Stored quiz question snapshot is invalid');
    }
    const options = questionData.options.map((option) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) {
        throw new ConflictException('Stored quiz question snapshot is invalid');
      }
      const optionData = option as Record<string, unknown>;
      if (
        typeof optionData.id !== 'string' ||
        typeof optionData.text !== 'string' ||
        typeof optionData.isCorrect !== 'boolean' ||
        typeof optionData.order !== 'number' ||
        !Number.isInteger(optionData.order) ||
        optionData.order < 0
      ) {
        throw new ConflictException('Stored quiz question snapshot is invalid');
      }
      return {
        id: optionData.id,
        text: optionData.text,
        isCorrect: optionData.isCorrect,
        order: optionData.order,
      };
    });

    return {
      questionId: item.questionId,
      order: item.order,
      points: item.points,
      isRequired: item.isRequired,
      question: {
        id: questionData.id,
        text: questionData.text,
        type: questionData.type as Question['type'],
        points: questionData.points,
        topicIds: questionData.topicIds as string[],
        options,
      },
    };
  });

  if (
    new Set(questions.map((question) => question.questionId)).size !==
      questions.length ||
    new Set(questions.map((question) => question.order)).size !==
      questions.length ||
    questions.some(
      ({ question }) =>
        new Set(question.options.map((option) => option.id)).size !==
        question.options.length,
    )
  ) {
    throw new ConflictException('Stored quiz question snapshot is invalid');
  }
  return {
    version: 1,
    quizId: snapshot.quizId,
    passingScore: snapshot.passingScore as number | null,
    questions,
  };
}

function parseStoredQuizAnswers(value: unknown): StoredQuizAnswer[] {
  if (!Array.isArray(value)) {
    throw new ConflictException('Stored quiz answers are invalid');
  }

  const answers = value.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof (entry as Record<string, unknown>).questionId !== 'string' ||
      !('selectedOption' in (entry as Record<string, unknown>))
    ) {
      throw new ConflictException('Stored quiz answers are invalid');
    }
    const answer = entry as Record<string, unknown>;
    return {
      questionId: answer.questionId as string,
      selectedOption: answer.selectedOption,
    };
  });

  if (
    new Set(answers.map(({ questionId }) => questionId)).size !== answers.length
  ) {
    throw new ConflictException('Stored quiz answers are invalid');
  }
  return answers;
}

function isAttemptPastDeadline(
  startedAt: Date,
  timeLimit: number | null,
  now = new Date(),
): boolean {
  return (
    timeLimit !== null &&
    now.getTime() >= startedAt.getTime() + timeLimit * 60_000
  );
}

function canonicalizeOptionResponses(value: unknown): string {
  if (!Array.isArray(value)) {
    throw new ConflictException('Stored quiz responses are invalid');
  }

  const responses = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ConflictException('Stored quiz responses are invalid');
    }
    const response = entry as Record<string, unknown>;
    const selectedAnswers = response.selectedAnswers;
    if (
      typeof response.questionId !== 'string' ||
      !Array.isArray(selectedAnswers) ||
      selectedAnswers.some((answer) => typeof answer !== 'string')
    ) {
      throw new ConflictException('Stored quiz responses are invalid');
    }
    return {
      questionId: response.questionId,
      selectedAnswers: [...selectedAnswers].sort(),
    };
  });

  if (
    new Set(responses.map(({ questionId }) => questionId)).size !==
    responses.length
  ) {
    throw new ConflictException('Stored quiz responses are invalid');
  }
  return JSON.stringify(
    responses.sort((left, right) =>
      left.questionId.localeCompare(right.questionId),
    ),
  );
}

function canonicalizeQuizAnswers(value: unknown): string {
  if (!Array.isArray(value)) {
    throw new ConflictException('Stored quiz answers are invalid');
  }

  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) {
      return entry.map(normalize);
    }
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(
        Object.entries(entry)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return entry;
  };

  const answers = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ConflictException('Stored quiz answers are invalid');
    }
    const answer = entry as Record<string, unknown>;
    if (
      typeof answer.questionId !== 'string' ||
      !('selectedOption' in answer)
    ) {
      throw new ConflictException('Stored quiz answers are invalid');
    }
    return {
      questionId: answer.questionId,
      selectedOption: normalize(answer.selectedOption),
    };
  });

  if (
    new Set(answers.map(({ questionId }) => questionId)).size !== answers.length
  ) {
    throw new ConflictException('Stored quiz answers are invalid');
  }
  return JSON.stringify(
    answers.sort((left, right) =>
      left.questionId.localeCompare(right.questionId),
    ),
  );
}

@Injectable()
@ApiTags('quizzes')
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly progressService: AssessmentProgressService,
    private readonly analyticsService: AssessmentAnalyticsService,
    private readonly masteryGateService: MasteryGateService,
    private readonly questionBankService: QuestionBankService,
    private readonly searchSync: GlobalSearchSyncService,
    private readonly eventEmitter: EventEmitter2,
    private readonly flashcardsService: FlashcardsService,
    private readonly recommendationService: AssessmentRecommendationService,
  ) {}

  async importQuiz(data: ImportQuizDto, creatorId: string): Promise<Quiz> {
    let { courseId, unitId } = data;
    const { topicId } = data;
    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, courseId: true },
      });
      if (!unit) throw new NotFoundException(`Unit ${unitId} not found`);
      if (courseId && courseId !== unit.courseId) {
        throw new BadRequestException(
          'The selected unit does not belong to the course',
        );
      }
      courseId = unit.courseId;
    }

    if (topicId) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        select: {
          id: true,
          unitId: true,
          unit: { select: { courseId: true } },
        },
      });
      if (!topic) throw new NotFoundException(`Topic ${topicId} not found`);
      if (unitId && unitId !== topic.unitId) {
        throw new BadRequestException(
          'The selected topic does not belong to the unit',
        );
      }
      unitId = topic.unitId;
      courseId = topic.unit.courseId;
    }

    const preparedQuestions = data.questions.map((question) => {
      this.questionBankService.validateQuestionOptions(
        question.type,
        question.options,
      );
      return {
        ...question,
        courseId: question.courseId ?? courseId,
        unitId: question.unitId ?? unitId,
        topicIds: question.topicIds?.length
          ? question.topicIds
          : data.topicId
            ? [data.topicId]
            : [],
      };
    });
    if (data.isPublished) {
      assertLearnerSupportedQuestionTypes(preparedQuestions);
    }
    for (const question of preparedQuestions) {
      await this.questionBankService.validateCourseAndUnit(
        question.courseId,
        question.unitId,
      );
    }

    const topicIds = [...new Set(preparedQuestions.flatMap((q) => q.topicIds))];
    if (topicIds.length > 0) {
      const topics = await this.prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: {
          id: true,
          unitId: true,
          unit: { select: { courseId: true } },
        },
      });
      if (topics.length !== topicIds.length) {
        throw new BadRequestException(
          'One or more question topic IDs do not exist',
        );
      }
      const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
      for (const question of preparedQuestions) {
        for (const topicId of question.topicIds) {
          const topic = topicsById.get(topicId)!;
          if (question.unitId && topic.unitId !== question.unitId) {
            throw new BadRequestException(
              `Topic ${topicId} does not belong to question unit ${question.unitId}`,
            );
          }
          if (question.courseId && topic.unit.courseId !== question.courseId) {
            throw new BadRequestException(
              `Topic ${topicId} does not belong to question course ${question.courseId}`,
            );
          }
        }
      }
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const questionRecords: Array<{
        questionId: string;
        order: number;
        points: number;
      }> = [];
      for (const [index, question] of preparedQuestions.entries()) {
        const createdQuestion = await tx.question.create({
          data: {
            text: question.questionText,
            type: question.type,
            difficulty: question.difficulty,
            category: question.category,
            explanation: question.explanation,
            conceptsCovered: question.conceptsCovered ?? [],
            tags: question.tags ?? [],
            topicIds: question.topicIds,
            points: question.points ?? 1,
            courseId: question.courseId,
            unitId: question.unitId,
            difficultyIndex: QuizUtils.getDifficultyIndex(question.difficulty),
            createdBy: creatorId,
            isActive: true,
            options: {
              create: question.options.map((option, optionOrder) => ({
                text: option.text,
                isCorrect: option.isCorrect ?? false,
                order: optionOrder,
              })),
            },
          },
          select: { id: true },
        });
        questionRecords.push({
          questionId: createdQuestion.id,
          order: index + 1,
          points: question.points ?? 1,
        });
      }

      const createdQuiz = await tx.quiz.create({
        data: {
          title: data.title,
          description: data.description,
          unitId,
          topicId,
          passingScore: data.passingScore ?? 70,
          isPublished: data.isPublished ?? false,
          publishedAt: data.isPublished ? new Date() : null,
          createdBy: creatorId,
          questionCount: questionRecords.length,
          questions: { create: questionRecords },
        },
      });
      return createdQuiz;
    });

    await this.invalidateAssessmentCaches(
      [
        ...new Set(
          preparedQuestions
            .map((question) => question.unitId)
            .filter((id): id is string => Boolean(id)),
        ),
        ...(unitId ? [unitId] : []),
      ],
      [
        ...new Set(preparedQuestions.flatMap((question) => question.topicIds)),
        ...(topicId ? [topicId] : []),
      ],
    );
    await this.searchSync.syncEntity('quiz', quiz.id);
    return quiz;
  }

  private async invalidateAssessmentCaches(
    unitIds: string[] = [],
    topicIds: string[] = [],
    quizIds: string[] = [],
  ): Promise<void> {
    await Promise.all([
      this.redisService.delPattern('questions:*'),
      this.redisService.delPattern('adaptive_quiz_questions:*'),
      this.redisService.delPattern('quizzes:*'),
      this.redisService.delPattern('unit:*:questions:v2'),
      this.redisService.delPattern('unit:*:questions:v3:*'),
      this.redisService.delPattern('topic:*:questions:v2'),
      this.redisService.delPattern('topic:*:questions:v3:*'),
      ...unitIds.flatMap((unitId) => [
        this.redisService.del(`unit:${unitId}:questions:v2`),
        this.redisService.del(`unit_quiz:${unitId}`),
      ]),
      ...topicIds.map((topicId) =>
        this.redisService.del(`topic:${topicId}:questions:v2`),
      ),
      ...quizIds.map((quizId) => this.redisService.del(`quiz:${quizId}`)),
    ]);
  }

  private async assertPublishedUnit(unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        isPublished: true,
        course: { select: { status: true } },
      },
    });

    if (!unit || !unit.isPublished || unit.course.status !== 'published') {
      throw new NotFoundException(`Published unit ${unitId} not found`);
    }
  }

  private async getVisibleTopic(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        name: true,
        unitId: true,
        quizQuestionCount: true,
        unit: {
          select: {
            id: true,
            isPublished: true,
            course: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (
      !topic ||
      !topic.unit.isPublished ||
      topic.unit.course.status !== 'published'
    ) {
      throw new NotFoundException(`Published topic ${topicId} not found`);
    }

    return topic;
  }

  private getUnitQuestionsCacheKey(
    unitId: string,
    quizzes: Array<{
      id: string;
      isPublished: boolean;
      updatedAt: Date;
      availableFrom?: Date | null;
      availableUntil?: Date | null;
      expiresAt?: Date | null;
    }>,
  ): string {
    const version = quizzes
      .map(
        ({
          id,
          isPublished,
          updatedAt,
          availableFrom,
          availableUntil,
          expiresAt,
        }) =>
          `${id}:${isPublished ? 'published' : 'draft'}:${updatedAt.getTime()}:${availableFrom?.getTime() ?? 'null'}:${availableUntil?.getTime() ?? 'null'}:${expiresAt?.getTime() ?? 'null'}`,
      )
      .sort()
      .join('|');
    return `unit:${unitId}:questions:v4:${version || 'none'}`;
  }

  private getTopicQuestionsCacheKey(
    topicId: string,
    quizzes: Array<{
      id: string;
      isPublished: boolean;
      updatedAt: Date;
      availableFrom?: Date | null;
      availableUntil?: Date | null;
      expiresAt?: Date | null;
    }>,
  ): string {
    const version = quizzes
      .map(
        ({
          id,
          isPublished,
          updatedAt,
          availableFrom,
          availableUntil,
          expiresAt,
        }) =>
          `${id}:${isPublished ? 'published' : 'draft'}:${updatedAt.getTime()}:${availableFrom?.getTime() ?? 'null'}:${availableUntil?.getTime() ?? 'null'}:${expiresAt?.getTime() ?? 'null'}`,
      )
      .sort()
      .join('|');
    return `topic:${topicId}:questions:v4:${version || 'none'}`;
  }

  private isQuizParentPublished(quiz: {
    unitId: string | null;
    topicId: string | null;
    unit?: {
      isPublished: boolean;
      course: { status: string };
    } | null;
    topic?: {
      unit: { isPublished: boolean; course: { status: string } };
    } | null;
  }): boolean {
    if (
      quiz.unitId &&
      (!quiz.unit ||
        !quiz.unit.isPublished ||
        quiz.unit.course.status !== 'published')
    ) {
      return false;
    }
    if (
      quiz.topicId &&
      (!quiz.topic ||
        !quiz.topic.unit.isPublished ||
        quiz.topic.unit.course.status !== 'published')
    ) {
      return false;
    }
    return true;
  }

  private isQuizAvailable(
    quiz: {
      availableFrom?: Date | null;
      availableUntil?: Date | null;
      expiresAt?: Date | null;
    },
    now = new Date(),
  ): boolean {
    return (
      (!quiz.availableFrom || quiz.availableFrom <= now) &&
      (!quiz.availableUntil || quiz.availableUntil > now) &&
      (!quiz.expiresAt || quiz.expiresAt > now)
    );
  }

  private getPublicQuestionWhere(): Prisma.QuestionWhereInput {
    return {
      isActive: true,
      type: { in: [...LEARNER_SUPPORTED_QUESTION_TYPES] },
      AND: [
        {
          OR: [
            { unitId: null, courseId: null },
            { unitId: null, course: { is: { status: 'published' } } },
            {
              unit: {
                is: {
                  isPublished: true,
                  course: { is: { status: 'published' } },
                },
              },
            },
          ],
        },
        {
          OR: [
            { quizQuestions: { none: {} } },
            {
              quizQuestions: {
                some: { quiz: { is: { topicPracticeForId: { not: null } } } },
              },
            },
            {
              quizQuestions: {
                some: {
                  quiz: {
                    is: {
                      isPublished: true,
                      AND: [
                        {
                          OR: [
                            { unitId: null, topicId: null },
                            {
                              unit: {
                                is: {
                                  isPublished: true,
                                  course: { is: { status: 'published' } },
                                },
                              },
                            },
                            {
                              topic: {
                                is: {
                                  unit: {
                                    is: {
                                      isPublished: true,
                                      course: { is: { status: 'published' } },
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private async ensureTopicPracticeQuiz(
    tx: Prisma.TransactionClient,
    topic: { id: string; name: string; unitId: string },
    questions: Array<{ id: string; points: number }>,
  ): Promise<Quiz> {
    const existingQuiz = await tx.quiz.findUnique({
      where: { topicPracticeForId: topic.id },
      include: { _count: { select: { attempts: true } } },
    });
    if (existingQuiz && existingQuiz._count.attempts > 0) {
      return existingQuiz;
    }

    const quiz = await tx.quiz.upsert({
      where: { topicPracticeForId: topic.id },
      create: {
        title: `${topic.name} Practice Quiz`,
        description: `Practice questions for ${topic.name}`,
        topicId: topic.id,
        topicPracticeForId: topic.id,
        unitId: topic.unitId,
        createdBy: 'system-topic-practice',
        isPublished: true,
        publishedAt: new Date(),
        maxAttempts: null,
        passingScore: 70,
        questionCount: questions.length,
        questions: {
          create: questions.map((question, order) => ({
            questionId: question.id,
            order,
            points: question.points,
          })),
        },
      },
      update: {
        title: `${topic.name} Practice Quiz`,
        description: `Practice questions for ${topic.name}`,
        unitId: topic.unitId,
        questionCount: questions.length,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    const existingQuestions = await tx.quizQuestion.findMany({
      where: { quizId: quiz.id },
      select: { questionId: true },
    });
    const existingIds = existingQuestions.map(({ questionId }) => questionId);
    const expectedIds = questions.map(({ id }) => id);
    if (
      existingIds.length !== expectedIds.length ||
      existingIds.some((id, index) => id !== expectedIds[index])
    ) {
      await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
      await tx.quizQuestion.createMany({
        data: questions.map((question, order) => ({
          quizId: quiz.id,
          questionId: question.id,
          order,
          points: question.points,
        })),
      });
    }
    return quiz;
  }

  async getQuestionBank(filters: QuestionBankFilters) {
    return this.questionBankService.findQuestions({
      ...filters,
      page: Math.max(1, Number(filters.page) || 1),
      limit: Math.min(100, Math.max(1, Number(filters.limit) || 20)),
    });
  }

  private toPublicQuizQuestion(
    question: Question & {
      options: Array<Pick<Option, 'id' | 'text' | 'order'>>;
    },
  ): PublicQuizQuestion {
    const { options, explanation, choices, metadata, ...publicQuestion } =
      question;
    void explanation;
    void choices;
    void metadata;
    return {
      ...publicQuestion,
      options: options.map(({ id, text, order }) => ({ id, text, order })),
    };
  }

  async publishQuiz(quizId: string, creatorId: string): Promise<Quiz> {
    const { quiz, publishedQuiz } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM quizzes WHERE id = ${quizId} FOR UPDATE
      `;
        const currentQuiz = await tx.quiz.findUnique({ where: { id: quizId } });
        if (!currentQuiz)
          throw new NotFoundException(`Quiz ${quizId} not found`);
        if (currentQuiz.createdBy !== creatorId) {
          throw new BadRequestException(
            'Only the quiz creator can publish this quiz',
          );
        }
        const questionCount = await tx.quizQuestion.count({
          where: { quizId },
        });
        if (questionCount < 1) {
          throw new BadRequestException(
            'A quiz must contain at least one question before publishing',
          );
        }
        const questions = await tx.quizQuestion.findMany({
          where: { quizId },
          select: { question: { select: { type: true } } },
        });
        assertLearnerSupportedQuestionTypes(
          questions.map(({ question }) => question),
        );
        const published = await tx.quiz.update({
          where: { id: quizId },
          data: {
            isPublished: true,
            publishedAt: currentQuiz.publishedAt ?? new Date(),
            questionCount,
          },
        });
        return { quiz: currentQuiz, publishedQuiz: published };
      },
    );
    await this.invalidateAssessmentCaches(
      quiz.unitId ? [quiz.unitId] : [],
      quiz.topicId ? [quiz.topicId] : [],
      [quiz.id],
    );
    await this.searchSync.syncEntity('quiz', quizId);
    return publishedQuiz;
  }

  @ApiOperation({ summary: 'Create a new quiz' })
  @ApiResponse({ status: 201, description: 'Quiz created successfully' })
  async create(data: CreateQuizDto, creatorId: string): Promise<Quiz> {
    if (data.isPublished && !data.questions?.length) {
      throw new BadRequestException(
        'A quiz must contain at least one question before publishing',
      );
    }
    const cacheKey = `quiz:create:${JSON.stringify(data)}:${creatorId}`;
    const cachedQuiz = await this.redisService.get(cacheKey);
    if (cachedQuiz) {
      try {
        return JSON.parse(cachedQuiz);
      } catch {
        this.logger.warn(`Corrupt cache for quiz creation: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const createdQuiz = await tx.quiz.create({
        data: {
          title: data.title || 'Untitled Quiz',
          description: data.description,
          instructions: data.instructions,
          timeLimit: data.timeLimit,
          unitId: data.unitId,
          topicId: data.topicId,
          maxAttempts: data.maxAttempts ?? 3,
          passingScore: data.passingScore ?? 70,
          shuffleQuestions: data.shuffleQuestions ?? false,
          showResults: data.showResults ?? true,
          availableFrom: data.availableFrom
            ? new Date(data.availableFrom)
            : undefined,
          availableUntil: data.availableUntil
            ? new Date(data.availableUntil)
            : undefined,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          isPublished: data.isPublished || false,
          createdBy: creatorId,
        },
      });

      if (data.questions && data.questions.length > 0) {
        const questions = await tx.question.findMany({
          where: { id: { in: data.questions } },
          select: { id: true, points: true, type: true },
        });
        if (questions.length !== data.questions.length) {
          throw new BadRequestException(
            'One or more quiz questions could not be found',
          );
        }
        if (data.isPublished) {
          assertLearnerSupportedQuestionTypes(questions);
        }
        const pointsByQuestionId = new Map(
          questions.map(({ id: questionId, points }) => [questionId, points]),
        );
        await tx.quizQuestion.createMany({
          data: data.questions.map((qId, index) => ({
            quizId: createdQuiz.id,
            questionId: qId,
            order: index + 1,
            points: pointsByQuestionId.get(qId) ?? 1,
          })),
        });
      }

      return tx.quiz.findUnique({
        where: { id: createdQuiz.id },
        include: {
          questions: { include: { question: true } },
          unit: true,
        },
      });
    });

    if (!quiz) {
      throw new BadRequestException('Failed to create quiz');
    }

    await this.invalidateAssessmentCaches(
      quiz.unitId ? [quiz.unitId] : [],
      quiz.topicId ? [quiz.topicId] : [],
      [quiz.id],
    );
    await this.redisService.set(cacheKey, JSON.stringify(quiz), 24 * 60 * 60); // 1 day TTL
    this.logger.log(`Created quiz ${quiz.id} by user ${creatorId}`);

    // Sync to global search index
    await this.searchSync.syncEntity('quiz', quiz.id);

    return quiz;
  }

  @ApiOperation({ summary: 'Find quizzes with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of quizzes with pagination' })
  async findMany(
    pagination: { page?: number; limit?: number },
    filters?: {
      unitId?: string;
      topicId?: string;
      isPublished?: boolean;
      search?: string;
    },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const normalizedPagination = { page, limit };
    const cacheKey = `quizzes:${JSON.stringify({
      pagination: normalizedPagination,
      filters,
    })}`;
    const cachedResult = await this.redisService.get(cacheKey);
    if (cachedResult) {
      try {
        this.logger.log(
          `Retrieved cached quizzes for filters: ${JSON.stringify(filters)}`,
        );
        return JSON.parse(cachedResult);
      } catch {
        this.logger.warn(`Corrupt cache for quizzes list: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const skip = (page - 1) * limit;

    const whereConditions: Prisma.QuizWhereInput[] = [
      {
        OR: [
          { unitId: null },
          {
            unit: {
              is: {
                isPublished: true,
                course: { is: { status: 'published' } },
              },
            },
          },
        ],
      },
      {
        OR: [
          { topicId: null },
          {
            topic: {
              is: {
                unit: {
                  is: {
                    isPublished: true,
                    course: { is: { status: 'published' } },
                  },
                },
              },
            },
          },
        ],
      },
    ];
    const searchTerms = filters?.search?.trim().split(/\s+/).filter(Boolean);
    if (searchTerms?.length) {
      whereConditions.push(
        ...searchTerms.map((term) => {
          const containsTerm = { contains: term, mode: 'insensitive' as const };
          return {
            OR: [
              { title: containsTerm },
              { description: containsTerm },
              { category: { is: { name: containsTerm } } },
              {
                unit: {
                  is: {
                    OR: [
                      { name: containsTerm },
                      { title: containsTerm },
                      { description: containsTerm },
                    ],
                  },
                },
              },
              {
                unit: {
                  is: {
                    course: {
                      is: {
                        OR: [
                          { name: containsTerm },
                          { title: containsTerm },
                          { code: containsTerm },
                          { description: containsTerm },
                          {
                            category: {
                              is: { name: containsTerm },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
              {
                topic: {
                  is: {
                    OR: [{ name: containsTerm }, { description: containsTerm }],
                  },
                },
              },
            ],
          };
        }),
      );
    }
    const where: Prisma.QuizWhereInput = {
      AND: whereConditions,
      ...(filters?.unitId ? { unitId: filters.unitId } : {}),
      ...(filters?.topicId ? { topicId: filters.topicId } : {}),
      ...(filters?.isPublished !== undefined
        ? { isPublished: filters.isPublished }
        : {}),
    };

    const [quizzes, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          timeLimit: true,
          questionCount: true,
          isAdaptive: true,
          maxAttempts: true,
          passingScore: true,
          isPublished: true,
          createdAt: true,
          category: { select: { name: true } },
          unit: {
            select: {
              id: true,
              name: true,
              course: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: { attempts: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quiz.count({ where }),
    ]);

    const result = {
      data: quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(cacheKey, JSON.stringify(result), 1 * 60 * 60); // 1 hour TTL
    this.logger.log(
      `Fetched ${quizzes.length} quizzes with filters: ${JSON.stringify(filters)}`,
    );
    return result;
  }

  @ApiOperation({ summary: 'Find a quiz by ID' })
  @ApiResponse({ status: 200, description: 'Quiz details' })
  async findById(id: string, creatorId?: string): Promise<Quiz> {
    const cacheKey = `quiz:${id}`;
    const cachedQuiz = await this.redisService.get(cacheKey);
    if (cachedQuiz) {
      let cached: Quiz | null = null;
      try {
        cached = JSON.parse(cachedQuiz) as Quiz;
      } catch {
        this.logger.warn(`Corrupt cache for quiz ${id}`);
        await this.redisService.del(cacheKey);
      }
      if (cached) {
        this.logger.log(`Retrieved cached quiz ${id}`);
        if (creatorId && cached.createdBy !== creatorId) {
          throw new ForbiddenException(
            'Only the quiz creator can access this draft',
          );
        }
        return cached;
      }
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          where: { question: { isActive: true } },
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        unit: {
          include: {
            course: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!quiz) {
      this.logger.error(`Quiz ${id} not found`);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
    if (creatorId && quiz.createdBy !== creatorId) {
      throw new ForbiddenException(
        'Only the quiz creator can access this draft',
      );
    }

    await this.redisService.set(cacheKey, JSON.stringify(quiz), 1 * 60 * 60); // 1 hour TTL
    this.logger.log(`Fetched quiz ${id}`);
    return quiz;
  }

  @ApiOperation({ summary: 'Update a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz updated successfully' })
  async update(
    id: string,
    data: UpdateQuizDto,
    creatorId: string,
  ): Promise<Quiz> {
    const existingQuiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existingQuiz) {
      this.logger.error(`Quiz ${id} not found`);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    if (existingQuiz.createdBy !== creatorId) {
      this.logger.error(
        `User ${creatorId} not authorized to update quiz ${id}`,
      );
      throw new BadRequestException('Only the creator can update this quiz');
    }
    if (existingQuiz.isPublished && data.questions?.length === 0) {
      throw new BadRequestException(
        'A published quiz must contain at least one question',
      );
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM quizzes WHERE id = ${id} FOR UPDATE
      `;
      const attempts = await tx.quizAttempt.count({
        where: { quizId: id },
      });
      if (attempts > 0) {
        throw new ConflictException(
          'A quiz with recorded attempts is immutable; create a new quiz version instead',
        );
      }

      if (data.questions) {
        const questions = await tx.question.findMany({
          where: { id: { in: data.questions } },
          select: { id: true, points: true, type: true },
        });
        if (questions.length !== data.questions.length) {
          throw new BadRequestException(
            'One or more quiz questions could not be found',
          );
        }
        if (existingQuiz.isPublished) {
          assertLearnerSupportedQuestionTypes(questions);
        }
        const pointsByQuestionId = new Map(
          questions.map(({ id: questionId, points }) => [questionId, points]),
        );
        await tx.quizQuestion.deleteMany({ where: { quizId: id } });
        await tx.quizQuestion.createMany({
          data: data.questions.map((qId, index) => ({
            quizId: id,
            questionId: qId,
            order: index + 1,
            points: pointsByQuestionId.get(qId) ?? 1,
          })),
        });
      }

      return tx.quiz.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          instructions: data.instructions,
          timeLimit: data.timeLimit,
          maxAttempts: data.maxAttempts,
          passingScore: data.passingScore,
          shuffleQuestions: data.shuffleQuestions,
          showResults: data.showResults,
          availableFrom: data.availableFrom
            ? new Date(data.availableFrom)
            : undefined,
          availableUntil: data.availableUntil
            ? new Date(data.availableUntil)
            : undefined,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          questionCount: data.questions?.length,
        },
        include: {
          questions: { include: { question: true } },
          unit: true,
        },
      });
    });

    await this.invalidateAssessmentCaches(
      [existingQuiz.unitId, quiz.unitId].filter((unitId): unitId is string =>
        Boolean(unitId),
      ),
      [existingQuiz.topicId, quiz.topicId].filter(
        (topicId): topicId is string => Boolean(topicId),
      ),
      [id],
    );
    this.logger.log(`Updated quiz ${id} by user ${creatorId}`);

    // Sync to global search index
    await this.searchSync.syncEntity('quiz', quiz.id);

    return quiz;
  }

  @ApiOperation({ summary: 'Delete a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz deleted successfully' })
  async delete(id: string, creatorId: string): Promise<void> {
    const existingQuiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existingQuiz) {
      this.logger.error(`Quiz ${id} not found`);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    if (existingQuiz.createdBy !== creatorId) {
      this.logger.error(
        `User ${creatorId} not authorized to delete quiz ${id}`,
      );
      throw new BadRequestException('Only the creator can delete this quiz');
    }

    await this.prisma.$transaction(async (tx) => {
      const attemptCount = await tx.quizAttempt.count({
        where: { quizId: id },
      });
      if (attemptCount > 0) {
        throw new ConflictException(
          'A quiz with recorded attempts cannot be deleted',
        );
      }

      await tx.quizQuestion.deleteMany({ where: { quizId: id } });
      await tx.quiz.delete({ where: { id } });
    });

    await this.invalidateAssessmentCaches(
      existingQuiz.unitId ? [existingQuiz.unitId] : [],
      existingQuiz.topicId ? [existingQuiz.topicId] : [],
      [id],
    );
    this.logger.log(`Deleted quiz ${id} by user ${creatorId}`);
  }

  @ApiOperation({ summary: 'Get questions for a unit' })
  @ApiResponse({ status: 200, description: 'Questions retrieved successfully' })
  async getQuestionsByUnit(
    unitId: string,
    userId?: string,
  ): Promise<PublicQuizQuestion[]> {
    await this.assertPublishedUnit(unitId);

    const now = new Date();
    const optionInclude = {
      options: {
        select: { id: true, text: true, order: true },
        orderBy: { order: 'asc' as const },
      },
    };
    if (userId) {
      const activeAttempt = await this.prisma.quizAttempt.findFirst({
        where: {
          userId,
          completedAt: null,
          quiz: {
            is: {
              unitId,
              topicId: null,
              OR: [
                { isPublished: true },
                { autoGeneratedQuizzes: { some: { userId } } },
              ],
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        select: { quizId: true },
      });
      if (activeAttempt) {
        const activeQuiz = await this.prisma.quiz.findFirst({
          where: {
            id: activeAttempt.quizId,
            unit: {
              is: {
                isPublished: true,
                course: { is: { status: 'published' } },
              },
            },
          },
          include: {
            questions: {
              where: { question: this.getPublicQuestionWhere() },
              orderBy: { order: 'asc' },
              include: { question: { include: optionInclude } },
            },
          },
        });
        if (activeQuiz) {
          return activeQuiz.questions.map(({ question }) =>
            this.toPublicQuizQuestion(question),
          );
        }
      }
    }

    const quizVersions = await this.prisma.quiz.findMany({
      where: { unitId, topicId: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        isPublished: true,
        updatedAt: true,
        availableFrom: true,
        availableUntil: true,
        expiresAt: true,
      },
    });
    const publishedQuiz = quizVersions.find(
      (quiz) => quiz.isPublished && this.isQuizAvailable(quiz, now),
    );

    const cacheKey = this.getUnitQuestionsCacheKey(unitId, quizVersions);
    const cachedQuestions = await this.redisService.get(cacheKey);
    if (cachedQuestions) {
      try {
        this.logger.debug(`Retrieved cached questions for unit ${unitId}`);
        return JSON.parse(cachedQuestions);
      } catch {
        this.logger.warn(`Corrupt cache for unit ${unitId} questions`);
        await this.redisService.del(cacheKey);
      }
    }

    const questions: PublicQuizQuestion[] = publishedQuiz
      ? await this.prisma.quiz
          .findFirst({
            where: {
              unitId,
              topicId: null,
              isPublished: true,
              AND: [
                {
                  OR: [
                    { availableFrom: null },
                    { availableFrom: { lte: now } },
                  ],
                },
                {
                  OR: [
                    { availableUntil: null },
                    { availableUntil: { gt: now } },
                  ],
                },
                { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              ],
            },
            orderBy: { updatedAt: 'desc' },
            include: {
              questions: {
                where: { question: this.getPublicQuestionWhere() },
                orderBy: { order: 'asc' },
                include: { question: { include: optionInclude } },
              },
            },
          })
          .then((quiz) => {
            const questionList = quiz
              ? quiz.questions.map(({ question }) => question)
              : [];
            return questionList.map((question) =>
              this.toPublicQuizQuestion(question),
            );
          })
      : await this.prisma.question
          .findMany({
            where: {
              unitId,
              isActive: true,
              quizQuestions: { none: {} },
            },
            orderBy: { createdAt: 'desc' },
            include: optionInclude,
          })
          .then((items) =>
            items.map((question) => this.toPublicQuizQuestion(question)),
          );

    // Return an empty array when no questions exist for the unit instead of throwing
    // This allows callers (and tests) to handle empty quizzes gracefully.
    await this.redisService.set(cacheKey, JSON.stringify(questions), 3600);
    return questions;
  }

  async getQuestionsByAssessmentId(
    assessmentId: string,
    userId: string,
  ): Promise<PublicQuizQuestion[]> {
    const now = new Date();
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id: assessmentId,
        OR: [
          { isPublished: true },
          { autoGeneratedQuizzes: { some: { userId } } },
        ],
        AND: [
          { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
          { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      include: {
        unit: {
          select: {
            isPublished: true,
            course: { select: { status: true } },
          },
        },
        topic: {
          select: {
            unit: {
              select: {
                isPublished: true,
                course: { select: { status: true } },
              },
            },
          },
        },
        questions: {
          where: { question: this.getPublicQuestionWhere() },
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  select: { id: true, text: true, order: true },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(
        `Published assessment ${assessmentId} not found`,
      );
    }

    if (!this.isQuizParentPublished(quiz) || !this.isQuizAvailable(quiz, now)) {
      throw new NotFoundException(
        `Published assessment ${assessmentId} not found`,
      );
    }

    return quiz.questions.map(({ question }) =>
      this.toPublicQuizQuestion(question),
    );
  }

  @ApiOperation({ summary: 'Get questions for a topic' })
  @ApiResponse({
    status: 200,
    description: 'Topic questions retrieved successfully',
  })
  async getQuestionsByTopic(
    topicId: string,
    applyTopicQuestionLimit = true,
    attemptId?: string,
  ): Promise<PublicQuizQuestion[]> {
    const topic = await this.getVisibleTopic(topicId);
    if (
      attemptId !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        attemptId,
      )
    ) {
      throw new BadRequestException('A valid quiz attempt ID is required');
    }
    const now = new Date();
    const quizVersions = await this.prisma.quiz.findMany({
      where: {
        topicId,
        OR: [{ unitId: null }, { unitId: topic.unitId }],
      },
      select: {
        id: true,
        isPublished: true,
        updatedAt: true,
        availableFrom: true,
        availableUntil: true,
        expiresAt: true,
      },
    });
    const publishedQuizIds = quizVersions
      .filter((quiz) => quiz.isPublished && this.isQuizAvailable(quiz, now))
      .map((quiz) => quiz.id);
    const cacheKey = this.getTopicQuestionsCacheKey(topicId, quizVersions);
    const cachedQuestions = await this.redisService.get(cacheKey);
    if (cachedQuestions) {
      try {
        this.logger.debug(`Retrieved cached questions for topic ${topicId}`);
        const questions = JSON.parse(cachedQuestions) as PublicQuizQuestion[];
        return applyTopicQuestionLimit
          ? this.selectTopicQuizQuestions(
              topicId,
              questions,
              topic.quizQuestionCount,
              attemptId,
            )
          : questions;
      } catch {
        this.logger.warn(`Corrupt cache for topic ${topicId} questions`);
        await this.redisService.del(cacheKey);
      }
    }

    const optionInclude = {
      options: {
        select: { id: true, text: true, order: true },
        orderBy: { order: 'asc' as const },
      },
    };
    const [publishedQuizzes, standaloneQuestions] = await Promise.all([
      publishedQuizIds.length
        ? this.prisma.quiz.findMany({
            where: { id: { in: publishedQuizIds }, isPublished: true },
            include: {
              questions: {
                where: { question: this.getPublicQuestionWhere() },
                orderBy: { order: 'asc' },
                include: { question: { include: optionInclude } },
              },
            },
          })
        : Promise.resolve([]),
      this.prisma.question.findMany({
        where: {
          ...this.getPublicQuestionWhere(),
          topicIds: { has: topicId },
          quizQuestions: { none: {} },
        },
        orderBy: { createdAt: 'desc' },
        include: optionInclude,
      }),
    ]);

    const questionById = new Map<
      string,
      Question & { options: Array<Pick<Option, 'id' | 'text' | 'order'>> }
    >();
    for (const quiz of publishedQuizzes) {
      for (const { question } of quiz.questions) {
        questionById.set(question.id, question);
      }
    }
    for (const question of standaloneQuestions) {
      questionById.set(question.id, question);
    }
    const publicQuestions = Array.from(questionById.values())
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .map((question) => this.toPublicQuizQuestion(question));
    await this.redisService.set(
      cacheKey,
      JSON.stringify(publicQuestions),
      3600,
    );
    return applyTopicQuestionLimit
      ? this.selectTopicQuizQuestions(
          topicId,
          publicQuestions,
          topic.quizQuestionCount,
          attemptId,
        )
      : publicQuestions;
  }

  private selectTopicQuizQuestions(
    topicId: string,
    questions: PublicQuizQuestion[],
    questionCount: number,
    attemptId?: string,
  ): PublicQuizQuestion[] {
    const targetCount = Math.min(questionCount, questions.length);
    if (questions.length <= targetCount) return questions;
    if (attemptId) {
      return questions
        .map((question) => ({
          question,
          rank: createHash('sha256')
            .update(`${topicId}:${attemptId}:${question.id}`)
            .digest('hex'),
        }))
        .sort((left, right) => left.rank.localeCompare(right.rank))
        .slice(0, targetCount)
        .map(({ question }) => question);
    }
    const shuffled = [...questions];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled.slice(0, targetCount);
  }

  async startQuizAttempt(
    userId: string,
    quizOrUnitId: string,
    attemptId: string,
  ): Promise<QuizAttemptStartResult> {
    if (
      typeof attemptId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        attemptId,
      )
    ) {
      throw new BadRequestException('A valid quiz attempt ID is required');
    }

    const attemptInclude = {
      quiz: {
        select: {
          id: true,
          unitId: true,
          timeLimit: true,
          showResults: true,
        },
      },
      questionSnapshot: { select: { snapshot: true } },
    };
    const existingAttempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: attemptInclude,
    });
    if (existingAttempt) {
      return this.toQuizAttemptStart(
        existingAttempt,
        existingAttempt.quiz,
        userId,
        quizOrUnitId,
      );
    }

    const quizInclude = {
      questions: {
        where: { question: this.getPublicQuestionWhere() },
        orderBy: { order: 'asc' as const },
        select: {
          questionId: true,
          order: true,
          points: true,
          isRequired: true,
          question: {
            select: {
              id: true,
              text: true,
              type: true,
              points: true,
              topicIds: true,
              options: {
                select: { id: true, text: true, isCorrect: true, order: true },
                orderBy: { order: 'asc' as const },
              },
            },
          },
        },
      },
      unit: {
        select: {
          isPublished: true,
          course: { select: { status: true } },
        },
      },
      topic: {
        select: {
          unit: {
            select: {
              isPublished: true,
              course: { select: { status: true } },
            },
          },
        },
      },
    };
    const now = new Date();
    let quiz = await this.prisma.quiz.findFirst({
      where: {
        id: quizOrUnitId,
        OR: [
          { isPublished: true },
          { autoGeneratedQuizzes: { some: { userId } } },
        ],
      },
      include: quizInclude,
    });
    if (!quiz) {
      quiz = await this.prisma.quiz.findFirst({
        where: {
          unitId: quizOrUnitId,
          topicId: null,
          isPublished: true,
          AND: [
            { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
            { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        include: quizInclude,
      });
    }

    if (!quiz || !this.isQuizParentPublished(quiz)) {
      throw new NotFoundException('No published quiz is available');
    }
    if (
      (quiz.availableFrom && quiz.availableFrom > now) ||
      (quiz.availableUntil && quiz.availableUntil <= now) ||
      (quiz.expiresAt && quiz.expiresAt <= now)
    ) {
      throw new ConflictException(
        'This quiz is outside its availability window',
      );
    }
    if (quiz.questions.length === 0) {
      throw new NotFoundException(
        'The published quiz has no available questions',
      );
    }

    try {
      const attempt = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM quizzes WHERE id = ${quiz.id} FOR UPDATE
        `;
        const racedAttempt = await tx.quizAttempt.findUnique({
          where: { id: attemptId },
          include: attemptInclude,
        });
        if (racedAttempt) {
          return this.toQuizAttemptStart(
            racedAttempt,
            racedAttempt.quiz,
            userId,
            quizOrUnitId,
          );
        }

        const lockedQuiz = await tx.quiz.findUnique({
          where: { id: quiz.id },
          include: quizInclude,
        });
        const startedAt = new Date();
        const assignedToUser =
          lockedQuiz && !lockedQuiz.isPublished
            ? await tx.autoGeneratedQuiz.findFirst({
                where: { quizId: lockedQuiz.id, userId },
                select: { id: true },
              })
            : null;
        if (
          !lockedQuiz ||
          (!lockedQuiz.isPublished && !assignedToUser) ||
          !this.isQuizParentPublished(lockedQuiz) ||
          !this.isQuizAvailable(lockedQuiz, startedAt)
        ) {
          throw new ConflictException(
            'The quiz is no longer available to start',
          );
        }
        const questionsById = new Map(
          lockedQuiz.questions.map((quizQuestion) => [
            quizQuestion.questionId,
            quizQuestion,
          ]),
        );
        const questionIds = lockedQuiz.questions.map(
          ({ questionId }) => questionId,
        );
        if (questionIds.length === 0) {
          throw new ConflictException(
            'The quiz no longer has available questions',
          );
        }
        if (lockedQuiz.shuffleQuestions) {
          for (let index = questionIds.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [questionIds[index], questionIds[swapIndex]] = [
              questionIds[swapIndex],
              questionIds[index],
            ];
          }
        }
        const initialAnswers: StoredQuizAnswer[] = questionIds.map(
          (questionId) => ({ questionId, selectedOption: null }),
        );
        const existingAttempts = await tx.quizAttempt.count({
          where: { userId, quizId: lockedQuiz.id },
        });
        if (
          lockedQuiz.maxAttempts !== null &&
          existingAttempts >= lockedQuiz.maxAttempts
        ) {
          throw new MaxAttemptsExceededException(lockedQuiz.id);
        }

        const createdAttempt = await tx.quizAttempt.create({
          data: {
            id: attemptId,
            userId,
            quizId: lockedQuiz.id,
            startedAt,
            answers: initialAnswers as Prisma.InputJsonValue,
          },
        });
        const questionSnapshot: AttemptQuestionSnapshot = {
          version: 1,
          quizId: lockedQuiz.id,
          passingScore: lockedQuiz.passingScore,
          questions: questionIds.map((questionId, order) => {
            const quizQuestion = questionsById.get(questionId);
            if (!quizQuestion) {
              throw new ConflictException(
                'The quiz question set changed while the attempt was starting',
              );
            }
            return {
              questionId,
              order,
              points: quizQuestion.points,
              isRequired: quizQuestion.isRequired,
              question: quizQuestion.question,
            };
          }),
        };
        await tx.quizAttemptQuestionSnapshot.create({
          data: {
            attemptId: createdAttempt.id,
            snapshot: questionSnapshot as Prisma.InputJsonValue,
          },
        });
        return this.toQuizAttemptStart(
          {
            ...createdAttempt,
            questionSnapshot: { snapshot: questionSnapshot },
          },
          lockedQuiz,
          userId,
          quizOrUnitId,
        );
      });
      return attempt;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const committedAttempt = await this.prisma.quizAttempt.findUnique({
          where: { id: attemptId },
          include: attemptInclude,
        });
        if (committedAttempt) {
          return this.toQuizAttemptStart(
            committedAttempt,
            committedAttempt.quiz,
            userId,
            quizOrUnitId,
          );
        }
      }
      throw error;
    }
  }

  private toQuizAttemptStart(
    attempt: Pick<
      QuizAttempt,
      'id' | 'userId' | 'startedAt' | 'completedAt' | 'answers'
    > & { questionSnapshot?: { snapshot: Prisma.JsonValue } | null },
    quiz: {
      id: string;
      unitId: string | null;
      timeLimit: number | null;
      showResults: boolean;
    },
    userId: string,
    quizOrUnitId: string,
  ): QuizAttemptStartResult {
    if (
      attempt.userId !== userId ||
      (quiz.id !== quizOrUnitId && quiz.unitId !== quizOrUnitId)
    ) {
      throw new ConflictException(
        'This quiz attempt ID is already associated with another submission',
      );
    }

    const answers = parseStoredQuizAnswers(attempt.answers);
    const snapshot = attempt.questionSnapshot
      ? parseAttemptQuestionSnapshot(attempt.questionSnapshot.snapshot)
      : undefined;
    if (snapshot && snapshot.quizId !== quiz.id) {
      throw new ConflictException(
        'Stored quiz question snapshot does not match this quiz attempt',
      );
    }
    const expiresAt =
      quiz.timeLimit === null
        ? null
        : new Date(attempt.startedAt.getTime() + quiz.timeLimit * 60_000);
    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      questionIds: answers.map(({ questionId }) => questionId),
      ...(snapshot
        ? {
            questions: snapshot.questions
              .sort((left, right) => left.order - right.order)
              .map(({ question }) => ({
                id: question.id,
                text: question.text,
                type: question.type,
                points: question.points,
                topicIds: question.topicIds,
                options: question.options.map(({ id, text, order }) => ({
                  id,
                  text,
                  order,
                })),
              })),
          }
        : {}),
      answers,
      timeLimit: quiz.timeLimit,
      expiresAt,
      showResults: quiz.showResults,
    };
  }

  async saveQuizAttemptAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    selectedOption: string | string[],
  ): Promise<{ saved: true }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM quiz_attempts WHERE id = ${attemptId} FOR UPDATE
      `;
      const attempt = await tx.quizAttempt.findUnique({
        where: { id: attemptId },
        include: { quiz: { select: { timeLimit: true } } },
      });
      if (!attempt) {
        throw new NotFoundException(`Quiz attempt ${attemptId} not found`);
      }
      if (attempt.userId !== userId) {
        throw new ConflictException(
          'This quiz attempt belongs to another user',
        );
      }
      if (attempt.completedAt) {
        throw new ConflictException(
          'This quiz attempt has already been submitted',
        );
      }
      if (isAttemptPastDeadline(attempt.startedAt, attempt.quiz.timeLimit)) {
        throw new ConflictException('The quiz time limit has expired');
      }

      const answers = parseStoredQuizAnswers(attempt.answers);
      const answerToUpdate = answers.find(
        (answer) => answer.questionId === questionId,
      );
      if (!answerToUpdate) {
        throw new BadRequestException(
          'The question is not part of this quiz attempt',
        );
      }
      const selectedOptionIds = Array.isArray(selectedOption)
        ? selectedOption
        : [selectedOption];
      if (
        selectedOptionIds.length === 0 ||
        selectedOptionIds.some((id) => typeof id !== 'string' || !id) ||
        new Set(selectedOptionIds).size !== selectedOptionIds.length
      ) {
        throw new BadRequestException('The selected options are invalid');
      }

      const options = Array.isArray(selectedOption)
        ? await tx.option.findMany({
            where: {
              id: { in: selectedOptionIds },
              questionId,
            },
            select: { id: true },
          })
        : await tx.option
            .findFirst({
              where: {
                id: selectedOptionIds[0],
                questionId,
              },
              select: { id: true },
            })
            .then((option) => (option ? [option] : []));
      if (options.length !== selectedOptionIds.length) {
        throw new BadRequestException(
          'A selected option is not part of this question',
        );
      }

      answerToUpdate.selectedOption = Array.isArray(selectedOption)
        ? selectedOption
        : selectedOptionIds[0];
      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: { answers: answers as Prisma.InputJsonValue },
      });
      return { saved: true };
    });
  }

  @ApiOperation({ summary: 'Get quiz results for a user' })
  @ApiResponse({
    status: 200,
    description: 'Quiz results retrieved successfully',
  })
  async getUserQuizResults(
    userId: string,
    unitId: string,
  ): Promise<{
    totalQuizzes: number;
    completedQuizzes: number;
    averageScore: number | null;
    attempts: Array<
      | (Omit<QuizAttempt, 'feedback' | 'responses'> & {
          resultsAvailable: true;
        })
      | {
          id: string;
          quizId: string;
          startedAt: Date;
          completedAt: Date | null;
          timeTaken: number | null;
          createdAt: Date;
          resultsAvailable: false;
        }
    >;
  }> {
    const cacheKey = `quiz:results:v2:${userId}:${unitId}`;
    const cachedResults = await this.redisService.get(cacheKey);
    if (cachedResults) {
      try {
        return JSON.parse(cachedResults);
      } catch {
        this.logger.warn(`Corrupt cache for quiz results: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        quiz: { unitId },
      },
      orderBy: { completedAt: 'desc' },
      include: { quiz: { select: { showResults: true } } },
    });
    const visibleAttempts = attempts.filter(
      (attempt) => attempt.quiz.showResults && attempt.completedAt,
    );

    const results = {
      totalQuizzes: attempts.length,
      completedQuizzes: attempts.filter((a) => a.completedAt).length,
      averageScore: visibleAttempts.length
        ? visibleAttempts.reduce(
            (sum, attempt) => sum + attempt.percentage,
            0,
          ) / visibleAttempts.length
        : null,
      attempts: attempts.map(({ quiz, ...attempt }) =>
        quiz.showResults
          ? { ...attempt, resultsAvailable: true as const }
          : {
              id: attempt.id,
              quizId: attempt.quizId,
              startedAt: attempt.startedAt,
              completedAt: attempt.completedAt,
              timeTaken: attempt.timeTaken,
              createdAt: attempt.createdAt,
              resultsAvailable: false as const,
            },
      ),
    };

    await this.redisService.set(cacheKey, JSON.stringify(results), 3600);
    return results;
  }

  @ApiOperation({ summary: 'Submit a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz submitted successfully' })
  async submitQuiz(
    userId: string,
    unitId: string,
    attemptId: string,
    answers: QuizAnswerDto[],
  ): Promise<QuizSubmissionResult> {
    if (
      typeof attemptId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        attemptId,
      )
    ) {
      throw new BadRequestException('A valid quiz attempt ID is required');
    }
    if (!Array.isArray(answers)) {
      throw new BadRequestException('Quiz answers must be an array');
    }
    if (
      answers.some(
        (answer) =>
          !answer ||
          typeof answer.questionId !== 'string' ||
          !answer.questionId ||
          !('selectedOption' in answer) ||
          answer.selectedOption === undefined,
      )
    ) {
      throw new BadRequestException('Quiz answers contain an invalid response');
    }

    const existingAttempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: { select: { questionId: true, isCorrect: true } },
        questionSnapshot: { select: { snapshot: true } },
        quiz: {
          select: {
            id: true,
            topicId: true,
            unitId: true,
            showResults: true,
            timeLimit: true,
            unit: { select: { courseId: true } },
          },
        },
      },
    });
    let startedAttempt: NonNullable<typeof existingAttempt> | null = null;
    let storedAnswers: StoredQuizAnswer[] | null = null;
    let attemptSnapshot: AttemptQuestionSnapshot | undefined;
    if (existingAttempt) {
      if (
        existingAttempt.userId !== userId ||
        (existingAttempt.quiz.id !== unitId &&
          existingAttempt.quiz.unitId !== unitId)
      ) {
        throw new ConflictException(
          'This quiz attempt ID is already associated with another submission',
        );
      }

      storedAnswers = parseStoredQuizAnswers(existingAttempt.answers);
      if (existingAttempt.completedAt) {
        const submittedQuestionIds = answers.map((answer) => answer.questionId);
        const expectedQuestionIds = storedAnswers.map(
          ({ questionId }) => questionId,
        );
        if (
          new Set(submittedQuestionIds).size !== submittedQuestionIds.length ||
          submittedQuestionIds.some(
            (questionId) => !expectedQuestionIds.includes(questionId),
          )
        ) {
          throw new BadRequestException(
            'A quiz submission contains duplicate or unknown question answers',
          );
        }
        const answersByQuestionId = new Map(
          answers.map((answer) => [answer.questionId, answer]),
        );
        const normalizedAnswers = expectedQuestionIds.map(
          (questionId) =>
            answersByQuestionId.get(questionId) ?? {
              questionId,
              selectedOption: null,
            },
        );
        return this.replayQuizSubmission(
          existingAttempt,
          existingAttempt.quiz,
          userId,
          canonicalizeQuizAnswers(normalizedAnswers),
        );
      }

      startedAttempt = existingAttempt;
      attemptSnapshot = existingAttempt.questionSnapshot
        ? parseAttemptQuestionSnapshot(
            existingAttempt.questionSnapshot.snapshot,
          )
        : undefined;
      if (
        attemptSnapshot &&
        attemptSnapshot.quizId !== existingAttempt.quiz.id
      ) {
        throw new ConflictException(
          'Stored quiz question snapshot does not match this quiz attempt',
        );
      }
    }

    if (!startedAttempt || !storedAnswers) {
      throw new ConflictException(
        'Start a quiz attempt before submitting answers',
      );
    }

    const quizInclude = {
      questions: {
        where: { question: this.getPublicQuestionWhere() },
        include: {
          question: {
            include: { options: true },
          },
        },
      },
      unit: {
        select: {
          courseId: true,
          isPublished: true,
          course: { select: { status: true } },
        },
      },
      topic: {
        select: {
          unit: {
            select: {
              isPublished: true,
              course: { select: { status: true } },
            },
          },
        },
      },
    };
    const quizWhere: Prisma.QuizWhereInput = startedAttempt
      ? { id: startedAttempt.quiz.id }
      : {
          id: unitId,
          OR: [
            { isPublished: true },
            { autoGeneratedQuizzes: { some: { userId } } },
          ],
        };
    let quiz = await this.prisma.quiz.findFirst({
      where: quizWhere,
      include: quizInclude,
    });
    if (!quiz && !startedAttempt) {
      quiz = await this.prisma.quiz.findFirst({
        where: { unitId, topicId: null, isPublished: true },
        include: quizInclude,
      });
    }

    if (!quiz) {
      this.logger.warn(
        `No published quiz found for unit ${unitId} — submission rejected`,
      );
      throw new NotFoundException(
        `No published quiz found for unit ${unitId}. Please use the generate endpoint first.`,
      );
    }

    const activeQuiz = quiz;
    if (!startedAttempt && !this.isQuizParentPublished(activeQuiz)) {
      throw new NotFoundException(
        `No published quiz found for unit ${unitId}. Please use the generate endpoint first.`,
      );
    }
    if (!attemptSnapshot && activeQuiz.questions.length === 0) {
      throw new NotFoundException(
        `Published quiz ${activeQuiz.id} has no currently available questions.`,
      );
    }

    const submittedQuestionIds = answers.map((answer) => answer.questionId);
    const questionsForAttempt =
      attemptSnapshot?.questions ?? activeQuiz.questions;
    const expectedQuestionIds = questionsForAttempt.map(
      (quizQuestion) => quizQuestion.questionId,
    );
    const startedQuestionIds = storedAnswers.map(
      ({ questionId }) => questionId,
    );
    if (
      !attemptSnapshot &&
      (expectedQuestionIds.length !== startedQuestionIds.length ||
        expectedQuestionIds.some(
          (questionId) => !startedQuestionIds.includes(questionId),
        ))
    ) {
      throw new ConflictException(
        'The quiz content no longer matches this attempt',
      );
    }
    if (
      new Set(submittedQuestionIds).size !== submittedQuestionIds.length ||
      submittedQuestionIds.some(
        (questionId) => !expectedQuestionIds.includes(questionId),
      )
    ) {
      throw new BadRequestException(
        'A quiz submission contains duplicate or unknown question answers',
      );
    }

    const answersByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer]),
    );
    const normalizedAnswers = expectedQuestionIds.map(
      (questionId) =>
        answersByQuestionId.get(questionId) ?? {
          questionId,
          selectedOption: null,
        },
    );
    const requestedAnswersKey = canonicalizeQuizAnswers(normalizedAnswers);
    if (canonicalizeQuizAnswers(storedAnswers) !== requestedAnswersKey) {
      throw new ConflictException(
        'Submitted answers do not match the saved attempt answers',
      );
    }

    const bktUpdates: Array<{ skillId: string; isCorrect: boolean }> = [];
    const reviewAnswersByTopic = new Map<
      string,
      Array<{ questionId: string; isCorrect: boolean }>
    >();

    let result: { attempt: QuizAttempt; alreadyCompleted?: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM quiz_attempts WHERE id = ${attemptId} FOR UPDATE
        `;
        const prelimAttempt = await tx.quizAttempt.findUnique({
          where: { id: attemptId },
        });
        if (
          !prelimAttempt ||
          prelimAttempt.userId !== userId ||
          prelimAttempt.quizId !== activeQuiz.id
        ) {
          throw new ConflictException(
            'This quiz attempt is not available for submission',
          );
        }
        if (prelimAttempt.completedAt) {
          return { attempt: prelimAttempt, alreadyCompleted: true };
        }
        if (
          canonicalizeQuizAnswers(prelimAttempt.answers) !== requestedAnswersKey
        ) {
          throw new ConflictException(
            'Submitted answers do not match the saved attempt answers',
          );
        }

        let correctAnswers = 0;
        const totalQuestions = questionsForAttempt.length;
        let totalPoints = 0;
        let earnedPoints = 0;

        for (const answer of normalizedAnswers) {
          const quizQuestion = questionsForAttempt.find(
            (q) => q.questionId === answer.questionId,
          );
          const question = quizQuestion?.question;
          if (!question) {
            this.logger.warn(
              `Question ${answer.questionId} not found for quiz ${activeQuiz.id}`,
            );
            continue;
          }

          const gradingResult = QuizUtils.gradeAnswer(
            question,
            answer.selectedOption,
          );
          const questionPoints = Math.max(1, quizQuestion.points);
          const partialCredit =
            gradingResult.partialCredit === undefined
              ? undefined
              : question.points > 0
                ? (gradingResult.partialCredit / question.points) *
                  questionPoints
                : 0;
          const responseScore = Math.min(
            questionPoints,
            Math.max(
              0,
              gradingResult.isCorrect ? questionPoints : (partialCredit ?? 0),
            ),
          );
          totalPoints += questionPoints;
          earnedPoints += responseScore;
          await tx.userResponse.create({
            data: {
              userId,
              questionId: answer.questionId,
              attemptId: prelimAttempt.id,
              answer: answer.selectedOption ?? Prisma.JsonNull,
              isCorrect: gradingResult.isCorrect,
              score: responseScore,
              createdAt: new Date(),
            },
          });

          if (gradingResult.isCorrect) {
            correctAnswers++;
          }

          const topicIds = activeQuiz.topicId
            ? question.topicIds.includes(activeQuiz.topicId)
              ? [activeQuiz.topicId]
              : []
            : question.topicIds;
          for (const topicId of topicIds) {
            const topicAnswers = reviewAnswersByTopic.get(topicId) ?? [];
            topicAnswers.push({
              questionId: question.id,
              isCorrect: gradingResult.isCorrect,
            });
            reviewAnswersByTopic.set(topicId, topicAnswers);
          }

          // Collect BKT update data — will be dispatched after transaction commits
          const skillId =
            (question as any).topicId ||
            (question as any).topic_ids?.[0] ||
            (question as any).topicIds?.[0] ||
            activeQuiz.topicId;
          if (skillId) {
            bktUpdates.push({ skillId, isCorrect: gradingResult.isCorrect });
          }
        }

        const scorePercentage = QuizUtils.calculatePointsPercentage(
          earnedPoints,
          totalPoints,
        );
        const passingScore = attemptSnapshot
          ? (attemptSnapshot.passingScore ?? 70)
          : (activeQuiz.passingScore ?? 70);
        const isPassed = scorePercentage >= passingScore;

        const attempt = await tx.quizAttempt.update({
          where: { id: prelimAttempt.id },
          data: {
            answers: JSON.parse(requestedAnswersKey) as Prisma.InputJsonValue,
            score: scorePercentage,
            maxScore: totalPoints,
            percentage: scorePercentage,
            isPassed,
            correctAnswers,
            totalQuestions,
            timeTaken: Math.min(
              Math.max(
                0,
                Math.floor(
                  (Date.now() - prelimAttempt.startedAt.getTime()) / 1000,
                ),
              ),
              activeQuiz.timeLimit === null
                ? 2_147_483_647
                : activeQuiz.timeLimit * 60,
            ),
            completedAt: new Date(),
          },
        });

        const completedAt = attempt.completedAt ?? new Date();
        await tx.userActivity.create({
          data: {
            userId,
            sourceKey: `quiz-attempt:${prelimAttempt.id}`,
            type: UserActivityType.QUIZ_ATTEMPT,
            description: `Completed quiz: ${activeQuiz.title}`,
            details: {
              quizAttemptId: prelimAttempt.id,
              quizId: activeQuiz.id,
              unitId: activeQuiz.unitId,
              score: scorePercentage,
              passed: isPassed,
              totalQuestions,
              correctAnswers,
            },
            createdAt: completedAt,
          },
        });

        if (isPassed && activeQuiz.unitId) {
          // REMOVE THIS LINE: await tx.unitProgress.upsert({...});
        }

        const autoQuizUpdate = await tx.autoGeneratedQuiz.updateMany({
          where: {
            userId,
            quizId: activeQuiz.id,
            completedAt: null,
          },
          data: { completedAt: new Date() },
        });

        const reviewAnswersByQuestion = new Map(
          [...reviewAnswersByTopic.values()]
            .flat()
            .map((answer) => [answer.questionId, answer]),
        );
        await writeApplicationOutboxEvent(tx, {
          eventType: 'quiz.submitted',
          aggregateId: prelimAttempt.id,
          dedupeKey: `quiz-submitted:${prelimAttempt.id}`,
          payload: {
            userId,
            quizId: activeQuiz.id,
            attemptId: prelimAttempt.id,
            topicId: activeQuiz.topicId,
            score: scorePercentage,
            isPassed,
            passingScore,
            bktUpdates: bktUpdates.map(({ skillId, isCorrect }) => ({
              skillId,
              isCorrect,
            })),
            reviewAnswers: [...reviewAnswersByQuestion.values()].map(
              ({ questionId, isCorrect }) => ({ questionId, isCorrect }),
            ),
          },
        });

        if (autoQuizUpdate.count === 1) {
          await writeApplicationOutboxEvent(tx, {
            eventType: 'auto-quiz.completed',
            aggregateId: prelimAttempt.id,
            dedupeKey: `auto-quiz-completed:${prelimAttempt.id}`,
            payload: {
              userId,
              quizId: activeQuiz.id,
              score: scorePercentage,
              maxScore: totalPoints,
              timestamp: new Date().toISOString(),
            },
          });
        }

        return { attempt, alreadyCompleted: false };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const committedAttempt = await this.prisma.quizAttempt.findUnique({
          where: { id: attemptId },
          include: {
            responses: {
              select: { questionId: true, isCorrect: true },
            },
          },
        });
        if (committedAttempt) {
          return this.replayQuizSubmission(
            committedAttempt,
            activeQuiz,
            userId,
            requestedAnswersKey,
          );
        }
      }
      throw error;
    }

    if (result.alreadyCompleted) {
      const completedAttempt = await this.prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
          responses: { select: { questionId: true, isCorrect: true } },
        },
      });
      if (!completedAttempt) {
        throw new NotFoundException(`Quiz attempt ${attemptId} not found`);
      }
      return this.replayQuizSubmission(
        completedAttempt,
        activeQuiz,
        userId,
        requestedAnswersKey,
      );
    }

    await Promise.all([
      this.redisService.del(`quiz:${activeQuiz.id}`),
      this.redisService.del(
        `quiz:results:v2:${userId}:${activeQuiz.unitId ?? ''}`,
      ),
    ]).catch((error) => {
      this.logger.warn(
        `Quiz ${activeQuiz.id} was submitted, but its cache could not be invalidated: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
    });
    this.logger.log(
      `Submitted quiz ${activeQuiz.id} for user ${userId} with score ${result.attempt.score}`,
    );

    let completedAttempt = result.attempt;
    let recommendations: QuizPerformanceRecommendations | undefined;
    try {
      recommendations = await this.recommendationService.recommendForAnswers(
        userId,
        {
          topicId: activeQuiz.topicId,
          unitId: activeQuiz.unitId,
          courseId: activeQuiz.unit?.courseId,
        },
        [...reviewAnswersByTopic.values()].flat(),
        attemptId,
      );

      const feedback = JSON.parse(
        JSON.stringify(recommendations),
      ) as Prisma.InputJsonValue;
      completedAttempt = await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: { feedback },
      });
    } catch (error) {
      this.logger.error(
        `Quiz attempt ${attemptId} was persisted, but recommendations could not be generated: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!activeQuiz.showResults) {
      return {
        id: completedAttempt.id,
        completedAt: completedAttempt.completedAt,
        resultsAvailable: false,
      };
    }

    return {
      ...completedAttempt,
      ...(recommendations ? { recommendations } : {}),
      recommendationsAvailable: recommendations !== undefined,
      resultsAvailable: true,
    };
  }

  private async replayQuizSubmission(
    attempt: QuizAttempt & {
      responses: Array<{ questionId: string; isCorrect: boolean }>;
      questionSnapshot?: { snapshot: Prisma.JsonValue } | null;
      quiz?: {
        id: string;
        topicId: string | null;
        unitId: string | null;
        showResults: boolean;
        unit?: { courseId: string } | null;
      };
    },
    quiz: {
      id: string;
      topicId: string | null;
      unitId: string | null;
      showResults: boolean;
      unit?: { courseId: string } | null;
    },
    userId: string,
    requestedAnswersKey: string,
  ): Promise<QuizSubmissionResult> {
    if (
      attempt.userId !== userId ||
      attempt.quizId !== quiz.id ||
      canonicalizeQuizAnswers(attempt.answers) !== requestedAnswersKey
    ) {
      throw new ConflictException(
        'This quiz attempt ID is already associated with another submission',
      );
    }

    if (!quiz.showResults) {
      return {
        id: attempt.id,
        completedAt: attempt.completedAt,
        resultsAvailable: false,
      };
    }

    const {
      responses,
      quiz: _quiz,
      questionSnapshot: _questionSnapshot,
      ...attemptResult
    } = attempt;
    void _quiz;
    void _questionSnapshot;
    const storedRecommendations = attempt.feedback;
    let recommendations: QuizPerformanceRecommendations | undefined;
    if (
      storedRecommendations &&
      typeof storedRecommendations === 'object' &&
      !Array.isArray(storedRecommendations)
    ) {
      recommendations = JSON.parse(
        JSON.stringify(storedRecommendations),
      ) as QuizPerformanceRecommendations;
    } else {
      try {
        recommendations = await this.recommendationService.recommendForAnswers(
          userId,
          {
            topicId: quiz.topicId,
            unitId: quiz.unitId,
            courseId: quiz.unit?.courseId,
          },
          responses.map(({ questionId, isCorrect }) => ({
            questionId,
            isCorrect,
          })),
          attempt.id,
        );
        const feedback = JSON.parse(
          JSON.stringify(recommendations),
        ) as Prisma.InputJsonValue;
        await this.prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { feedback },
        });
      } catch (error) {
        this.logger.error(
          `Quiz attempt ${attempt.id} was persisted, but recommendations could not be generated: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      ...attemptResult,
      ...(recommendations ? { recommendations } : {}),
      recommendationsAvailable: recommendations !== undefined,
      resultsAvailable: true,
    };
  }

  @ApiOperation({ summary: 'Get progress for a topic quiz' })
  async getTopicQuizProgress(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true },
    });
    if (!topic)
      throw new NotFoundException(`Topic with ID ${topicId} not found`);

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        quiz: { topicId },
      },
      select: {
        percentage: true,
        isPassed: true,
        completedAt: true,
        quiz: { select: { showResults: true } },
      },
      orderBy: { completedAt: 'desc' },
    });
    const visibleAttempts = attempts.filter(
      (attempt) => attempt.quiz.showResults,
    );
    const scores = visibleAttempts.map((attempt) => attempt.percentage);
    return {
      topicId,
      totalAttempts: attempts.length,
      resultsAvailable: visibleAttempts.length > 0,
      latestScore: scores[0] ?? null,
      bestScore: scores.length ? Math.max(...scores) : null,
      averageScore: scores.length
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : null,
      ...(visibleAttempts.length
        ? { isPassed: visibleAttempts.some((attempt) => attempt.isPassed) }
        : {}),
      lastAttemptedAt: attempts[0]?.completedAt ?? null,
    };
  }

  async startTopicQuizAttempt(
    userId: string,
    topicId: string,
    attemptId: string,
  ): Promise<QuizAttemptStartResult> {
    if (
      typeof attemptId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        attemptId,
      )
    ) {
      throw new BadRequestException('A valid quiz attempt ID is required');
    }

    const topic = await this.getVisibleTopic(topicId);
    const getExistingAttempt = async () => {
      const attempt = await this.prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
          quiz: {
            select: { id: true, topicPracticeForId: true, showResults: true },
          },
        },
      });
      if (!attempt) return null;
      if (
        attempt.userId !== userId ||
        attempt.quiz.topicPracticeForId !== topicId
      ) {
        throw new ConflictException(
          'This quiz attempt ID is already associated with another submission',
        );
      }

      const answers = parseStoredQuizAnswers(attempt.answers);
      const availableQuestions = await this.getQuestionsByTopic(
        topicId,
        false,
      );
      const questionById = new Map(
        availableQuestions.map((question) => [question.id, question]),
      );
      const questions = answers.map((answer) => {
        const question = questionById.get(answer.questionId);
        if (!question) {
          throw new ConflictException(
            'The active topic quiz question set has changed. Restart the quiz.',
          );
        }
        return question;
      });

      return {
        attemptId: attempt.id,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        questionIds: answers.map(({ questionId }) => questionId),
        questions,
        answers,
        timeLimit: null,
        expiresAt: null,
        showResults: attempt.quiz.showResults,
      } satisfies QuizAttemptStartResult;
    };

    const existingAttempt = await getExistingAttempt();
    if (existingAttempt) return existingAttempt;

    const questions = await this.getQuestionsByTopic(topicId, true, attemptId);
    if (questions.length === 0) {
      throw new NotFoundException('No published quiz questions are available');
    }
    const availableQuestions = await this.getQuestionsByTopic(topicId, false);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const quiz = await this.ensureTopicPracticeQuiz(
          tx,
          topic,
          availableQuestions,
        );
        const racedAttempt = await tx.quizAttempt.findUnique({
          where: { id: attemptId },
        });
        if (racedAttempt) {
          throw new ConflictException(
            'The quiz attempt was started concurrently. Retry to resume it.',
          );
        }

        const startedAt = new Date();
        const answers: StoredQuizAnswer[] = questions.map(({ id }) => ({
          questionId: id,
          selectedOption: null,
        }));
        const attempt = await tx.quizAttempt.create({
          data: {
            id: attemptId,
            userId,
            quizId: quiz.id,
            startedAt,
            answers: answers as Prisma.InputJsonValue,
          },
        });
        return {
          attemptId: attempt.id,
          startedAt,
          completedAt: null,
          questionIds: questions.map(({ id }) => id),
          questions,
          answers,
          timeLimit: null,
          expiresAt: null,
          showResults: quiz.showResults,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentAttempt = await getExistingAttempt();
        if (concurrentAttempt) return concurrentAttempt;
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Submit a topic-level quiz' })
  @ApiResponse({
    status: 200,
    description: 'Topic quiz submitted successfully',
  })
  async submitTopicQuiz(
    userId: string,
    topicId: string,
    attemptId: string | undefined,
    responses: Array<{ questionId: string; selectedAnswers: string[] }>,
  ): Promise<
    | { resultsAvailable: false }
    | {
        score: number;
        feedback: string;
        passed: boolean;
        masteryUnlocked: boolean;
        nextTopicUnlocked: boolean;
        nextTopicId?: string;
        gateDecision?: GateDecision;
        readinessPending?: boolean;
        reviewCardsScheduled: number;
        recommendations?: QuizPerformanceRecommendations;
        recommendationsAvailable: boolean;
        resultsAvailable: true;
      }
  > {
    try {
      if (
        !attemptId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          attemptId,
        )
      ) {
        throw new BadRequestException(
          'A valid X-Idempotency-Key is required for topic quiz submission',
        );
      }

      const topic = await this.getVisibleTopic(topicId);
      if (
        !Array.isArray(responses) ||
        responses.length === 0 ||
        responses.length > 100 ||
        responses.some((response) => !response || typeof response !== 'object')
      ) {
        throw new BadRequestException(
          'Topic quiz responses must contain 1–100 answer objects',
        );
      }

      const questionIds = responses.map((r) => r.questionId);
      if (
        questionIds.some((id) => typeof id !== 'string' || !id) ||
        new Set(questionIds).size !== questionIds.length
      ) {
        throw new BadRequestException(
          'Topic quiz responses contain invalid or duplicate question IDs',
        );
      }
      const availableQuestionSummaries = await this.getQuestionsByTopic(
        topicId,
        false,
      );
      const availableQuestionIds = availableQuestionSummaries.map(
        ({ id }) => id,
      );
      const expectedQuestionCount = Math.min(
        topic.quizQuestionCount,
        availableQuestionIds.length,
      );
      if (
        questionIds.length !== expectedQuestionCount ||
        questionIds.some((id) => !availableQuestionIds.includes(id))
      ) {
        throw new BadRequestException(
          `This topic quiz requires exactly ${expectedQuestionCount} current question responses`,
        );
      }

      const fetchedQuestions = await this.prisma.question.findMany({
        where: {
          ...this.getPublicQuestionWhere(),
          id: { in: availableQuestionIds },
        },
        include: { options: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (fetchedQuestions.length !== availableQuestionIds.length) {
        throw new BadRequestException(
          'Some topic quiz questions are no longer available',
        );
      }
      const selectedQuestionIds = new Set(questionIds);
      const selectedQuestions = fetchedQuestions.filter((question) =>
        selectedQuestionIds.has(question.id),
      );
      const graded = QuizUtils.gradeOptionQuiz(selectedQuestions, responses);
      const reviewAnswers = graded.responses.map(
        ({ questionId, isCorrect }) => ({
          questionId,
          isCorrect,
        }),
      );
      const requestedAnswerKey = canonicalizeOptionResponses(
        graded.responses.map((response) => ({
          questionId: response.questionId,
          selectedAnswers: response.selectedAnswers,
        })),
      );
      const scorePercentage = graded.percentage;
      const passed = scorePercentage >= DEFAULT_MASTERY_PASSING_THRESHOLD;
      let topicQuiz: {
        quiz: Pick<Quiz, 'id' | 'showResults'>;
        attemptId: string;
      };
      try {
        topicQuiz = await this.prisma.$transaction(async (tx) => {
          if (typeof tx.$queryRaw === 'function') {
            await tx.$queryRaw<Array<{ id: string }>>`
              SELECT id FROM quiz_attempts WHERE id = ${attemptId} FOR UPDATE
            `;
          }
          const quiz = await this.ensureTopicPracticeQuiz(
            tx,
            topic,
            fetchedQuestions,
          );
          const existingAttempt = await tx.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
              responses: { select: { questionId: true, answer: true } },
              quiz: { select: { topicPracticeForId: true } },
            },
          });
          if (existingAttempt) {
            if (
              existingAttempt.userId !== userId ||
              existingAttempt.quizId !== quiz.id ||
              existingAttempt.quiz.topicPracticeForId !== topicId
            ) {
              throw new ConflictException(
                'This topic quiz attempt ID is already associated with another submission',
              );
            }
            const existingAnswers = existingAttempt.completedAt
              ? canonicalizeOptionResponses(
                  existingAttempt.responses.map((response) => ({
                    questionId: response.questionId,
                    selectedAnswers: response.answer,
                  })),
                )
              : canonicalizeOptionResponses(
                  parseStoredQuizAnswers(existingAttempt.answers).map(
                    ({ questionId, selectedOption }) => ({
                      questionId,
                      selectedAnswers:
                        typeof selectedOption === 'string'
                          ? [selectedOption]
                          : Array.isArray(selectedOption)
                            ? selectedOption
                            : [],
                    }),
                  ),
                );
            if (existingAnswers !== requestedAnswerKey) {
              throw new ConflictException(
                'The submitted answers do not match the saved quiz attempt',
              );
            }
            if (existingAttempt.completedAt) {
              return { quiz, attemptId: existingAttempt.id };
            }

            const completedAt = new Date();
            await tx.quizAttempt.update({
              where: { id: existingAttempt.id },
              data: {
                completedAt,
                answers: parseStoredQuizAnswers(existingAttempt.answers)
                  .map((answer) => ({
                    questionId: answer.questionId,
                    selectedOption: answer.selectedOption,
                  })) as Prisma.InputJsonValue,
                score: scorePercentage,
                maxScore: graded.totalPoints,
                percentage: scorePercentage,
                correctAnswers: graded.correctAnswers,
                totalQuestions: selectedQuestions.length,
                isPassed: passed,
              },
            });
            await tx.userResponse.createMany({
              data: graded.responses.map((response) => ({
                userId,
                questionId: response.questionId,
                attemptId: existingAttempt.id,
                answer: response.selectedAnswers,
                isCorrect: response.isCorrect,
                score: response.earnedPoints,
              })),
            });
            await tx.userActivity.create({
              data: {
                userId,
                sourceKey: `quiz-attempt:${existingAttempt.id}`,
                type: UserActivityType.QUIZ_ATTEMPT,
                description: `Completed topic quiz: ${topicId}`,
                details: {
                  quizAttemptId: existingAttempt.id,
                  quizId: quiz.id,
                  topicId,
                  score: scorePercentage,
                  passed,
                  totalPoints: graded.totalPoints,
                },
                createdAt: completedAt,
              },
            });
            await writeApplicationOutboxEvent(tx, {
              eventType: 'quiz.submitted',
              aggregateId: existingAttempt.id,
              dedupeKey: `quiz-submitted:${existingAttempt.id}`,
              payload: {
                userId,
                quizId: quiz.id,
                attemptId: existingAttempt.id,
                topicId,
                score: scorePercentage,
                isPassed: passed,
                passingScore: DEFAULT_MASTERY_PASSING_THRESHOLD,
                bktUpdates: graded.responses.map(({ isCorrect }) => ({
                  skillId: topicId,
                  isCorrect,
                })),
                reviewAnswers,
              },
            });
            return { quiz, attemptId: existingAttempt.id };
          }

          const attempt = await tx.quizAttempt.create({
            data: {
              id: attemptId,
              userId,
              quizId: quiz.id,
              completedAt: new Date(),
              score: scorePercentage,
              maxScore: graded.totalPoints,
              percentage: scorePercentage,
              correctAnswers: graded.correctAnswers,
              totalQuestions: selectedQuestions.length,
              isPassed: passed,
            },
          });
          await tx.userResponse.createMany({
            data: graded.responses.map((response) => ({
              userId,
              questionId: response.questionId,
              attemptId: attempt.id,
              answer: response.selectedAnswers,
              isCorrect: response.isCorrect,
              score: response.earnedPoints,
            })),
          });
          await tx.userActivity.create({
            data: {
              userId,
              sourceKey: `quiz-attempt:${attempt.id}`,
              type: UserActivityType.QUIZ_ATTEMPT,
              description: `Completed topic quiz: ${topicId}`,
              details: {
                quizAttemptId: attempt.id,
                quizId: quiz.id,
                topicId,
                score: scorePercentage,
                passed,
                totalPoints: graded.totalPoints,
              },
              createdAt: attempt.completedAt ?? new Date(),
            },
          });
          await writeApplicationOutboxEvent(tx, {
            eventType: 'quiz.submitted',
            aggregateId: attempt.id,
            dedupeKey: `quiz-submitted:${attempt.id}`,
            payload: {
              userId,
              quizId: quiz.id,
              attemptId: attempt.id,
              topicId,
              score: scorePercentage,
              isPassed: passed,
              passingScore: DEFAULT_MASTERY_PASSING_THRESHOLD,
              bktUpdates: graded.responses.map(({ isCorrect }) => ({
                skillId: topicId,
                isCorrect,
              })),
              reviewAnswers,
            },
          });
          return { quiz, attemptId: attempt.id };
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }

        const concurrentAttempt = await this.prisma.quizAttempt.findUnique({
          where: { id: attemptId },
          include: {
            responses: { select: { questionId: true, answer: true } },
            quiz: { select: { topicPracticeForId: true, showResults: true } },
          },
        });
        if (!concurrentAttempt) throw error;
        const concurrentAnswers = canonicalizeOptionResponses(
          concurrentAttempt.responses.map((response) => ({
            questionId: response.questionId,
            selectedAnswers: response.answer,
          })),
        );
        if (
          concurrentAttempt.userId !== userId ||
          concurrentAttempt.quiz.topicPracticeForId !== topicId ||
          concurrentAnswers !== requestedAnswerKey
        ) {
          throw new ConflictException(
            'This topic quiz attempt ID is already associated with another submission',
          );
        }
        topicQuiz = {
          quiz: {
            id: concurrentAttempt.quizId,
            showResults: concurrentAttempt.quiz.showResults,
          },
          attemptId: concurrentAttempt.id,
        };
      }
      let recommendations: QuizPerformanceRecommendations | undefined;
      try {
        recommendations = await this.recommendationService.recommendForAnswers(
          userId,
          {
            topicId,
            unitId: topic.unitId,
            courseId: topic.unit.course.id,
          },
          reviewAnswers,
          topicQuiz.attemptId,
        );
      } catch (error) {
        this.logger.error(
          `Topic quiz attempt ${topicQuiz.attemptId} was persisted, but recommendations could not be generated: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      let reviewCardsScheduled = 0;
      try {
        reviewCardsScheduled =
          await this.flashcardsService.recordTopicQuizReviews(
            userId,
            topicId,
            reviewAnswers,
            topicQuiz.attemptId,
          );
      } catch (error) {
        this.logger.warn(
          `Topic quiz ${topicQuiz.quiz.id} was recorded, but its review cards could not be scheduled: ${String(error)}`,
        );
      }
      let readinessPending = false;
      try {
        for (const [index, response] of graded.responses.entries()) {
          await this.analyticsService.updateBktForAssessment(
            userId,
            topicId,
            response.isCorrect,
            `quiz-attempt:${topicQuiz.attemptId}:bkt:${index}`,
          );
        }
      } catch (error) {
        readinessPending = true;
        this.logger.warn(
          `Quiz attempt ${topicQuiz.attemptId} was saved, but its readiness estimate is still updating: ${String(error)}`,
        );
      }
      const mastery = await this.masteryGateService.onQuizComplete(
        userId,
        topicId,
        topicQuiz.attemptId,
      );

      if (!topicQuiz.quiz.showResults) {
        return { resultsAvailable: false };
      }

      return {
        score: scorePercentage,
        feedback: passed
          ? `Great job! You scored ${scorePercentage}%`
          : `You scored ${scorePercentage}%. Keep practicing!`,
        passed,
        masteryUnlocked: mastery.masteryUnlocked,
        nextTopicUnlocked: mastery.nextTopicUnlocked,
        nextTopicId: mastery.nextTopicId,
        gateDecision: readinessPending ? undefined : mastery.gateDecision,
        ...(readinessPending ? { readinessPending: true } : {}),
        reviewCardsScheduled,
        ...(recommendations ? { recommendations } : {}),
        recommendationsAvailable: recommendations !== undefined,
        resultsAvailable: true,
      };
    } catch (error) {
      this.logger.error(`Error submitting topic quiz: ${String(error)}`);
      throw error;
    }
  }

  async syncOfflinePracticeAttempt(
    userId: string,
    topicId: string,
    attemptId: string,
    responses: Array<{ questionId: string; selectedAnswers: string[] }>,
  ): Promise<{
    attemptId: string;
    score: number;
    validatedAt: Date;
    formative: true;
  }> {
    if (typeof attemptId !== 'string' || !attemptId.trim()) {
      throw new BadRequestException('An offline attempt ID is required');
    }
    if (
      !Array.isArray(responses) ||
      responses.length === 0 ||
      responses.length > 100
    ) {
      throw new BadRequestException(
        'Practice responses must contain 1–100 answers',
      );
    }
    if (
      responses.some(
        (response) =>
          !response || typeof response !== 'object' || Array.isArray(response),
      )
    ) {
      throw new BadRequestException('Practice responses must be objects');
    }

    const questionIds = responses.map((response) => response.questionId);
    if (
      questionIds.some(
        (questionId) => typeof questionId !== 'string' || !questionId,
      ) ||
      new Set(questionIds).size !== questionIds.length
    ) {
      throw new BadRequestException(
        'Practice responses contain invalid or duplicate question IDs',
      );
    }

    const topic = await this.getVisibleTopic(topicId);
    const availableQuestionSummaries = await this.getQuestionsByTopic(
      topicId,
      false,
    );
    const availableQuestionIds = availableQuestionSummaries.map(({ id }) => id);
    const expectedQuestionCount = Math.min(
      topic.quizQuestionCount,
      availableQuestionIds.length,
    );
    if (
      questionIds.length !== expectedQuestionCount ||
      questionIds.some(
        (questionId) => !availableQuestionIds.includes(questionId),
      )
    ) {
      throw new BadRequestException(
        `This topic practice attempt requires exactly ${expectedQuestionCount} current question responses`,
      );
    }

    const questions = await this.prisma.question.findMany({
      where: {
        ...this.getPublicQuestionWhere(),
        id: { in: availableQuestionIds },
      },
      include: { options: { select: { id: true, isCorrect: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (questions.length !== availableQuestionIds.length) {
      throw new BadRequestException(
        'Some topic practice questions are no longer available',
      );
    }

    const selectedQuestionIds = new Set(questionIds);
    const selectedQuestions = questions.filter((question) =>
      selectedQuestionIds.has(question.id),
    );
    const graded = QuizUtils.gradeOptionQuiz(selectedQuestions, responses);
    const normalizedResponses = graded.responses.map((response) => ({
      questionId: response.questionId,
      selectedAnswers: [...response.selectedAnswers].sort(),
    }));
    const score = graded.percentage;
    const usingTransaction =
      typeof this.prisma?.$transaction === 'function' &&
      typeof this.prisma?.offlinePracticeAttempt?.upsert === 'function';

    const attempt = await (usingTransaction
      ? this.prisma.$transaction(async (tx: any) => {
          const storedAttempt = await tx.offlinePracticeAttempt.upsert({
            where: { id: attemptId },
            create: {
              id: attemptId,
              userId,
              topicId,
              responses: normalizedResponses as Prisma.InputJsonValue,
              score,
            },
            update: {},
            select: {
              id: true,
              userId: true,
              topicId: true,
              responses: true,
              score: true,
              validatedAt: true,
            },
          });
          const storedAnswerKey = canonicalizeOptionResponses(
            storedAttempt.responses,
          );
          const requestedAnswerKey =
            canonicalizeOptionResponses(normalizedResponses);
          if (
            storedAttempt.userId !== userId ||
            storedAttempt.topicId !== topicId ||
            storedAnswerKey !== requestedAnswerKey
          ) {
            throw new ConflictException(
              'This offline attempt ID is already associated with another submission',
            );
          }

          const hasTopicQuizSupport =
            !!tx.quiz &&
            typeof tx.quiz.upsert === 'function' &&
            !!tx.quizQuestion &&
            typeof tx.quizQuestion.findMany === 'function';
          const topicQuiz = hasTopicQuizSupport
            ? await this.ensureTopicPracticeQuiz(
                tx,
                topic ?? { id: topicId, name: topicId, unitId: '' },
                questions,
              )
            : null;
          const existingQuizAttempt =
            tx.quizAttempt && typeof tx.quizAttempt.findUnique === 'function'
              ? await tx.quizAttempt.findUnique({
                  where: { id: attemptId },
                  include: {
                    responses: { select: { questionId: true, answer: true } },
                  },
                })
              : null;
          const isNewQuizAttempt = !existingQuizAttempt;
          if (existingQuizAttempt) {
            const existingAnswers = canonicalizeOptionResponses(
              existingQuizAttempt.responses.map((response: any) => ({
                questionId: response.questionId,
                selectedAnswers: response.answer,
              })),
            );
            if (
              existingQuizAttempt.userId !== userId ||
              (!topicQuiz && existingQuizAttempt.quizId !== undefined) ||
              (topicQuiz && existingQuizAttempt.quizId !== topicQuiz.id) ||
              existingAnswers !== requestedAnswerKey
            ) {
              throw new ConflictException(
                'This offline attempt ID is already associated with another quiz attempt',
              );
            }
          } else if (
            tx.quizAttempt &&
            typeof tx.quizAttempt.create === 'function' &&
            topicQuiz
          ) {
            await tx.quizAttempt.create({
              data: {
                id: attemptId,
                userId,
                quizId: topicQuiz.id,
                completedAt: storedAttempt.validatedAt,
                score,
                percentage: score,
                maxScore: graded.totalPoints,
                correctAnswers: graded.correctAnswers,
                totalQuestions: graded.responses.length,
                isPassed: score >= (topicQuiz.passingScore ?? 70),
              },
            });
            if (
              tx.userResponse &&
              typeof tx.userResponse.createMany === 'function'
            ) {
              await tx.userResponse.createMany({
                data: graded.responses.map((response) => ({
                  userId,
                  questionId: response.questionId,
                  attemptId,
                  answer: response.selectedAnswers,
                  isCorrect: response.isCorrect,
                  score: response.earnedPoints,
                })),
              });
            }
          }
          return { storedAttempt, topicQuiz, isNewQuizAttempt };
        })
      : (async () => {
          const storedAttempt = await this.prisma.offlinePracticeAttempt.upsert(
            {
              where: { id: attemptId },
              create: {
                id: attemptId,
                userId,
                topicId,
                responses: normalizedResponses,
                score,
              },
              update: {},
              select: {
                id: true,
                userId: true,
                topicId: true,
                responses: true,
                score: true,
                validatedAt: true,
              },
            },
          );
          const storedAnswerKey = canonicalizeOptionResponses(
            storedAttempt.responses,
          );
          const requestedAnswerKey =
            canonicalizeOptionResponses(normalizedResponses);
          if (
            storedAttempt.userId !== userId ||
            storedAttempt.topicId !== topicId ||
            storedAnswerKey !== requestedAnswerKey
          ) {
            throw new ConflictException(
              'This offline attempt ID is already associated with another submission',
            );
          }
          return {
            storedAttempt,
            topicQuiz: null,
            isNewQuizAttempt: false,
          };
        })());

    if (attempt.isNewQuizAttempt && attempt.topicQuiz) {
      await this.analyticsService.generateAnalytics(
        userId,
        attempt.topicQuiz.id,
      );
      for (const answer of graded.responses) {
        void this.analyticsService
          .updateBktForAssessment(userId, topicId, answer.isCorrect)
          .catch((error) =>
            this.logger.warn(
              `Could not update topic mastery for ${topicId}: ${String(error)}`,
            ),
          );
      }
      try {
        await this.flashcardsService.recordTopicQuizReviews(
          userId,
          topicId,
          graded.responses.map(({ questionId, isCorrect }) => ({
            questionId,
            isCorrect,
          })),
          attemptId,
        );
      } catch (error) {
        this.logger.warn(
          `Offline quiz ${attemptId} was recorded, but its review cards could not be scheduled: ${String(error)}`,
        );
      }
    }

    return {
      attemptId: attempt.storedAttempt.id,
      score: attempt.storedAttempt.score,
      validatedAt: attempt.storedAttempt.validatedAt,
      formative: true,
    };
  }

  /**
   * Automatically generate a quiz for a specific unit using available questions.
   * Merged from UnitQuizService.
   */
  @ApiOperation({ summary: 'Generate a quiz for a unit' })
  async generateUnitQuiz(unitId: string, creatorId: string): Promise<Quiz> {
    await this.assertPublishedUnit(unitId);

    const cacheKey = `unit_quiz:${unitId}`;
    const cachedQuiz = await this.redisService.get(cacheKey);
    if (cachedQuiz) {
      try {
        this.logger.log(`Retrieved cached unit quiz for unit ${unitId}`);
        return JSON.parse(cachedQuiz);
      } catch {
        this.logger.warn(`Corrupt cache for unit quiz: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { course: true },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    const questions = await this.questionBankService.findQuestions({
      unitId,
      limit: 10,
    });

    if (questions.questions.length < 5) {
      throw new BadRequestException(
        `Not enough questions available for unit ${unitId} (found ${questions.questions.length}, need at least 5)`,
      );
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const createdQuiz = await tx.quiz.create({
        data: {
          title: `Unit Quiz for ${unit.title}`,
          description: `Automatically generated quiz for ${unit.title}`,
          unitId,
          maxAttempts: 3,
          passingScore: 70,
          isPublished: true,
          createdBy: creatorId,
          questionCount: questions.questions.length,
        },
      });

      await tx.quizQuestion.createMany({
        data: questions.questions.map((q: any, index: number) => ({
          quizId: createdQuiz.id,
          questionId: q.id,
          order: index + 1,
          points: q.points ?? 1,
        })),
      });

      return createdQuiz;
    });

    if (!quiz) {
      throw new BadRequestException('Failed to generate unit quiz');
    }

    await this.invalidateAssessmentCaches([unitId], [], [quiz.id]);
    await this.redisService.set(cacheKey, JSON.stringify(quiz), 3600);

    // Sync to global search index
    await this.searchSync.syncEntity('quiz', quiz.id);

    return quiz;
  }
}
