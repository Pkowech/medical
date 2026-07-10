// frontend/src/app/(app)/admin/roles/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { RoleList } from '@/features/security/components/RoleList';
import { RoleForm } from '@/features/security/components/RoleForm';
import { adminService } from '@/features/admin/services/adminService';
import { RoleEntity } from '@/shared/types/systemInterface';
import { Button } from '@/shared/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Role as RoleEnum } from '@/shared/enums/role.enum';

export default function AdminRolesPage() {
  const { allRoles } = usePermissions();
  const isAdmin = allRoles?.includes(RoleEnum.admin);

  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleEntity | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const fetchedRolesData = await adminService.getRoles();
      setRoles(fetchedRolesData);
    } catch (err) {
      setError('Failed to fetch roles.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateOrUpdateRole = async (roleData: RoleEntity) => {
    try {
      if (roleData.id) {
        const updatedRole = await adminService.updateRole(roleData.id, roleData);
        setRoles(prev => prev.map(r => (r.id === updatedRole.id ? updatedRole : r)));
      } else {
        const newRole = await adminService.createRole(roleData);
        setRoles(prev => [...prev, newRole]);
      }
      setIsFormOpen(false);
      setEditingRole(null);
      fetchRoles(); // Refresh the list
    } catch (error) {
      setError('Failed to save role.');
      console.error(error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await adminService.deleteRole(roleId);
        fetchRoles(); // Refresh the list
      } catch (error) {
        setError('Failed to delete role.');
        console.error(error);
      }
    }
  };

  const handleEditRole = (role: RoleEntity) => {
    setEditingRole(role);
    setIsFormOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-gray-600">You must be an administrator to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading Role Management...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Role and Permission Management</h1>
        <Button
          onClick={() => {
            setEditingRole(null);
            setIsFormOpen(true);
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
        </Button>
      </div>

      {isFormOpen && (
        <RoleForm
          role={editingRole}
          onSave={handleCreateOrUpdateRole}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingRole(null);
          }}
        />
      )}

      <RoleList roles={roles} onEdit={handleEditRole} onDelete={handleDeleteRole} />
    </div>
  );
}
