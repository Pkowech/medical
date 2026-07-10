'use client';

import React, { ReactNode, Suspense, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useTheme } from '@/app/providers';
import { useFetchNotifications } from '@/features/community/useFetchNotifications';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/features/community/notificationEvents';
import { Sidebar } from '@/core/app/components/layout/AppSidebar';
import { AppHeader } from '@/core/app/components/layout/AppHeader';
import { AppFooter } from '@/core/app/components/layout/AppFooter';
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

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const isCoursePage = pathname?.startsWith('/courses/') && pathname !== '/courses';

    return (
        <>
            {/* Mobile overlay backdrop (z-40) */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
                {!isCoursePage && <Sidebar theme={colorScheme} user={user} navigationItems={navigationItems} />}

                {/* Main app column (center) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <AppHeader
                        theme={colorScheme}
                        toggleTheme={toggleTheme}
                        user={user}
                        notifications={notifications}
                        notificationsOpen={notificationsOpen}
                        setNotificationsOpen={setNotificationsOpen}
                        onNotificationRefresh={refreshNotifications}
                        // Passing default implementations for simple props to avoid errors if not provided
                        searchQuery=""
                        setSearchQuery={() => { }}
                        selectedFilter="all"
                        setSelectedFilter={() => { }}
                    />

                    {/* content area */}
                    <div className={cn("flex-1", !isCoursePage && "overflow-auto")}>
                        <div
                            className={cn(
                                `w-full transition-all duration-300 pt-0`,
                                !isCoursePage && "px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6",
                                isCoursePage && "h-full flex flex-col",
                                sidebarOpen && !isCoursePage && 'lg:pl-0'
                            )}
                        >
                            <main className={cn('flex-1 py-2 transition-all duration-300 min-w-0', isCoursePage && 'py-0 h-full')}>
                                <div className={cn("space-y-6", isCoursePage && "space-y-0 h-full")}>
                                    <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
                                </div>
                            </main>
                        </div>
                        <AppFooter />
                    </div>
                </div>
            </div>
        </>
    );
};
