import 'next-auth';
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';
import { Role } from '@/shared/enums/role.enum';
import type { UserProfile, UserPreferences, User } from '@/shared/types/authInterface';

/**
 * Consolidated NextAuth module augmentations
 * Single source of truth for auth type extensions
 */

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    roles: Role[];
    permissions: string[];
    isEmailVerified: boolean;
    careerStage?: 'student' | 'professional' | null;
    healthcareField?: string | null;
    studyYear?: number | null;
    yearOfExperience?: number | null;
    specialization?: string | null;
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
  }

  interface Session {
    user: User & DefaultSession['user'];
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    roles: Role[];
    permissions: string[];
    isEmailVerified: boolean;
    careerStage?: 'student' | 'professional' | null;
    healthcareField?: string | null;
    studyYear?: number | null;
    yearOfExperience?: number | null;
    specialization?: string | null;
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: 'RefreshAccessTokenError' | 'TokenExpiredError' | 'NoAccessToken';
  }
}
