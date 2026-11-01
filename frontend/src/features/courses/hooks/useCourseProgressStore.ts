import { createUserScopedCourseProgressStore } from './createUserScopedCourseProgressStore';

export const useCourseProgressStore =
  createUserScopedCourseProgressStore('course-progress-storage');
