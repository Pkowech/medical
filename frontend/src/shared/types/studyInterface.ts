export interface StudySessionInternal {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  topic: string;
  score?: number;
  notes?: string;
}

/**
 * Backend API response type for study session (aligns with Prisma StudySession)
 * Contains all fields from backend StudySession model
 */
export interface StudySession {
  id: string;
  userId: string;
  topicId?: string;
  materialId?: string;
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601
  duration?: number; // minutes
  focusScore?: number; // 0-100 score tracking user focus
  
  // **Activity tracking**
  activities?: Record<string, unknown>; // JSON array of discrete activities during session
  notes?: string; // User notes from session
  metadata?: Record<string, unknown>; // Additional metadata JSON
  
  // **Session Quality & Outcomes**
  isValid: boolean; // Session quality check - flag if session should be counted
  invalidReason?: string; // Reason if session is marked invalid
  learningGain?: number; // Calculated intensity metric of learning
  quizAttemptIds?: string[]; // Reference to quiz attempts during session
}

/**
 * Backend API response type for course progress
 */
export interface CourseProgressResponse {
  id?: string;
  courseId?: string;
  course?: { title?: string };
  title?: string;
  progressPercentage?: number;
}

/**
 * Backend API response type for unit progress
 */
export interface UnitProgressResponse {
  id?: string;
  unitId?: string;
  unit?: { title?: string; courseId?: string };
  title?: string;
  progressPercentage?: number;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  endDate: Date;
  type?: string;
  location?: string;
  instructor?: string | null;
  completed?: boolean;
  
  // Calendar app features
  allDay?: boolean; // All-day event
  priority?: number; // 1=Normal, 2=Important, 3=Urgent
  status?: string; // pending, in_progress, completed, cancelled
  category?: string; // academic, social, personal, work
  color?: string; // Hex color for custom styling
  
  // Recurring events
  isRecurring?: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    endDate?: Date;
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
  };
  
  // Reminders (array of minutes before event)
  reminders?: number[];
  
  // Attendees
  attendees?: string[];
}

// StudyGroup is consolidated in progressInterface.ts - re-export for backward compatibility
export type { StudyGroup } from './progressInterface';

export interface StudyGroupSummary {
  id: string;
  name: string;
  membersCount: number;
}

/**
 * Group study session (collaborative learning)
 * Note: This is distinct from the backend StudySession which tracks individual study sessions
 */
export interface GroupStudySession {
  id: string;
  groupId: string;
  subject: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

export interface StudySessionDetails extends GroupStudySession {

  notes?: string;
  resources?: string[]; // URLs or resource identifiers
  participants: StudyGroupMember[];
  topicCoverage?: TopicCoverage[];
  outcome?: string; // Summary of what was achieved
}

export interface StudyGroupMember {
  userId: string;
  name: string;
  email?: string;
  role: 'member' | 'admin';
  joinedAt: string; // ISO 8601 format
}

export interface TopicCoverage {
  topicId: string;
  topicName: string;
  covered: boolean;
  notes?: string;
  durationMinutes?: number; // Time spent on this topic
  resourcesUsed?: string[]; // URLs or resource identifiers
  quizScores?: Record<string, number>; // Quiz ID to score mapping
}

/**
 * Summary view of a group study session
 */
export interface GroupStudySessionSummary {
  id: string;
  groupId: string;
  subject: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  participants: StudyGroupMember[];
  topicCoverage?: TopicCoverage[];
  outcome?: string; // Summary of what was achieved
}

/**
 * @deprecated Use GroupStudySessionSummary instead
 */
export type StudySessionSummary = GroupStudySessionSummary;

export interface StudyPattern {
  userId: string;
  averageStudyDurationMinutes: number;
  frequentStudyTimes: string[]; // e.g., ["Evenings", "Weekends"]
  preferredSubjects: string[]; // Subject identifiers
  learningStyles: ('visual' | 'auditory' | 'kinesthetic')[];
  challengeAreas: string[]; // Topics or subjects where the user struggles
  recommendations?: string[]; // General study recommendations
}