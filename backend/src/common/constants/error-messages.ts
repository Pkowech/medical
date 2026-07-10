export const ErrorMessages = {
  auth: {
    invalidCredentials: 'Invalid username or password',
    emailExists: 'Email is already registered',
    usernameExists: 'Username is already taken',
    passwordRequirements: {
      length: 'Password must be at least 8 characters long',
      uppercase: 'Password must contain at least one uppercase letter',
      lowercase: 'Password must contain at least one lowercase letter',
      number: 'Password must contain at least one number',
      special:
        'Password must contain at least one special character (!@#$%^&*)',
    },
    tokenInvalid: 'Invalid or expired token',
    tokenMissing: 'Authentication token is required',
    unauthorized: 'You are not authorized to perform this action',
    passwordConfirmationRequired: 'Password confirmation is required',
  },
  validation: {
    required: (field: string) => `${field} is required`,
    invalidFormat: (field: string) => `Invalid ${field} format`,
    minLength: (field: string, length: number) =>
      `${field} must be at least ${length} characters`,
    maxLength: (field: string, length: number) =>
      `${field} must not exceed ${length} characters`,
  },
  server: {
    internalError: 'An internal server error occurred',
    serviceUnavailable: 'Service is temporarily unavailable',
    databaseError: 'Database operation failed',
  },
  user: {
    notFound: 'User not found',
    inactive: 'User account is inactive',
    alreadyExists: 'User already exists',
    accountLocked: 'Account is locked. Please try again later.',
    accountInactive:
      'Account is inactive. Please check your email for activation instructions.',
    tooManyFailedAttempts: 'Too many failed attempts. Account has been locked.',
    twoFactorAuthRequired: 'Two-factor authentication required',
    invalidTwoFactorToken: 'Invalid two-factor authentication token',
    authenticationFailed: 'Authentication failed',
    invalidRefreshToken: 'Invalid refresh token',
    logoutFailed: 'Logout failed',
    invalidGuestSession: 'Invalid guest session',
    roleNotFound: (role: string) => `Role '${role}' not found.`,
  },
} as const;
