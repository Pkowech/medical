'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Menu,
  Search,
  Bell,
  User,
  Sun,
  Moon,
  ChevronDown,
  Flame,
} from 'lucide-react';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { HeaderProps } from '@/shared/types/navigationInterface';

// Local types to avoid `any`
type Activity = { date?: string; createdAt?: string; timestamp?: string; time?: string; datetime?: string; startedAt?: string };
interface SearchResult { id: string; title?: string; name?: string; type?: string; description?: string; fileType?: string; instructor?: { name?: string }; }

import { useRouter, usePathname, useParams } from 'next/navigation';
import { useSearch, SearchResult as HookSearchResult } from '@/features/search/hooks/useSearch';
import { markNotificationAsRead } from '@/features/community/notificationService';
import { useProgress } from '@/shared/hooks/useProgress';
import { SearchResultItem } from './SearchResultItem';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { UserMenu } from './UserMenu';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

export const AppHeader: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  user,
  notifications,
  searchQuery = '',
  setSearchQuery = () => { },
  notificationsOpen,
  setNotificationsOpen,
  selectedFilter = 'all',
  setSelectedFilter = () => { },
  onNotificationRefresh,
}) => {
  const { sidebarOpen, setSidebarOpen, headerUserMenuOpen, setHeaderUserMenuOpen } = useLayoutStore();
  const { header } = usePageHeader();

  const { logout } = useAuth();
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { progressData, isLoading: progressLoading } = useProgress(); // RQ hook: Handles loading/error internally
  const [streak, setStreak] = useState<number | null>(null);

  // Compute a local fallback streak from recent activities when backend streak isn't available.
  const computeLocalStreak = (activities?: Activity[]): number => {
    if (!activities || activities.length === 0) return 0;

    // Normalize timestamps to Date objects and a set of unique day strings
    const daySet = new Set<string>();
    activities.forEach((a: Activity) => {
      const dStr = a.date || a.createdAt || a.timestamp || a.time || a.datetime || a.startedAt;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;
      daySet.add(d.toDateString());
    });

    if (daySet.size === 0) return 0;

    // Start from today and count consecutive days backwards
    let streakCount = 0;
    const today = new Date();
    for (let i = 0; ; i++) {
      const check = new Date(today);
      check.setDate(today.getDate() - i);
      const key = check.toDateString();
      if (daySet.has(key)) {
        streakCount++;
      } else {
        break;
      }
      // safety cap to avoid infinite loop
      if (streakCount > 365) break;
    }

    return streakCount;
  };

  // Update streak when progressData changes: prefer backend stats.streak, otherwise local calc
  useEffect(() => {
    const backendStreak = (progressData as { stats?: { streak?: number } } | undefined)?.stats?.streak ?? null;
    if (typeof backendStreak === 'number' && backendStreak > 0) {
      setStreak(backendStreak);
      return;
    }

    // compute fallback from recent activities
    const activities = (progressData?.recentActivities as Activity[] | undefined) || (progressData?.recentActivity as Activity[] | undefined) || [];
    const local = computeLocalStreak(activities);
    setStreak(local > 0 ? local : backendStreak === 0 ? 0 : null);
  }, [progressData]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  // Search hook
  const { search, results: searchResults, loading: isSearching, error: searchHookError, clearSearch, expandedQuery, synonymsMatched } = useSearch();
  const searchError = searchHookError?.message || null;

  // Search state (local + results)
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const searchTimeout = useRef<number | null>(null);

  // Detect context
  const pathname = usePathname();
  const params = useParams();
  const courseId = params?.courseId as string | undefined;

  const contextType = pathname?.startsWith('/courses') ? 'course' : 
                     pathname?.startsWith('/dashboard') ? 'dashboard' : undefined;
  const contextId = courseId;

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

  // Sync external searchQuery prop into localQuery when it changes externally
  useEffect(() => {
    setLocalQuery(searchQuery || '');
  }, [searchQuery]);

  // handleSearchChange replaces doSearch
  const handleSearchChange = (q: string) => {
    setLocalQuery(q);
    setSearchQuery(q);

    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
    }
    
    // debounce 300ms
    searchTimeout.current = window.setTimeout(() => {
      search(q, selectedFilter, 1, 6, contextType, contextId);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
      clearSearch();
    };
  }, [clearSearch]);

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-sm">
      {' '}
      {/* Header z-50 */}
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 transition-all duration-300">
        {' '}
        {/* Adjusted py for better spacing */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Welcome/Page Header */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mobile hamburger to open sidebar */}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors mr-1 text-gray-500 dark:text-slate-400"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>

            {header ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {header.icon && <div className="text-xl sm:text-2xl shrink-0">{header.icon}</div>}
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {header.title}
                  </h1>
                  {header.description && (
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate hidden md:block max-w-[200px] lg:max-w-md">
                      {header.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  Welcome back, {user?.firstName}! 👋
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">Track your progress</p>
              </div>
            )}

            {/* Streak Badge area (always reserved on large screens)
                - shows a skeleton while loading
                - shows streak when available
                - shows a small dash when no streak */}
            <div className="hidden lg:flex items-center shrink-0">
              {progressLoading ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 w-16 h-6 rounded-full" />
              ) : (
                <div className="items-center gap-1.5 px-3 py-1 bg-orange-50/50 dark:bg-orange-500/10 rounded-full border border-orange-100 dark:border-orange-500/20 flex shadow-sm">
                  <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                    {(streak ?? 0) > 0
                      ? `${streak}d`
                      : progressData?.recentActivities && progressData.recentActivities.length > 0
                        ? '1d'
                        : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Center - Search and Filter (Desktop only) */}
          <div className="hidden sm:flex gap-2 items-center shrink-0">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={localQuery}
                onChange={e => handleSearchChange(e.target.value)}
                aria-label="Search resources"
                className="pl-10 pr-4 py-2 w-32 sm:w-48 md:w-64 lg:w-72 rounded-xl border border-gray-200 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
              />

              {/* Results dropdown (z-50) */}
              {(searchResults.length > 0 || expandedQuery || synonymsMatched.length > 0) && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {(expandedQuery || synonymsMatched.length > 0) && (
                    <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 mb-1">Medical Search Optimization</p>
                      {synonymsMatched.length > 0 && (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          Matched: <span className="font-medium text-gray-900 dark:text-white">{synonymsMatched.join(', ')}</span>
                        </p>
                      )}
                    </div>
                  )}
                  <ul className="max-h-64 overflow-y-auto">
                    {searchResults.map((result: HookSearchResult) => (
                      <SearchResultItem
                        key={result.id}
                        course={{
                          ...result,
                          instructor: result.instructor ? { name: result.instructor.name } : undefined
                        }}
                        onSelect={() => clearSearch()}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {searchError && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-red-500 font-medium">
                  {searchError}
                </div>
              )}
              {isSearching && !searchError && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                  Searching…
                </div>
              )}
            </div>
            <select
              value={selectedFilter}
              onChange={e => setSelectedFilter(e.target.value)}
              title="Filter"
              className="border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2 bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Right controls - Notifications, User Menu and Theme */}
          <div className="flex items-center space-x-2 shrink-0">
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
                className="notifications-button relative p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Toggle notifications"
                aria-label="Toggle notifications"
                {...{ 'aria-expanded': notificationsOpen ? 'true' : 'false' }}
                aria-haspopup="menu"
                aria-controls="notifications-menu"
              >
                <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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
                  className="notifications-menu fixed sm:absolute right-0 sm:mt-2 sm:w-80 bottom-0 sm:bottom-auto left-0 sm:left-auto w-full sm:rounded-radius-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-50"
                  role="region"
                  aria-label="Notifications list"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 sticky top-0">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          router.push('/notifications');
                          setNotificationsOpen(false);
                        }}
                        className="font-semibold text-gray-900 dark:text-white text-left"
                        title="View all notifications"
                      >
                        Notifications
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="sm:hidden p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
                        className="w-full text-left p-6 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="shrink-0 w-2 h-2 rounded-full mt-2 bg-blue-500"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
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
              {notificationsOpen && (
                <div
                  className="sm:hidden fixed inset-0 z-40 bg-black bg-opacity-40"
                  onClick={() => setNotificationsOpen(false)}
                />
              )}
            </div>

            {/* User Menu - Content rendered conditionally for desktop only */}
            {isDesktop && (
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
                  className="user-menu-button flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="User menu"
                  {...{ 'aria-expanded': headerUserMenuOpen ? 'true' : 'false' }}
                  aria-haspopup="menu"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium truncate">
                    {user?.firstName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
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
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
        {/* Mobile search and filter */}
        <div className="flex gap-2 mt-3 sm:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={localQuery}
              onChange={e => handleSearchChange(e.target.value)}
              aria-label="Search"
              className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />

            {(searchResults.length > 0 || expandedQuery || synonymsMatched.length > 0) && (
              // Mobile search results dropdown (z-50)
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                {(expandedQuery || synonymsMatched.length > 0) && (
                  <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 mb-1">Medical Search Optimization</p>
                    {synonymsMatched.length > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Matched: <span className="font-medium text-gray-900 dark:text-white">{synonymsMatched.join(', ')}</span>
                      </p>
                    )}
                  </div>
                )}
                <ul className="max-h-64 overflow-y-auto">
                  {searchResults.map((result: HookSearchResult) => (
                    <SearchResultItem
                      key={result.id}
                      course={{
                        ...result,
                        instructor: result.instructor ? { name: result.instructor.name } : undefined
                      }}
                      onSelect={() => clearSearch()}
                    />
                  ))}
                </ul>
              </div>
            )}
            {searchError && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-red-500 font-medium">
                {searchError}
              </div>
            )}
            {isSearching && !searchError && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                Searching…
              </div>
            )}
          </div>
          <select
            value={selectedFilter}
            onChange={e => setSelectedFilter(e.target.value)}
            title="Filter courses"
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Done</option>
          </select>
        </div>
      </div>
    </header>
  );
};
