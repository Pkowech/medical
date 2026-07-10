// src/common/constants/redis-ttl.ts
export const redisTtl = {
  userSession: 24 * 60 * 60, // 24 hours
  userProfile: 60 * 60, // 1 hour
  courseData: 30 * 60, // 30 minutes
  quizCache: 15 * 60, // 15 minutes
  analytics: 10 * 60, // 10 minutes
  leaderboard: 5 * 60, // 5 minutes
  shortCache: 2 * 60, // 2 minutes
} as const;
