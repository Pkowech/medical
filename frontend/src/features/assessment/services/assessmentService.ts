import { apiService } from '@/features/auth/services/apiClient';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'exam' | 'adaptive';
  status: 'draft' | 'published' | 'archived';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  timeLimitMinutes?: number;
  passingScore: number;
  bestScore?: number;
  lastAttemptAt?: string;
  isCompleted?: boolean;
}

const DEFAULT_ASSESSMENTS: Assessment[] = [
  {
    id: 'quiz-gm101-basics',
    title: 'Clinical Practice Foundations',
    description: 'Comprehensive assessment on clinical examination, history taking, and core patient care fundamentals.',
    type: 'quiz',
    status: 'published',
    category: 'General Medicine',
    difficulty: 'easy',
    questionCount: 10,
    timeLimitMinutes: 15,
    passingScore: 70,
  },
  {
    id: 'cardiology-core-exam',
    title: 'Cardiovascular Pathology & ECG Interpretation',
    description: 'Advanced diagnostic evaluation testing ischemic heart disease, arrhythmias, valvular disorders, and emergency ECG recognition.',
    type: 'exam',
    status: 'published',
    category: 'Cardiology',
    difficulty: 'hard',
    questionCount: 25,
    timeLimitMinutes: 45,
    passingScore: 75,
  },
  {
    id: 'pharmacology-drug-interactions',
    title: 'Clinical Pharmacology & Therapeutics',
    description: 'In-depth assessment of pharmacokinetics, high-risk drug interactions, antimicrobials, and autonomic drug regimens.',
    type: 'quiz',
    status: 'published',
    category: 'Pharmacology',
    difficulty: 'medium',
    questionCount: 20,
    timeLimitMinutes: 30,
    passingScore: 80,
  },
  {
    id: 'emergency-trauma-resuscitation',
    title: 'Emergency Medicine: Acute Trauma & Resuscitation',
    description: 'Timed clinical decision-making assessment covering ABCDE trauma primary survey, shock management, and rapid triage.',
    type: 'exam',
    status: 'published',
    category: 'Emergency Medicine',
    difficulty: 'hard',
    questionCount: 30,
    timeLimitMinutes: 60,
    passingScore: 80,
  },
  {
    id: 'neurology-localization',
    title: 'Neurological Examination & Lesion Localization',
    description: 'Clinical problem-solving for cranial nerve palsies, stroke syndromes, spinal cord lesions, and peripheral neuropathies.',
    type: 'quiz',
    status: 'published',
    category: 'Neurology',
    difficulty: 'medium',
    questionCount: 15,
    timeLimitMinutes: 25,
    passingScore: 75,
  },
  {
    id: 'adaptive-clinical-diagnostic',
    title: 'AI Adaptive Clinical Diagnostic Assessment',
    description: 'Dynamically calibrated questions adapting in real-time to your response confidence and accuracy across core medical specialties.',
    type: 'adaptive',
    status: 'published',
    category: 'Multi-Specialty',
    difficulty: 'medium',
    questionCount: 20,
    passingScore: 75,
  },
];

export const fetchAssessments = async (): Promise<Assessment[]> => {
  try {
    const res = await apiService.get<{ data?: Array<{ id: string; title?: string; quizId?: string }> }>(
      '/quizzes/assessments/auto-generated-quizzes'
    );
    const serverQuizzes = res.data?.data || [];
    if (serverQuizzes.length > 0) {
      const dynamicAssessments: Assessment[] = serverQuizzes.map((q, idx) => ({
        id: q.quizId || q.id || `auto-quiz-${idx}`,
        title: q.title || `Review Assessment #${idx + 1}`,
        description: 'Auto-generated targeted knowledge review based on your clinical weakness profile.',
        type: 'quiz',
        status: 'published',
        category: 'Personalized Review',
        difficulty: 'medium',
        questionCount: 10,
        timeLimitMinutes: 20,
        passingScore: 70,
      }));
      return [...dynamicAssessments, ...DEFAULT_ASSESSMENTS];
    }
  } catch {
    // Fall back to default curriculum assessments
  }
  return DEFAULT_ASSESSMENTS;
};

export const fetchUserAssessmentSummary = async (): Promise<PerformanceData | null> => {
  try {
    const res = await apiService.get<PerformanceData>('/assessment-progress/summary');
    return res.data;
  } catch {
    return null;
  }
};
