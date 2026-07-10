import { useSession, signIn, signOut } from 'next-auth/react';
import { authService } from '@/features/auth/services/authService';
import type { User, RegisterDTO } from '@/shared/types/authInterface';

const UNAUTHENTICATED_SESSION = { data: null, status: 'unauthenticated' as const };

export const useAuth = () => {
  const { data: session, status } = useSession() ?? UNAUTHENTICATED_SESSION;

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  // Wrap authService methods so callers can use a single hook
  const login = async (identifier: string, password: string) => {
    // Use the signIn function from next-auth/react to trigger the credentials provider flow.
    return signIn('credentials', {
      identifier,
      password,
    });
  };

  const register = async (userData: RegisterDTO) => {
    const resp = await authService.register(userData);
    // After successful registration, the user should be redirected to the login page
    // to establish their NextAuth session. Removing the signIn call here.
    // try {
    //   const signInResult = await signIn('credentials', {
    //     redirect: false,
    //     identifier: (userData?.email as string) || (userData?.username as string) || '',
    //     password: (userData?.password as string) || '',
    //   });
    //   if (signInResult?.error) {
    //     // eslint-disable-next-line no-console
    //     console.error('[useAuth] post-register signIn failed with error:', signInResult.error);
    //   } else if (signInResult?.ok) {
    //     // eslint-disable-next-line no-console
    //     console.log('[useAuth] post-register signIn successful');
    //   }
    // } catch (e) {
    //   // non-fatal
    //   // eslint-disable-next-line no-console
    //   console.error('[useAuth] post-register signIn threw exception', e);
    // }
    return resp;
  };

  const logout = async () => {
    // authService.logout() already calls signOut, no need to call again
    await authService.logout();
  };

  const getCurrentUser = async (): Promise<User | null> => {
    return authService.getSessionUser() as Promise<User | null>; // Changed to getSessionUser
  };

  return {
    session,
    user: session?.user as User | undefined,
    isAuthenticated,
    isLoading,
    // convenience wrappers
    login,
    register,
    logout,
    getCurrentUser,
    // expose raw next-auth helpers if needed
    signIn,
    signOut,
  } as const;
};
