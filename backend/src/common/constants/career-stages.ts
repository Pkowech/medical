export const CAREER_STAGES = [
  'student',
  'postgraduate',
  'professional',
] as const;

export type CareerStage = (typeof CAREER_STAGES)[number];

export function normalizeCareerStage(value: unknown): CareerStage | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return CAREER_STAGES.includes(normalized as CareerStage)
    ? (normalized as CareerStage)
    : null;
}
