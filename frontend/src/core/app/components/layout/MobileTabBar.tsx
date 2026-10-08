'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from '@/shared/types/navigationInterface';

interface MobileTabBarProps {
  navigationItems: NavigationItem[];
}

const primaryTabs = [
  { href: '/dashboard', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: '/study-planner', label: 'Study' },
  { href: '/progress', label: 'Progress' },
  { href: '/profile', label: 'Profile' },
];

export function MobileTabBar({ navigationItems }: MobileTabBarProps) {
  const pathname = usePathname();
  const availableTabs = primaryTabs.flatMap(tab => {
    const item = navigationItems.find(candidate => candidate.href === tab.href);
    return item ? [{ ...tab, item }] : [];
  });

  if (!availableTabs.length) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(15,23,42,0.06)] backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
    >
      <div
        className="mx-auto grid h-16 max-w-xl"
        style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}
      >
        {availableTabs.map(({ href, label, item }) => {
          const isActive =
            pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
          const Icon = item.icon;

          return (
            <Link
              key={href}
              href={href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors active:scale-95 motion-reduce:transition-none ${
                isActive
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`h-5 w-5 transition-transform motion-reduce:transition-none ${
                  isActive ? 'scale-105' : ''
                }`}
              />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
