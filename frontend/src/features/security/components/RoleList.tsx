// frontend/src/components/admin/RoleList.tsx

'use client';

import React from 'react';
import { RoleEntity } from '@/shared/types/systemInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

interface RoleListProps {
  roles: RoleEntity[];
  onEdit: (role: RoleEntity) => void;
  onDelete: (roleId: string) => void;
}

export const RoleList: React.FC<RoleListProps> = ({ roles, onEdit, onDelete }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Roles</CardTitle>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <p className="text-muted-foreground text-center">No roles found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.permissions.map(p => p.name).join(', ')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(role)}
                        className="mr-2"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(role.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
