import axios, { AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { signOut, getSession } from 'next-auth/react';
import { ApiError, ApiResponse, RequestOptions } from '@/shared/types';
import { errorService } from '@/app/services/error.service';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

// Enhanced error classification
type ErrorType = 'network' | 'timeout' | 'auth' | 'validation' | 'server' | 'unknown';

interface EnhancedApiError extends ApiError {
  errorType: ErrorType;
  isRetryable: boolean;
  timestamp: string;
  url?: string;
  method?: string;
  rawResponse?: unknown;
}

class ApiService {
  private static instance: ApiService;
  private api: AxiosInstance;
  private refreshTokenPromise: Promise<boolean> | null = null;
  private isSigningOut = false;

  private static buildApiBaseUrl(): string {
    // Use backend URL with /v1 prefix directly
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    return `${backendUrl}/v1`;
  }

  private constructor() {
    const baseURL = ApiService.buildApiBaseUrl();
    this.api = axios.create({
      baseURL,
      timeout: 30000,
      withCredentials: true,
    });
    this.setupInterceptors();
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Classify error type for better handling and logging
   */
  private classifyError(error: unknown): ErrorType {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        // Network error
        if (error.code === 'ECONNABORTED' || error.message === 'timeout of 30000ms exceeded') {
          return 'timeout';
        }
        return 'network';
      }

      const status = error.response.status;
      if (status === 401 || status === 403) {
        return 'auth';
      }
      if (status === 400 || status === 422) {
        return 'validation';
      }
      if (status >= 500) {
        return 'server';
      }
      return 'unknown';
    }
    return 'unknown';
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(errorType: ErrorType, status?: number): boolean {
    if (errorType === 'timeout' || errorType === 'network') {
      return true;
    }
    if (errorType === 'server' && status && status >= 500 && status < 599) {
      // Retry on server errors except 501 Not Implemented
      return status !== 501;
    }
    return false;
  }

  private setupInterceptors(): void {
    // Request interceptor - uses Zustand store for token (not getSession on every request)
    this.api.interceptors.request.use(
      config => {
        try {
          // Get token from Zustand store (should be synced by AuthSynchronizer on mount)
          const user = useAuthStore.getState().user;
          const token = user?.accessToken;

          if (token) {
            // Ensure headers object exists
            config.headers.Authorization = `Bearer ${token}`;
            const isFormData =
              typeof FormData !== 'undefined' && config.data instanceof FormData;
            if (!isFormData) {
              config.headers['Content-Type'] = 'application/json';
            }
            // Add credentials
            config.withCredentials = true;
          } else {
            // Don't warn for public endpoints like /auth/login, /auth/register
            if (!config.url?.includes('/auth/')) {
              console.warn('[ApiClient] No access token found for request to:', config.url);
            }
          }
          return config;
        } catch (error) {
          console.error('[ApiClient] Request interceptor error:', error);
          return Promise.reject(error);
        }
      },
      error => {
        console.error('[ApiClient] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        const errorType = this.classifyError(error);

        // --- OFFLINE SYNC INTEGRATION START ---
        // Identify if this is a mutation (POST, PUT, PATCH, DELETE) that failed due to network
        // Note: 503 is also often a temporary server issue worth queuing
        const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
          originalRequest.method?.toUpperCase() || ''
        );
        const isNetworkOrServerTemp =
          errorType === 'network' ||
          errorType === 'timeout' ||
          (axios.isAxiosError(error) && error.response?.status === 503);

        if (isMutation && isNetworkOrServerTemp) {
          try {
            // Lazy load syncService to separate imports slightly (optional but safe)
            const { syncService } = await import('@/lib/core/offline/syncService');
            console.warn(
              `[Offline] Queuing mutation: ${originalRequest.method} ${originalRequest.url}`
            );

            // Queue request
            await syncService.addToOutbox(
              originalRequest.url || '',
              (originalRequest.method?.toUpperCase() || 'POST') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
              originalRequest.data
                ? typeof originalRequest.data === 'string'
                  ? JSON.parse(originalRequest.data)
                  : originalRequest.data
                : undefined,
              originalRequest.headers as Record<string, string> // Includes Auth headers
            );

            // Return "Optimistic Success"
            // The UI should handle this gracefully by checking for an 'offline' flag if needed
            // or we just return a standard success structure.
            return {
              data: {
                success: true,
                message: 'Operation queued for offline sync',
                offline: true, // Marker for UI
                queuedAt: new Date().toISOString(),
              },
              status: 200,
              statusText: 'OK (Offline Queued)',
              headers: {},
              config: originalRequest,
            } as AxiosResponse;
          } catch (queueError) {
            console.error('[Offline] Failed to queue request', queueError);
            // Fall through to normal error handling
          }
        }
        // --- OFFLINE SYNC INTEGRATION END ---

        // Handle token refresh for 401s except for auth endpoints
        if (
          errorType === 'auth' &&
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/')
        ) {
          // Even if we didn't send a token (store might not be synced yet),
          // NextAuth might still have a valid session cookie.
          originalRequest._retry = true;

          try {
            // Ensure only one token refresh request is in flight
            if (!this.refreshTokenPromise) {
              this.refreshTokenPromise = (async () => {
                // Simply calling getSession() triggers the NextAuth JWT callback,
                // which handles the background refresh if needed.
                const session = await getSession();
                return !!session?.user?.accessToken;
              })();
            }

            const refreshSuccess = await this.refreshTokenPromise;
            this.refreshTokenPromise = null;

            if (refreshSuccess) {
              const newSession = await getSession();
              if (newSession?.user?.accessToken) {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${newSession.user.accessToken}`;

                // Sync the new token into the store immediately
                if (newSession?.user) {
                  useAuthStore.setState({ 
                    user: newSession.user as unknown as ReturnType<typeof useAuthStore.getState>['user'],
                    isAuthenticated: true,
                  });
                }

                return this.api(originalRequest);
              }
            }

            // If we get here, refresh genuinely failed (e.g. refresh token expired)
            if (!this.isSigningOut) {
              this.isSigningOut = true;
              console.error('[Token Refresh] Token refresh failed, signing out');

              // Clear store immediately to prevent other parallel requests from using the stale token
              useAuthStore.getState().clearUser();
              
              // Use Promise.race to add timeout to signOut
              try {
                await Promise.race([
                  signOut({ redirect: false }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('SignOut timeout')), 2000)
                  )
                ]);
              } catch (signOutError) {
                console.warn('[Token Refresh] signOut timed out or failed:', signOutError);
              }

              // Add a small delay to allow session-token cookie to be fully cleared
              await new Promise(resolve => setTimeout(resolve, 500));
              this.isSigningOut = false;

              // Force a reload or redirect to ensure clean state
              console.warn('[Token Refresh] Redirecting to login page');
              window.location.href = '/login';
            }
          } catch (refreshError) {
            console.error('[Token Refresh] Token refresh error:', refreshError);
            this.refreshTokenPromise = null;

            if (!this.isSigningOut) {
              this.isSigningOut = true;
              useAuthStore.getState().clearUser();
              
              // Use Promise.race to add timeout to signOut
              try {
                await Promise.race([
                  signOut({ redirect: false }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('SignOut timeout')), 2000)
                  )
                ]);
              } catch (signOutError) {
                console.warn('[Token Refresh] signOut timed out or failed during error handling:', signOutError);
              }
              
              console.warn('[Token Refresh] Redirecting to login page from error handler');
              window.location.href = '/login';
            }
          }

          return Promise.reject(
            this.createEnhancedError(error, 'Session expired. Please log in again.', 'auth')
          );
        }

        // Transform error response
        const enhancedError = this.createEnhancedError(
          error,
          axios.isAxiosError(error) ? error.response?.data?.message : undefined,
          errorType
        );

        // Pass the enhanced error directly to the error service for centralized handling and logging
        errorService.handleApiError({
          ...enhancedError,
          endpoint: originalRequest?.url,
          method: originalRequest?.method?.toUpperCase(),
        });

        return Promise.reject(enhancedError);
      }
    );
  }

  /**
   * Create enhanced error object with full context
   */
  private createEnhancedError(
    error: unknown,
    message?: string,
    errorType?: ErrorType
  ): EnhancedApiError {
    const err = error as {
      response?: {
        status?: number;
        data?: {
          details?: Record<string, unknown>;
          validationErrors?: unknown;
          code?: string;
          message?: string;
        };
        statusText?: string;
      };
      code?: string;
      message?: string;
      config?: { url?: string; method?: string };
      status?: number;
    };

    const status = err.response?.status ?? err.status ?? 500;
    const classifiedErrorType = errorType || this.classifyError(error);
    const isRetryable = this.isRetryable(classifiedErrorType, status);

    const detailsFromResponse = err.response?.data?.details ?? {};
    const validationErrors = err.response?.data?.validationErrors;

    const errorDetails: Record<string, unknown> = {
      ...(detailsFromResponse as Record<string, unknown>),
      ...(validationErrors ? { validationErrors } : {}),
      ...(err.response?.statusText ? { statusText: err.response.statusText } : {}),
    };

    return {
      code: err.response?.data?.code ?? err.code ?? 'UNKNOWN_ERROR',
      message:
        message ?? err.response?.data?.message ?? err.message ?? 'An unexpected error occurred',
      details: Object.keys(errorDetails).length > 0 ? errorDetails : undefined,
      rawResponse: err.response?.data,
      status,
      errorType: classifiedErrorType,
      isRetryable,
      timestamp: new Date().toISOString(),
      url: err.config?.url,
      method: err.config?.method?.toUpperCase?.(),
    };
  }

  async get<T = unknown>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        headers: options?.headers,
        params: options?.params,
        timeout: options?.timeout,
        withCredentials: options?.withCredentials,
        responseType: options?.responseType,
        signal: options?.signal,
      };

      const response: AxiosResponse<ApiResponse<T>> = await this.api.get(url, config);
      return response.data;
    } catch (error) {
      if (error instanceof Error && 'isRetryable' in error) {
        // Already enhanced error, just rethrow
        throw error;
      }
      throw this.createEnhancedError(error);
    }
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        headers: options?.headers,
        params: options?.params,
        timeout: options?.timeout,
        withCredentials: options?.withCredentials,
        responseType: options?.responseType,
        onUploadProgress: options?.onUploadProgress
          ? (progressEvent: import('axios').AxiosProgressEvent) => {
              // Normalize and forward to the provided handler. Use a loose cast because
              // handlers in callers may accept browser ProgressEvent or AxiosProgressEvent.
              (options.onUploadProgress as (ev: unknown) => void)(progressEvent as unknown);
            }
          : undefined,
      };

      const response: AxiosResponse<ApiResponse<T>> = await this.api.post(url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof Error && 'isRetryable' in error) {
        throw error;
      }
      throw this.createEnhancedError(error);
    }
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        headers: options?.headers,
        params: options?.params,
        timeout: options?.timeout,
        withCredentials: options?.withCredentials,
        responseType: options?.responseType,
        signal: options?.signal,
      };

      const response: AxiosResponse<ApiResponse<T>> = await this.api.put(url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof Error && 'isRetryable' in error) {
        throw error;
      }
      throw this.createEnhancedError(error);
    }
  }

  async patch<T = unknown>(
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        headers: options?.headers,
        params: options?.params,
        timeout: options?.timeout,
        withCredentials: options?.withCredentials,
        responseType: options?.responseType,
        signal: options?.signal,
      };

      const response: AxiosResponse<ApiResponse<T>> = await this.api.patch(url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof Error && 'isRetryable' in error) {
        throw error;
      }
      throw this.createEnhancedError(error);
    }
  }

  async delete<T = unknown>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        headers: options?.headers,
        params: options?.params,
        timeout: options?.timeout,
        withCredentials: options?.withCredentials,
      };

      const response: AxiosResponse<ApiResponse<T>> = await this.api.delete(url, config);
      return response.data;
    } catch (error) {
      if (error instanceof Error && 'isRetryable' in error) {
        throw error;
      }
      throw this.createEnhancedError(error);
    }
  }
}

const apiService = ApiService.getInstance();
export { apiService };
export default apiService;

// Backwards-compatible helper functions used across the codebase
export async function getData<T = unknown>(url: string, options?: RequestOptions) {
  return apiService.get<T>(url, options);
}

export async function postData<T = unknown>(
  url: string,
  data?: unknown,
  options?: RequestOptions
) {
  return apiService.post<T>(url, data, options);
}

export async function putData<T = unknown>(
  url: string,
  data?: unknown,
  options?: RequestOptions
) {
  return apiService.put<T>(url, data, options);
}

export async function patchData<T = unknown>(
  url: string,
  data?: unknown,
  options?: RequestOptions
) {
  return apiService.patch<T>(url, data, options);
}

export async function deleteData<T = unknown>(url: string, options?: RequestOptions) {
  return apiService.delete<T>(url, options);
}