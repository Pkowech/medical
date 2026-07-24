import { useSession } from 'next-auth/react';
import { Role } from '@/shared/enums/role.enum';
import { navigationPermissions } from '@/core/app/components/layout/permissionConfig';
import navigationConfig from '@/core/app/components/layout/navigationConfig';

export const usePermissions = () => {
  const { data: session } = useSession() || {};
  const user = session?.user;

  const getHighestRole = (roles: Role[]): Role => {
    const roleHierarchy: Role[] = [
      Role.guest,
      Role.student,
      Role.moderator,
      Role.instructor,
      Role.admin,
    ];
    let highestRole: Role = Role.guest;
    for (const role of roles) {
      if (roleHierarchy.indexOf(role) > roleHierarchy.indexOf(highestRole)) {
        highestRole = role;
      }
    }
    return highestRole;
  };

  // Use all user roles if available, otherwise fall back to primary role
  const roles =
    user?.roles && user.roles.length > 0
      ? (user.roles as Role[])
      : user?.role
        ? [user.role as Role]
        : [Role.guest];

  const highestRole = getHighestRole(roles);

  const allowedRoutes = navigationPermissions[highestRole] || navigationPermissions[Role.guest];

  const filteredNavigation = navigationConfig
    .filter(item => allowedRoutes.includes(item.id))
    .filter((item, index, self) => self.findIndex(t => t.id === item.id) === index);

  return { filteredNavigation, role: highestRole, allRoles: roles };
};
