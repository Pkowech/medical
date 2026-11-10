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
import { Badge } from '@/shared/components/ui/badge';
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
          <p className="py-8 text-center text-sm text-muted-foreground">
            No roles yet. Add a role to define access permissions.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[36rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Role Name</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium capitalize">{role.name}</TableCell>
                    <TableCell>
                      <div className="flex max-w-xl flex-wrap gap-1.5">
                        {role.permissions.length > 0 ? (
                          role.permissions.map(permission => (
                            <Badge
                              key={permission.id}
                              variant="secondary"
                              className="max-w-40 truncate font-normal"
                              title={permission.name}
                            >
                              {permission.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No permissions</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(role)}
                        className="h-8 w-8"
                        aria-label={`Edit ${role.name} role`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(role.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${role.name} role`}
                      >
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
