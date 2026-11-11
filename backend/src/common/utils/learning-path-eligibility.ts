import { normalizeCareerStage } from '#common/constants/career-stages';

export type LearningPathEligibilityDecision = {
  eligible: boolean;
  eligibilityType: 'ELIGIBLE' | 'INELIGIBLE';
  reasons: string[];
  restrictions: string[];
};

export function evaluateLearningPathEligibility(
  targetCareerStages: readonly string[] | null | undefined,
  learnerCareerStage: string | null | undefined,
): LearningPathEligibilityDecision {
  const careerStage = normalizeCareerStage(learnerCareerStage);
  if (!careerStage) {
    return {
      eligible: false,
      eligibilityType: 'INELIGIBLE',
      reasons: ['CAREER_STAGE_REQUIRED'],
      restrictions: [],
    };
  }

  const eligibleStages = (targetCareerStages ?? [])
    .map(stage => normalizeCareerStage(stage))
    .filter((stage): stage is NonNullable<typeof stage> => stage !== null);

  if (eligibleStages.length === 0) {
    return {
      eligible: false,
      eligibilityType: 'INELIGIBLE',
      reasons: ['AUDIENCE_UNSPECIFIED'],
      restrictions: [],
    };
  }

  if (!eligibleStages.includes(careerStage)) {
    return {
      eligible: false,
      eligibilityType: 'INELIGIBLE',
      reasons: ['CAREER_STAGE_MISMATCH'],
      restrictions: [],
    };
  }

  return {
    eligible: true,
    eligibilityType: 'ELIGIBLE',
    reasons: [],
    restrictions: [],
  };
}
