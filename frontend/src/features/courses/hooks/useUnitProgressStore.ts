import { createUserScopedCourseProgressStore } from './createUserScopedCourseProgressStore';

export const useUnitProgressStore =
  createUserScopedCourseProgressStore('unit-progress-storage');
