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

function getRequestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message
  ) {
    return error.message;
  }
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export default function AdminUsersPage() {
  const { allRoles } = usePermissions();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const isAdmin = isAuthenticated && (allRoles?.includes(RoleEnum.admin) || user?.role === RoleEnum.admin);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetryFetch, setCanRetryFetch] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [deletingUserId, setDeletingUserId] = useState<string>();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [rolesRefreshVersion, setRolesRefreshVersion] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!isAdmin) return;
    let current = true;
    setRolesError(null);
    void adminService
      .getRoles()
      .then(fetchedRoles => {
        if (current) setRoles(fetchedRoles);
      })
      .catch(error => {
        if (current) {
          setRolesError(getRequestErrorMessage(error, 'Failed to fetch roles.'));
        }
      });

    return () => {
      current = false;
    };
  }, [isAdmin, rolesRefreshVersion]);

  useEffect(() => {
    if (!isAdmin) return;
    let current = true;
    setLoading(true);
    setError(null);
    setCanRetryFetch(false);

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
      .catch(requestError => {
        if (!current) return;
        setError(getRequestErrorMessage(requestError, 'Failed to fetch users.'));
        setCanRetryFetch(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [isAdmin, page, debouncedSearch, roleFilter, statusFilter, refreshVersion]);

  const handleCreateOrUpdateUser = async (
    userData: Partial<User> & { password?: string; acceptTerms?: boolean }
  ) => {
    try {
      if (editingUser?.id) {
        await adminService.updateUser(editingUser.id, userData);
      } else {
        await adminService.createUser(userData);
      }
      setIsFormOpen(false);
      setEditingUser(null);
      setRefreshVersion(version => version + 1);
    } catch (requestError) {
      setCanRetryFetch(false);
      setError(getRequestErrorMessage(requestError, 'Failed to save user.'));
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
      } catch (requestError) {
        setCanRetryFetch(false);
        setError(getRequestErrorMessage(requestError, 'Failed to delete user.'));
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
        <p className="text-muted-foreground">You must be an administrator to access this page.</p>
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

        {error && (
          <div
            className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive"
            role="alert"
          >
            <span>{error}</span>
            {canRetryFetch && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setRefreshVersion(version => version + 1)}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {rolesError && (
          <div
            className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive"
            role="alert"
          >
            <span>{rolesError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRolesRefreshVersion(version => version + 1)}
            >
              Retry roles
            </Button>
          </div>
        )}

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
