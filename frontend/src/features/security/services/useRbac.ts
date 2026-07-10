'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '@/features/auth/services/authService';

export const useRbac = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => authService.getRoles(),
    retry: false,
  });
};
