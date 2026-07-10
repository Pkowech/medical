import { apiService } from '@/features/auth/services/apiClient';

class QuizService {
  private readonly baseUrl = '/quiz';

  async getRapidReviewQuestions(userId: string, topics?: string[]): Promise<unknown[]> {
    try {
      const response = await apiService.get<unknown[]>(`${this.baseUrl}/rapid-review/${userId}`, {
        params: topics && topics.length > 0 ? { topics: topics.join(',') } : undefined,
      });
      return response.data;
    } catch (error) {
      console.warn('[QuizService] Backend call failed, using demo data', error);
      return this.getDemoRapidReviewQuestions();
    }
  }

  async getQuestionsForLesson(lessonId: string | number): Promise<unknown[]> {
    try {
      const response = await apiService.get<unknown[]>(`${this.baseUrl}/lesson/${lessonId}`);
      return response.data;
    } catch (error) {
      console.warn(`[QuizService] Failed to fetch questions for lesson ${lessonId}, using demo data`, error);
      // Filter demo questions by topic if possible, or just return them all
      return this.getDemoRapidReviewQuestions().slice(0, 5); 
    }
  }

  private getDemoRapidReviewQuestions(): unknown[] {
    return [
      {
        id: '1',
        text:
          'Which of the following is the most common cause of acute myocardial infarction?',
        type: 'multiple_choice',
        options: [
          { id: '1a', text: 'Coronary artery spasm', isCorrect: false },
          { id: '1b', text: 'Atherosclerotic plaque rupture', isCorrect: true },
          { id: '1c', text: 'Coronary embolism', isCorrect: false },
          { id: '1d', text: 'Coronary dissection', isCorrect: false },
        ],
        explanation:
          'Atherosclerotic plaque rupture with subsequent thrombosis is the most common cause of acute MI, accounting for about 90% of cases.',
        topic: 'Cardiology',
      },
      {
        id: '2',
        text: 'What is the normal range for adult resting heart rate?',
        type: 'multiple_choice',
        options: [
          { id: '2a', text: '40-60 bpm', isCorrect: false },
          { id: '2b', text: '60-100 bpm', isCorrect: true },
          { id: '2c', text: '80-120 bpm', isCorrect: false },
          { id: '2d', text: '100-140 bpm', isCorrect: false },
        ],
        explanation:
          'The normal resting heart rate for adults is 60-100 beats per minute. Athletes may have lower rates due to conditioning.',
        topic: 'Physiology',
      },
      {
        id: '3',
        text:
          'Which hormone is primarily responsible for regulating blood glucose levels?',
        type: 'multiple_choice',
        options: [
          { id: '3a', text: 'Cortisol', isCorrect: false },
          { id: '3b', text: 'Insulin', isCorrect: true },
          { id: '3c', text: 'Thyroxine', isCorrect: false },
          { id: '3d', text: 'Growth hormone', isCorrect: false },
        ],
        explanation:
          'Insulin, produced by pancreatic beta cells, is the primary hormone responsible for lowering blood glucose levels.',
        topic: 'Endocrinology',
      },
      {
        id: '4',
        text: 'What is the first-line treatment for uncomplicated hypertension?',
        type: 'multiple_choice',
        options: [
          { id: '4a', text: 'Beta-blockers', isCorrect: false },
          { id: '4b', text: 'ACE inhibitors or ARBs', isCorrect: true },
          { id: '4c', text: 'Calcium channel blockers', isCorrect: false },
          { id: '4d', text: 'Diuretics', isCorrect: false },
        ],
        explanation:
          'ACE inhibitors or ARBs are typically first-line treatments for uncomplicated hypertension due to their cardiovascular protective effects.',
        topic: 'Cardiology',
      },
      {
        id: '5',
        text: 'Which part of the brain controls balance and coordination?',
        type: 'multiple_choice',
        options: [
          { id: '5a', text: 'Cerebrum', isCorrect: false },
          { id: '5b', text: 'Brainstem', isCorrect: false },
          { id: '5c', text: 'Cerebellum', isCorrect: true },
          { id: '5d', text: 'Thalamus', isCorrect: false },
        ],
        explanation:
          'The cerebellum is responsible for balance, coordination, and fine motor control.',
        topic: 'Neurology',
      },
      {
        id: '6',
        text: 'What is the most common type of kidney stone?',
        type: 'multiple_choice',
        options: [
          { id: '6a', text: 'Uric acid stones', isCorrect: false },
          { id: '6b', text: 'Calcium oxalate stones', isCorrect: true },
          { id: '6c', text: 'Struvite stones', isCorrect: false },
          { id: '6d', text: 'Cystine stones', isCorrect: false },
        ],
        explanation: 'Calcium oxalate stones account for approximately 80% of all kidney stones.',
        topic: 'Urology',
      },
      {
        id: '7',
        text: 'Which antibiotic is contraindicated in pregnancy?',
        type: 'multiple_choice',
        options: [
          { id: '7a', text: 'Amoxicillin', isCorrect: false },
          { id: '7b', text: 'Cephalexin', isCorrect: false },
          { id: '7c', text: 'Tetracycline', isCorrect: true },
          { id: '7d', text: 'Erythromycin', isCorrect: false },
        ],
        explanation:
          'Tetracycline is contraindicated in pregnancy as it can cause tooth discoloration and bone growth problems in the fetus.',
        topic: 'Pharmacology',
      },
      {
        id: '8',
        text: 'What is the Glasgow Coma Scale maximum score?',
        type: 'multiple_choice',
        options: [
          { id: '8a', text: '12', isCorrect: false },
          { id: '8b', text: '15', isCorrect: true },
          { id: '8c', text: '18', isCorrect: false },
          { id: '8d', text: '20', isCorrect: false },
        ],
        explanation:
          'The Glasgow Coma Scale ranges from 3 (worst) to 15 (best), assessing eye opening, verbal response, and motor response.',
        topic: 'Emergency Medicine',
      },
      {
        id: '9',
        text: 'Which vitamin deficiency causes scurvy?',
        type: 'multiple_choice',
        options: [
          { id: '9a', text: 'Vitamin A', isCorrect: false },
          { id: '9b', text: 'Vitamin B12', isCorrect: false },
          { id: '9c', text: 'Vitamin C', isCorrect: true },
          { id: '9d', text: 'Vitamin D', isCorrect: false },
        ],
        explanation:
          'Scurvy is caused by vitamin C (ascorbic acid) deficiency, leading to collagen synthesis problems.',
        topic: 'Nutrition',
      },
      {
        id: '10',
        text: 'What is the most common cause of bacterial meningitis in adults?',
        type: 'multiple_choice',
        options: [
          { id: '10a', text: 'Haemophilus influenzae', isCorrect: false },
          { id: '10b', text: 'Neisseria meningitidis', isCorrect: false },
          { id: '10c', text: 'Streptococcus pneumoniae', isCorrect: true },
          { id: '10d', text: 'Listeria monocytogenes', isCorrect: false },
        ],
        explanation:
          'Streptococcus pneumoniae is the most common cause of bacterial meningitis in adults, especially in those over 50.',
        topic: 'Infectious Disease',
      },
    ];
  }
}
export const quizService = new QuizService();
