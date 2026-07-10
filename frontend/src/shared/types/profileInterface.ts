/**
 * User Profile Types and Interfaces
 * Centralized definitions aligned with backend User model, BaseUserResponseDto, and UserProfileResponseDto
 * This is the single source of truth for all user profile-related data structures
 *
 * See Also:
 * - backend/src/common/dto/base-response.dto.ts (BaseUserResponseDto)
 * - backend/src/common/dto/user.dto.ts (UserProfileResponseDto, UserStatsDto)
 * - backend/prisma/schema.prisma (User model)
 */

import { BaseEntity } from './authInterface';

// ============================================================================
// PROFILE STATUS & TYPE ENUMS
// ============================================================================

/**
 * User profile visibility setting
 * Aligned with UserPreferences from backend
 */
export type ProfileVisibility = 'public' | 'private' | 'friends';

/**
 * Learning analytics levels
 * Determines study recommendations and AI guidance
 */
export type GuidanceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * User account status
 */
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

// ============================================================================
// BASE USER PROFILE DATA
// ============================================================================

/**
 * Base user profile fields - core personal information
 * Maps directly to User model fields in Prisma schema
 *
 * Backend: User model, fields firstName through specialization
 */
export interface UserProfileBase extends BaseEntity {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  specialization?: string;
  yearOfExperience?: number;
  isActive: boolean;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: string | Date;
  streakDays: number;
}

// ============================================================================
// PROFILE STATISTICS & ANALYTICS
// ============================================================================

/**
 * User profile statistics - aggregated learning and engagement metrics
 * Aligned with backend UserStatsDto
 * Used in profile display and dashboard
 */
export interface UserProfileStats {
  coursesEnrolled: number;
  coursesCompleted: number;
  totalStudyTime: number; // in minutes
  averageScore: number; // 0-100
  badges: number;
  points: number;
  level: number;
  currentStreak: number; // in days
}

/**
 * User activity record - represents a single user action
 * Aligned with backend UserActivityDto
 * Examples: course_started, assessment_completed, lesson_viewed
 */
export interface UserActivity {
  id: string;
  type: string;
  description: string;
  createdAt: string | Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * User Profile Response - complete profile data from backend
 * Aligned with backend UserProfileResponseDto
 * Combines base user info with stats and recent activity
 *
 * Backend: UserProfileResponseDto class
 */
export interface UserProfileResponse extends UserProfileBase {
  totalCourses: number;
  stats: UserProfileStats;
  recentActivity: UserActivity[];
  role?: string;
  permissions?: string[];
}

/**
 * User Profile Display - profile data enriched for UI presentation
 * Combines API response with computed fields for display
 * Used in profile page components
 */
export interface UserProfileDisplay extends UserProfileResponse {
  fullName?: string; // computed: firstName + ' ' + lastName
  initials?: string; // computed: first letter of firstName + lastName
  profileCompleteness?: number; // 0-100 percentage
  lastActivityDate?: string;
  totalLearningHours?: number; // computed: totalStudyTime / 60
}

// ============================================================================
// FORM MODELS (EDITABLE PROFILE DATA)
// ============================================================================

/**
 * Local User Profile - client-side form model for profile editing
 * Used in components to track editable profile state
 * Doesn't include read-only fields like createdAt, stats
 * Combines editable base fields with optional stats for display
 */
export interface LocalUserProfile {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  bio: string;
  location: string;
  specialization: string;
  yearOfExperience: number;
  profileImage?: string;
  // Stats fields (read-only after fetch, for display)
  coursesEnrolled?: number;
  coursesCompleted?: number;
  totalStudyTime?: number;
  averageScore?: number;
}

/**
 * Profile Update Request DTO - sent to backend on save
 * Aligned with backend UpdateUserDto profile fields
 * All fields optional to support partial updates
 */
export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  bio?: string;
  location?: string;
  specialization?: string;
  yearOfExperience?: number;
  profileImage?: string;
}

// ============================================================================
// VALIDATION & STATE MANAGEMENT
// ============================================================================

/**
 * Validation result for a form field
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

/**
 * Profile validation state - tracks validation for form
 */
export interface ProfileValidationState {
  isValid: boolean;
  errors: Record<string, string>; // field -> error message
  touched: Record<string, boolean>; // field -> has user interacted
  completeness: number; // 0-100 percentage of required fields
}

/**
 * Profile completeness breakdown - detailed metrics
 * Shows which required/optional fields are complete
 */
export interface ProfileCompletenessBreakdown {
  requiredFieldsComplete: number; // 0-100%
  optionalFieldsComplete: number; // 0-100%
  overallCompleteness: number; // 0-100%
  missingRequiredFields: string[];
  suggestedOptionalFields: string[];
}

/**
 * Complete profile edit state - all state for edit form
 */
export interface ProfileEditState {
  profile: LocalUserProfile;
  errors: Record<string, string>;
  hasUnsavedChanges: boolean;
  isSubmitting: boolean;
  hasValidationErrors: boolean;
  completenessBreakdown: ProfileCompletenessBreakdown;
}

// ============================================================================
// UI ORGANIZATION & CONTEXT
// ============================================================================

/**
 * Profile page section/tab identifier
 */
export type ProfileTab =
  | 'overview'
  | 'personal'
  | 'professional'
  | 'educational'
  | 'activity'
  | 'achievements'
  | 'settings';

/**
 * Profile context for React Context API
 * Centralizes profile data and operations across components
 */
export interface IProfileContext {
  profile: UserProfileDisplay | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (data: ProfileUpdateRequest) => Promise<void>;
}

// ============================================================================
// FORM MODEL
// ============================================================================

/**
 * User Profile Form - model for profile editing with all editable fields
 */
export interface UserProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  bio: string;
  location: string;
  specialization: string;
  yearOfExperience: number;
  profileImage?: string;
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

/**
 * Profile Validation Error - field-level validation error with severity
 */
export interface ProfileValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

// ============================================================================
// EDUCATION & PROFESSIONAL HISTORY
// ============================================================================

/**
 * User Education History - standardized education record
 */
export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

/**
 * User Certification - professional certification record
 */
export interface Certification {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

/**
 * Social Media Link - user social profiles
 */
export interface SocialLink {
  platform: string;
  url: string;
  username?: string;
}

/**
 * User Education Profile - extended profile with education, certifications, skills
 */
export interface UserEducationProfile {
  specialization?: string;
  experience?: string;
  education?: Education[];
  certifications?: Certification[];
  skills?: string[];
  interests?: string[];
  socialLinks?: SocialLink[];
}

// ============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

/** @deprecated Use UserEducationProfile instead */
export type UserProfile = UserEducationProfile;
