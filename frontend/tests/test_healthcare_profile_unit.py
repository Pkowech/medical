from ts_runtime import run_typescript


def test_healthcare_profile_labels():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { healthcareFieldLabel, healthcareProfileLabel } =
  require('./src/shared/utils/healthcareProfile.ts');

assert.equal(healthcareFieldLabel('medical_laboratory'), 'Medical laboratory science');
assert.equal(
  healthcareProfileLabel({ careerStage: 'student', healthcareField: 'pharmacy' }),
  'Pharmacy Student',
);
assert.equal(
  healthcareProfileLabel({
    careerStage: 'professional',
    healthcareField: 'medicine',
    specialization: 'Cardiology',
  }),
  'Cardiology · Medicine Professional',
);
"""
    )
