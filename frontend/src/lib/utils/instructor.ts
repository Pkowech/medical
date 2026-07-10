import type { Course } from '@/shared/types/courseInterface';

export function getInstructorDisplayName(
  instructor?: Course['instructor'] | string | null | undefined
): string {
  if (!instructor) return 'Instructor';
  if (typeof instructor === 'string') return instructor;
  if (typeof instructor === 'object') {
    if ('firstName' in instructor && typeof instructor.firstName === 'string')
      return instructor.firstName;
    if ('name' in instructor && typeof instructor.name === 'string') return instructor.name;
  }
  return 'Instructor';
}
