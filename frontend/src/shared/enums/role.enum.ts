export enum Role {
  guest = 'guest',
  student = 'student',
  moderator = 'moderator',
  instructor = 'instructor',
  admin = 'admin',
}

export function getSafeRoles(value: unknown, fallback: Role | Role[] = [Role.guest]): Role[] {
  const candidates = Array.isArray(value) ? value : [value];
  const valid = candidates.reduce<Role[]>((roles, candidate) => {
    if (typeof candidate !== 'string') return roles;
    const normalized = candidate.trim();
    if (Object.values(Role).includes(normalized as Role)) {
      roles.push(normalized as Role);
    }
    return roles;
  }, []);

  if (valid.length > 0) {
    return [...new Set(valid)];
  }

  const fallbackRoles = Array.isArray(fallback) ? fallback : [fallback];
  return fallbackRoles.filter((role): role is Role => Object.values(Role).includes(role as Role));
}

// Default role for new user registration
export const defaultRegistrationRole: Role = Role.student;

// guest role configuration
export const guestRoleConfig = {
  name: Role.guest,
  description: 'Limited access for anonymous browsing',
  color: 'gray',
  hierarchyLevel: 0,
  sessionDuration: 3600,
  maxConcurrentSessions: 5,
};

// Role hierarchy for permission inheritance and access control
export const roleHierarchy: Record<Role, number> = {
  [Role.guest]: 0,
  [Role.student]: 1,
  [Role.moderator]: 2,
  [Role.instructor]: 3,
  [Role.admin]: 4,
};

// Roles allowed to create content
export const instructorRoles: Role[] = [Role.instructor, Role.admin];
