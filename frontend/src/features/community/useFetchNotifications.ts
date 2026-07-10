import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications } from '../community/notificationService';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];

export const useFetchNotifications = () => {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => getNotifications(),
    // Keep notifications fresh for 1 hour by default.
    // This prevents frequent polling while allowing manual/triggered refresh.
    staleTime: 60 * 60 * 1000, // 1 hour
    // Do not refetch on window focus by default for notifications
    refetchOnWindowFocus: false,
  });
};

// Hook that returns a function to trigger an invalidation of the notifications query
// Usage: const trigger = useTriggerNotificationsRefresh(); trigger();
export const useTriggerNotificationsRefresh = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
};
