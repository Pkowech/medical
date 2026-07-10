// src/common/constants/cache-keys.ts

export const cacheKeys = {
  userProfile: (userId: string) => `user:profile:${userId}`,
  userCourses: (userId: string) => `user:courses:${userId}`,
  courseDetails: (courseId: string) => `course:details:${courseId}`,
  courseUnits: (courseId: string) => `course:units:${courseId}`,
  userProgress: (userId: string, courseId: string) =>
    `progress:${userId}:${courseId}`,
  quizQuestions: (quizId: string) => `quiz:questions:${quizId}`,
  leaderboard: (type: string) => `leaderboard:${type}`,
  analyticsCache: (userId: string, type: string) =>
    `analytics:${userId}:${type}`,

  // Added keys for units
  unitsAll: (courseId: string, userId: string) =>
    `units:all:${courseId}:${userId}`,
  unitById: (unitId: string) => `unit:${unitId}`,
  unitsByCourse: (courseId: string) => `units:course:${courseId}`,

  // Added keys for progress
  progressByUser: (userId: string) => `progress:user:${userId}`,
  progressByUserCourse: (userId: string, courseId: string) =>
    `progress:user:${userId}:course:${courseId}`,
  progressOverall: (userId: string) => `progress:overall:${userId}`,
} as const;
