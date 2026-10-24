// frontend/src/app/(app)/notifications/page.tsx

'use client';

import React from 'react';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
} from '@/features/community/notificationService';
import { useFetchNotifications } from '@/features/community/useFetchNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Bell, CheckCircle } from 'lucide-react';

import { useState } from 'react';

export default function NotificationsPage() {
  const { data: notifications = [], refetch, isLoading } = useFetchNotifications();
  const [error, setError] = useState<string | null>(null);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      refetch(); // Re-fetch to update UI
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      refetch(); // Re-fetch to update UI
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      refetch(); // Re-fetch to update UI
    } catch (err: unknown) {
      console.error('Failed to delete notification:', err);
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
      ) {
        setError((err.response.data as { message: string }).message);
      } else {
        setError('Failed to delete notification.');
      }
    }
  };

  const getTimeAgo = (dateString: string | Date | undefined) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds > 0 ? seconds : 0} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  };

  if (isLoading) {
    return <div className="py-8 text-center">Loading Notifications...</div>;
  }

  if (error) {
    return <div className="break-words py-8 text-center text-red-500">Error: {error}</div>;
  }

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Notifications</h1>
        {unreadNotifications.length > 0 && (
          <Button onClick={handleMarkAllAsRead} variant="outline" className="w-full sm:w-auto">
            <CheckCircle className="mr-2 h-4 w-4" /> Mark All as Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p>You don't have any notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {unreadNotifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Unread ({unreadNotifications.length})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {unreadNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className="flex min-w-0 items-start gap-3 rounded-md border bg-blue-50 p-3 dark:bg-blue-900/20 sm:p-4"
                  >
                    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">{notification.title}</p>
                      <p className="break-words text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(notification.createdAt)}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="sm"
                          className="min-h-10 w-full sm:w-auto"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          Mark as Read
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="min-h-10 w-full sm:w-auto"
                          onClick={() => handleDeleteNotification(notification.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {readNotifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Read ({readNotifications.length})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {readNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className="flex min-w-0 items-start gap-3 rounded-md border p-3 sm:p-4"
                  >
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">{notification.title}</p>
                      <p className="break-words text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(notification.createdAt)}
                      </p>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="min-h-10 w-full sm:w-auto"
                          onClick={() => handleDeleteNotification(notification.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
