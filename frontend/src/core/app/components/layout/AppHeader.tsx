'use client';

import React, { useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  User,
  Sun,
  Moon,
  ChevronDown,
  Flame,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { HeaderProps } from '@/shared/types/navigationInterface';

import { useRouter } from 'next/navigation';
import { markNotificationAsRead } from '@/features/community/notificationService';
import { useLearningStreak } from '@/shared/hooks/useProgress';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { UserMenu } from './UserMenu';
import { InstallAppButton } from './InstallAppButton';

export const AppHeader: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  user,
  notifications,
  notificationsOpen,
  setNotificationsOpen,
  onNotificationRefresh,
}) => {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    headerUserMenuOpen,
    setHeaderUserMenuOpen,
  } = useLayoutStore();
  const { header } = usePageHeader();

  const { logout } = useAuth();
  const router = useRouter();
  const { streak, longestStreak, isLoading: isStreakLoading, error: streakError } =
    useLearningStreak();

  const unreadCount = notifications.filter(n => !n.read).length;
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  // Handle click outside notifications menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationsMenuRef.current &&
        notificationsButtonRef.current &&
        !notificationsMenuRef.current.contains(target) &&
        !notificationsButtonRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [notificationsOpen, setNotificationsOpen]);

  // Handle click outside user menu
  useEffect(() => {
    const handleClickOutsideUser = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        userMenuRef.current &&
        userMenuButtonRef.current &&
        !userMenuRef.current.contains(target) &&
        !userMenuButtonRef.current.contains(target)
      ) {
        setHeaderUserMenuOpen(false);
      }
    };

    if (headerUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutsideUser);
      return () => document.removeEventListener('mousedown', handleClickOutsideUser);
    }
  }, [headerUserMenuOpen, setHeaderUserMenuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-card/80 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md dark:bg-card/80 border-b border-border dark:border-border">
      {' '}
      {/* Header z-50 */}
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 transition-all duration-300">
        {' '}
        {/* Adjusted py for better spacing */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left side - Welcome/Page Header */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mobile hamburger to open sidebar */}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted dark:hover:bg-card transition-colors mr-1 text-muted-foreground dark:text-muted-foreground"
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
              aria-controls="app-sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:inline-flex rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-muted-foreground dark:hover:bg-card"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
              aria-controls="app-sidebar"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
              ) : (
                <PanelLeftClose aria-hidden="true" className="h-5 w-5" />
              )}
            </button>

            {header ? (
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {header.icon && <div className="text-xl sm:text-2xl shrink-0">{header.icon}</div>}
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground dark:text-foreground truncate">
                    {header.title}
                  </h1>
                  {header.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground truncate hidden md:block max-w-50 lg:max-w-md">
                      {header.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground dark:text-foreground truncate">
                  Welcome back, {user?.firstName}! 👋
                </h1>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">Track your progress</p>
              </div>
            )}

            {/* Streak Badge area (always reserved on large screens)
                - shows a skeleton while loading
                - shows streak when available
                - shows a small dash when no streak */}
            <div className="hidden lg:flex items-center shrink-0">
              {isStreakLoading ? (
                <div className="animate-pulse bg-secondary dark:bg-secondary w-16 h-6 rounded-full" />
              ) : (
                <div
                  className="items-center gap-1.5 px-3 py-1 bg-orange-50/50 dark:bg-orange-500/10 rounded-full border border-orange-100 dark:border-orange-500/20 flex shadow-sm"
                  title={
                    typeof streak === 'number' && typeof longestStreak === 'number'
                      ? `Current learning streak: ${streak} days. Longest: ${longestStreak} days.`
                      : streakError?.message ?? 'Learning streak unavailable'
                  }
                >
                  <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                    {typeof streak === 'number' ? `${streak}d` : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right controls - Notifications, User Menu and Theme */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <InstallAppButton />
            {/* Notifications */}
            <div className="relative">
              <button
                ref={notificationsButtonRef}
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setNotificationsOpen(false);
                  }
                }}
                className="notifications-button relative p-2 rounded-md hover:bg-muted dark:hover:bg-secondary transition-colors"
                title="Toggle notifications"
                aria-label="Toggle notifications"
                {...{ 'aria-expanded': notificationsOpen ? 'true' : 'false' }}
                aria-haspopup="menu"
                aria-controls="notifications-menu"
              >
                <Bell className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                    aria-live="polite"
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                // Notifications dropdown (z-50)
                <div
                  ref={notificationsMenuRef}
                  id="notifications-menu"
                  className="notifications-menu absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-md border border-border bg-card shadow-xl dark:border-border dark:bg-card z-[60]"
                  role="region"
                  aria-label="Notifications list"
                >
                  <div className="p-4 border-b border-border dark:border-border bg-background dark:bg-secondary sticky top-0">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          router.push('/notifications');
                          setNotificationsOpen(false);
                        }}
                        className="font-semibold text-foreground dark:text-foreground text-left"
                        title="View all notifications"
                      >
                        Notifications
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="sm:hidden p-1 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
                        aria-label="Close notifications"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
                    {notifications.filter(n => !n.read).length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          router.push('/notifications');
                          setNotificationsOpen(false);
                        }}
                        className="w-full text-left p-6 text-sm text-muted-foreground dark:text-muted-foreground hover:bg-background dark:hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="View all notifications"
                      >
                        No unread notifications
                      </button>
                    ) : (
                      notifications
                        .filter(n => !n.read)
                        .map(notification => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={async () => {
                              await markNotificationAsRead(notification.id);
                              onNotificationRefresh?.();
                              router.push(`/notifications`);
                              setNotificationsOpen(false);
                            }}
                            className="w-full text-left p-4 border-b border-border dark:border-border hover:bg-background dark:hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="shrink-0 w-2 h-2 rounded-full mt-2 bg-blue-500"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground dark:text-foreground truncate">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-2">
                                  {notification.createdAt
                                    ? new Date(notification.createdAt).toLocaleDateString()
                                    : ''}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Account actions remain available on mobile and desktop. */}
            <div className="relative">
                <button
                  ref={userMenuButtonRef}
                  type="button"
                  onClick={() => setHeaderUserMenuOpen(!headerUserMenuOpen)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && headerUserMenuOpen) {
                      setHeaderUserMenuOpen(false);
                    }
                  }}
                  className="user-menu-button flex items-center space-x-2 p-2 rounded-md hover:bg-muted dark:hover:bg-secondary transition-colors"
                  aria-label="User menu"
                  {...{ 'aria-expanded': headerUserMenuOpen ? 'true' : 'false' }}
                  aria-haspopup="menu"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="hidden lg:inline text-sm font-medium truncate">
                    {user?.firstName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* User Menu Dropdown */}
                <UserMenu
                  user={user}
                  logout={logout}
                  isOpen={headerUserMenuOpen}
                  setIsOpen={setHeaderUserMenuOpen}
                  direction="down"
                />
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex p-2 rounded-md hover:bg-muted dark:hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
