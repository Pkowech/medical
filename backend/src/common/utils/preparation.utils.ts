import { RiskLevel } from '@prisma/client';

/**
 * Maps risk levels to recommended preparation steps
 */
export function getPreparationSteps(riskLevel: RiskLevel): string[] {
  switch (riskLevel) {
    case RiskLevel.high:
      return ['Review weak topics', 'Practice more questions'];
    case RiskLevel.medium:
      return ['Target medium topics'];
    case RiskLevel.low:
      return ['Proceed to next level'];
    default:
      return ['General review recommended'];
  }
}
