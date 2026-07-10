// store/useAuthStore.ts
import { create } from 'zustand';
import { patchData, apiService } from '@/features/auth/services/apiClient';
import { authService } from '../services/authService'; // Use the unified authService
import { User as BackendUser, RegisterDTO } from '@/shared/types/authInterface';

type User = BackendUser;

interface AuthState {
  user?: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  register: (userData: RegisterDTO) => Promise<unknown>;
  clearError: () => void;
  clearUser: () => void;
  setUser: (user: User | null) => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  clearUser: () => {
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user: User | null) => {
    set({ user, isAuthenticated: !!user });
  },

  refreshSession: async () => {
    try {
      const session = await authService.getSessionUser();
      if (session?.accessToken) {
        const user: User = {
          id: session.id,
          email: session.email,
          username: session.username,
          firstName: session.firstName,
          lastName: session.lastName,
          role: session.role,
          roles: session.roles || [],
          isEmailVerified: session.isEmailVerified,
          permissions: session.permissions || [],
          accessToken: session.accessToken,
          // Default expiry to 1 hour from now if not provided
          accessTokenExpires: Math.floor(Date.now() / 1000) + 3600,
          refreshToken: '', // Will be updated by token refresh
        };
        set({ user, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      set({ user: null, isAuthenticated: false });
    }
  },

  register: async userData => {
    try {
      set({ isLoading: true, error: null });
      const response = await authService.register(userData);
      set({ isLoading: false });
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(error);
      set({ error: message, isLoading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  clearError: () => set({ error: null }),

  updateUser: async userData => {
    try {
      set({ isLoading: true, error: null });
      // This updates the backend. The session can be updated via `useSession().update()` if needed.
      await patchData<Partial<User>>(`/users/profile`, userData);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message || 'Update failed', isLoading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      await apiService.post('/auth/change-password', { currentPassword, newPassword });
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message || 'Change password failed', isLoading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  forgotPassword: async (email: string) => {
    try {
      set({ isLoading: true, error: null });
      await authService.forgotPassword(email);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message || 'Forgot password failed', isLoading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  resetPassword: async (token: string, newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      await authService.resetPassword(token, newPassword);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message || 'Reset password failed', isLoading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  verifyEmail: async (token: string) => {
    try {
      set({ isLoading: true, error: null });
      await authService.verifyEmail(token);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message || 'Email verification failed', isLoading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },
}));
