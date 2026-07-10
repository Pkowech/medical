import { UserFlashcardProgress } from '@/features/assessment/services/flashcardApi';

export interface StudySchedule {
  date: Date;
  cardsDue: number;
  estimatedTime: number; // in minutes
  priority: 'high' | 'medium' | 'low';
}

export class StudyScheduler {
  private static readonly HIGH_PRIORITY_THRESHOLD = 10;
  private static readonly MEDIUM_PRIORITY_THRESHOLD = 5;
  private static readonly AVG_TIME_PER_CARD = 2; // minutes

  static generateSchedule(cards: UserFlashcardProgress[], days: number = 7): StudySchedule[] {
    const schedule: StudySchedule[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      const cardsDue = cards.filter(card => {
        const nextReview = new Date(card.nextReviewDate);
        return nextReview.toDateString() === date.toDateString();
      }).length;

      if (cardsDue > 0) {
        const estimatedTime = cardsDue * this.AVG_TIME_PER_CARD;
        const priority = this.calculatePriority(cardsDue);

        schedule.push({
          date,
          cardsDue,
          estimatedTime,
          priority,
        });
      }
    }

    return schedule;
  }

  static calculateOptimalStudyTime(cards: UserFlashcardProgress[]): {
    bestTime: Date;
    cardsDue: number;
  } {
    const now = new Date();
    let bestTime = new Date(now);
    let maxCardsDue = 0;

    // Check next 24 hours in 1-hour intervals
    for (let i = 0; i < 24; i++) {
      const checkTime = new Date(now);
      checkTime.setHours(checkTime.getHours() + i);

      const cardsDue = cards.filter(card => {
        const nextReview = new Date(card.nextReviewDate);
        return nextReview <= checkTime;
      }).length;

      if (cardsDue > maxCardsDue) {
        maxCardsDue = cardsDue;
        bestTime = new Date(checkTime);
      }
    }

    return { bestTime, cardsDue: maxCardsDue };
  }

  static getStudyRecommendations(cards: UserFlashcardProgress[]): string[] {
    const recommendations: string[] = [];
    const { bestTime, cardsDue } = this.calculateOptimalStudyTime(cards);

    if (cardsDue > 0) {
      recommendations.push(
        `Best time to study: ${bestTime.toLocaleTimeString()} (${cardsDue} cards due)`
      );
    }

    const schedule = this.generateSchedule(cards, 3);
    const highPriorityDays = schedule.filter(s => s.priority === 'high').length;

    if (highPriorityDays > 0) {
      recommendations.push(`${highPriorityDays} high-priority study sessions in the next 3 days`);
    }

    const totalCardsDue = cards.filter(card => new Date(card.nextReviewDate) <= new Date()).length;
    if (totalCardsDue > 20) {
      recommendations.push(
        `Consider breaking your study session into smaller chunks (${totalCardsDue} cards due)`
      );
    }

    return recommendations;
  }

  private static calculatePriority(cardsDue: number): 'high' | 'medium' | 'low' {
    if (cardsDue >= this.HIGH_PRIORITY_THRESHOLD) {
      return 'high';
    } else if (cardsDue >= this.MEDIUM_PRIORITY_THRESHOLD) {
      return 'medium';
    }
    return 'low';
  }
}
