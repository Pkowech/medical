'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  Flame,
  Moon,
  Sun,
  Stethoscope,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SidebarProps } from '@/shared/types/navigationInterface';
import { NavigationItemComponent } from './NavigationItem';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { UserMenu } from './UserMenu';
import { InstallAppButton } from './InstallAppButton';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { mobilePrimaryNavigation } from './mobileNavigationConfig';
import { healthcareProfileLabel } from '@/shared/utils/healthcareProfile';
import { markNotificationAsRead } from '@/features/community/notificationService';
import { useLearningStreak } from '@/shared/hooks/useProgress';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'medtrack.sidebar-collapsed.v1';

export function Sidebar({
  theme,
  toggleTheme,
  user,
  navigationItems,
  notifications,
  notificationsOpen,
  setNotificationsOpen,
  onNotificationRefresh,
}: SidebarProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarUserMenuOpen,
    setSidebarUserMenuOpen,
  } = useLayoutStore();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const hasRestoredSidebarState = useRef(false);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const router = useRouter();
  const [notificationActionError, setNotificationActionError] = useState<string | null>(null);
  const { streak, longestStreak, isLoading: isStreakLoading, error: streakError } =
    useLearningStreak();
  const unreadNotifications = notifications.filter(notification => !notification.read);
  const visibleNavigationItems = isDesktop
    ? navigationItems
    : navigationItems.filter(
        item =>
          !mobilePrimaryNavigation.some(tab => tab.href === item.href) ||
          Boolean(item.children?.length) || item.id === 'search',
      );

  useEffect(() => {
    try {
      const savedState = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (savedState !== null) setSidebarCollapsed(savedState === 'true');
    } catch (error) {
      console.warn('Could not restore sidebar preference:', error);
    } finally {
      hasRestoredSidebarState.current = true;
    }
  }, [setSidebarCollapsed]);

  useEffect(() => {
    if (!hasRestoredSidebarState.current) return;
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        String(sidebarCollapsed),
      );
    } catch (error) {
      console.warn('Could not save sidebar preference:', error);
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (isDesktop && sidebarOpen) setSidebarOpen(false);
  }, [isDesktop, sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    if (isDesktop || !sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !sidebarRef.current) return;

      const focusable = Array.from(
        sidebarRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current?.isConnected) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isDesktop, setSidebarOpen, sidebarOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !notificationsMenuRef.current?.contains(target) &&
        !notificationsButtonRef.current?.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, setNotificationsOpen]);

  const openNotification = async (notificationId: string) => {
    setNotificationActionError(null);
    try {
      await markNotificationAsRead(notificationId);
      onNotificationRefresh?.();
      router.push('/notifications');
      setNotificationsOpen(false);
    } catch (error) {
      console.error('Failed to open notification:', error);
      setNotificationActionError('Could not open this notification. Please try again.');
    }
  };

  return (
    <>
      {sidebarOpen && !isDesktop && (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 bg-slate-950/55 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <nav
        ref={sidebarRef}
        id="app-sidebar"
        role={!isDesktop ? 'dialog' : undefined}
        aria-modal={!isDesktop && sidebarOpen ? true : undefined}
        aria-label={isDesktop ? 'Main navigation' : 'More navigation'}
        aria-hidden={!isDesktop && !sidebarOpen}
        inert={!isDesktop && !sidebarOpen}
        className={cn(
          'fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex w-full max-w-sm flex-col border-r border-border bg-card shadow-2xl transition-[transform,width] duration-300 ease-out dark:border-border dark:bg-card lg:static lg:inset-auto lg:z-auto lg:h-full lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          isDesktop && sidebarCollapsed && 'lg:w-[4.5rem]',
        )}
      >
        <div className={cn(
          'flex h-14 shrink-0 items-center border-b border-border dark:border-border',
          isDesktop && sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}>
          <Link
            href="/"
            aria-label="MedTrack Hub home"
            title={isDesktop && sidebarCollapsed ? 'MedTrack Hub' : undefined}
            className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight text-blue-700 dark:text-blue-300"
          >
            <Stethoscope className="h-5 w-5 shrink-0" />
            {(!isDesktop || !sidebarCollapsed) && <span className="truncate">MedTrack Hub</span>}
          </Link>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-muted-foreground dark:hover:bg-card lg:hidden"
            aria-label="Close sidebar"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div
          role="group"
          className={cn(
            'mx-3 mt-3 shrink-0 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 text-orange-950 shadow-sm dark:border-orange-400/20 dark:from-orange-950/40 dark:to-amber-950/30 dark:text-orange-100',
            isDesktop && sidebarCollapsed
              ? 'mx-2 flex min-h-12 items-center justify-center p-2'
              : 'px-3 py-2',
          )}
          title={
            typeof streak === 'number' && typeof longestStreak === 'number'
              ? `Current learning streak: ${streak} days. Longest: ${longestStreak} days.`
              : streakError?.message ?? 'Learning streak unavailable'
          }
          aria-label={isStreakLoading
            ? 'Learning streak loading'
            : `Learning streak: ${typeof streak === 'number' ? `${streak} days` : streakError ? 'unavailable' : 'not started'}`}
        >
          <div className={cn(
            'flex min-h-10 items-center gap-3',
            isDesktop && sidebarCollapsed && 'justify-center',
          )}>
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-200/80 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300">
              <Flame aria-hidden="true" className="h-5 w-5" />
              {isDesktop && sidebarCollapsed && typeof streak === 'number' && streak > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">
                  {streak}
                </span>
              )}
            </span>
            {(!isDesktop || !sidebarCollapsed) && (
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                <p className="truncate text-sm font-bold">
                  {isStreakLoading
                    ? 'Loading streak…'
                    : typeof streak === 'number'
                      ? `${streak} ${streak === 1 ? 'day' : 'days'}`
                      : streakError
                        ? 'Streak unavailable'
                        : 'No streak yet'}
                </p>
                {typeof streak === 'number' && streak >= 0 && (
                  <span className="shrink-0 text-[11px] font-medium text-orange-800/80 dark:text-orange-100/70">
                    {streak === 0 ? 'Start today' : 'Keep it going'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-4',
          isDesktop && sidebarCollapsed ? 'px-2' : 'px-3',
        )}>
          {!isDesktop && (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
              More
            </p>
          )}
          {visibleNavigationItems.map(item => (
            <NavigationItemComponent
              key={item.id}
              item={item}
              sidebarCollapsed={isDesktop && sidebarCollapsed}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              onExpandSidebar={() => setSidebarCollapsed(false)}
            />
          ))}
        </div>

        <div className={cn(
          'shrink-0 border-t border-border py-3 dark:border-border',
          isDesktop && sidebarCollapsed ? 'space-y-2 px-2' : 'space-y-2 px-3',
        )}>
          <div className="relative">
            <button
              ref={notificationsButtonRef}
              type="button"
              onClick={() => {
                setNotificationActionError(null);
                setNotificationsOpen(!notificationsOpen);
              }}
              className={cn(
                'relative flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-secondary',
                isDesktop && sidebarCollapsed && 'justify-center px-0',
              )}
              aria-label={`Notifications${unreadNotifications.length ? ` (${unreadNotifications.length} unread)` : ''}`}
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              aria-controls="sidebar-notifications"
              title={isDesktop && sidebarCollapsed ? 'Notifications' : undefined}
            >
              <Bell aria-hidden="true" className="h-5 w-5 shrink-0" />
              {(!isDesktop || !sidebarCollapsed) && <span className="flex-1 text-left">Notifications</span>}
              {unreadNotifications.length > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white"
                  aria-live="polite"
                >
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                ref={notificationsMenuRef}
                id="sidebar-notifications"
                className={cn(
                  'absolute z-[60] overflow-hidden rounded-xl border border-border bg-card shadow-xl dark:bg-card',
                  isDesktop && sidebarCollapsed
                    ? 'left-full top-0 ml-2 w-80'
                    : 'bottom-full left-0 mb-2 w-full',
                )}
                role="dialog"
                aria-label="Unread notifications"
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      router.push('/notifications');
                      setNotificationsOpen(false);
                    }}
                    className="font-semibold text-foreground"
                  >
                    Notifications
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Close notifications"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                {notificationActionError && (
                  <p className="px-4 py-2 text-sm text-destructive" role="alert">
                    {notificationActionError}
                  </p>
                )}
                <div className="max-h-[50vh] overflow-y-auto">
                  {unreadNotifications.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        router.push('/notifications');
                        setNotificationsOpen(false);
                      }}
                      className="w-full px-4 py-6 text-left text-sm text-muted-foreground hover:bg-muted"
                    >
                      No unread notifications. View all notifications
                    </button>
                  ) : (
                    unreadNotifications.map(notification => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => void openNotification(notification.id)}
                        className="w-full border-b border-border bg-blue-50/60 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-900/20"
                      >
                        <span className="block truncate text-sm font-medium text-foreground">
                          {notification.title}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">
                          {notification.message}
                        </span>
                        <span className="mt-2 block text-xs text-muted-foreground">
                          {notification.createdAt
                            ? new Date(notification.createdAt).toLocaleDateString()
                            : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            className={cn(
              'flex items-center gap-1',
              isDesktop && sidebarCollapsed ? 'flex-col' : 'justify-between',
            )}
          >
            <div className={cn(
              'flex items-center gap-1',
              isDesktop && sidebarCollapsed && 'flex-col',
            )}>
              <InstallAppButton compact={isDesktop && sidebarCollapsed} />
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-secondary"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? (
                  <Sun aria-hidden="true" className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Moon aria-hidden="true" className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {user && (
          <div className={cn(
            'relative shrink-0 border-t border-border dark:border-border',
            isDesktop && sidebarCollapsed ? 'p-2' : 'p-3',
          )}>
            <button
              type="button"
              onClick={() => setSidebarUserMenuOpen(!sidebarUserMenuOpen)}
              onKeyDown={event => {
                if (event.key === 'Escape' && sidebarUserMenuOpen) {
                  setSidebarUserMenuOpen(false);
                }
              }}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-secondary',
                isDesktop && sidebarCollapsed && 'justify-center',
              )}
              aria-label="Account menu"
              aria-expanded={sidebarUserMenuOpen}
              aria-haspopup="menu"
              title={isDesktop && sidebarCollapsed ? user.fullName || `${user.firstName} ${user.lastName}` : undefined}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                <span className="text-sm font-semibold">
                  {(user.fullName || user.firstName)?.charAt(0).toUpperCase() || 'U'}
                </span>
              </span>
              {(!isDesktop || !sidebarCollapsed) && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {user.fullName || `${user.firstName} ${user.lastName}`}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {healthcareProfileLabel(user)}
                    </span>
                  </span>
                  <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
            <UserMenu
              user={user}
              logout={logout}
              isOpen={sidebarUserMenuOpen}
              setIsOpen={setSidebarUserMenuOpen}
              direction="up"
              className={cn(isDesktop && sidebarCollapsed && 'left-0 right-auto')}
            />
            {isDesktop && sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="mt-2 hidden w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-muted-foreground dark:hover:bg-card lg:flex"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </nav>
    </>
  );
}

export default Sidebar;
