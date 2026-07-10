import { LucideIcon } from 'lucide-react';
import type { User as AppUser } from '@/shared/types/authInterface';
import { Notification } from '@/shared/types/notificationsInterface'; // Import Notification

export interface NavigationItem {
  id: string;
  label: string;
  href?: string; // Make href optional
  icon: LucideIcon;
  badge?: string | number;
  highlight?: boolean;
  children?: NavigationItem[];
  onClick?: () => void; // Add optional onClick property
  color?: string; // Add color property
}

export interface LayoutState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface LayoutContextType extends LayoutState {
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
}

export interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user?: AppUser | null;
  notifications: Notification[];
  searchQuery?: string; // Optional - managed locally in AppHeader
  setSearchQuery?: (query: string) => void; // Optional
  notificationsOpen: boolean;
  setNotificationsOpen: (isOpen: boolean) => void;
  selectedFilter?: string; // Optional
  setSelectedFilter?: (filter: string) => void; // Optional
  onNotificationRefresh?: () => void; // Callback to refresh notifications
}

export interface SidebarProps {
  theme: 'light' | 'dark';
  user?: AppUser | null;
  navigationItems: NavigationItem[];
  // Optional title for special sidebars (e.g. Admin Panel)
  title?: string;
  // When true the sidebar renders admin-specific quick actions/profile
  admin?: boolean;
}

export interface NavigationItemProps {
  item: NavigationItem;
  sidebarCollapsed?: boolean;
  sidebarOpen?: boolean;
  onClick?: () => void;
  active?: boolean;
}

export interface UserMenuProps {
  user?: AppUser | null;
  onLogout: () => void;
}
