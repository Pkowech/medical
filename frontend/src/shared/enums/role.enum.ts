export enum Role {
  guest = 'guest',
  student = 'student',
  moderator = 'moderator',
  instructor = 'instructor',
  admin = 'admin',
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
