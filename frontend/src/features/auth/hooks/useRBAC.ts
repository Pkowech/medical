import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/auth/roles';
import { UserRole } from '@/shared/types';
import { Permission } from '@/lib/auth/roles';
import { AuthSessionUser } from '@/shared/types/authInterface';
import { useState, useEffect } from 'react';

/**
 * Custom hook for checking user roles and permissions on the client-side.
 *
 * @param requiredPermission Optional. The permission required for a specific action or component.
 * @returns An object with the user's role, loading state, and a boolean indicating if they have the required role.
 */
export const useRBAC = (requiredPermission?: Permission) => {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const [data, setData] = useState<AuthSessionUser | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const userRole = (session?.user?.role as UserRole) || 'guest'; // Default to 'guest' if role is undefined
  const userPermissions = (session?.user?.permissions as string[]) || [];

  useEffect(() => {
    // If no permission is specified, this hook acts as a roles/permissions fetcher
    if (!requiredPermission) {
      // In a real implementation, this would fetch roles from the backend
      // For now, we'll return the user's role/permissions from session
      if (session?.user) {
        const user: AuthSessionUser = {
          id: session.user.id,
          email: session.user.email,
          username: session.user.username,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          role: session.user.role,
          roles: session.user.roles || [],
          permissions: (session.user.permissions || []) as unknown as Permission[],
          isEmailVerified: session.user.isEmailVerified,
          accessToken: session.user.accessToken,
        };
        setData(user);
      } else {
        setData(null);
      }
      if (error) setError(null);
    }
  }, [session, requiredPermission]);

  // Check if the user has the required permission
  const hasRequiredPermission = requiredPermission
    ? hasPermission(userRole as never, requiredPermission as Permission) ||
      userPermissions.includes(requiredPermission)
    : true;

  return {
    /** The role of the currently authenticated user. Defaults to 'guest'. */
    role: userRole,
    /** `true` if the session is still being fetched. */
    isLoading,
    /** `true` if the user has the required permission. */
    hasRequiredPermission,
    /** Data returned when no permission is specified (for RBACAdminPanel) */
    data,
    /** Error when fetching data */
    error,
  };
};
