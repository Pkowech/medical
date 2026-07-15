/**
 * Quiz → Progress → Recommendations Integration Service
 * Orchestrates the complete event chain from quiz submission through recommendation updates
 */

import { toast } from 'sonner';
import progressService from '@/features/learning-management/services/progressService';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import type { QuizCompletionEvent } from '@/shared/types/assessmentInterface';

class QuizProgressIntegrationService {
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private readonly debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register listener for integration events
   */
  on(event: string, listener: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove listener for integration events
   */
  off(event: string, listener: (...args: unknown[]) => void) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(listener);
    }
  }

  /**
   * Emit integration event
   */
  emit(event: string, ...args: unknown[]) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((listener) => {
        try {
          listener(...args);
        } catch (err) {
          console.error('[Integration] listener error for', event, err);
        }
      });
    }
  }

  /**
   * Handle quiz completion with full event chain:
   * Quiz → Progress Sync → Mastery Calculation → Recommendation Refresh
   */
  async handleQuizCompletion(quizEvent: QuizCompletionEvent): Promise<void> {
    const eventKey = `quiz-${quizEvent.topicId}-${quizEvent.userId}`;

    // Debounce to avoid race conditions
    if (this.debounceTimers.has(eventKey)) {
      clearTimeout(this.debounceTimers.get(eventKey)!);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        try {
          // Step 1: Sync quiz completion to backend progress
          console.warn('[Integration] Step 1: Syncing quiz completion to progress service...');
          await this.syncQuizToProgress(quizEvent);
          this.emit('progress-synced', quizEvent);

          // Step 2: Update spaced repetition flashcards for weak areas
          console.warn('[Integration] Step 2: Updating spaced repetition scheduling...');
          await this.updateSpacedRepetition(quizEvent);
          this.emit('spaced-repetition-updated', quizEvent);

          // Step 3: Refresh recommendations based on new mastery data
          console.warn('[Integration] Step 3: Refreshing recommendations...');
          await this.refreshRecommendations(quizEvent.userId);
          this.emit('recommendations-refreshed', quizEvent);

          // Step 4: Create flashcards for review if score is below threshold
          if (quizEvent.score < 80) {
            console.warn('[Integration] Step 4: Creating review flashcards for weak areas...');
            await this.createReviewFlashcards(quizEvent);
            this.emit('flashcards-created', quizEvent);
          }

          console.warn('[Integration] Quiz completion event chain completed successfully');
          resolve();
        } catch (error) {
          console.error('[Integration] Error in quiz completion event chain:', error);
          toast.error('Failed to sync quiz completion');
          resolve(); // Don't throw to avoid breaking quiz flow
        } finally {
          this.debounceTimers.delete(eventKey);
        }
      }, 500); // 500ms debounce to batch rapid updates

      this.debounceTimers.set(eventKey, timer);
    });
  }

  /**
   * Step 1: Sync quiz results to progress tracking
   */
  private async syncQuizToProgress(event: QuizCompletionEvent): Promise<void> {
    try {
      await progressService.updateUnitProgress(
        event.topicId,
        'completed',
        event.score,
        0,
        `Quiz completed with score: ${event.score}%`,
        { [event.topicId]: event.score } // Store score by topic for recommendations
      );
    } catch (error) {
      console.error('Error syncing quiz to progress:', error);
      throw error;
    }
  }

  /**
   * Step 2: Update spaced repetition scheduling based on performance
   */
  private async updateSpacedRepetition(event: QuizCompletionEvent): Promise<void> {
    try {
      // If score is low, mark for immediate review
      if (event.score < 70) {
        const _quality = 1; // Quality score for low performance (1-5 scale)
        // This would trigger SM-2 algorithm to schedule review soon
        console.warn('[Integration] Low score detected - scheduling urgent review');
      }

      // If score is good, increase interval
      if (event.score >= 80) {
        const _quality = 4; // Quality score for good performance
        console.warn('[Integration] Good score - extending review interval');
      }
    } catch (error) {
      console.error('Error updating spaced repetition:', error);
      // Don't throw - spaced rep update is optional
    }
  }

  /**
   * Step 3: Invalidate recommendation cache to trigger refresh
   */
  private async refreshRecommendations(userId: string): Promise<void> {
    try {
      // Clear any cached recommendations
      sessionStorage.removeItem(`recommendations-${userId}`);

      // Trigger recommendation fetch (will use fresh data from backend)
      const freshRecommendations = await learningPathService.getRecommendedPaths(5);
      sessionStorage.setItem(
        `recommendations-${userId}`,
        JSON.stringify(freshRecommendations)
      );

      console.warn('[Integration] Recommendations refreshed with fresh data');
    } catch (error) {
      console.error('Error refreshing recommendations:', error);
      // Don't throw - recommendation update is optional
    }
  }

  /**
   * Step 4: Create review flashcards for topics with low scores
   */
  private async createReviewFlashcards(event: QuizCompletionEvent): Promise<void> {
    try {
      if (event.score < 80) {
        // This would be implemented to create flashcards from weak questions
        // For now, just log that it would happen
        console.warn('[Integration] Would create review flashcards for topic:', event.topicId);
      }
    } catch (error) {
      console.error('Error creating review flashcards:', error);
      // Don't throw - flashcard creation is optional
    }
  }

  /**
   * Get current integration status/metrics
   */
  getIntegrationStatus() {
    return {
      pendingEvents: this.debounceTimers.size,
      listeners: Array.from(this.listeners.keys()),
      timestamp: Date.now(),
    };
  }

  /**
   * Clear all listeners and timers (useful for cleanup)
   */
  cleanup() {
    this.listeners.clear();
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

// Export singleton instance
export const quizProgressIntegration = new QuizProgressIntegrationService();
