'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Stethoscope, ChevronDown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SidebarProps } from '@/shared/types/navigationInterface';
import { NavigationItemComponent } from './NavigationItem';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { UserMenu } from './UserMenu';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { mobilePrimaryNavigation } from './mobileNavigationConfig';
import { healthcareProfileLabel } from '@/shared/utils/healthcareProfile';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'medtrack.sidebar-collapsed.v1';

export function Sidebar({ user, navigationItems }: SidebarProps) {
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
  const { logout } = useAuth();
  const visibleNavigationItems = isDesktop
    ? navigationItems
    : navigationItems.filter(
        item => !mobilePrimaryNavigation.some(tab => tab.href === item.href),
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
          'fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex w-full max-w-sm flex-col border-r border-slate-200 bg-white shadow-2xl transition-[transform,width] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:inset-auto lg:z-auto lg:h-full lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          isDesktop && sidebarCollapsed && 'lg:w-[4.5rem]',
        )}
      >
        <div className={cn(
          'flex h-14 shrink-0 items-center border-b border-slate-100 dark:border-slate-800',
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
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-4',
          isDesktop && sidebarCollapsed ? 'px-2' : 'px-3',
        )}>
          {!isDesktop && (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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

        {user && (
          <div className={cn(
            'relative shrink-0 border-t border-slate-200 dark:border-slate-800',
            isDesktop && sidebarCollapsed ? 'p-2' : 'p-3',
          )}>
            <div className={cn(
              'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
              isDesktop && sidebarCollapsed && 'justify-center',
            )}>
              <div
                title={isDesktop && sidebarCollapsed ? user.fullName || `${user.firstName} ${user.lastName}` : undefined}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
              >
                <span className="text-sm font-semibold">
                  {(user.fullName || user.firstName)?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              {(!isDesktop || !sidebarCollapsed) && <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user.fullName || `${user.firstName} ${user.lastName}`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {healthcareProfileLabel(user)}
                </p>
              </div>}
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setSidebarUserMenuOpen(!sidebarUserMenuOpen)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && sidebarUserMenuOpen) {
                      setSidebarUserMenuOpen(false);
                    }
                  }}
                  className="shrink-0 rounded-md p-1 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-600"
                  aria-label="User menu"
                  {...{ 'aria-expanded': sidebarUserMenuOpen ? 'true' : 'false' }}
                  aria-haspopup="menu"
                >
                  <ChevronDown aria-hidden="true" className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              )}
            </div>

            {!isDesktop && (
              <UserMenu
                user={user}
                logout={logout}
                isOpen={sidebarUserMenuOpen}
                setIsOpen={setSidebarUserMenuOpen}
                direction="up"
              />
            )}
            {isDesktop && sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="mt-2 hidden w-full items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 lg:flex"
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
