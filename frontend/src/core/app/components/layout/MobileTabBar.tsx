'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from '@/shared/types/navigationInterface';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { mobilePrimaryNavigation } from './mobileNavigationConfig';

const adminPrimaryNavigation = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/analytics', label: 'Insights' },
  { href: '/admin/settings', label: 'Settings' },
] as const;

function findNavigationItem(items: NavigationItem[], href: string): NavigationItem | undefined {
  for (const item of items) {
    if (item.href === href) return item;
    const childMatch = item.children && findNavigationItem(item.children, href);
    if (childMatch) return childMatch;
  }
}

interface MobileTabBarProps {
  navigationItems: NavigationItem[];
}

export function MobileTabBar({ navigationItems }: MobileTabBarProps) {
  const pathname = usePathname();
  const setSidebarOpen = useLayoutStore(state => state.setSidebarOpen);
  const isAdminNavigation = navigationItems.some(item => item.href === '/admin');
  const availableTabs = isAdminNavigation
    ? adminPrimaryNavigation.flatMap(tab => {
        const item = findNavigationItem(navigationItems, tab.href);
        return item ? [{ ...tab, item }] : [];
      })
    : mobilePrimaryNavigation.flatMap(tab => {
        const item = navigationItems.find(candidate => candidate.href === tab.href);
        return item ? [{ ...tab, item }] : [];
      });

  if (!availableTabs.length) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(15,23,42,0.06)] backdrop-blur-lg dark:border-border dark:bg-background/95 lg:hidden"
    >
      <div
        className="mx-auto grid h-16 max-w-xl"
        style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}
      >
        {availableTabs.map(({ href, label, item }) => {
          const isActive = isAdminNavigation
            ? pathname === href ||
              (href !== '/admin' && pathname.startsWith(`${href}/`)) ||
              (href === '/admin/content' &&
                ['/admin/materials/', '/admin/assessment/'].some(prefix =>
                  pathname.startsWith(prefix),
                )) ||
              (href === '/admin/analytics' && pathname === '/admin/performance')
            : pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(`${href}/`)) ||
              (href === '/progress' && pathname === '/analytics');
          const Icon = item.icon;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'
              }`}
            >
              <Icon
                aria-hidden="true"
                className="h-[18px] w-[18px] transition-transform motion-reduce:transition-none"
              />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
