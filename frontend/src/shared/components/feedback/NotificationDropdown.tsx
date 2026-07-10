'use client';

import React, { useEffect } from 'react';
import { Bell, Check, Trash2, ExternalLink, MoreHorizontal, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '@/features/community/notificationService';
import { useFetchNotifications } from '@/features/community/useFetchNotifications';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/features/community/notificationEvents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/lib/utils/cn';

interface NotificationAction {
  label: string;
  url?: string;
  actionType?: 'navigate' | 'api'; // default is navigate
}

export default function NotificationDropdown() {
  const { data: notifications = [], refetch } = useFetchNotifications();
  const router = useRouter();

  useEffect(() => {
    const handler = () => {
      try {
        refetch();
      } catch {
        // ignore
      }
    };
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handler);
  }, [refetch]);

  const handleNotificationClick = async (id: string, action?: NotificationAction) => {
    await markNotificationAsRead(id);
    if (action) {
      if (action.url) {
          router.push(action.url);
      }
    }
    refetch();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      refetch();
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    refetch();
  };

  // Sort: Unread first, then date
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.read === b.read) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return a.read ? 1 : -1;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getTimeAgo = (dateString: string | undefined) => {
    if (!dateString) return 'recently';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'recently';
    
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 5) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Helper to extract action from metadata
  const getAction = (metadata?: Record<string, unknown>): NotificationAction | null => {
    if (!metadata) return null;
    const m = metadata as Record<string, string | undefined>;
    if (m.actionUrl && m.actionLabel) {
      return {
        label: m.actionLabel,
        url: m.actionUrl,
        actionType: (m.actionType as 'navigate' | 'api') || 'navigate',
      };
    }
    return null;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0 shadow-xl border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-t-lg">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2"
                onClick={handleMarkAllAsRead}
              >
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href="/notifications">
                <Settings className="h-3.5 w-3.5 text-gray-500" />
              </Link>
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {sortedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
              <Bell className="h-12 w-12 text-gray-200 dark:text-gray-800 mb-3" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-gray-400">You're all caught up!</p>
            </div>
          ) : (
            <div className="py-1">
              {sortedNotifications.map(notification => {
                const action = getAction(notification.metadata);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative flex gap-3 p-4 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer border-l-2",
                      !notification.read 
                        ? "border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10" 
                        : "border-l-transparent opacity-80 hover:opacity-100"
                    )}
                    onClick={() => handleNotificationClick(notification.id, action || undefined)}
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-950",
                        !notification.read ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                      )}>
                        <Bell className="h-4 w-4" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm font-medium leading-none", !notification.read ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400")}>
                          {notification.title || notification.metadata?.title || 'System Notification'}
                        </p>
                        <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                          {getTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-2 mt-3">
                        {action && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs px-3 bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 hover:text-blue-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification.id, action);
                            }}
                          >
                            <span className="mr-1.5">{action.label}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {!notification.read && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(notification.id);
                          }}>
                            <Check className="mr-2 h-3.5 w-3.5" />
                            Mark read
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-red-600 dark:text-red-400 focus:text-red-600"
                          onClick={(e) => handleDelete(e, notification.id)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
          <Button variant="ghost" className="w-full text-xs h-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-300" asChild>
            <Link href="/notifications">
              View all notification history
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
