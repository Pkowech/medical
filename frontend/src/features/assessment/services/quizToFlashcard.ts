import { QuizQuestion } from '@/shared/types/assessmentInterface';
import { flashcardApi } from './flashcardApi';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export class QuizToFlashcardService {
  static async convertQuizToFlashcards(questions: QuizQuestion[], userId: string): Promise<void> {
    for (const question of questions) {
      await flashcardApi.createFlashcard(userId, {
        front: question.question_text || '',
        back: question.explanation || '',
        questionId: question.id,
        difficulty: question.difficulty,
        tags: question.category ? [question.category] : [],
      });
    }
  }

  static async convertQuizResponseToFlashcard(
    questionId: string,
    userId: string,
    isCorrect: boolean
  ): Promise<void> {
    const quality = isCorrect ? 5 : 2; // High quality for correct, low for incorrect
    await flashcardApi.updateCard(questionId, quality);
  }
}

// Hook for converting quiz questions to flashcards
export const useQuizToFlashcard = () => {
  const { user } = useAuthStore();

  const convertQuizToFlashcards = async (questions: QuizQuestion[]) => {
    if (!user) return;
    await QuizToFlashcardService.convertQuizToFlashcards(questions, user.id);
  };

  const convertQuizResponseToFlashcard = async (questionId: string, isCorrect: boolean) => {
    if (!user) return;
    await QuizToFlashcardService.convertQuizResponseToFlashcard(questionId, user.id, isCorrect);
  };

  return {
    convertQuizToFlashcards,
    convertQuizResponseToFlashcard,
  };
};
