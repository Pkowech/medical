import { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/features/auth/services/authService';

interface WithRoleProps {
  requiredRoles: string | string[];
  fallbackUrl?: string;
}

export function withRole<P extends object>(
  WrappedComponent: ComponentType<P>,
  { requiredRoles, fallbackUrl = '/unauthorized' }: WithRoleProps
) {
  return function WithRoleComponent(props: P) {
    const router = useRouter();

    if (!authService.hasRole(requiredRoles)) {
      router.push(fallbackUrl);
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}
