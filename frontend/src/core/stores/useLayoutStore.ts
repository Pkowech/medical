'use client';

import { create } from 'zustand';

interface LayoutState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarUserMenuOpen: boolean;
  headerUserMenuOpen: boolean;
  searchQuery: string;
  notificationsOpen: boolean;
  activeCoursePanel?: string;
  setNotificationsOpen: (isOpen: boolean) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setSidebarUserMenuOpen: (isOpen: boolean) => void;
  setHeaderUserMenuOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleSidebar: () => void;
  toggleCoursePanel: (panelName: string) => void;
}

export const useLayoutStore = create<LayoutState>(set => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  notificationsOpen: false,
  sidebarUserMenuOpen: false,
  headerUserMenuOpen: false,
  searchQuery: '',
  activeCoursePanel: undefined,
  setSidebarOpen: isOpen => set({ sidebarOpen: isOpen }),
  setSidebarCollapsed: isCollapsed => set({ sidebarCollapsed: isCollapsed }),
  setNotificationsOpen: isOpen => set({ notificationsOpen: isOpen }),
  setSidebarUserMenuOpen: isOpen => set({ sidebarUserMenuOpen: isOpen }),
  setHeaderUserMenuOpen: isOpen => set({ headerUserMenuOpen: isOpen }),
  setSearchQuery: query => set({ searchQuery: query }),
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  toggleCoursePanel: (panelName: string) =>
    set(state => ({
      activeCoursePanel: state.activeCoursePanel === panelName ? undefined : panelName,
    })),
}));
