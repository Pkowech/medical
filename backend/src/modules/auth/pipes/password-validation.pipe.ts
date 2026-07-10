import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// src/common/validators/password-complexity.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ErrorMessages } from '#common/constants/error-messages';

interface PasswordConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars: string;
}

interface ValueWithPassword {
  password?: string;
  [key: string]: any;
}

@Injectable()
export class PasswordValidationPipe implements PipeTransform {
  constructor(private readonly configService: ConfigService) {}

  transform(value: ValueWithPassword): ValueWithPassword {
    if (!value?.password) {
      return value;
    }

    const passwordConfig = this.configService.get<PasswordConfig>(
      'app.security.password',
    ) || {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      allowedSpecialChars: '!@#$%^&*?/',
    };

    const password = value.password;
    const passwordErrors: string[] = [];

    // Length validation
    if (password.length < passwordConfig.minLength) {
      passwordErrors.push(
        `Password must be at least ${passwordConfig.minLength} characters long`,
      );
    }

    // Uppercase validation
    if (passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
      passwordErrors.push(
        'Password must contain at least one uppercase letter',
      );
    }

    // Lowercase validation
    if (passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
      passwordErrors.push(
        'Password must contain at least one lowercase letter',
      );
    }

    // Number validation
    if (passwordConfig.requireNumbers && !/[0-9]/.test(password)) {
      passwordErrors.push('Password must contain at least one number');
    }

    // Special character validation
    if (passwordConfig.requireSpecialChars) {
      const specialCharsRegex = new RegExp(
        `[${passwordConfig.allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`,
      );
      if (!specialCharsRegex.test(password)) {
        passwordErrors.push(
          `Password must contain at least one special character (${passwordConfig.allowedSpecialChars})`,
        );
      }
    }

    if (passwordErrors.length > 0) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        details: passwordErrors,
      });
    }

    return value;
  }
}

/**
 * Password complexity requirements
 */
export interface PasswordComplexityConfig {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  specialChars?: string;
}

/**
 * Default password complexity configuration
 */
const DEFAULT_CONFIG: PasswordComplexityConfig = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

@ValidatorConstraint({ name: 'passwordComplexity', async: false })
export class PasswordComplexityConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    const config: PasswordComplexityConfig =
      args.constraints[0] || DEFAULT_CONFIG;

    // Check minimum length
    if (config.minLength && password.length < config.minLength) {
      return false;
    }

    // Check uppercase requirement
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    // Check lowercase requirement
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      return false;
    }

    // Check numbers requirement
    if (config.requireNumbers && !/\d/.test(password)) {
      return false;
    }

    // Check special characters requirement
    if (config.requireSpecialChars) {
      const specialChars =
        config.specialChars || DEFAULT_CONFIG.specialChars || '';
      const hasSpecialChar = specialChars
        .split('')
        .some((char) => password.includes(char));
      if (!hasSpecialChar) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const config: PasswordComplexityConfig =
      args.constraints[0] || DEFAULT_CONFIG;
    const requirements: string[] = [];

    if (config.minLength) {
      requirements.push(ErrorMessages.auth.passwordRequirements.length);
    }
    if (config.requireUppercase) {
      requirements.push(ErrorMessages.auth.passwordRequirements.uppercase);
    }
    if (config.requireLowercase) {
      requirements.push(ErrorMessages.auth.passwordRequirements.lowercase);
    }
    if (config.requireNumbers) {
      requirements.push(ErrorMessages.auth.passwordRequirements.number);
    }
    if (config.requireSpecialChars) {
      requirements.push(ErrorMessages.auth.passwordRequirements.special);
    }

    return requirements.join('. ');
  }
}

/**
 * Decorator for password complexity validation
 *
 * @example
 * ```typescript
 * class RegisterDto {
 *   @IsPasswordComplex()
 *   password: string;
 * }
 * ```
 *
 * @example With custom config
 * ```typescript
 * class RegisterDto {
 *   @IsPasswordComplex({ minLength: 12, requireSpecialChars: false })
 *   password: string;
 * }
 * ```
 */
export function IsPasswordComplex(
  config?: PasswordComplexityConfig,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [config || DEFAULT_CONFIG],
      validator: PasswordComplexityConstraint,
    });
  };
}

/**
 * Utility function to validate password complexity programmatically
 */
export function validatePasswordComplexity(
  password: string,
  config: PasswordComplexityConfig = DEFAULT_CONFIG,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (config.minLength && password.length < config.minLength) {
    errors.push(ErrorMessages.auth.passwordRequirements.length);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push(ErrorMessages.auth.passwordRequirements.uppercase);
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push(ErrorMessages.auth.passwordRequirements.lowercase);
  }

  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push(ErrorMessages.auth.passwordRequirements.number);
  }

  if (config.requireSpecialChars) {
    const specialChars =
      config.specialChars || DEFAULT_CONFIG.specialChars || '';
    const hasSpecialChar = specialChars
      .split('')
      .some((char) => password.includes(char));
    if (!hasSpecialChar) {
      errors.push(ErrorMessages.auth.passwordRequirements.special);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate password strength score (0-100)
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) {
    return 0;
  }

  let score = 0;

  // Length score (max 30 points)
  score += Math.min(password.length * 3, 30);

  // Complexity scores
  if (/[a-z]/.test(password)) {
    score += 10;
  }
  if (/[A-Z]/.test(password)) {
    score += 15;
  }
  if (/\d/.test(password)) {
    score += 15;
  }
  if (/[!@#$%^&*()_+-=[\]{}|;:,.<>?]/.test(password)) {
    score += 20;
  }

  // Variety bonus
  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars * 2, 10);

  return Math.min(score, 100);
}
