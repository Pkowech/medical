'use client';

import React, { useState, useEffect } from 'react';
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

  // Auto-expand if a child is active
  useEffect(() => {
    if (isChildActive) {
      setIsExpanded(true);
    }
  }, [isChildActive]);

  const handleClick = (_e: React.MouseEvent) => {
    if (item.children) {
      // If it has children and no href (or we want to prioritize toggling), toggle expand
      // If it has href, navigation might happen, but usually folders don't have hrefs in this pattern.
      // Assuming folder behavior for items with children:
      if (!item.href || item.children.length > 0) {
        // e.preventDefault(); // if it was a link
        setIsExpanded(!isExpanded);
      }
    }

    if (onClick && !item.children) {
      onClick();
    }
  };

  const showLabel = !sidebarCollapsed || sidebarOpen;

  const baseClasses = `w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-semibold rounded-xl transition-all ${effectiveActive
      ? 'bg-blue-50/80 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm'
      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
    }`;

  const itemContent = (
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
      {item.children && showLabel && (
        <ChevronRight
          className={`h-4 w-4 text-gray-600 dark:text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      )}
    </>
  );

  // If item has children, it behaves primarily as a toggle (unless it also has a unique href, which is rare for folders)
  // To keep it simple: if children exist, render as button to toggle.
  if (item.children) {
    return (
      <div>
        <button type="button" onClick={handleClick} className={baseClasses}>
          {itemContent}
        </button>
        {isExpanded && showLabel && (
          <div className="ml-6 mt-1 space-y-1">
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
        )}
      </div>
    );
  }

  // Standard link item
  return (
    <div className="mb-1">
      {item.href ? (
        <Link href={item.href} className={baseClasses} onClick={onClick}>
          {itemContent}
        </Link>
      ) : (
        <button type="button" onClick={handleClick} className={baseClasses}>
          {itemContent}
        </button>
      )}
    </div>
  );
};
