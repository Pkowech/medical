from ts_runtime import run_typescript


def test_profile_username_uses_auth_validation_rules():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { validateField, validateProfile } =
  require('./src/features/profile/utils/profileValidation.ts');

assert.deepEqual(validateField('username', 'valid_user-1'), []);
assert.equal(validateField('username', 'Invalid Name').length, 1);

const profile = {
  username: 'Invalid Name',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: '',
  bio: '',
  location: '',
  careerStage: '',
  healthcareField: '',
  studyYear: null,
  specialization: '',
  yearOfExperience: null,
};
const validation = validateProfile(profile);
assert.equal(validation.isValid, false);
assert.equal(validation.errors.username.length, 1);
"""
    )
