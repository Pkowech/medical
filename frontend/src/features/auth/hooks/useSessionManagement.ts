'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionService } from '../services/sessionService';

const queryKey = ['sessions'];

export const useSessionManagement = () => {
  const queryClient = useQueryClient();

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: sessionService.getSessions,
  });

  const terminateSessionMutation = useMutation({
    mutationFn: sessionService.terminateSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { sessions, isLoading, error, terminateSession: terminateSessionMutation.mutate };
};
