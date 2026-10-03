// frontend/src/components/admin/UserList.tsx

'use client';

import { User } from '@/shared/types/authInterface';
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
import { Progress } from '@/shared/components/ui/progress';
import { Input } from '@/shared/components/ui/input';

interface UserListProps {
  users: User[];
  search: string;
  roleFilter: string;
  statusFilter: string;
  roleOptions: string[];
  page: number;
  totalPages: number;
  totalUsers: number;
  loading: boolean;
  deletingUserId?: string;
  onSearchChange: (search: string) => void;
  onRoleFilterChange: (role: string) => void;
  onStatusFilterChange: (status: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  search,
  roleFilter,
  statusFilter,
  roleOptions,
  page,
  totalPages,
  totalUsers,
  loading,
  deletingUserId,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onPageChange,
  onEdit,
  onDelete,
}) => {
  const formatLastUpdated = (timestamp?: string | number): string => {
    if (!timestamp) return 'N/A';
    const ts = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp;
    if (!ts) return 'N/A';
    const now = Date.now();
    const diffMs = now - ts;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
          <Input
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search name, email, or username"
            aria-label="Search users"
          />
          <select
            value={roleFilter}
            onChange={event => onRoleFilterChange(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter users by role"
          >
            <option value="all">All roles</option>
            {roleOptions.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={event => onStatusFilterChange(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter users by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-center">
            {search || roleFilter !== 'all' || statusFilter !== 'all'
              ? 'No users match these filters.'
              : 'No users found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Course Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Progress Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">
                          {user.completedCourses ?? 0} / {user.totalCourses ?? 0}
                        </span>
                        <Progress value={user.courseProgress || 0} className="w-24 mt-1" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          {
                            active: 'bg-green-500',
                            inactive: 'bg-red-500',
                            pending: 'bg-yellow-500',
                            suspended: 'bg-gray-500',
                          }[user.status || 'inactive'] || 'bg-gray-500'
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {user.progressLastUpdated ? formatLastUpdated(user.progressLastUpdated) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(user)}
                        className="mr-2"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(user.id)}
                        disabled={deletingUserId === user.id}
                        aria-label={`Delete ${user.fullName || user.email}`}
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
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{loading ? 'Updating results...' : `${totalUsers} users`}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span aria-live="polite">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
