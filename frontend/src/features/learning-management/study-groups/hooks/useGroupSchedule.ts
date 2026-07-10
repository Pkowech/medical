import { useEffect, useState } from 'react';
import { apiService } from '@/features/auth/services/apiClient';
import type { GroupSchedule } from '@/shared/types/studyGroupInterface';

export function useGroupSchedule(groupId: string) {
  const [schedule, setSchedule] = useState<GroupSchedule | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchSchedule() {
      setLoading(true);
      try {
        const res = await apiService.get<GroupSchedule>(`/study-groups/${groupId}/schedule`);
        if (mounted) setSchedule(res.data as unknown as GroupSchedule);
      } catch (err) {
        if (mounted) setError(err as unknown);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (groupId) fetchSchedule();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  return { schedule, loading, error };
}
