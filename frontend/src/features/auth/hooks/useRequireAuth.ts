'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface UseRequireAuthOptions {
  redirectTo?: string;
  requiredRole?: string | string[];
}

export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const { redirectTo = '/login', requiredRole } = options;
  /* Safe replacement of useSession with useAuth */
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  // const [isLoading, setIsLoading] = useState(true); // Removed local isLoading state conflict

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // If the session is not available (i.e., unauthenticated), redirect to login.
    if (!session) {
      router.push(`${redirectTo}?from=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // At this point, session is available.
    // Check for required role
    if (requiredRole) {
      const userRole = session.user?.role;

      if (Array.isArray(requiredRole)) {
        // Check if user has any of the required roles
        if (!userRole || !requiredRole.includes(userRole)) {
          router.push('/unauthorized'); // Corrected redirection
          return;
        }
      } else {
        // Check if user has the required role
        if (!userRole || userRole !== requiredRole) {
          router.push('/unauthorized'); // Corrected redirection
          return;
        }
      }
    }

    setIsAuthorized(true);
    // setIsLoading(false); // isLoading is now derived from useAuth
  }, [isLoading, session, router, redirectTo, requiredRole]);

  return { isAuthorized, isLoading, session };
}

export default useRequireAuth;
