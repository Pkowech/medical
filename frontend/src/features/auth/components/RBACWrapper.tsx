'use client';

import { ReactNode } from 'react';
import { useRBAC } from '@/features/auth/hooks/useRBAC';
import { Permission } from '@/shared/types';

interface RBACWrapperProps {
  /** The permission required to view the children of this component. */
  requiredPermission?: Permission;
  /** The content to render if the user has the required permission. */
  children: ReactNode;
  /** Optional: A component or element to show while the session is loading. */
  loadingComponent?: ReactNode;
}

/**
 * A client-side component that conditionally renders its children
 * based on the current user's permissions.
 */
export const RBACWrapper = ({
  requiredPermission,
  children,
  loadingComponent = null,
}: RBACWrapperProps) => {
  const { hasRequiredPermission, isLoading } = useRBAC(requiredPermission);

  if (isLoading) {
    return <>{loadingComponent}</>;
  }

  if (!hasRequiredPermission) {
    return null; // Or render an "Access Denied" message
  }

  return <>{children}</>;
};
