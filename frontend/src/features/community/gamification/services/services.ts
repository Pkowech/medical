// Module-level types for gamification
export interface Reward {
  id: string;
  title: string;
  description?: string;
  points: number;
  // backend uses `requiredPoints` in CreateRewardDto; frontend shows pointsCost
  requiredPoints?: number | string;
  isActive?: boolean;
  redeemed?: boolean;
  redeemedDate?: string;
  imageUrl?: string;
  // Backward-compatible fields some components expect
  name?: string;
  pointsCost?: number;
}

export interface LeaderboardEntry {
  userId: string;
  name?: string;
  displayName?: string;
  userName?: string;
  points?: number;
  totalPoints?: number;
  score?: number;
  rank?: number;
}

export {};
