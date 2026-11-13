export type ReadinessSignal = 'SAFE' | 'BORDERLINE' | 'NOT_READY';

export const TOPIC_MASTERY_PASSING_SCORE = 70;

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
  gateDecision?: GateDecision;
}

export interface GateDecision {
  canProceed: boolean;
  reason: string;
  pKnown: number;
  recommendations?: string[];
  explanation?: string[];
  supportOptions?: Array<{
    type: 'bridging_material' | 'study_group' | 'office_hours' | 'tutor';
    label: string;
    link?: string;
    description: string;
  }>;
}
