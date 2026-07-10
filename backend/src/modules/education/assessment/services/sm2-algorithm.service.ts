/**
 * SM-2 Algorithm Service
 *
 * Canonical implementation of the SuperMemo 2 (SM-2) spaced repetition algorithm.
 * This service provides the core calculation logic used across the application
 * for flashcard and spaced repetition scheduling.
 *
 * Reference: https://www.supermemo.com/en/algorithms/sm2
 *
 * Core formula:
 * - EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
 *   where EF' is the new ease factor, EF is the old ease factor, and q is the quality rating
 * - Interval is calculated based on repetitions and ease factor
 */

import { BadRequestException, Injectable } from '@nestjs/common';

export interface SM2Card {
  easeFactor: number; // Ease factor (default 2.5)
  interval: number; // Days until next review
  repetitions: number; // Number of successful repetitions
  correctStreak: number; // Consecutive correct responses
  lastReviewDate?: Date; // Last review date
  nextReviewDate: Date; // Next scheduled review date
}

export interface SM2ReviewResult {
  updated: SM2Card;
  nextReviewDate: Date;
  intervalDays: number;
}

@Injectable()
export class SM2AlgorithmService {
  /**
   * Minimum allowed ease factor (prevents ease factor from becoming too low)
   */
  private readonly MIN_EASE_FACTOR = 1.3;

  /**
   * Default initial ease factor for new cards
   */
  private readonly DEFAULT_INITIAL_EASE = 2.5;

  /**
   * Standard interval progression for SM-2
   * Used when starting a new card or resetting after failure
   */
  private readonly INTERVAL_STEPS = [1, 6]; // First interval: 1 day, Second interval: 6 days

  /**
   * Validate quality rating
   * @param quality - Rating from 0-5 (0=complete blackout, 5=perfect response)
   * @throws BadRequestException if quality is not in valid range
   */
  private validateQuality(quality: number): void {
    if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
      throw new BadRequestException(
        `Quality must be an integer between 0 and 5, received: ${quality}`,
      );
    }
  }

  /**
   * Calculate new ease factor using SM-2 formula
   * EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
   *
   * @param currentEaseFactor - Current ease factor
   * @param quality - Quality rating (0-5)
   * @returns New ease factor (minimum 1.3)
   */
  private calculateNewEaseFactor(
    currentEaseFactor: number,
    quality: number,
  ): number {
    const newEaseFactor =
      currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Ensure ease factor never drops below minimum
    return Math.max(this.MIN_EASE_FACTOR, newEaseFactor);
  }

  /**
   * Calculate next interval based on SM-2 rules
   *
   * - Quality < 3: Reset to interval 1 (relearning phase)
   * - Quality >= 3 with repetitions 0: interval = 1
   * - Quality >= 3 with repetitions 1: interval = 6
   * - Quality >= 3 with repetitions >= 2: interval = round(previous_interval * ease_factor)
   *
   * @param quality - Quality rating (0-5)
   * @param currentInterval - Current interval in days
   * @param repetitions - Number of successful repetitions
   * @param easeFactor - Current ease factor (needed for calculation)
   * @returns Next interval in days
   */
  private calculateNextInterval(
    quality: number,
    currentInterval: number,
    repetitions: number,
    easeFactor: number,
  ): number {
    // If quality < 3, learner has not recalled the card successfully
    if (quality < 3) {
      return 1; // Reset to 1 day
    }

    // Successful recall - determine next interval
    if (repetitions === 0) {
      // First successful review
      return 1;
    } else if (repetitions === 1) {
      // Second successful review
      return 6;
    } else {
      // Subsequent reviews: multiply previous interval by ease factor
      return Math.round(currentInterval * easeFactor);
    }
  }

  /**
   * Create a new SM-2 card with default values
   *
   * @returns New SM2Card ready for first review
   */
  createNewCard(): SM2Card {
    const now = new Date();
    return {
      easeFactor: this.DEFAULT_INITIAL_EASE,
      interval: 0,
      repetitions: 0,
      correctStreak: 0,
      nextReviewDate: now, // Due immediately
    };
  }

  /**
   * Process a flashcard review and calculate next review date
   * This is the main entry point for handling user responses
   *
   * @param card - Current card state
   * @param quality - Quality rating (0-5)
   * @returns Result object with updated card and next review date
   */
  reviewCard(card: SM2Card, quality: number): SM2ReviewResult {
    this.validateQuality(quality);

    // Calculate new ease factor
    const newEaseFactor = this.calculateNewEaseFactor(card.easeFactor, quality);

    // Determine if response was successful (quality >= 3)
    const isSuccessful = quality >= 3;

    // Calculate new interval
    const newInterval = this.calculateNextInterval(
      quality,
      card.interval,
      card.repetitions,
      newEaseFactor,
    );

    // Update repetitions and correct streak
    let newRepetitions = card.repetitions;
    let newCorrectStreak = card.correctStreak;

    if (isSuccessful) {
      newRepetitions += 1;
      newCorrectStreak += 1;
    } else {
      // Failed response: reset repetitions counter but keep repetitions for history
      newCorrectStreak = 0;
      // Note: in some SM-2 variants, failed responses don't increment repetitions
      // We keep them for analytics, but streak resets
    }

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    const updated: SM2Card = {
      ...card,
      easeFactor: newEaseFactor,
      interval: newInterval,
      repetitions: newRepetitions,
      correctStreak: newCorrectStreak,
      lastReviewDate: new Date(),
      nextReviewDate,
    };

    return {
      updated,
      nextReviewDate,
      intervalDays: newInterval,
    };
  }

  /**
   * Check if a card is due for review
   *
   * @param card - Card to check
   * @param referenceDate - Date to check against (defaults to now)
   * @returns true if nextReviewDate <= referenceDate
   */
  isDueForReview(card: SM2Card, referenceDate: Date = new Date()): boolean {
    return card.nextReviewDate <= referenceDate;
  }

  /**
   * Get the number of days until next review
   * Negative values indicate the card is overdue
   *
   * @param card - Card to check
   * @param referenceDate - Date to check from (defaults to now)
   * @returns Days until next review (negative if overdue)
   */
  getDaysUntilReview(card: SM2Card, referenceDate: Date = new Date()): number {
    const diffMs = card.nextReviewDate.getTime() - referenceDate.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get the status of a card (new, learning, review, or relearning)
   * Helps categorize cards for display and scheduling
   *
   * @param card - Card to check
   * @returns Card status as a string
   */
  getCardStatus(card: SM2Card): 'new' | 'learning' | 'review' | 'relearning' {
    if (card.repetitions === 0) {
      return 'new';
    }

    if (card.correctStreak === 0 && card.repetitions > 0) {
      return 'relearning';
    }

    if (card.correctStreak < 2) {
      return 'learning';
    }

    return 'review';
  }

  /**
   * Convert a quality rating to a standard scale
   * Useful for UI feedback: 1-2=poor, 3=moderate, 4=good, 5=excellent
   *
   * @param rating - Input rating (can be any scale)
   * @returns Normalized quality rating (0-5)
   */
  normalizeQualityRating(rating: number): number {
    // Clamp to valid range
    return Math.min(5, Math.max(0, Math.round(rating)));
  }

  /**
   * Get recommended next review intervals based on ease factor
   * Helps show learners how card scheduling will progress
   *
   * @param currentCard - Current card state
   * @returns Array of estimated intervals for successful reviews
   */
  getProjectedIntervals(currentCard: SM2Card): number[] {
    const intervals: number[] = [];
    let testCard = { ...currentCard };

    // Project next 5 successful reviews
    for (let i = 0; i < 5; i++) {
      const result = this.reviewCard(testCard, 4); // Assume quality 4 (good) responses
      intervals.push(result.intervalDays);
      testCard = result.updated;
    }

    return intervals;
  }

  /**
   * Bulk update multiple cards after review
   * Useful for batch processing or importing external card states
   *
   * @param cards - Array of cards with their quality ratings
   * @returns Array of updated cards with new scheduling
   */
  reviewMultipleCards(
    cards: Array<{ card: SM2Card; quality: number }>,
  ): SM2ReviewResult[] {
    return cards.map(({ card, quality }) => this.reviewCard(card, quality));
  }

  /**
   * Reset a card to initial state (for manual reset or re-learning)
   *
   * @param card - Card to reset
   * @returns Reset card with default values
   */
  resetCard(card: SM2Card): SM2Card {
    return {
      ...card,
      easeFactor: this.DEFAULT_INITIAL_EASE,
      interval: 0,
      repetitions: 0,
      correctStreak: 0,
      nextReviewDate: new Date(),
    };
  }

  /**
   * Get algorithm statistics for monitoring algorithm health
   *
   * @param cards - Collection of cards to analyze
   * @returns Statistics object
   */
  getStatistics(cards: SM2Card[]): {
    totalCards: number;
    averageEaseFactor: number;
    averageInterval: number;
    masteredCards: number;
    learningCards: number;
    relearningCards: number;
  } {
    if (cards.length === 0) {
      return {
        totalCards: 0,
        averageEaseFactor: 0,
        averageInterval: 0,
        masteredCards: 0,
        learningCards: 0,
        relearningCards: 0,
      };
    }

    const stats = {
      totalCards: cards.length,
      averageEaseFactor:
        cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length,
      averageInterval:
        cards.reduce((sum, c) => sum + c.interval, 0) / cards.length,
      masteredCards: cards.filter((c) => c.easeFactor >= 2.5 && c.interval > 30)
        .length,
      learningCards: cards.filter((c) => this.getCardStatus(c) === 'learning')
        .length,
      relearningCards: cards.filter(
        (c) => this.getCardStatus(c) === 'relearning',
      ).length,
    };

    return stats;
  }
}
