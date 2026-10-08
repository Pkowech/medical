'use client';

import React, { ReactNode, Suspense, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useTheme } from '@/app/providers';
import { useFetchNotifications } from '@/features/community/useFetchNotifications';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/features/community/notificationEvents';
import { Sidebar } from '@/core/app/components/layout/AppSidebar';
import { AppHeader } from '@/core/app/components/layout/AppHeader';
import { AppFooter } from '@/core/app/components/layout/AppFooter';
import { MobileTabBar } from '@/core/app/components/layout/MobileTabBar';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { usePathname } from 'next/navigation';
import { NavigationItem } from '@/shared/types/navigationInterface';
import { User } from '@/shared/types/authInterface';
import { Notification as AppNotification } from '@/shared/types/notificationsInterface';

interface DashboardLayoutProps {
    children: ReactNode;
    navigationItems: NavigationItem[];
    user: User | null;
    isLoading?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    children,
    navigationItems,
    user,
    isLoading = false,
}) => {
    const { colorScheme, toggleTheme } = useTheme();
    const { sidebarOpen, setSidebarOpen, setNotificationsOpen, notificationsOpen } = useLayoutStore();
    const pathname = usePathname();
    const contentScrollRef = useRef<HTMLDivElement>(null);

    // Notifications logic
    const { data, refetch } = useFetchNotifications();
    const notifications = (data as unknown as AppNotification[]) || [];

    const refreshNotifications = () => {
        try {
            refetch();
        } catch {
            // ignore
        }
    };

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

    // Close mobile sidebar on navigation
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname, setSidebarOpen]);

    useEffect(() => {
        if (!isLoading && pathname === '/dashboard' && contentScrollRef.current) {
            contentScrollRef.current.scrollTop = 0;
        }
    }, [isLoading, pathname]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const coursePathSegments = pathname?.split('/').filter(Boolean) ?? [];
    const isCoursePage = coursePathSegments[0] === 'courses' && coursePathSegments.length > 2;
    const isMaterialViewPage =
        coursePathSegments[0] === 'study-planner' &&
        coursePathSegments[1] === 'materials' &&
        coursePathSegments.length === 3 &&
        coursePathSegments[2] !== 'upload';
    const isFullHeightPage = isCoursePage || isMaterialViewPage;
    const isQuizSessionPage =
        coursePathSegments[0] === 'quiz' && coursePathSegments[1] === 'unit';
    const isFocusedPage = isFullHeightPage || isQuizSessionPage;

    return (
        <>
            <div className="flex h-screen h-dvh overflow-hidden bg-gray-50 dark:bg-gray-900">
                {!isQuizSessionPage && (
                    <div className={cn(isFullHeightPage && 'lg:hidden')}>
                        <Sidebar theme={colorScheme} user={user} navigationItems={navigationItems} />
                    </div>
                )}

                {/* Main app column (center) */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {!isQuizSessionPage && (
                        <AppHeader
                            theme={colorScheme}
                            toggleTheme={toggleTheme}
                            user={user}
                            notifications={notifications}
                            notificationsOpen={notificationsOpen}
                            setNotificationsOpen={setNotificationsOpen}
                            onNotificationRefresh={refreshNotifications}
                        />
                    )}

                    {/* content area */}
                    <div
                        ref={contentScrollRef}
                        className={cn(
                            'min-h-0 flex-1 overscroll-y-contain',
                            isFullHeightPage ? 'overflow-hidden' : 'overflow-auto',
                            !isQuizSessionPage && 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0',
                        )}
                    >
                        <div
                            className={cn(
                                `w-full transition-all duration-300 pt-0`,
                                !isFocusedPage && "px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6",
                                isQuizSessionPage && 'h-full flex flex-col',
                                isFullHeightPage && "h-full flex flex-col",
                                sidebarOpen && !isFullHeightPage && 'lg:pl-0'
                            )}
                        >
                            <main className={cn(
                                'min-h-0 min-w-0 flex-1 py-2 transition-all duration-300',
                                isFocusedPage && 'h-full py-0',
                            )}>
                                <div className={cn('min-h-0 space-y-6', isFullHeightPage && 'h-full space-y-0', isQuizSessionPage && 'h-full space-y-0')}>
                                    <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
                                </div>
                            </main>
                        </div>
                        <AppFooter />
                    </div>
                </div>
            </div>
            {!isQuizSessionPage && <MobileTabBar navigationItems={navigationItems} />}
        </>
    );
};
