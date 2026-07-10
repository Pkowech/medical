import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';

export interface LearningGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: 'short_term' | 'long_term' | 'exam' | 'skill_mastery' | 'certification';
  category: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  targetDate: string;
  startDate?: string;
  completedAt?: string;
  targetCriteria: {
    type: 'numeric' | 'percentage' | 'boolean' | 'completion' | 'score';
    targetValue: number | boolean | string;
    currentValue?: number;
    unit?: string;
  };
  milestones?: Milestone[];
  rewards?: {
    points: number;
    badge?: string;
    certificate?: boolean;
  };
  progress?: number;
  streakCount?: number;
  relatedLearningPath?: string;
  relatedCourse?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate: string;
  isCompleted: boolean;
  completedAt?: string;
  order: number;
}

export interface GoalProgress {
  goalId: string;
  completionPercentage: number;
  currentValue: number;
  targetValue: number;
  progressHistory: Array<{
    date: string;
    value: number;
  }>;
  estimatedCompletionDate?: string;
}

export interface GoalRecommendation {
  id: string;
  title: string;
  description: string;
  type: string;
  reasoning: string;
  estimatedDurationWeeks: number;
  difficulty: string;
  category: string;
}

export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  completionRate: number;
  averageTimeToComplete: number;
  currentStreak: number;
  longestStreak: number;
}

class LearningGoalsService {
  private readonly BASE_URL = '/learning-goals';

  // ==================== CRUD Operations ====================
  async createGoal(goal: Partial<LearningGoal>): Promise<LearningGoal> {
    try {
      const response = await apiService.post<ApiResponse<LearningGoal>>(
        this.BASE_URL,
        goal
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating learning goal:', error);
      throw error;
    }
  }

  async getGoals(filters?: any): Promise<LearningGoal[]> {
    try {
      const response = await apiService.get<ApiResponse<LearningGoal[]>>(
        this.BASE_URL,
        { params: filters }
      );
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching learning goals:', error);
      return [];
    }
  }

  async getGoalById(id: string): Promise<LearningGoal | null> {
    try {
      const response = await apiService.get<ApiResponse<LearningGoal>>(
        `${this.BASE_URL}/${id}`
      );
      return response.data?.data || response.data || null;
    } catch (error) {
      console.error('Error fetching learning goal:', error);
      return null;
    }
  }

  async updateGoal(id: string, updates: Partial<LearningGoal>): Promise<LearningGoal> {
    try {
      const response = await apiService.put<ApiResponse<LearningGoal>>(
        `${this.BASE_URL}/${id}`,
        updates
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating learning goal:', error);
      throw error;
    }
  }

  async deleteGoal(id: string): Promise<void> {
    try {
      await apiService.delete(`${this.BASE_URL}/${id}`);
    } catch (error) {
      console.error('Error deleting learning goal:', error);
      throw error;
    }
  }

  // ==================== Goal Recommendations ====================
  async getRecommendedGoals(limit: number = 5): Promise<GoalRecommendation[]> {
    try {
      const response = await apiService.get<ApiResponse<GoalRecommendation[]>>(
        `${this.BASE_URL}/recommendations?limit=${limit}`
      );
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching recommended goals:', error);
      return [];
    }
  }

  // ==================== Goal Status ====================
  async getActiveGoals(): Promise<LearningGoal[]> {
    try {
      const response = await apiService.get<ApiResponse<LearningGoal[]>>(
        `${this.BASE_URL}/active`
      );
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching active goals:', error);
      return [];
    }
  }

  async getCompletedGoals(): Promise<LearningGoal[]> {
    try {
      const response = await apiService.get<ApiResponse<LearningGoal[]>>(
        `${this.BASE_URL}/completed`
      );
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching completed goals:', error);
      return [];
    }
  }

  // ==================== Goal Lifecycle ====================
  async startGoal(id: string): Promise<LearningGoal> {
    try {
      const response = await apiService.post<ApiResponse<LearningGoal>>(
        `${this.BASE_URL}/${id}/start`
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error starting goal:', error);
      throw error;
    }
  }

  async pauseGoal(id: string): Promise<LearningGoal> {
    try {
      const response = await apiService.post<ApiResponse<LearningGoal>>(
        `${this.BASE_URL}/${id}/pause`
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error pausing goal:', error);
      throw error;
    }
  }

  async completeGoal(id: string): Promise<LearningGoal> {
    try {
      const response = await apiService.post<ApiResponse<LearningGoal>>(
        `${this.BASE_URL}/${id}/complete`
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error completing goal:', error);
      throw error;
    }
  }

  async abandonGoal(id: string): Promise<LearningGoal> {
    try {
      const response = await apiService.post<ApiResponse<LearningGoal>>(
        `${this.BASE_URL}/${id}/abandon`
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error abandoning goal:', error);
      throw error;
    }
  }

  // ==================== Goal Progress ====================
  async getGoalProgress(id: string): Promise<GoalProgress | null> {
    try {
      const response = await apiService.get<ApiResponse<GoalProgress>>(
        `${this.BASE_URL}/${id}/progress`
      );
      return response.data?.data || response.data || null;
    } catch (error) {
      console.error('Error fetching goal progress:', error);
      return null;
    }
  }

  async updateGoalProgress(
    id: string,
    update: Partial<GoalProgress>
  ): Promise<GoalProgress> {
    try {
      const response = await apiService.post<ApiResponse<GoalProgress>>(
        `${this.BASE_URL}/${id}/progress`,
        update
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating goal progress:', error);
      throw error;
    }
  }

  // ==================== Goal Analytics ====================
  async getGoalAnalytics(id: string): Promise<any> {
    try {
      const response = await apiService.get<ApiResponse<any>>(
        `${this.BASE_URL}/${id}/analytics`
      );
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching goal analytics:', error);
      return null;
    }
  }

  async getGoalsStats(): Promise<GoalStats> {
    try {
      const response = await apiService.get<ApiResponse<GoalStats>>(
        `${this.BASE_URL}/stats/overview`
      );
      const data = response.data?.data || response.data;
      return data || {
        totalGoals: 0,
        activeGoals: 0,
        completedGoals: 0,
        completionRate: 0,
        averageTimeToComplete: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    } catch (error) {
      console.error('Error fetching goal stats:', error);
      return {
        totalGoals: 0,
        activeGoals: 0,
        completedGoals: 0,
        completionRate: 0,
        averageTimeToComplete: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }
  }
}

export const learningGoalsService = new LearningGoalsService();
