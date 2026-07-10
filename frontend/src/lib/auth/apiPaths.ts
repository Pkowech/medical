/**
 * Canonical API paths for the frontend. All frontend code should use
 * these paths. Requests are made directly to the backend API via the
 * centralized apiService, which handles authentication and base URL prefixing.
 */
export const API_PATHS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    SESSION: '/auth/session',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    VERIFY_EMAIL: '/auth/verify-email',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },

  USERS: {
    BASE: '/users',
    PROFILE: '/users/profile',
  },

  COURSES: {
    BASE: '/courses',
    ENROLL: (courseId?: string) =>
      courseId ? `/courses/${courseId}/enroll` : '/courses/enroll',
    FEATURED: '/courses/featured',
    MY_COURSES: '/courses/my-courses',
  },

  MATERIALS: {
    BASE: '/materials',
    UPLOAD: '/materials/upload',
    SHARE: '/materials/share',
  },

  PROGRESS: {
    BASE: '/progress',
    USER: (userId: string) => `/progress/user/${userId}`,
  },

  QUIZ: {
    UNIT: (unitId: string) => `/quiz/unit/${unitId}`,
    SUBMIT: '/quiz/submit',
    RESULTS: (userId: string, unitId: string) => `/quiz/results/${userId}/${unitId}`,
    RAPID_REVIEW: (userId: string) => `/quiz/rapid-review/${userId}`,
  },

  CLINICAL_CASES: {
    BASE: '/clinical-cases',
  },
} as const;

export type ApiPaths = typeof API_PATHS;
