import { Injectable } from '@nestjs/common';
import { Question, QuestionDifficulty, QuestionCategory } from '@prisma/client';
import { AdaptiveQuizSession } from '../dto/assessment.dto';

type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'fill_in_blank'
  | 'matching'
  | 'ordering';

@Injectable()
export class QuizUtils {
  static getDifficultyIndex(difficulty: QuestionDifficulty): number {
    switch (difficulty) {
      case QuestionDifficulty.easy:
        return 0.3;
      case QuestionDifficulty.medium:
        return 0.5;
      case QuestionDifficulty.hard:
        return 0.7;
      default:
        return 0.5;
    }
  }

  static calculateAbility(
    responses: boolean[],
    questionParams: Array<{
      difficultyIndex: number;
      discrimination: number;
      guessing: number;
    }>,
  ): number {
    if (
      !responses.length ||
      !questionParams.length ||
      responses.length !== questionParams.length
    ) {
      return 0;
    }

    let ability = 0.5; // initial guess
    const maxIterations = 10;
    const convergenceThreshold = 0.001;

    // Newton-Raphson method for ability estimation
    for (let i = 0; i < maxIterations; i++) {
      let sumNum = 0;
      let sumDenom = 0;

      for (let j = 0; j < responses.length; j++) {
        const { difficultyIndex, discrimination, guessing } = questionParams[j];
        const p = this.calculateProbability(
          ability,
          difficultyIndex,
          discrimination,
          guessing,
        );

        if (responses[j]) {
          sumNum += (discrimination * (1 - p)) / (p * (1 - guessing));
        } else {
          sumNum -= discrimination / (1 - p);
        }

        sumDenom +=
          (discrimination * discrimination * p * (1 - p)) /
          ((1 - guessing) * (1 - guessing));
      }

      const delta = sumNum / Math.max(sumDenom, 0.001);
      ability += delta;

      if (Math.abs(delta) < convergenceThreshold) {
        break;
      }
    }

    return Math.min(Math.max(ability, 0), 1);
  }

  static calculateProbability(
    ability: number,
    difficulty: number,
    discrimination: number,
    guessing: number,
  ): number {
    const z = discrimination * (ability - difficulty);
    const p = guessing + (1 - guessing) / (1 + Math.exp(-z));
    return Math.min(Math.max(p, 0.0001), 0.9999); // avoid 0 and 1
  }

  static getProbabilityOfCorrect(
    userAbility: number,
    question: {
      difficultyIndex: number;
      discrimination?: number;
      guessing?: number;
    },
  ): number {
    const { difficultyIndex, discrimination = 1, guessing = 0.25 } = question;
    return (
      guessing +
      (1 - guessing) /
        (1 + Math.exp(-discrimination * (userAbility - difficultyIndex)))
    );
  }

  static updateUserAbility(
    currentAbility: number,
    question: {
      difficultyIndex: number;
      discrimination?: number;
      guessing?: number;
    },
    isCorrect: boolean,
  ): number {
    const expected = this.getProbabilityOfCorrect(currentAbility, question);
    const learningRate = 0.1;
    return (
      currentAbility + learningRate * (isCorrect ? 1 - expected : -expected)
    );
  }

  static updateConfidenceInterval(
    currentInterval: number,
    discrimination: number = 1,
  ): number {
    const information = discrimination ** 2 * 0.25;
    return Math.max(0.1, currentInterval / Math.sqrt(1 + information));
  }

  static gradeAnswer(
    question: Question & {
      options?: Array<{ id: string; isCorrect: boolean }>;
    },
    answer: any,
  ): { isCorrect: boolean; partialCredit?: number } {
    const questionOptions = question.options || [];

    switch (question.type as QuestionType) {
      case 'multiple_choice': {
        const correctOptions = questionOptions
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id);
        return { isCorrect: correctOptions.includes(answer) };
      }
      case 'multiple_select': {
        const correctOptions = questionOptions
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id);
        const userAnswers = Array.isArray(answer) ? answer : [];
        const correctCount = userAnswers.filter((ans) =>
          correctOptions.includes(ans),
        ).length;
        const totalCorrect = correctOptions.length;
        return {
          isCorrect:
            correctCount === totalCorrect &&
            userAnswers.length === totalCorrect,
          partialCredit:
            totalCorrect > 0
              ? (correctCount / totalCorrect) * (question.points || 0)
              : 0,
        };
      }
      case 'true_false': {
        const correctAnswer = questionOptions.find((opt) => opt.isCorrect);
        return {
          isCorrect: correctAnswer ? answer === correctAnswer.id : false,
        };
      }
      case 'short_answer': {
        // Simple text matching - in production, use fuzzy matching or NLP
        const correctOptions = questionOptions
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id);
        const normalizedAnswer = (answer || '').toString().toLowerCase().trim();
        const normalizedCorrect = correctOptions.map((ca) =>
          ca.toLowerCase().trim(),
        );
        return { isCorrect: normalizedCorrect.includes(normalizedAnswer) };
      }
      case 'fill_in_blank': {
        // Handle multiple blanks in a question
        const correctOptions = questionOptions
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id);
        const userAnswers = Array.isArray(answer) ? answer : [answer];

        if (userAnswers.length !== correctOptions.length) {
          return { isCorrect: false };
        }

        const correctCount = userAnswers.filter((userAns, index) => {
          const normalizedUser = (userAns || '')
            .toString()
            .toLowerCase()
            .trim();
          const normalizedCorrect = correctOptions[index].toLowerCase().trim();
          return normalizedUser === normalizedCorrect;
        }).length;

        return {
          isCorrect: correctCount === correctOptions.length,
          partialCredit:
            correctOptions.length > 0
              ? (correctCount / correctOptions.length) * (question.points || 0)
              : 0,
        };
      }
      case 'matching': {
        // Handle matching questions where answer is an object with pairs
        const correctPairs = questionOptions.filter((opt) => opt.isCorrect);
        const userPairs = answer || {};

        let correctCount = 0;
        let totalPairs = 0;

        for (const correctPair of correctPairs) {
          totalPairs++;
          const [left, right] = correctPair.id.split('|');
          if (userPairs[left] === right) {
            correctCount++;
          }
        }

        return {
          isCorrect: correctCount === totalPairs && totalPairs > 0,
          partialCredit:
            totalPairs > 0
              ? (correctCount / totalPairs) * (question.points || 0)
              : 0,
        };
      }
      case 'ordering': {
        // Handle ordering questions where answer is an array of ordered IDs
        const correctOrder = questionOptions
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id);
        const userOrder = Array.isArray(answer) ? answer : [];

        if (userOrder.length !== correctOrder.length) {
          return { isCorrect: false };
        }

        const correctPositions = userOrder.filter(
          (id, index) => id === correctOrder[index],
        ).length;

        return {
          isCorrect: correctPositions === correctOrder.length,
          partialCredit:
            correctOrder.length > 0
              ? (correctPositions / correctOrder.length) *
                (question.points || 0)
              : 0,
        };
      }
      case 'essay': {
        // For essays, we can't auto-grade, so return partial credit based on length
        const minLength = 50; // Minimum words for partial credit
        const answerText = (answer || '').toString().trim();
        const wordCount = answerText.split(/\s+/).length;

        if (wordCount < minLength) {
          return { isCorrect: false, partialCredit: 0 };
        }

        // Return partial credit for meeting minimum requirements
        // In production, this would use AI or manual grading
        return {
          isCorrect: false,
          partialCredit: (question.points || 0) * 0.3,
        };
      }
      default:
        return { isCorrect: false };
    }
  }

  /**
   * Calculates the overall score and pass status for a quiz
   * @param correctCount Number of correct answers
   * @param totalCount Total number of questions
   * @param passingScore The required score to pass (default 70)
   */
  static calculateScore(
    correctCount: number,
    totalCount: number,
    passingScore: number = 70,
  ): { score: number; isPassed: boolean } {
    const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    return {
      score: Math.round(score),
      isPassed: score >= passingScore,
    };
  }

  static estimateQuestionTime(question: Question): number {
    switch (question.type as QuestionType) {
      case 'multiple_choice':
      case 'multiple_select':
        return 30;
      case 'fill_in_blank':
        return 45;
      case 'short_answer':
        return 60;
      case 'essay':
        return 300;
      default:
        return 30;
    }
  }

  static getTargetDifficulty(userAbility: number): QuestionDifficulty {
    if (userAbility < 0.4) {
      return QuestionDifficulty.easy;
    }
    if (userAbility < 0.6) {
      return QuestionDifficulty.medium;
    }
    return QuestionDifficulty.hard;
  }

  static logit(probability: number): number {
    return Math.log(probability / (1 - probability));
  }

  static generateRecommendations(session: AdaptiveQuizSession): string[] {
    const gaps = session.responses
      .filter((r) => !r.isCorrect)
      .map(
        (r) => session.questions.find((q) => q.id === r.questionId)?.category,
      )
      .filter((c): c is QuestionCategory => c != null);
    return [...new Set(gaps)].map((category) => `Review ${category} materials`);
  }

  static generateFeedback(
    questions: Question[],
    answers: Record<string, any>,
  ): string[] {
    return questions.map((q) => {
      const gradingResult = QuizUtils.gradeAnswer(q, answers[q.id]);
      return gradingResult.isCorrect
        ? `Correct answer for question ${q.id}`
        : `Incorrect answer for question ${q.id}. Review: ${
            q.explanation || 'No explanation provided'
          }`;
    });
  }

  static calculateDiscriminationIndex(
    responses: boolean[],
    _questionDifficulty: number,
    userAbilities: number[],
  ): number {
    if (responses.length !== userAbilities.length || responses.length < 2) {
      return 1.0; // Default discrimination
    }

    // Calculate point-biserial correlation
    const correctResponses = responses.filter((r) => r).length;
    const totalResponses = responses.length;
    const p = correctResponses / totalResponses; // Proportion correct

    if (p === 0 || p === 1) {
      return 0.5; // Low discrimination for extreme proportions
    }

    // Calculate means for correct and incorrect responses
    const correctAbilities = userAbilities.filter((_, i) => responses[i]);
    const incorrectAbilities = userAbilities.filter((_, i) => !responses[i]);

    if (correctAbilities.length === 0 || incorrectAbilities.length === 0) {
      return 0.5;
    }

    const meanCorrect =
      correctAbilities.reduce((sum, a) => sum + a, 0) / correctAbilities.length;
    const meanIncorrect =
      incorrectAbilities.reduce((sum, a) => sum + a, 0) /
      incorrectAbilities.length;

    // Calculate standard deviation
    const allAbilities = userAbilities;
    const meanAll =
      allAbilities.reduce((sum, a) => sum + a, 0) / allAbilities.length;
    const variance =
      allAbilities.reduce((sum, a) => sum + Math.pow(a - meanAll, 2), 0) /
      allAbilities.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return 0.5;
    }

    // Point-biserial correlation
    const discrimination =
      ((meanCorrect - meanIncorrect) / stdDev) * Math.sqrt(p * (1 - p));

    // Normalize to reasonable range
    return Math.max(0.1, Math.min(2.0, Math.abs(discrimination)));
  }

  static estimateAbility(
    responses: boolean[],
    questionParams: Array<{
      difficultyIndex: number;
      discrimination: number;
      guessing: number;
    }>,
  ): number {
    return this.calculateAbility(responses, questionParams);
  }

  static calculateItemInformation(
    ability: number,
    difficulty: number,
    discrimination: number,
    guessing: number,
  ): number {
    const p = this.calculateProbability(
      ability,
      difficulty,
      discrimination,
      guessing,
    );
    const q = 1 - p;
    const d = discrimination;
    const c = guessing;

    // Item information function
    const information =
      (d * d * (p - c) * (p - c)) / (p * q * (1 - c) * (1 - c));
    return Math.max(0, information);
  }

  static selectNextQuestion(
    userAbility: number,
    availableQuestions: Array<{
      id: string;
      difficultyIndex: number;
      discrimination: number;
      guessing: number;
      category: string;
    }>,
    previousQuestions: string[] = [],
  ): string | null {
    if (availableQuestions.length === 0) {
      return null;
    }

    // Filter out already answered questions
    const remainingQuestions = availableQuestions.filter(
      (q) => !previousQuestions.includes(q.id),
    );

    if (remainingQuestions.length === 0) {
      return null;
    }

    // Calculate information for each question
    const questionInfo = remainingQuestions.map((q) => ({
      id: q.id,
      information: this.calculateItemInformation(
        userAbility,
        q.difficultyIndex,
        q.discrimination,
        q.guessing,
      ),
      difficulty: q.difficultyIndex,
    }));

    // Select question with maximum information
    const bestQuestion = questionInfo.reduce((best, current) =>
      current.information > best.information ? current : best,
    );

    return bestQuestion.id;
  }

  static calculateConfidenceInterval(
    ability: number,
    responses: boolean[],
    questionParams: Array<{
      difficultyIndex: number;
      discrimination: number;
      guessing: number;
    }>,
  ): { lower: number; upper: number; standardError: number } {
    if (responses.length === 0) {
      return { lower: 0, upper: 1, standardError: 1 };
    }

    // Calculate standard error using Fisher information
    let information = 0;
    for (let i = 0; i < responses.length; i++) {
      const { difficultyIndex, discrimination, guessing } = questionParams[i];
      information += this.calculateItemInformation(
        ability,
        difficultyIndex,
        discrimination,
        guessing,
      );
    }

    const standardError = information > 0 ? 1 / Math.sqrt(information) : 1;
    const confidenceLevel = 1.96; // 95% confidence interval

    return {
      lower: Math.max(0, ability - confidenceLevel * standardError),
      upper: Math.min(1, ability + confidenceLevel * standardError),
      standardError,
    };
  }

  static calculateTestReliability(
    responses: boolean[],
    questionParams: Array<{
      difficultyIndex: number;
      discrimination: number;
      guessing: number;
    }>,
  ): number {
    if (responses.length < 2) {
      return 0;
    }

    // Calculate Cronbach's alpha approximation
    const pValues = responses.map((_, i) => {
      const { difficultyIndex, discrimination, guessing } = questionParams[i];
      return this.calculateProbability(
        0.5,
        difficultyIndex,
        discrimination,
        guessing,
      ); // Use average ability
    });

    const meanP = pValues.reduce((sum, p) => sum + p, 0) / pValues.length;
    const variance =
      pValues.reduce((sum, p) => sum + Math.pow(p - meanP, 2), 0) /
      pValues.length;
    const totalVariance = meanP * (1 - meanP);

    if (totalVariance === 0) {
      return 0;
    }

    const k = responses.length;
    const alpha = (k / (k - 1)) * (1 - variance / totalVariance);

    return Math.max(0, Math.min(1, alpha));
  }
}
