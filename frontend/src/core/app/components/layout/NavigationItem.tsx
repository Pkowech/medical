'use client';

import React, { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { NavigationItemProps } from '@/shared/types/navigationInterface';

export const NavigationItemComponent: React.FC<NavigationItemProps> = ({
  item,
  sidebarCollapsed = false,
  sidebarOpen = false,
  onClick,
  active: propActive = false,
}) => {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const childrenId = useId();

  // Determine if this item or any of its children are active
  const isActive = (path?: string) => {
    if (!path) return false;
    if (pathname === path) return true;
    if (path !== '/' && pathname.startsWith(`${path}/`)) return true;
    return false;
  };

  const isItemActive = isActive(item.href);
  const isChildActive = item.children?.some(child => isActive(child.href));
  const effectiveActive = isItemActive || isChildActive || propActive;
  const activeStateClasses = effectiveActive
    ? 'bg-blue-50/80 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm'
    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white';

  // Auto-expand if a child is active
  useEffect(() => {
    if (isChildActive) {
      setIsExpanded(true);
    }
  }, [isChildActive]);

  const toggleExpanded = () => setIsExpanded(expanded => !expanded);

  const showLabel = !sidebarCollapsed || sidebarOpen;

  const baseClasses = `w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-semibold rounded-xl transition-all ${activeStateClasses}`;
  const parentRowClasses = `w-full flex items-center justify-between text-left text-sm font-semibold rounded-xl transition-all ${activeStateClasses}`;

  const itemLabel = (
    <>
      <div className="flex items-center space-x-3">
        <item.icon
          className={`h-5 w-5 shrink-0 ${item.color || 'text-gray-600 dark:text-gray-300'}`}
        />
        {showLabel && (
          <>
            <span>{item.label}</span>
            {item.badge && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </div>
    </>
  );

  if (item.children) {
    return (
      <div className="mb-1">
        <div className={parentRowClasses}>
          {item.href ? (
            <Link
              href={item.href}
              className="flex min-w-0 flex-1 items-center rounded-l-xl px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              onClick={onClick}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {itemLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={toggleExpanded}
              className="flex min-w-0 flex-1 items-center rounded-l-xl px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              aria-expanded={isExpanded}
              aria-controls={childrenId}
            >
              {itemLabel}
              <ChevronRight
                aria-hidden="true"
                className={`ml-auto h-4 w-4 text-gray-600 transition-transform dark:text-gray-300 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          {item.href && (
            <button
              type="button"
              onClick={toggleExpanded}
              className="mr-2 rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
              aria-expanded={isExpanded}
              aria-controls={childrenId}
            >
              <ChevronRight
                aria-hidden="true"
                className={`h-4 w-4 text-gray-600 transition-transform dark:text-gray-300 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </div>
        <div id={childrenId} hidden={!isExpanded || !showLabel} className="ml-6 mt-1 space-y-1">
          {item.children.map(child => (
            <NavigationItemComponent
              key={child.id}
              item={child}
              sidebarCollapsed={sidebarCollapsed}
              sidebarOpen={sidebarOpen}
              onClick={onClick}
            />
          ))}
        </div>
      </div>
    );
  }

  // Standard link item
  return (
    <div className="mb-1">
      {item.href ? (
        <Link
          href={item.href}
          className={baseClasses}
          onClick={onClick}
          aria-current={pathname === item.href ? 'page' : undefined}
        >
          {itemLabel}
        </Link>
      ) : (
        <button type="button" className={baseClasses}>
          {itemLabel}
        </button>
      )}
    </div>
  );
};
