'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Stethoscope, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SidebarProps } from '@/shared/types/navigationInterface';
import { NavigationItemComponent } from './NavigationItem';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { UserMenu } from './UserMenu';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

export function Sidebar({ user, navigationItems }: SidebarProps) {
  const { sidebarOpen, setSidebarOpen, sidebarUserMenuOpen, setSidebarUserMenuOpen } = useLayoutStore();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { logout } = useAuth();

  // Handle responsive behavior on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen, setSidebarOpen]);

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

      {/* Sidebar (z-50) */}
      <nav
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-full lg:w-64 flex flex-col border-r transition-transform duration-300 ease-in-out',
          'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800',
          // Mobile: transform-based drawer (full width)
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible (fixed width)
          'lg:translate-x-0'
        )}
      >
        {/* Sidebar Header */}
        <div className="shrink-0 flex items-center justify-between h-16 px-6 border-b border-gray-100 dark:border-slate-800">
          <Link href="/" className="flex items-center space-x-2 text-xl font-bold text-blue-600">
            <Stethoscope className="h-6 w-6 shrink-0" />
            <span className="truncate">MedTrack Hub</span>
          </Link>

          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation - scrollable */}
        <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map(item => (
            <NavigationItemComponent
              key={item.id}
              item={item}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
            />
          ))}
        </nav>

        {/* User Profile - fixed at bottom */}
        {user && (
          <div className="shrink-0 border-t border-gray-100 dark:border-slate-800 p-4">
            <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-gray-100 dark:hover:border-slate-700/50 group">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-primary-foreground">
                  {(user.fullName || user.firstName)?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user.fullName || `${user.firstName} ${user.lastName}`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Medical Student</p>
              </div>
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setSidebarUserMenuOpen(!sidebarUserMenuOpen)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && sidebarUserMenuOpen) {
                      setSidebarUserMenuOpen(false);
                    }
                  }}
                  className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                  aria-label="User menu"
                  {...{ 'aria-expanded': sidebarUserMenuOpen ? 'true' : 'false' }}
                  aria-haspopup="menu"
                >
                  <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              )}
            </div>

            {/* User Menu Dropdown - Only rendered on mobile */}
            {!isDesktop && (
              <UserMenu
                user={user}
                logout={logout}
                isOpen={sidebarUserMenuOpen}
                setIsOpen={setSidebarUserMenuOpen}
                direction="up"
              />
            )}
          </div>
        )}
      </nav>
    </>
  );
}

export default Sidebar;
