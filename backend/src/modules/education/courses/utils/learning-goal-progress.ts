import { ProgressEntryType } from '@prisma/client';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

export interface GoalProgressScope {
  courseId?: string;
  topicId?: string;
}

export interface ScopedLearningGoal {
  courseId?: string | null;
  topicId?: string | null;
  metadata?: unknown;
}

export function goalMatchesProgressScope(
  goal: ScopedLearningGoal,
  scope: GoalProgressScope,
): boolean {
  const metadata = asRecord(goal.metadata);
  const goalCourseId =
    goal.courseId ??
    (typeof metadata.courseId === 'string' ? metadata.courseId : undefined);
  const goalTopicId =
    goal.topicId ??
    (typeof metadata.topicId === 'string' ? metadata.topicId : undefined);

  return (
    (!goalCourseId || goalCourseId === scope.courseId) &&
    (!goalTopicId || goalTopicId === scope.topicId)
  );
}

export function goalAllowsProgressEntry(
  metadataValue: unknown,
  entryType: ProgressEntryType,
  isInternalEntry = false,
): boolean {
  if (isInternalEntry) return true;

  const tracking = asRecord(asRecord(metadataValue).progressTracking);
  if (entryType === ProgressEntryType.automatic) {
    return tracking.autoTracking === true;
  }
  return (
    entryType === ProgressEntryType.manual && tracking.manualUpdates !== false
  );
}

export function getGoalTargetCriteria(metadataValue: unknown): JsonRecord {
  return asRecord(asRecord(metadataValue).targetCriteria);
}
