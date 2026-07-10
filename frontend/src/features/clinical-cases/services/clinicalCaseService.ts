import { apiService } from '@/features/auth/services/apiClient';
import { toast } from 'sonner';

export interface ClinicalCase {
  id: string;
  title: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  specialty: string;
  status: 'draft' | 'published' | 'archived';
  estimated_duration_minutes: number;
  learning_objectives: string[];
  tags: string[];
  attempts_count: number;
  average_score: number;
  user_attempts?: unknown[];
  current_attempt?: { percentage?: number } | null | unknown;
}

export const fetchClinicalCases = async (): Promise<ClinicalCase[]> => {
  try {
    const response = await apiService.get<ClinicalCase[]>('/clinical-cases');
    return response.data;
  } catch (error) {
    console.error('Failed to load cases:', error);
    toast.error('Failed to load clinical cases');
    return [];
  }
};
