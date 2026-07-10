'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authService';

export const useFetchAllRoles = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => authService.getRoles(),
    retry: false,
  });
};
