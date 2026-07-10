import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  notificationsOpen: boolean;
  userMenuOpen: boolean;
  searchQuery: string;
  setSidebarOpen: (isOpen: boolean) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setNotificationsOpen: (isOpen: boolean) => void;
  setUserMenuOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>(set => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  notificationsOpen: false,
  userMenuOpen: false,
  searchQuery: '',
  setSidebarOpen: isOpen => set({ sidebarOpen: isOpen }),
  setSidebarCollapsed: isCollapsed => set({ sidebarCollapsed: isCollapsed }),
  setNotificationsOpen: isOpen => set({ notificationsOpen: isOpen }),
  setUserMenuOpen: isOpen => set({ userMenuOpen: isOpen }),
  setSearchQuery: query => set({ searchQuery: query }),
}));
