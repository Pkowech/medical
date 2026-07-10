export interface AssessmentProgress {
  assessmentId?: string;
  quizId?: string;
  questionsCompleted: number;
  totalQuestions: number;
  timeSpent: number;
  currentQuestion?: number;
  remainingTime?: number;
}

export interface AssessmentProgressSummary {
  userId: string;
  assessmentId?: string;
  progressPercentage: number;
  totalAttempts: number;
  bestScore?: number;
}

export default {};
