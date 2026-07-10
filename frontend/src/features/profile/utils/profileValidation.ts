import type { LocalUserProfile, ValidationResult } from '@/shared/types/profileInterface';

/**
 * Validate a single profile field
 * Returns array of error messages (empty if valid)
 */
export function validateField(name: string, value: string): string[] {
  const errors: string[] = [];

  switch (name) {
    case 'firstName':
    case 'lastName': {
      if (!value.trim()) {
        errors.push(`${name === 'firstName' ? 'First' : 'Last'} name is required`);
      } else if (value.trim().length < 2) {
        errors.push('Must be at least 2 characters');
      } else if (value.trim().length > 50) {
        errors.push('Must be 50 characters or less');
      }
      break;
    }
    case 'bio': {
      if (value.length > 500) {
        errors.push('Bio must be 500 characters or less');
      }
      break;
    }
    case 'phoneNumber': {
      if (value.trim() && !/^[+]?[\d\s\-().]{7,20}$/.test(value.trim())) {
        errors.push('Please enter a valid phone number');
      }
      break;
    }
    case 'location': {
      if (value.trim().length > 100) {
        errors.push('Location must be 100 characters or less');
      }
      break;
    }
    case 'specialization': {
      if (value.trim().length > 100) {
        errors.push('Specialization must be 100 characters or less');
      }
      break;
    }
    case 'yearOfExperience': {
      const num = parseInt(value, 10);
      if (value.trim() && (isNaN(num) || num < 0 || num > 70)) {
        errors.push('Experience must be between 0 and 70 years');
      }
      break;
    }
  }

  return errors;
}

/**
 * Validate the entire profile form
 * Returns validation result with field-level errors
 */
export function validateProfile(profile: LocalUserProfile): ValidationResult {
  const errors: Record<string, string[]> = {};

  const fieldsToValidate: [string, string][] = [
    ['firstName', profile.firstName],
    ['lastName', profile.lastName],
    ['bio', profile.bio || ''],
    ['phoneNumber', profile.phoneNumber || ''],
    ['location', profile.location || ''],
    ['specialization', profile.specialization || ''],
    ['yearOfExperience', profile.yearOfExperience?.toString() || ''],
  ];

  for (const [name, value] of fieldsToValidate) {
    const fieldErrors = validateField(name, value);
    if (fieldErrors.length > 0) {
      errors[name] = fieldErrors;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate an image file for profile upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed' };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Image must be smaller than 5 MB' };
  }

  return { valid: true };
}
