import { signIn, signOut, type SignInResponse } from 'next-auth/react';
import { apiService } from '@/features/auth/services/apiClient'; // Use the centralized apiClient
import { useAuthStore } from '@/features/auth/store/useAuthStore'; // Import useAuthStore
import {
  LoginDTO,
  RegisterResponse,
  RegisterDTO,
  User,
  AuthSessionUser,
  GetRolesResponse,
} from '@/shared/types/authInterface';
import { ApiResponse, Session } from '@/shared/types';
import { hasPermission, hasAnyPermission, Role } from '@/lib/auth/roles';

type GenericRecord = Record<string, unknown>;

class AuthService {
  private static instance: AuthService;

  private constructor() {
    // Interceptors are now handled by apiService
    // this.setupInterceptors();
    // this.setupUnauthenticatedInterceptors();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Remove setupInterceptors as apiService handles interceptors
  // private setupInterceptors(): void {
  //   this.axiosInstance.interceptors.request.use(
  //     async (config) => {
  //       const session = await getSession();
  //       const token = session?.user?.accessToken;
  //       if (token) {
  //         config.headers = (config.headers || {}) as import('axios').AxiosRequestHeaders;
  //         config.headers.Authorization = `Bearer ${token}`;
  //       }
  //       return config;
  //     },
  //     (error) => Promise.reject(error)
  //   );

  //   this.axiosInstance.interceptors.response.use(
  //     (response) => response,
  //     async (error) => {
  //       return Promise.reject(error);
  //     }
  //   );
  // }

  // Remove setupUnauthenticatedInterceptors as apiService handles interceptors
  // private setupUnauthenticatedInterceptors(): void {
  //   // Similar interceptor setup for unauthenticatedAxiosInstance if needed
  // }

  async login(credentials: LoginDTO): Promise<SignInResponse | undefined> {
    try {
      const identifier = credentials.identifier || credentials.email;
      const result = await signIn('credentials', {
        identifier,
        password: credentials.password,
        redirect: false,
      });

      if (result?.error) {
        console.error('[AuthService] NextAuth signIn failed:', result.error);
      }

      return result;
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      throw error;
    }
  }

  async register(registerData: RegisterDTO): Promise<RegisterResponse> {
    // Use apiService for registration, as it's an unauthenticated endpoint initially
    const response = await apiService.post<RegisterResponse>('/auth/register', registerData);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      // Call the consolidated backend logout endpoint
      try {
        await apiService.post('/auth/sessions/logout', {});
      } catch (error) {
        // Log but don't throw if backend logout fails
        // We still want to clear local session
        console.warn('[AuthService] Backend logout failed:', error);
      }

      // Clear auth store state
      useAuthStore.getState().clearUser();

      // Use NextAuth's signOut with explicit redirect: false and add timeout
      // This ensures the signout callback is triggered
      // The middleware will handle the redirect to /login
      console.warn('[AuthService] Calling signOut with redirect: false');
      
      try {
        await Promise.race([
          signOut({ redirect: false }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SignOut timeout')), 2000)
          )
        ]);
        console.warn('[AuthService] signOut completed');
      } catch (signOutError) {
        console.warn('[AuthService] signOut timed out or failed:', signOutError);
      }
      
      // Add a small delay to ensure cookies are cleared and session is invalidated
      // before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // After signOut completes, redirect to login
      // This is a fallback in case the middleware redirect doesn't work
      console.warn('[AuthService] Redirecting to /login');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force redirect to login page
      window.location.href = '/login';
    }
  }

  async getAccessToken(): Promise<string | null> {
    // Get token directly from Zustand store (synced by AuthSynchronizer)
    const user = useAuthStore.getState().user;
    return user?.accessToken || null;
  }

  async getSessionUser(): Promise<AuthSessionUser | null> {
    // Get user directly from Zustand store (synced by AuthSynchronizer)
    const user = useAuthStore.getState().user;
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      roles: user.roles || [],
      permissions: user.permissions || [],
      isEmailVerified: user.isEmailVerified,
      accessToken: user.accessToken,
    };
  }

  async verifyEmail(token: string): Promise<ApiResponse<GenericRecord>> {
    const response = await apiService.post<ApiResponse<GenericRecord>>(
      '/auth/security/email/verify',
      { token }
    );
    return response.data;
  }

  async forgotPassword(email: string): Promise<ApiResponse<GenericRecord>> {
    const response = await apiService.post<ApiResponse<GenericRecord>>(
      '/auth/security/recovery/initiate',
      {
        email,
      }
    );
    return response.data;
  }

  async resetPassword(password: string, token: string): Promise<ApiResponse<GenericRecord>> {
    const response = await apiService.post<ApiResponse<GenericRecord>>(
      '/auth/security/recovery/verify',
      {
        token,
        answers: { password }, // Assuming the backend takes password in answers for now or needs another check
      }
    );
    return response.data;
  }

  async resendVerificationEmail(): Promise<ApiResponse<GenericRecord>> {
    const response = await apiService.post<ApiResponse<GenericRecord>>(
      '/auth/security/email/resend',
      {}
    );
    return response.data;
  }

  /**
   * Gets all available roles and their permissions from the backend.
   * @returns A promise that resolves to the GetRolesResponse.
   */
  async getRoles(): Promise<GetRolesResponse> {
    // Lazy import to avoid edge runtime issues with middleware
    const { apiService: apiSvc } = await import('@/features/auth/services/apiClient');
    const response = await apiSvc.get<{ data: GetRolesResponse }>('/security/rbac/roles');
    return response.data.data;
  }

  // RBAC related methods
  hasPermission(permission: string): boolean {
    const user = useAuthStore.getState().user;
    if (!user) return false;
    return hasPermission(user.role, permission as never);
  }

  hasAnyPermission(permissions: string[]): boolean {
    const user = useAuthStore.getState().user;
    if (!user) return false;
    return hasAnyPermission(user.role, permissions as never);
  }

  /**
   * Check if user has a specific role or any of the required roles.
   * Checks against all user roles (stored in user.roles array)
   * @param requiredRoles - A single role string or array of role strings to check
   * @returns true if user has any of the required roles, false otherwise
   */
  hasRole(requiredRoles: string | string[]): boolean {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];

    return rolesArray.some(role => userRoles.includes(role as Role));
  }

  // New method to get user profile from backend
  async getProfile(): Promise<User> {
    const response = await apiService.get<User>('/users/profile');
    return response.data;
  }

  // New method to update user profile
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiService.patch<User>('/users/profile', data);
    return response.data;
  }

  // New method to change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiService.put('/auth/security/password', { currentPassword, newPassword });
  }

  // New method to setup 2FA
  async setupTwoFactorAuth(): Promise<{ otpauthUrl: string }> {
    const response = await apiService.post<{ otpauthUrl: string }>(
      '/auth/security/2fa/setup'
    );
    return response.data;
  }

  // New method to verify 2FA
  async verifyTwoFactorAuth(token: string): Promise<void> {
    await apiService.post('/auth/security/2fa/verify', { token });
  }

  // New method to disable 2FA
  async disableTwoFactorAuth(): Promise<void> {
    await apiService.post('/auth/security/2fa/disable');
  }

  // New method to generate backup codes
  async generateBackupCodes(): Promise<{ backupCodes: string[] }> {
    const response = await apiService.post<{ backupCodes: string[] }>(
      '/auth/security/backup-codes/generate'
    );
    return response.data;
  }

  // New method to get security settings
  async getSecuritySettings(): Promise<GenericRecord> {
    const response = await apiService.get<GenericRecord>('/auth/security/settings');
    return response.data;
  }

  // New method to update security settings
  async updateSecuritySettings(data: GenericRecord): Promise<GenericRecord> {
    const response = await apiService.patch<GenericRecord>('/auth/security/settings', data);
    return response.data;
  }

  // New method to get all sessions for the current user
  async getSessions(): Promise<Session[]> {
    const response = await apiService.get<Session[]>('/auth/sessions');
    return response.data;
  }

  // New method to revoke a specific session
  async revokeSession(sessionId: string): Promise<void> {
    await apiService.delete(`/auth/sessions/${sessionId}`);
  }

  // New method to revoke all sessions
  async revokeAllSessions(): Promise<void> {
    await apiService.post('/auth/sessions/revoke-all');
  }

  // New method to create a guest session
  async createguestSession(): Promise<GenericRecord> {
    const response = await apiService.post<GenericRecord>('/guest-sessions');
    return response.data;
  }

  // New method to convert a guest session to a full user
  async convertguestSession(data: GenericRecord): Promise<GenericRecord> {
    const response = await apiService.post<GenericRecord>('/auth/guest/convert', data);
    return response.data;
  }

  // New method to validate a guest session
  async validateguestSession(): Promise<GenericRecord> {
    const response = await apiService.get<GenericRecord>('/auth/guest/validate');
    return response.data;
  }
}

export const authService = AuthService.getInstance();
