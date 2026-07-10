export type ReadinessSignal = 'SAFE' | 'BORDERLINE' | 'NOT_READY';

export interface MasteryStatus {
  userId: string;
  topicId: string;
  masteryUnlocked: boolean;
  failedAttempts: number;
  isEligibleForNextTopic: boolean;
  readinessSignal: ReadinessSignal;
}

export interface QuizCompletionResult {
  topicId: string;
  masteryUnlocked: boolean;
  failedAttempts: number;
  nextTopicUnlocked: boolean;
  nextTopicId?: string;
  message: string;
}
