export type ReadinessSignal = 'SAFE' | 'BORDERLINE' | 'NOT_READY';

export const DEFAULT_MASTERY_PASSING_THRESHOLD = 70;
const BORDERLINE_READINESS_THRESHOLD = 50;

export function getReadinessSignal(score: number): ReadinessSignal {
  if (score >= DEFAULT_MASTERY_PASSING_THRESHOLD) return 'SAFE';
  if (score >= BORDERLINE_READINESS_THRESHOLD) return 'BORDERLINE';
  return 'NOT_READY';
}

export interface MasteryStatus {
  userId: string;
  topicId: string;
  masteryUnlocked: boolean;
  failedAttempts: number;
  isEligibleForNextTopic: boolean;
  readinessSignal: ReadinessSignal;
}

export interface GateDecision {
  canProceed: boolean;
  reason: string;
  pKnown: number;
  recommendations?: string[];
  supportOptions?: Array<{
    type: 'bridging_material' | 'study_group' | 'office_hours' | 'tutor';
    label: string;
    link?: string;
    description: string;
  }>;
  explanation?: string[];
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
