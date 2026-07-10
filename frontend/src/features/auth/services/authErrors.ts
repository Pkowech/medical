export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  INVALID_MFA_CODE = 'INVALID_MFA_CODE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  PASSWORD_CONFIRMATION_REQUIRED = 'PASSWORD_CONFIRMATION_REQUIRED',
}

export const AUTH_ERROR_MESSAGES = {
  [AuthErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password',
  [AuthErrorCode.ACCOUNT_LOCKED]: 'Account has been locked due to too many failed attempts',
  [AuthErrorCode.EMAIL_NOT_VERIFIED]: 'Please verify your email address',
  [AuthErrorCode.TOKEN_EXPIRED]: 'Your session has expired, please login again',
  [AuthErrorCode.INVALID_TOKEN]: 'Invalid authentication token',
  [AuthErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to access this resource',
  [AuthErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many attempts, please try again later',
  [AuthErrorCode.MFA_REQUIRED]: 'Multi-factor authentication is required',
  [AuthErrorCode.INVALID_MFA_CODE]: 'Invalid authentication code',
  [AuthErrorCode.SESSION_EXPIRED]: 'Your session has expired',
  [AuthErrorCode.CSRF_TOKEN_INVALID]: 'Invalid security token',
  [AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED]: 'Password confirmation is required',
};

export class AuthErrorHandler {
  static handle(error: unknown): { message: string; code: AuthErrorCode; statusCode: number } {
    if (error instanceof AuthError) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      };
    }

    // Log unexpected errors
    console.error('Unexpected auth error:', error);
    return {
      message: 'An unexpected authentication error occurred',
      code: AuthErrorCode.INVALID_CREDENTIALS,
      statusCode: 500,
    };
  }

  static isAuthError(error: unknown): error is AuthError {
    return error instanceof AuthError;
  }

  static throwError(code: AuthErrorCode, customMessage?: string): never {
    throw new AuthError(customMessage || AUTH_ERROR_MESSAGES[code], code, this.getStatusCode(code));
  }

  private static getStatusCode(code: AuthErrorCode): number {
    switch (code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
      case AuthErrorCode.INVALID_MFA_CODE:
      case AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED:
        return 401;
      case AuthErrorCode.INSUFFICIENT_PERMISSIONS:
        return 403;
      case AuthErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case AuthErrorCode.ACCOUNT_LOCKED:
        return 423;
      default:
        return 400;
    }
  }
}
