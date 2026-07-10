import { LearningResourceType } from '@prisma/client';

/**
 * COURSE-002: Prerequisite type enum drives the 🔴/🟡/🟢 badge indicators in the UI.
 * - required: student must complete before enrolling (hard gate)
 * - optional: student is warned but not blocked
 * - recommended: soft suggestion only
 */
export enum PrerequisiteType {
  required = 'required',
  optional = 'optional',
  recommended = 'recommended',
}

export interface PrerequisiteItem {
  id: string;
  title: string;
  type: PrerequisiteType;
  required: boolean; // kept for backward-compat, derived from type === 'required'
}

export interface PrerequisiteCheck {
  satisfied: boolean;
  missingPrerequisites?: PrerequisiteItem[];
  completedPrerequisites?: PrerequisiteItem[];
}

// Base prerequisite interface
export interface Prerequisite {
  id: string;
  title: string;
  type: LearningResourceType;
  prerequisiteType?: PrerequisiteType;
  required?: boolean;
}

// For completed prerequisites tracking
export interface CompletedPrerequisite extends Omit<Prerequisite, 'required'> {
  completedAt: Date;
}
