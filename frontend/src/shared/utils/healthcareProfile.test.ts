import {
  healthcareFieldLabel,
  healthcareProfileLabel,
} from './healthcareProfile';

describe('healthcare profile labels', () => {
  it('formats common healthcare fields for display', () => {
    expect(healthcareFieldLabel('medical_laboratory')).toBe(
      'Medical laboratory science',
    );
  });

  it('identifies learners by field and career stage', () => {
    expect(
      healthcareProfileLabel({
        careerStage: 'student',
        healthcareField: 'pharmacy',
      }),
    ).toBe('Pharmacy Student');
  });

  it('includes professional specialty and field', () => {
    expect(
      healthcareProfileLabel({
        careerStage: 'professional',
        healthcareField: 'medicine',
        specialization: 'Cardiology',
      }),
    ).toBe('Cardiology · Medicine Professional');
  });
});
