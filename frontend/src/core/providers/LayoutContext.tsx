'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { LayoutContextType } from '@/shared/types/navigationInterface';
import { useTheme } from '@/app/providers';
import { useLayoutStore } from '@/core/stores/useLayoutStore';

/**
 * LayoutContext now proxies to the global Zustand store and the theme provider.
 * This ensures a single source of truth for sidebar state and theme toggling
 * across the application and avoids duplicated, out-of-sync state.
 */
const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const { theme, toggleTheme } = useTheme();

  // Read setters and values directly from the Zustand store
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen, setSidebarCollapsed } = useLayoutStore();

  const value: LayoutContextType = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      sidebarCollapsed,
      setSidebarCollapsed,
      theme: theme as 'light' | 'dark' | 'system',
      toggleTheme,
    }),
    [sidebarOpen, sidebarCollapsed, setSidebarOpen, setSidebarCollapsed, theme, toggleTheme]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
