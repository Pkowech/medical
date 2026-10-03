import type { Course } from '@/shared/types/courseInterface';

export function getInstructorDisplayName(
  instructor?: Course['instructor'] | Course['createdBy'] | null
): string {
  if (!instructor) return 'Instructor';
  if (typeof instructor === 'string') return instructor;
  if (typeof instructor === 'object') {
    if ('firstName' in instructor && typeof instructor.firstName === 'string') {
      const fullName = [instructor.firstName, 'lastName' in instructor ? instructor.lastName : '']
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();
      if (fullName) return fullName;
    }
    if ('name' in instructor && typeof instructor.name === 'string') return instructor.name;
  }
  return 'Instructor';
}
