'use client';

import { ApiError } from '@/shared/types/systemInterface';

export class ErrorService {
  private static instance: ErrorService;

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  handleApiError(error: ApiError & { endpoint?: string }): void {
    // Suppress logs for "Session expired" or "Authentication required" errors on logout 
    // since they are expected if a session is already invalidated.
    const isLogoutError = error.endpoint?.includes('/logout');
    const isSessionExpired = error.message?.includes('Session expired') || error.message?.includes('Authentication required');
    
    if (error.status === 401 && (isSessionExpired || isLogoutError)) {
      this.handleUnauthorized();
      return;
    }

    this.logError(error);
    switch (error.status) {
      case 401:
        this.handleUnauthorized();
        break;
      case 403:
        this.handleForbidden();
        break;
      case 429:
        this.handleRateLimit();
        break;
      default:
        this.handleGenericError(error);
    }
  }

  private logError(error: ApiError & { endpoint?: string }): void {
    // Placeholder: integrate with monitoring service here
    const errorDetails: Record<string, unknown> = {
      status: error?.status ?? 'unknown',
      code: error?.code ?? 'UNKNOWN_ERROR',
      message: error?.message ?? 'An unexpected error occurred',
      endpoint: error?.endpoint ?? 'unknown',
      timestamp: new Date().toISOString(),
      errorType:
        (error && typeof error === 'object' && 'errorType' in error)
          ? (error as { errorType: string }).errorType
          : 'unknown',
    };

    if (error?.details && typeof error.details === 'object') {
      errorDetails.details = error.details;
    } else if (error?.details) {
      errorDetails.details = error.details;
    }

    // Include raw response body if available for debugging (may be HTML/string)
    const errRec = error as unknown as Record<string, unknown>;
    if (errRec?.rawResponse) {
      try {
        errorDetails.rawResponse = errRec.rawResponse;
      } catch {
        try {
          errorDetails.rawResponse = JSON.stringify(errRec.rawResponse);
        } catch {
          errorDetails.rawResponse = 'unserializable';
        }
      }
    }

    if (error.status === 400) {
      console.warn('API Validation Warning', JSON.stringify(errorDetails, null, 2));
    } else {
      console.error('API Error', JSON.stringify(errorDetails, null, 2));
    }
  }

  private handleUnauthorized(): void {}
  private handleForbidden(): void {}
  private handleRateLimit(): void {}
  private handleGenericError(_error: ApiError): void {}
}

export const errorService = ErrorService.getInstance();

export type { ApiError } from '@/shared/types/systemInterface';

export function isApiError(error: unknown): error is ApiError & { endpoint?: string } {
  return typeof error === 'object' && error !== null && (('message' in error) || ('status' in error));
}

/**
 * Safely handle an unknown error by normalizing it to an ApiError shape
 * and delegating to the singleton errorService.
 */
export function handleUnknownError(error: unknown, endpoint?: string) {
  if (isApiError(error)) {
    // keep endpoint if present on the error object
    const normalized = error as ApiError & { endpoint?: string };
    if (endpoint && !normalized.endpoint) normalized.endpoint = endpoint;
    errorService.handleApiError(normalized);
    return;
  }

  // Fallback normalization for non-ApiError values
  const normalized: ApiError & { endpoint?: string } = {
    message: typeof error === 'string' ? error : (error && typeof error === 'object' && 'message' in error) ? String((error as { message: string }).message) : String(error),
    status: 500,
    code: 'UNKNOWN_ERROR',
    endpoint,
  };

  errorService.handleApiError(normalized);
}
