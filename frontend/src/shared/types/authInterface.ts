import { Role } from '@/shared/enums/role.enum'; // Import Role as a type
import { Permission } from '@/lib/auth/roles'; // Import canonical Permission enum
import type { Session as NextAuthSession } from 'next-auth';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { RoleEntity } from '@/shared/types/systemInterface';
import type { UserEducationProfile, Education, Certification, SocialLink } from './profileInterface';

// Define BaseEntity directly
export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Re-export Permission from lib/auth/roles for consistency
 * This is the canonical source of truth for permission definitions
 */
export { Permission };
export type { Role }; // Re-export Role as a type

/**
 * Authentication and user-related types
 */

/**
 * Form data for authentication flows
 */
export interface AuthFormData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  role: string;
  acceptTerms: boolean;
  // Optional profile fields
  phoneNumber?: string;
  bio?: string;
  location?: string;
  specialization?: string;
  yearOfExperience?: number | string;
}

export interface AuthFormErrors {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
}

// Keep old names for backwards compatibility (deprecated)
export type FormData = AuthFormData;
export type FormErrors = AuthFormErrors;

/**
 * Core User types with inheritance hierarchy
 */

// Base User interface with essential properties
export interface UserBase extends BaseEntity {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

// Complete User interface with all properties
// Aligned with backend AuthUserDto
export interface User extends UserBase {
  fullName?: string;
  avatar?: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  role: Role;
  roles: Role[];
  permissions: Permission[];
  isEmailVerified: boolean;
  isActive?: boolean;
  lastLoginAt?: string;
  preferences?: UserPreferences;
  profile?: UserEducationProfile;
  status?: 'active' | 'inactive' | 'pending' | 'suspended';
  // Token fields are optional as they may be absent after sign-out
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  specialization?: string;
  yearOfExperience?: number;
  institution?: string;
  courseProgress?: number; // Overall course progress percentage
  totalCourses?: number; // Total enrolled courses
  completedCourses?: number; // Total completed courses
  progressLastUpdated?: string; // Timestamp for last synced progress
}

export type UserRole = Role;

// Minimal user type for basic operations
export type UserMinimal = Pick<
  User,
  'id' | 'email' | 'username' | 'firstName' | 'lastName' | 'role' | 'isEmailVerified'
>;

// User preferences and settings
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  courseUpdates: boolean;
  assignments: boolean;
  announcements: boolean;
  reminders: boolean;
}

export interface DeviceInfo {
  name?: string;
  userAgent: string;
  platform: string;
  language: string;
}

export interface Session extends BaseEntity {
  userId: string;
  deviceInfo: DeviceInfo;
  lastActive: string;
  location?: string;
  isCurrentSession: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  allowMessages: boolean;
}

// User profile types are consolidated in user-profile.types.ts
export type { UserEducationProfile, Education, Certification, SocialLink };
// Backward compatibility: UserProfile is now an alias for UserEducationProfile
export type UserProfile = UserEducationProfile;

// Note: AuthState is now defined locally in @/features/auth/store/useAuthStore
// to keep store concerns separate from core auth types

/**
 * Authentication Request DTOs
 */

// Base authentication request type
interface AuthRequestBase {
  email: string;
  password: string;
}

// Consolidated login request
export interface LoginDTO extends AuthRequestBase {
  identifier?: string; // Optional: can be email or username
  rememberMe?: boolean;
}

// Registration request with all required fields
export interface RegisterDTO extends AuthRequestBase {
  firstName: string;
  lastName: string;
  username: string;
  confirmPassword: string;
  acceptTerms: boolean;
  role?: UserRole;
  // Optional profile fields
  phoneNumber?: string;
  bio?: string;
  location?: string;
  specialization?: string;
  yearOfExperience?: number;
}

// Password management DTOs
export interface PasswordRequestDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyEmailDTO {
  token: string;
}

/**
 * Authentication Response DTOs
 */

// Session user information
export interface AuthSessionUser extends UserMinimal {
  accessToken?: string;
  roles: Role[];
  permissions: Permission[];
}

// Full authentication response
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

// Login specific response
export interface LoginResponse {
  user: User;
  access_token: string; // Kept for backwards compatibility
  accessToken: string;
  expiresAt: string;
}
export interface LoginResponsePayload {
  message?: string;
  data?: {
    user?: Record<string, unknown>;
    roles?: Record<string, unknown>;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string | number;
  };
  raw?: string;
  [key: string]: unknown;
}

// Registration specific response
export interface RegisterResponse {
  user: User;
  accessToken: string;
  token_expiration: string;
  refresh_token?: string;
}

// Token refresh response
export interface RefreshTokenResponse {
  token: string;
}

/**
 * Auth Context and Hook Types
 */

// Auth context type with all available actions
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Authentication methods
  login: (credentials: LoginDTO) => Promise<void>;
  register: (data: RegisterDTO) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Profile management
  updateProfile: (data: Partial<User>) => Promise<void>;

  // Password and verification
  changePassword: (data: ChangePasswordDTO) => Promise<void>;
  forgotPassword: (data: PasswordRequestDTO) => Promise<void>;
  resetPassword: (data: ResetPasswordDTO) => Promise<void>;
  verifyEmail: (data: VerifyEmailDTO) => Promise<void>;

  clearError: () => void;
}

// Extended auth hook type with additional helper methods
export interface UseAuthReturn extends AuthContextType {
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  isRole: (role: UserRole) => boolean;
}
/**
 * RBAC and Roles related interfaces
 */

/**
 * Interface for a single role object with permissions
 */
export interface RolePermission {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

/**
 * Response type for getRoles API call
 */
export interface GetRolesResponse {
  roles: RolePermission[];
}

/**
 * ============================================================================
 * API Response Types
 * ============================================================================
 */

// Minimal API response shapes used by frontend services
export interface UserResponse {
  data: User;
  message?: string;
  success: boolean;
}

export interface UsersListResponse {
  data: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  success: boolean;
}

export interface UserSessionData {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  lastAccessed: string;
  createdAt: string;
  isCurrent: boolean;
}

export type GetSessionsResponse = UserSessionData[];

/**
 * User progress and engagement metrics
 */
export interface UserProgress {
  completedCourses: number;
  totalCourses: number;
  studyStreak: number;
}

/**
 * Activity tracking for user engagement
 */
export interface AuthUserActivity {
  id: string;
  date: string;
  type: string;
  durationMinutes?: number;
  score?: number;
  title?: string;
  description?: string;
}

/**
 * ============================================================================
 * Dashboard and UI Component Types
 * ============================================================================
 */

/**
 * Dashboard widget configuration
 */
export interface Widget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  component: string;
}

// StatCardProps removed - moved to uiInterface.ts

/**
 * Medical education dashboard data structure
 */
export interface MedicalDashboardData {
  progressData: { month: string; hours: number; score: number }[];
  courseData: { name: string; completed: number; total: number }[];
  upcomingDeadlines: { id: number; title: string; date: string; priority: string }[];
  recentActivity: AuthUserActivity[];
  stats: {
    totalCourses: number;
    coursesCompleted: number;
    overallProgress: number;
    averageScore: number;
    streak: number;
    lastActivity: string | null;
  };
}

/**
 * Medical education dashboard component props
 */
export interface MedicalEducationDashboardProps {
  session: NextAuthSession | null;
  router: AppRouterInstance;
}

/**
 * Role response from API
 */
export interface RoleResponse {
  data: RoleEntity;
  success: boolean;
}

/**
 * Roles list response from API
 */
export interface RolesListResponse {
  data: RoleEntity[];
  success: boolean;
}

/**
 * User permissions with role context
 */
export interface UserPermissions {
  role: RoleEntity;
  permissions: string[];
}

/**
 * Permission object for API responses
 */
export interface PermissionObject {
  id: string;
  action: string;
  subject: string;
}