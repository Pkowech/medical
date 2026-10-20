import { apiService } from '@/features/auth/services/apiClient';

export interface CompleteOnboardingPayload {
  healthcareField: string;
  careerStage: string;
  studyYear?: number;
  yearOfExperience?: number;
  specialization?: string;
  institution?: string;
  targetExam?: string;
  focusTopics?: string[];
  dailyGoalMinutes?: number;
}

export interface StarterPathItem {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  estimatedDurationWeeks: number | null;
  specialization: string | null;
  /** LearningPathType: STANDARD_STUDY | EXAM_BLUEPRINT | CLINICAL_COMPETENCY */
  pathType?: string;
  category?: { name: string } | null;
}

export interface OnboardingStatusResponse {
  isCompleted: boolean;
  completionPercentage: number;
  profile?: {
    healthcareField?: string | null;
    careerStage?: string | null;
    studyYear?: number | null;
    yearOfExperience?: number | null;
    specialization?: string | null;
    institution?: string | null;
    targetExam?: string | null;
    dailyGoalMinutes?: number | null;
    focusTopics?: string[];
  };
  suggestedStarterPaths?: StarterPathItem[];
}

class OnboardingService {
  async getStatus(): Promise<OnboardingStatusResponse> {
    const res = await apiService.get<OnboardingStatusResponse | { data: OnboardingStatusResponse }>('/onboarding/status');
    const data = res.data;
    if (data && typeof data === 'object' && 'data' in data && data.data) {
      return data.data as OnboardingStatusResponse;
    }
    return data as OnboardingStatusResponse;
  }

  async complete(payload: CompleteOnboardingPayload): Promise<OnboardingStatusResponse> {
    const res = await apiService.post<OnboardingStatusResponse | { data: OnboardingStatusResponse }>('/onboarding/complete', payload);
    const data = res.data;
    if (data && typeof data === 'object' && 'data' in data && data.data) {
      return data.data as OnboardingStatusResponse;
    }
    return data as OnboardingStatusResponse;
  }

  async getStarterPaths(field?: string, specialization?: string): Promise<StarterPathItem[]> {
    const params = new URLSearchParams();
    if (field) params.append('field', field);
    if (specialization) params.append('specialization', specialization);
    const res = await apiService.get<StarterPathItem[] | { data: StarterPathItem[] }>(`/onboarding/starter-paths?${params}`);
    const data = res.data;
    if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
      return (data as any).data;
    }
    return Array.isArray(data) ? data : [];
  }
}

export const onboardingService = new OnboardingService();
