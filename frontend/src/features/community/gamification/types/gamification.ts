export interface UserPoints {
  userId: string;
  totalPoints: number;
  pointsEarnedToday: number;
  level: number;
  nextLevelAt: number;
  streak: number;
  lastUpdated: string;
  milestones: {
    id: string;
    name: string;
    points: number;
    achieved: boolean;
  }[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  conditions: {
    type: string;
    threshold: number;
    current: number;
  }[];
  earnedDate?: string;
  progress: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  rank: number;
  score: number;
  avatar?: string;
  badges: number;
  streak: number;
}

export interface GamificationResponse<T> {
  success: boolean;
  data: T;
}

export interface BadgeListResponse {
  success: boolean;
  data: Badge[];
  total: number;
  page: number;
  limit: number;
}

export interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'allTime';
}

export interface Achievement {
  id: string;
  userId: string;
  type: string;
  name: string;
  description: string;
  earnedAt: string;
  points: number;
}
