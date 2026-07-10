'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { usePermissions } from './usePermissions';
import { NavigationItem } from '@/shared/types/navigationInterface';
import { Role } from '@/shared/enums/role.enum';

/**
 * Hook that returns navigation items relevant to the current route context.
 * Always includes core navigation items and adds context-specific items
 * based on the current page/section.
 */
export const useContextAwareNavigation = () => {
  const pathname = usePathname();
  const { filteredNavigation, allRoles } = usePermissions();

  // Define core items that should always be visible
  const coreNavIds = ['dashboard', 'courses', 'learning-paths', 'ai-tutor', 'profile', 'help'];

  // Define context-specific items for different sections
  const getContextSpecificItems = (path: string): string[] => {
    if (path.startsWith('/courses/')) {
      return ['study-planner', 'progress-tracking']; // Show study planner + progress in courses
    }
    if (path.startsWith('/schedule') || path.startsWith('/study-planner')) {
      return ['courses', 'progress-tracking']; // Show courses + progress in schedule
    }
    if (path.startsWith('/community')) {
      return ['study-planner']; // Show study planner in community
    }
    if (path.startsWith('/instructor')) {
      return ['admin-settings', 'admin-dashboard']; 
    }
    if (path.startsWith('/admin')) {
      return ['admin-settings', 'community-moderation']; 
    }
    // Default: show study planner and progress
    return ['study-planner', 'progress-tracking', 'community'];
  };

  const contextSpecificIds = getContextSpecificItems(pathname);
  const allowedIds = new Set([...coreNavIds, ...contextSpecificIds]);

  const contextAwareNavigation: NavigationItem[] = useMemo(() => {
    // Admins should see their full set of allowed navigation items (no extra filtering)
    if (allRoles && allRoles.includes(Role.admin)) {
      return filteredNavigation;
    }

    return filteredNavigation.filter(item => allowedIds.has(item.id));
  }, [filteredNavigation, allowedIds, allRoles]);

  return {
    contextAwareNavigation,
    currentPath: pathname,
  };
};
