import { Prisma, PrismaClient, UserActivityType } from '@prisma/client';

type QuizAttemptSource = {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  completedAt: Date;
  score: number;
  percentage: number;
  correctAnswers: number;
  totalQuestions: number;
};

type FlashcardResultSource = {
  id: string;
  userId: string;
  flashcardId: string;
  attemptedAt: Date;
  passed: boolean;
};

type BackfillSource =
  | { kind: 'quiz'; record: QuizAttemptSource }
  | { kind: 'flashcard'; record: FlashcardResultSource };

type ExistingActivity = {
  userId: string;
  sourceKey: string | null;
  type: UserActivityType;
  details: Prisma.JsonValue | null;
  createdAt: Date;
};

function detailsRecord(
  details: Prisma.JsonValue | null,
): Prisma.JsonObject | undefined {
  return details && typeof details === 'object' && !Array.isArray(details)
    ? details
    : undefined;
}

function correlatedLegacyActivity(
  source: BackfillSource,
  activities: ExistingActivity[],
): boolean {
  const { record } = source;
  const sourceKey =
    source.kind === 'quiz'
      ? `quiz-attempt:${record.id}`
      : `flashcard-result:${record.id}`;
  const activityType =
    source.kind === 'quiz'
      ? UserActivityType.QUIZ_ATTEMPT
      : UserActivityType.FLASHCARD_REVIEW;
  const records = activities.filter(
    activity => activity.userId === record.userId && activity.type === activityType,
  );

  if (records.some(activity => activity.sourceKey === sourceKey)) return true;

  const hasMatchingSourceId = records.some(activity => {
    const details = detailsRecord(activity.details);
    if (!details) return false;
    const sourceId =
      source.kind === 'quiz'
        ? (details.quizAttemptId ?? details.attemptId)
        : (details.flashcardResultId ?? details.sourceId);
    return sourceId === record.id;
  });
  if (hasMatchingSourceId) return true;

  return records.some(activity => {
    const details = detailsRecord(activity.details);
    const hasSourceId = source.kind === 'quiz'
      ? typeof details?.quizAttemptId === 'string' ||
        typeof details?.attemptId === 'string'
      : typeof details?.flashcardResultId === 'string' ||
        typeof details?.sourceId === 'string';
    return (
      !hasSourceId &&
      Math.abs(activity.createdAt.getTime() - recordTime(source).getTime()) <=
        5_000
    );
  });
}

function recordTime(source: BackfillSource): Date {
  return source.kind === 'quiz'
    ? source.record.completedAt
    : source.record.attemptedAt;
}

function toActivity(
  source: BackfillSource,
): Prisma.UserActivityCreateManyInput {
  if (source.kind === 'quiz') {
    const attempt = source.record;
    return {
      userId: attempt.userId,
      sourceKey: `quiz-attempt:${attempt.id}`,
      type: UserActivityType.QUIZ_ATTEMPT,
      description: `Completed quiz: ${attempt.quizTitle}`,
      details: {
        sourceType: 'quiz_attempt',
        sourceId: attempt.id,
        quizAttemptId: attempt.id,
        quizId: attempt.quizId,
        score: attempt.score,
        percentage: attempt.percentage,
        correctAnswers: attempt.correctAnswers,
        totalQuestions: attempt.totalQuestions,
        occurredAt: attempt.completedAt.toISOString(),
      },
      createdAt: attempt.completedAt,
    };
  }

  const result = source.record;
  return {
    userId: result.userId,
    sourceKey: `flashcard-result:${result.id}`,
    type: UserActivityType.FLASHCARD_REVIEW,
    description: 'Reviewed a flashcard',
    details: {
      sourceType: 'flashcard_result',
      sourceId: result.id,
      flashcardResultId: result.id,
      flashcardId: result.flashcardId,
      passed: result.passed,
      occurredAt: result.attemptedAt.toISOString(),
    },
    createdAt: result.attemptedAt,
  };
}

export function planLearningActivityBackfill(
  sources: BackfillSource[],
  existingActivities: ExistingActivity[],
): { activities: Prisma.UserActivityCreateManyInput[]; ambiguousSkipped: number } {
  const activities: Prisma.UserActivityCreateManyInput[] = [];
  let ambiguousSkipped = 0;

  for (const source of sources) {
    const existing = existingActivities.filter(
      activity => activity.userId === source.record.userId,
    );
    const activityType =
      source.kind === 'quiz'
        ? UserActivityType.QUIZ_ATTEMPT
        : UserActivityType.FLASHCARD_REVIEW;
    if (correlatedLegacyActivity(source, existing)) {
      const sourceKey =
        source.kind === 'quiz'
          ? `quiz-attempt:${source.record.id}`
          : `flashcard-result:${source.record.id}`;
      const hasStrongCorrelation = existing.some(activity => {
        if (activity.type !== activityType) return false;
        const details = detailsRecord(activity.details);
        const legacySourceId =
          source.kind === 'quiz'
            ? (details?.quizAttemptId ?? details?.attemptId)
            : (details?.flashcardResultId ?? details?.sourceId);
        return (
          activity.sourceKey === sourceKey || legacySourceId === source.record.id
        );
      });
      if (!hasStrongCorrelation) ambiguousSkipped += 1;
      continue;
    }
    activities.push(toActivity(source));
  }

  return { activities, ambiguousSkipped };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  if (apply && process.argv.includes('--dry-run')) {
    throw new Error('Choose either --apply or --dry-run, not both.');
  }

  const prisma = new PrismaClient();
  const totals = {
    quizAttemptsScanned: 0,
    flashcardResultsScanned: 0,
    activitiesPlanned: 0,
    activitiesInserted: 0,
    ambiguousLegacyMatchesSkipped: 0,
  };

  async function processBatch(sources: BackfillSource[]): Promise<void> {
    if (sources.length === 0) return;
    const userIds = [...new Set(sources.map(source => source.record.userId))];
    const activities = await prisma.userActivity.findMany({
      where: {
        userId: { in: userIds },
        type: {
          in: [
            UserActivityType.QUIZ_ATTEMPT,
            UserActivityType.FLASHCARD_REVIEW,
          ],
        },
      },
      select: {
        userId: true,
        sourceKey: true,
        type: true,
        details: true,
        createdAt: true,
      },
    });
    const plan = planLearningActivityBackfill(sources, activities);
    totals.activitiesPlanned += plan.activities.length;
    totals.ambiguousLegacyMatchesSkipped += plan.ambiguousSkipped;
    if (apply && plan.activities.length > 0) {
      const inserted = await prisma.userActivity.createMany({
        data: plan.activities,
        skipDuplicates: true,
      });
      totals.activitiesInserted += inserted.count;
    }
  }

  try {
    let lastQuizAttemptId: string | undefined;
    while (true) {
      const attempts = await prisma.quizAttempt.findMany({
        where: {
          completedAt: { not: null },
          ...(lastQuizAttemptId ? { id: { gt: lastQuizAttemptId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: 500,
        select: {
          id: true,
          userId: true,
          quizId: true,
          completedAt: true,
          score: true,
          percentage: true,
          correctAnswers: true,
          totalQuestions: true,
          quiz: { select: { title: true } },
        },
      });
      if (attempts.length === 0) break;
      lastQuizAttemptId = attempts[attempts.length - 1].id;
      const sources: BackfillSource[] = attempts.flatMap(attempt =>
        attempt.completedAt
          ? [{
              kind: 'quiz' as const,
              record: {
                id: attempt.id,
                userId: attempt.userId,
                quizId: attempt.quizId,
                quizTitle: attempt.quiz.title,
                completedAt: attempt.completedAt,
                score: attempt.score,
                percentage: attempt.percentage,
                correctAnswers: attempt.correctAnswers,
                totalQuestions: attempt.totalQuestions,
              },
            }]
          : [],
      );
      totals.quizAttemptsScanned += sources.length;
      await processBatch(sources);
    }

    let lastFlashcardResultId: string | undefined;
    while (true) {
      const results = await prisma.flashcardResult.findMany({
        where: lastFlashcardResultId
          ? { id: { gt: lastFlashcardResultId } }
          : {},
        orderBy: { id: 'asc' },
        take: 500,
        select: {
          id: true,
          userId: true,
          flashcardId: true,
          passed: true,
          attemptedAt: true,
        },
      });
      if (results.length === 0) break;
      lastFlashcardResultId = results[results.length - 1].id;
      const sources: BackfillSource[] = results.map(result => ({
        kind: 'flashcard',
        record: result,
      }));
      totals.flashcardResultsScanned += sources.length;
      await processBatch(sources);
    }

    console.info(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...totals }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('backfill-learning-activities')) {
  main().catch(error => {
    console.error('Learning activity backfill failed:', error);
    process.exitCode = 1;
  });
}
