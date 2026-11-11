import { BadRequestException, Injectable } from '@nestjs/common';
import { LearningPath } from '@prisma/client';
import {
  evaluateLearningPathEligibility,
  LearningPathEligibilityDecision,
} from '#common/utils/learning-path-eligibility';

@Injectable()
export class LearningPathEligibilityService {
  evaluate(
    path: Pick<LearningPath, 'targetCareerStages'>,
    learner: { careerStage?: string | null },
  ): LearningPathEligibilityDecision {
    return evaluateLearningPathEligibility(
      path.targetCareerStages,
      learner.careerStage,
    );
  }

  assertEligible(
    path: Pick<LearningPath, 'targetCareerStages'>,
    learner: { careerStage?: string | null },
  ): void {
    const decision = this.evaluate(path, learner);
    if (!decision.eligible) {
      throw new BadRequestException({
        message: 'Learning path is not eligible for this learner',
        eligibility: decision,
      });
    }
  }
}
