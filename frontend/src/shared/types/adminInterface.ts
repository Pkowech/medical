export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super-admin';
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetails extends AdminUser {
  permissions: string[];
  lastLogin: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  managedUsers: AdminUserSummary[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super-admin';
  createdAt: string;
  updatedAt: string;
}
