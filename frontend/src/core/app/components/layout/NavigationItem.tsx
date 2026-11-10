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
  onExpandSidebar,
  active: propActive = false,
}) => {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const childrenId = useId();

  // Determine if this item or any of its children are active
  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/assessment' && pathname?.startsWith('/quiz/')) return true;
    if (pathname === path) return true;
    if (path !== '/' && pathname.startsWith(`${path}/`)) return true;
    return false;
  };

  const isItemActive = isActive(item.href);
  const isChildActive = item.children?.some(
    child => isActive(child.href) || child.children?.some(grandchild => isActive(grandchild.href)),
  );
  const effectiveActive = isItemActive || isChildActive || propActive;
  const activeStateClasses = effectiveActive
    ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/15'
    : 'text-foreground/75 hover:bg-background hover:text-foreground dark:hover:bg-card';
  const parentActiveClasses = isItemActive
    ? activeStateClasses
    : isChildActive
      ? 'bg-muted/50 text-foreground'
      : 'text-foreground/75 hover:bg-muted/60 hover:text-foreground';

  useEffect(() => {
    setIsExpanded(Boolean(isChildActive));
  }, [isChildActive]);

  const toggleExpanded = () => {
    if (sidebarCollapsed && !sidebarOpen) onExpandSidebar?.();
    setIsExpanded(expanded => !expanded);
  };

  const showLabel = !sidebarCollapsed || sidebarOpen;

  const baseClasses = `w-full flex items-center ${showLabel ? 'justify-between px-4' : 'justify-center px-2'} py-2 text-left text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${activeStateClasses}`;
  const parentRowClasses = `w-full flex items-center justify-between text-left text-sm font-semibold rounded-lg transition-colors ${parentActiveClasses}`;

  const itemLabel = (
    <>
      <div className={`flex min-w-0 items-center ${showLabel ? 'space-x-3' : 'justify-center'}`}>
        <item.icon
          aria-hidden="true"
          className={`h-[18px] w-[18px] shrink-0 ${item.color || 'text-muted-foreground dark:text-muted-foreground'}`}
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
              title={!showLabel ? item.label : undefined}
              aria-label={!showLabel ? item.label : undefined}
              className={`flex min-w-0 flex-1 items-center rounded-l-xl ${showLabel ? 'px-4' : 'justify-center px-2'} py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500`}
              onClick={onClick}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {itemLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={toggleExpanded}
              title={!showLabel ? item.label : undefined}
              className={`flex min-w-0 flex-1 cursor-pointer items-center rounded-l-xl ${showLabel ? 'px-4' : 'justify-center px-2'} py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500`}
              aria-expanded={isExpanded}
              aria-controls={childrenId}
            >
              {itemLabel}
              <ChevronRight
                aria-hidden="true"
                className={`ml-auto h-4 w-4 text-muted-foreground transition-transform dark:text-muted-foreground ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          {item.href && (
            <button
              type="button"
              onClick={toggleExpanded}
              className={`shrink-0 cursor-pointer rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${showLabel ? 'mr-2' : 'mr-1'}`}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
              aria-expanded={isExpanded}
              aria-controls={childrenId}
            >
              <ChevronRight
                aria-hidden="true"
                className={`h-4 w-4 text-muted-foreground transition-transform dark:text-muted-foreground ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </div>
        <div id={childrenId} hidden={!isExpanded || !showLabel} className="ml-4 mt-1 space-y-1 border-l border-border pl-2 dark:border-border">
          {item.children.map(child => (
            <NavigationItemComponent
              key={child.id}
              item={child}
              sidebarCollapsed={sidebarCollapsed}
              sidebarOpen={sidebarOpen}
              onClick={onClick}
              onExpandSidebar={onExpandSidebar}
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
          title={!showLabel ? item.label : undefined}
          aria-label={!showLabel ? item.label : undefined}
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
