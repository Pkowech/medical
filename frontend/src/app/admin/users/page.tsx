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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [deletingUserId, setDeletingUserId] = useState<string>();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!isAdmin) return;
    let current = true;
    void adminService
      .getRoles()
      .then(fetchedRoles => {
        if (current) setRoles(fetchedRoles);
      })
      .catch(err => {
        console.error('Failed to fetch roles.', err);
      });

    return () => {
      current = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let current = true;
    setLoading(true);
    setError(null);

    void adminService
      .getUsers(page, 10, {
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter,
      })
      .then(result => {
        if (!current) return;
        setUsers(result.users);
        setTotalUsers(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      })
      .catch(err => {
        if (!current) return;
        setError('Failed to fetch users.');
        console.error(err);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [isAdmin, page, debouncedSearch, roleFilter, statusFilter, refreshVersion]);

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
      setRefreshVersion(version => version + 1);
    } catch (err) {
      setError('Failed to save user.');
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setDeletingUserId(userId);
      setError(null);
      try {
        await adminService.deleteUser(userId);
        setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
        setTotalUsers(currentTotal => Math.max(0, currentTotal - 1));
        if (users.length === 1 && page > 1) setPage(currentPage => currentPage - 1);
        setRefreshVersion(version => version + 1);
      } catch (err) {
        setError('Failed to delete user.');
        console.error(err);
      } finally {
        setDeletingUserId(undefined);
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

        {error && <div className="text-center text-red-500">Error: {error}</div>}

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

        {loading && (
          <div className="text-center text-sm text-muted-foreground" role="status">
            Updating users...
          </div>
        )}
        <UserList
          loading={loading}
          users={users}
          search={search}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          roleOptions={roles.map(role => role.name)}
          page={page}
          totalPages={totalPages}
          totalUsers={totalUsers}
          deletingUserId={deletingUserId}
          onSearchChange={value => {
            setSearch(value);
            setPage(1);
          }}
          onRoleFilterChange={value => {
            setRoleFilter(value);
            setPage(1);
          }}
          onStatusFilterChange={value => {
            setStatusFilter(value);
            setPage(1);
          }}
          onPageChange={setPage}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
        />
      </div>
    </div>
  );
}
