// frontend/src/components/admin/RoleForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { RoleEntity } from '@/shared/types/systemInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';

interface RoleFormProps {
  role: RoleEntity | null;
  onSave: (role: RoleEntity) => void;
  onCancel: () => void;
}

export const RoleForm: React.FC<RoleFormProps> = ({ role, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<RoleEntity>>({
    name: '',
    permissions: [],
  });

  useEffect(() => {
    if (role) {
      setFormData(role);
    } else {
      setFormData({
        name: '',
        permissions: [],
      });
    }
  }, [role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    if (id === 'permissions') {
      // Convert comma-separated permission names into minimal Permission objects expected by Role type
      setFormData(prev => ({
        ...prev,
        permissions: value
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
          .map(name => ({ id: name, name, description: '', category: '' })),
      }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.permissions) {
      onSave(formData as RoleEntity);
    } else {
      alert('Please fill in all required fields.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{role ? 'Edit Role' : 'Add New Role'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Role Name</Label>
            <Input id="name" value={formData.name || ''} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="permissions">Permissions (comma-separated)</Label>
            <Textarea
              id="permissions"
              value={formData.permissions?.map(p => p.name).join(', ') || ''}
              onChange={handleChange}
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save Role</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
