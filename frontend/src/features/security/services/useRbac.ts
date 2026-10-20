'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '@/features/auth/services/authService';

export const useRbac = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => authService.getRoles(),
    retry: false,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};
