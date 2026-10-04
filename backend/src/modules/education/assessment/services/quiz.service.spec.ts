import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AssessmentProgressService } from './assessment-progress.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { MasteryGateService } from '../../courses/services/mastery-gate.service';
import { QuestionBankService } from './question-bank.service';
import { GlobalSearchSyncService } from '../../../../infrastructure/search/services/global-search-sync.service';
import { QuizService } from './quiz.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('QuizService offline practice sync', () => {
  const userId = 'student-1';
  const topicId = 'topic-1';
  const attemptId = 'attempt-1';
  const questions = [
    {
      id: 'question-1',
      points: 1,
      options: [
        { id: 'option-correct', isCorrect: true },
        { id: 'option-wrong', isCorrect: false },
      ],
    },
    {
      id: 'question-2',
      points: 1,
      options: [{ id: 'option-2-correct', isCorrect: true }],
    },
  ];

  let service: QuizService;
  let prisma: {
    question: { findMany: jest.Mock };
    offlinePracticeAttempt: { upsert: jest.Mock };
  };
  let masteryGate: { onQuizComplete: jest.Mock };

  beforeEach(() => {
    prisma = {
      question: { findMany: jest.fn().mockResolvedValue(questions) },
      offlinePracticeAttempt: { upsert: jest.fn() },
    };
    masteryGate = { onQuizComplete: jest.fn() };
    service = new QuizService(
      prisma as unknown as PrismaService,
      {} as RedisService,
      {} as AssessmentProgressService,
      {} as AssessmentAnalyticsService,
      masteryGate as unknown as MasteryGateService,
      {} as QuestionBankService,
      {} as GlobalSearchSyncService,
      {} as EventEmitter2,
    );
  });

  it('validates and idempotently stores a formative score without unlocking mastery', async () => {
    const responses = [
      { questionId: 'question-1', selectedAnswers: ['option-correct'] },
      { questionId: 'question-2', selectedAnswers: ['option-2-correct'] },
    ];
    const validatedAt = new Date();
    prisma.offlinePracticeAttempt.upsert.mockResolvedValue({
      id: attemptId,
      userId,
      topicId,
      responses,
      score: 100,
      validatedAt,
    });

    const result = await service.syncOfflinePracticeAttempt(userId, topicId, attemptId, responses);

    expect(result).toEqual({ attemptId, score: 100, validatedAt, formative: true });
    expect(prisma.offlinePracticeAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attemptId },
        create: expect.objectContaining({ userId, topicId, score: 100 }),
        update: {},
      }),
    );
    expect(masteryGate.onQuizComplete).not.toHaveBeenCalled();
  });

  it('rejects incomplete attempts and selections outside the question', async () => {
    await expect(
      service.syncOfflinePracticeAttempt(userId, topicId, attemptId, [
        { questionId: 'question-1', selectedAnswers: ['option-correct'] },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.offlinePracticeAttempt.upsert).not.toHaveBeenCalled();

    await expect(
      service.syncOfflinePracticeAttempt(userId, topicId, attemptId, [
        { questionId: 'question-1', selectedAnswers: ['not-an-option'] },
        { questionId: 'question-2', selectedAnswers: ['option-2-correct'] },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.offlinePracticeAttempt.upsert).not.toHaveBeenCalled();
  });

  it('rejects reuse of an attempt ID for another user or answer set', async () => {
    prisma.offlinePracticeAttempt.upsert.mockResolvedValue({
      id: attemptId,
      userId: 'another-student',
      topicId,
      responses: [
        { questionId: 'question-1', selectedAnswers: ['option-correct'] },
        { questionId: 'question-2', selectedAnswers: ['option-2-correct'] },
      ],
      score: 100,
      validatedAt: new Date(),
    });

    await expect(
      service.syncOfflinePracticeAttempt(userId, topicId, attemptId, [
        { questionId: 'question-1', selectedAnswers: ['option-correct'] },
        { questionId: 'question-2', selectedAnswers: ['option-2-correct'] },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
