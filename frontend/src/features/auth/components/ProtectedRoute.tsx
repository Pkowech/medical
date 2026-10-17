'use client';

import { ReactNode, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Permission, hasPermission, Role } from '@/lib/auth/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  unAuthOnly?: boolean;
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  unAuthOnly = false,
  requiredPermission,
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user;
  const hasRequiredPermission = !requiredPermission || Boolean(
    user?.permissions?.includes(requiredPermission) ||
    (user?.role && hasPermission(user.role as Role, requiredPermission as Permission))
  );

  useEffect(() => {
    if (isLoading) return;

    if (unAuthOnly && isAuthenticated) {
      router.replace('/dashboard');
    } else if (!unAuthOnly && !isAuthenticated) {
      const callbackUrl = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?callbackUrl=${callbackUrl}`);
    } else if (!unAuthOnly && isAuthenticated && !hasRequiredPermission) {
      router.replace('/unauthorized');
    }
  }, [hasRequiredPermission, isAuthenticated, isLoading, pathname, router, unAuthOnly]);

  if (
    isLoading ||
    (unAuthOnly && isAuthenticated) ||
    (!unAuthOnly && (!isAuthenticated || !hasRequiredPermission))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true" />
        <span className="sr-only">Checking access…</span>
      </div>
    );
  }

  return <>{children}</>;
}
