// frontend/src/components/admin/UserForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { User } from '@/shared/types/authInterface';
import { RoleEntity } from '@/shared/types/systemInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

interface UserFormProps {
  user: User | null;
  roles: RoleEntity[];
  onSave: (user: Partial<User> & { password?: string; acceptTerms?: boolean }) => void;
  onCancel: () => void;
}

export const UserForm: React.FC<UserFormProps> = ({ user, roles, onSave, onCancel }) => {
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    firstName: '',
    lastName: '',
    email: '',
    role: undefined,
    status: 'active',
  });

  useEffect(() => {
    if (user) {
      setPassword('');
      setAcceptTerms(false);
      setValidationError(null);
      setFormData({
        ...user,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || undefined,
        status: user.status || 'active',
      });
    } else {
      setPassword('');
      setAcceptTerms(false);
      setValidationError(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: undefined,
        status: 'active',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (value: string, field: keyof User) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && password.length < 6) {
      setValidationError('Set a temporary password with at least 6 characters.');
      return;
    }
    if (!user && !acceptTerms) {
      setValidationError('Confirm that the user has accepted the Terms of Service.');
      return;
    }
    if (
      formData.firstName &&
      formData.lastName &&
      formData.email &&
      formData.role &&
      formData.status
    ) {
      setValidationError(null);
      onSave({
        email: formData.email,
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        status: formData.status,
        ...(password ? { password } : {}),
        ...(!user ? { acceptTerms: true } : {}),
      });
    } else {
      setValidationError('Complete all required fields before saving.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{user ? 'Edit User' : 'Add New User'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={formData.firstName || ''}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" value={formData.lastName || ''} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">{user ? 'New Password (optional)' : 'Temporary Password'}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={6}
              required={!user}
              placeholder={user ? 'Leave blank to keep the current password' : undefined}
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={value => handleSelectChange(value, 'role')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.name}>
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={value => handleSelectChange(value, 'status')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!user && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={event => setAcceptTerms(event.target.checked)}
                required
                className="mt-1"
              />
              <span>Confirm the user has accepted the Terms of Service.</span>
            </label>
          )}
          {validationError && (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          )}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save User</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
