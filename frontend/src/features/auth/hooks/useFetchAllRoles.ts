'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authService';

export const useFetchAllRoles = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => authService.getRoles(),
    retry: false,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};
