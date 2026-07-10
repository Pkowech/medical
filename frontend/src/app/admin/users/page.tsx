// frontend/src/app/(app)/admin/users/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { UserList } from '@/features/admin/components/UserList';
import { UserForm } from '@/features/admin/components/UserForm';
import { adminService } from '@/features/admin/services/adminService';
import { User } from '@/shared/types/authInterface';
import { RoleEntity } from '@/shared/types/systemInterface';
import { Role as RoleEnum } from '@/shared/enums/role.enum';
import { Button } from '@/shared/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function AdminUsersPage() {
  const { allRoles } = usePermissions();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const isAdmin = isAuthenticated && (allRoles?.includes(RoleEnum.admin) || user?.role === RoleEnum.admin);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsersAndRoles = async () => {
    try {
      setLoading(true);
      const [fetchedUsersData, fetchedRolesData] = await Promise.all([
        adminService.getUsers(),
        adminService.getRoles(),
      ]);

      setUsers(fetchedUsersData || []);
      setRoles(fetchedRolesData || []);
    } catch (err) {
      setError('Failed to fetch users or roles.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsersAndRoles();
    }
  }, [isAdmin]);

  const handleCreateOrUpdateUser = async (
    userData: Omit<User, 'id' | 'createdAt' | 'lastLogin'> | User
  ) => {
    try {
      if ('id' in userData && userData.id) {
        await adminService.updateUser(userData.id, userData as User);
      } else {
        await adminService.createUser(userData as Omit<User, 'id' | 'createdAt' | 'lastLogin'>);
      }
      setIsFormOpen(false);
      setEditingUser(null);
      await fetchUsersAndRoles();
    } catch (err) {
      setError('Failed to save user.');
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await adminService.deleteUser(userId);
        await fetchUsersAndRoles();
      } catch (err) {
        setError('Failed to delete user.');
        console.error(err);
      }
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  if (authLoading) {
    return <div className="text-center py-8">Checking session...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-gray-600">You must be an administrator to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">User Management</h1>
          <Button
            onClick={() => {
              setEditingUser(null);
              setIsFormOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add New User
          </Button>
        </div>

        {loading && <div className="text-center">Loading users...</div>}

        {error && <div className="text-center text-red-500">Error: {error}</div>}

        {!loading && !error && (
          <>
            {isFormOpen && (
              <UserForm
                user={editingUser}
                roles={roles}
                onSave={handleCreateOrUpdateUser}
                onCancel={() => {
                  setIsFormOpen(false);
                  setEditingUser(null);
                }}
              />
            )}

            <UserList users={users} onEdit={handleEditUser} onDelete={handleDeleteUser} />
          </>
        )}
      </div>
    </div>
  );
}
