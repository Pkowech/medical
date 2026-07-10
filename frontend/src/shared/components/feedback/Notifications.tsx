import { useEffect } from 'react';
import { Notification } from '@/shared/types/notificationsInterface';
import { useSession } from 'next-auth/react';
import { useFetchNotifications } from '@/features/community/useFetchNotifications';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/features/community/notificationEvents';

export default function Notifications({ userId: _userId }: { userId?: string }) {
  const { data: notifications = [], refetch } = useFetchNotifications();
  const { data: _session } = useSession();

  // If the app receives an external trigger, refetch notifications immediately
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handler);
  }, [refetch]);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Notifications</h2>
      {notifications.length ? (
        <ul>
          {notifications.map((notif: Notification) => (
            <li key={notif.id} className="py-2">
              <div className="text-sm text-gray-800 dark:text-gray-200">{notif.message}</div>
              <div className="text-xs text-gray-500">{notif.createdAt}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">No notifications yet.</p>
      )}
    </div>
  );
}
