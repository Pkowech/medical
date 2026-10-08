export const healthcareFields = [
  { value: 'medicine', label: 'Medicine' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dentistry', label: 'Dentistry' },
  { value: 'physiotherapy', label: 'Physiotherapy' },
  { value: 'occupational_therapy', label: 'Occupational therapy' },
  { value: 'medical_laboratory', label: 'Medical laboratory science' },
  { value: 'radiography', label: 'Radiography and imaging' },
  { value: 'public_health', label: 'Public health' },
  { value: 'allied_health', label: 'Other allied health' },
  { value: 'other', label: 'Other' },
] as const;

export function healthcareFieldLabel(value?: string | null): string {
  if (!value) return '';
  const normalized = value.toLowerCase();
  const option = healthcareFields.find(
    field =>
      field.value === normalized || field.label.toLowerCase() === normalized,
  );
  return option?.label ?? value.replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export function healthcareProfileLabel(profile: {
  careerStage?: string | null;
  healthcareField?: string | null;
  specialization?: string | null;
}): string {
  const field = healthcareFieldLabel(profile.healthcareField);
  const stage = profile.careerStage === 'student'
    ? 'Student'
    : profile.careerStage === 'professional'
      ? 'Professional'
      : '';
  const focus = profile.specialization?.trim();

  if (focus && field) return `${focus} · ${field} ${stage}`.trim();
  if (focus) return `${focus} ${stage}`.trim();
  if (field) return `${field} ${stage}`.trim();
  return stage || 'Healthcare learner';
}
