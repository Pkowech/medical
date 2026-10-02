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
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  CURRENT_PASSWORD_INCORRECT = 'CURRENT_PASSWORD_INCORRECT',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RECOVERY_NOT_CONFIGURED = 'RECOVERY_NOT_CONFIGURED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
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
  [AuthErrorCode.USERNAME_TAKEN]: 'That username is already in use. Please choose another.',
  [AuthErrorCode.EMAIL_TAKEN]: 'An account with this email already exists.',
  [AuthErrorCode.CURRENT_PASSWORD_INCORRECT]: 'Your current password is incorrect.',
  [AuthErrorCode.PASSWORD_POLICY_VIOLATION]: 'The new password does not meet the password requirements.',
  [AuthErrorCode.VALIDATION_FAILED]: 'Please check the highlighted fields and try again.',
  [AuthErrorCode.SERVICE_UNAVAILABLE]: 'Something went wrong while signing you in. Please try again later.',
  [AuthErrorCode.RECOVERY_NOT_CONFIGURED]: 'Password recovery is not configured yet. You can change your password in Settings while signed in.',
  [AuthErrorCode.NETWORK_ERROR]: 'We could not connect right now. Check your connection and try again later.',
  [AuthErrorCode.REQUEST_TIMEOUT]: 'Signing in is taking longer than expected. Please try again in a moment.',
};

export interface AuthErrorDetails {
  message: string;
  code: AuthErrorCode;
  statusCode: number;
  fieldErrors: Record<string, string>;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : undefined;
}

function messageText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const messages = value.map(messageText).filter((item): item is string => !!item);
    return messages.length ? messages.join('. ') : undefined;
  }
  return undefined;
}

function readFieldErrors(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record)
      .map(([field, message]) => [field, messageText(message)])
      .filter((entry): entry is [string, string] => !!entry[1])
  );
}

function inferFieldErrors(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};

  const fields: Record<string, string> = {};
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/(passwords do not match|password confirmation)/.test(item.toLowerCase())) {
      fields.confirmPassword = item;
      continue;
    }
    const field = [
      'email',
      'username',
      'confirmpassword',
      'currentpassword',
      'password',
      'firstname',
      'lastname',
      'acceptterms',
    ].find(name => normalized.includes(name));

    if (field) {
      fields[field] = item;
    }
  }
  return fields;
}

export function getAuthErrorDetails(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): AuthErrorDetails {
  if (error instanceof AuthError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      fieldErrors: {},
    };
  }
  if (typeof error === 'string') {
    const matchingCode = Object.values(AuthErrorCode).find(code => code === error);
    if (matchingCode) {
      return {
        message: AUTH_ERROR_MESSAGES[matchingCode],
        code: matchingCode,
        statusCode: 0,
        fieldErrors: {},
      };
    }

    const nextAuthErrors: Record<string, { code: AuthErrorCode; message: string }> = {
      CredentialsSignin: {
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid username/email or password.',
      },
      Configuration: {
        code: AuthErrorCode.SERVICE_UNAVAILABLE,
        message: 'Sign-in is temporarily unavailable. Please try again later.',
      },
      AccessDenied: {
        code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
        message: AUTH_ERROR_MESSAGES[AuthErrorCode.INSUFFICIENT_PERMISSIONS],
      },
      OAuthSignin: {
        code: AuthErrorCode.SERVICE_UNAVAILABLE,
        message: 'Could not start provider sign-in. Please try again.',
      },
      OAuthCallback: {
        code: AuthErrorCode.SERVICE_UNAVAILABLE,
        message: 'Provider sign-in could not be completed. Please try again.',
      },
    };
    const mapped = nextAuthErrors[error];
    if (mapped) {
      return { ...mapped, statusCode: 0, fieldErrors: {} };
    }

    const normalizedError = error.toLowerCase();
    let code = AuthErrorCode.VALIDATION_FAILED;
    let message = error;
    if (
      /(invalid|incorrect).*(email|username|password)|(email|username|password).*(invalid|incorrect)/.test(
        normalizedError
      )
    ) {
      code = AuthErrorCode.INVALID_CREDENTIALS;
      message = 'Invalid username/email or password.';
    } else if (normalizedError.includes('locked')) {
      code = AuthErrorCode.ACCOUNT_LOCKED;
    } else if (/(not verified|verify.*email|email.*verification)/.test(normalizedError)) {
      code = AuthErrorCode.EMAIL_NOT_VERIFIED;
    } else if (/(too many|rate limit|try again later)/.test(normalizedError)) {
      code = AuthErrorCode.RATE_LIMIT_EXCEEDED;
    } else if (normalizedError.includes('multi-factor')) {
      code = AuthErrorCode.MFA_REQUIRED;
    } else if (normalizedError.includes('permission')) {
      code = AuthErrorCode.INSUFFICIENT_PERMISSIONS;
    } else if (normalizedError.includes('token') && normalizedError.includes('expired')) {
      code = AuthErrorCode.TOKEN_EXPIRED;
    } else if (normalizedError.includes('token') && normalizedError.includes('invalid')) {
      code = AuthErrorCode.INVALID_TOKEN;
    } else if (normalizedError.includes('passwords do not match')) {
      code = AuthErrorCode.PASSWORD_CONFIRMATION_REQUIRED;
    } else if (/(timed out|timeout|aborted|taking longer than expected)/.test(normalizedError)) {
      code = AuthErrorCode.REQUEST_TIMEOUT;
      message = AUTH_ERROR_MESSAGES[code];
    } else if (
      /(temporarily unavailable|service unavailable|failed to fetch|network error)/.test(
        normalizedError
      )
    ) {
      code = AuthErrorCode.SERVICE_UNAVAILABLE;
      message = AUTH_ERROR_MESSAGES[code];
    } else if (normalizedError.includes('password recovery is not configured')) {
      code = AuthErrorCode.RECOVERY_NOT_CONFIGURED;
      message = AUTH_ERROR_MESSAGES[code];
    }

    return { message, code, statusCode: 0, fieldErrors: {} };
  }

  const root = asRecord(error);
  const response = asRecord(root?.response);
  const responseData = asRecord(response?.data);
  const rawResponse = asRecord(root?.rawResponse);
  const details = asRecord(root?.details);
  const data = responseData ?? rawResponse;
  const statusCode =
    (typeof response?.status === 'number' && response.status) ||
    (typeof root?.status === 'number' && root.status) ||
    (typeof data?.statusCode === 'number' && data.statusCode) ||
    0;
  const responseMessage =
    messageText(data?.message) ??
    messageText(data?.error) ??
    messageText(root?.message);
  const message = responseMessage ?? fallback;
  const normalized = message.toLowerCase();
  let code = AuthErrorCode.VALIDATION_FAILED;

  if (normalized.includes('username') && /(already exists|already taken|must be unique)/.test(normalized)) {
    code = AuthErrorCode.USERNAME_TAKEN;
  } else if (normalized.includes('email') && /(already exists|already registered|already taken)/.test(normalized)) {
    code = AuthErrorCode.EMAIL_TAKEN;
  } else if (normalized.includes('current password') && /(incorrect|invalid|wrong)/.test(normalized)) {
    code = AuthErrorCode.CURRENT_PASSWORD_INCORRECT;
  } else if (normalized.includes('password') && /(must|at least|requirements|too short)/.test(normalized)) {
    code = AuthErrorCode.PASSWORD_POLICY_VIOLATION;
  } else if (normalized.includes('token') && /(expired|invalid)/.test(normalized)) {
    code = normalized.includes('expired') ? AuthErrorCode.TOKEN_EXPIRED : AuthErrorCode.INVALID_TOKEN;
  } else if (/(not verified|verify.*email|email.*verification)/.test(normalized)) {
    code = AuthErrorCode.EMAIL_NOT_VERIFIED;
  } else if (normalized.includes('locked')) {
    code = AuthErrorCode.ACCOUNT_LOCKED;
  } else if (normalized.includes('permission')) {
    code = AuthErrorCode.INSUFFICIENT_PERMISSIONS;
  } else if (statusCode === 401) {
    code = AuthErrorCode.INVALID_CREDENTIALS;
  } else if (statusCode === 403) {
    code = AuthErrorCode.INSUFFICIENT_PERMISSIONS;
  } else if (statusCode === 429) {
    code = AuthErrorCode.RATE_LIMIT_EXCEEDED;
  } else if (statusCode === 423) {
    code = AuthErrorCode.ACCOUNT_LOCKED;
  } else if (
    statusCode === 501 ||
    normalized.includes('password recovery is not configured')
  ) {
    code = AuthErrorCode.RECOVERY_NOT_CONFIGURED;
  } else if (statusCode >= 500) {
    code = AuthErrorCode.SERVICE_UNAVAILABLE;
  } else if (
    root?.errorType === 'timeout' ||
    root?.errorType === 'network' ||
    (!root?.response && (root?.code === 'ERR_NETWORK' || root?.code === 'ECONNABORTED'))
  ) {
    code =
      root?.errorType === 'timeout' || root?.code === 'ECONNABORTED'
        ? AuthErrorCode.REQUEST_TIMEOUT
        : AuthErrorCode.NETWORK_ERROR;
  }

  const errors = asRecord(data?.errors);
  const responseValidationMessages = Array.isArray(data?.message) ? data.message : [];
  const validationErrors =
    asRecord(data?.validationErrors) ??
    asRecord(details?.validationErrors) ??
    errors;
  const fieldErrors = {
    ...inferFieldErrors(responseValidationMessages),
    ...readFieldErrors(validationErrors),
  };

  return {
    message:
      code === AuthErrorCode.SERVICE_UNAVAILABLE ||
      code === AuthErrorCode.RECOVERY_NOT_CONFIGURED ||
      code === AuthErrorCode.NETWORK_ERROR ||
      code === AuthErrorCode.REQUEST_TIMEOUT
        ? AUTH_ERROR_MESSAGES[code]
        : message,
    code,
    statusCode,
    fieldErrors,
  };
}

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
