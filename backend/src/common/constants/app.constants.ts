// src/common/constants/app.constants.ts
export const appConstants = {
  defaultPageSize: 10,
  maxPageSize: 100,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
  supportedDocumentTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  passwordMinLength: 8,
  jwtExpiry: '24h',
  refreshTokenExpiry: '7d',
} as const;

export const userRoles = {
  admin: 'admin',
  instructor: 'instructor',
  student: 'student',
  moderator: 'moderator',
} as const;

export const learningActivityTypes = {
  courseEnrollment: 'course_enrollment',
  unitCompletion: 'unit_completion',
  quizCompleted: 'quiz_completed',
  flashcardSession: 'flashcard_session',
  materialViewed: 'material_viewed',
  login: 'login',
  achievementEarned: 'achievement_earned',
} as const;
