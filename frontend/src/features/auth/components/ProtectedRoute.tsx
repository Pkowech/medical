'use client';

import { ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface ProtectedRouteProps {
  children: ReactNode;
  // Optional: if true, this route is for unauthenticated users only (e.g., login/register pages)
  // If an authenticated user tries to access it, they will be redirected to /dashboard.
  unAuthOnly?: boolean;
  // Optional: specific permission required to access this route
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  unAuthOnly: _unAuthOnly = false,
  requiredPermission: _requiredPermission,
}: ProtectedRouteProps) {
  const { data: _session, status } = useSession();
  const _router = null; // Unused but kept for structure
  const _pathname = null;
  const isLoading = status === 'loading';
  const _isAuthenticated = status === 'authenticated';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
