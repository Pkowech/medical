// config/assessment.config.ts (Fixed)
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuestionDifficulty } from '@prisma/client';

@Injectable()
export class AssessmentConfigService {
  constructor(private configService: ConfigService) {}

  get passingScore(): number {
    return this.configService.get('ASSESSMENT_PASSING_SCORE', 70);
  }

  get maxAttempts(): number {
    return this.configService.get('ASSESSMENT_MAX_ATTEMPTS', 3);
  }

  get targetPrecision(): number {
    return this.configService.get('ASSESSMENT_TARGET_PRECISION', 0.3);
  }

  get recentDays(): number {
    return this.configService.get('ASSESSMENT_RECENT_DAYS', 7);
  }

  get sessionTimeout(): number {
    return this.configService.get('ASSESSMENT_SESSION_TIMEOUT', 30 * 60 * 1000); // 30 minutes
  }

  get initialConfidenceInterval(): number {
    return this.configService.get('ASSESSMENT_INITIAL_CONFIDENCE', 2.0);
  }

  get minQuestions(): number {
    return this.configService.get('ASSESSMENT_MIN_QUESTIONS', 5);
  }

  get maxQuestions(): number {
    return this.configService.get('ASSESSMENT_MAX_QUESTIONS', 20);
  }

  // Fixed: Use lowercase enum values for camelCase consistency
  get difficultyWeights(): Record<QuestionDifficulty, number> {
    return {
      [QuestionDifficulty.easy]: this.configService.get(
        'assessmentWeight_EASY',
        1,
      ),
      [QuestionDifficulty.medium]: this.configService.get(
        'assessmentWeight_MEDIUM',
        2,
      ),
      [QuestionDifficulty.hard]: this.configService.get(
        'assessmentWeight_HARD',
        3,
      ),
    };
  }

  get flashcardInitialEaseFactor(): number {
    return this.configService.get('FLASHCARD_INITIAL_EASE', 2.5);
  }

  get flashcardIntervals(): number[] {
    return this.configService.get('FLASHCARD_INTERVALS', [1, 6, 14, 30, 90]);
  }

  get questionCacheTTL(): number {
    return this.configService.get('QUESTION_CACHE_TTL', 3600); // 1 hour default
  }

  // Additional utility methods
  getDifficultyWeight(difficulty: QuestionDifficulty): number {
    return this.difficultyWeights[difficulty] || 1;
  }

  isValidAttemptCount(attempts: number): boolean {
    return attempts >= 0 && attempts <= this.maxAttempts;
  }

  isPassingScore(score: number): boolean {
    return score >= this.passingScore;
  }

  getNextFlashcardInterval(
    currentInterval: number,
    performance: number,
  ): number {
    const intervals = this.flashcardIntervals;
    const currentIndex = intervals.indexOf(currentInterval);

    if (performance >= 0.8) {
      // Good performance - advance to next interval
      return currentIndex < intervals.length - 1
        ? intervals[currentIndex + 1]
        : intervals[intervals.length - 1] * 2;
    } else if (performance < 0.6) {
      // Poor performance - go back to first interval
      return intervals[0];
    } else {
      // Moderate performance - stay at current interval
      return currentInterval;
    }
  }

  validateAssessmentSettings(settings: {
    minQuestions?: number;
    maxQuestions?: number;
    passingScore?: number;
    maxAttempts?: number;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.minQuestions !== undefined && settings.minQuestions < 1) {
      errors.push('Minimum questions must be at least 1');
    }

    if (settings.maxQuestions !== undefined && settings.maxQuestions < 1) {
      errors.push('Maximum questions must be at least 1');
    }

    if (
      settings.minQuestions !== undefined &&
      settings.maxQuestions !== undefined
    ) {
      if (settings.minQuestions > settings.maxQuestions) {
        errors.push('Minimum questions cannot exceed maximum questions');
      }
    }

    if (settings.passingScore !== undefined) {
      if (settings.passingScore < 0 || settings.passingScore > 100) {
        errors.push('Passing score must be between 0 and 100');
      }
    }

    if (settings.maxAttempts !== undefined && settings.maxAttempts < 1) {
      errors.push('Maximum attempts must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
