/**
 * Course, Material, and related API types aligned with backend API
 */

import { BaseEntity } from '@/shared/types/systemInterface';
import { User } from '@/shared/types/authInterface';
import { Material } from '@/shared/types/materialInterface';
import type { ReadinessSignal } from '@/shared/types/mastery.types';

export interface Course extends BaseEntity {
  name: string;
  title?: string;
  recommendationReason?: string;
  description?: string;
  code?: string;
  categoryId: string;
  category?: Category;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  status: 'draft' | 'published' | 'archived' | 'under_review';
  price: number;
  estimatedHours?: number;
  tags?: string[];
  // Optional fields for display
  instructor?: User | { id: string; name: string; email?: string };
  enrollmentCount?: number;
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
  year?: number;
  semester?: number;
  lastAccessed?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  isEnrolled?: boolean;
  progress?: number;
  progressPercentage?: number;
  unitId?: string;
  nextTopicId?: string;
  modules?: CourseModule[];
  units?: CourseUnit[];
  prerequisites?: Course[];
  prerequisiteCourseIds?: string[];
  createdBy?: string | {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string;
  };
  updatedBy?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'active' | 'completed' | 'paused' | 'dropped';
  enrolledAt: string;
  completedAt?: string;
  totalUnits?: number;
  completedUnits?: number;
  progressPercentage: number;
  lastAccessed?: string;
}

export interface PrerequisiteCourse {
  id: string;
  title: string;
  code: string;
  isCompleted?: boolean;
}

export interface Prerequisites {
  courseIds: string[];
  skills: string[];
  description: string;
  prerequisiteCourses: PrerequisiteCourse[];
}

export interface Topic {
  id: string;
  unitId?: string;
  courseId?: string;
  title: string;
  name?: string;
  description?: string;
  order?: number;
  orderIndex?: number;
  estimatedMinutes?: number;
  isMandatory?: boolean;
  masteryUnlocked?: boolean;
  status?: 'active' | 'inactive';
  isCompleted?: boolean;
  materials?: Material[];
  quizzes?: any[];
}

export interface CourseUnit extends BaseEntity {
  id: string;
  courseId?: string;
  title: string;
  name?: string;
  description?: string;
  order?: number;
  orderIndex?: number;
  estimatedMinutes?: number;
  duration?: number;
  isCompleted?: boolean;
  content?: string;
  type?: 'lesson' | 'quiz' | 'assignment' | 'project';
  materials?: Material[];
  topics?: Topic[];
  learningObjectives?: string[];
  status?: 'active' | 'inactive';
  estimatedHours?: number;
}

export interface CourseModule extends BaseEntity {
  title: string;
  description: string;
  order: number;
  duration: number;
  isCompleted?: boolean;
  lessons: Lesson[];
}

export interface Lesson extends Omit<BaseEntity, 'id'> {
  id: number | string;
  description: string;
  order: number;
  title: string;
  resources?: Resource[];
  type: 'video' | 'interactive' | 'text' | 'quiz' | 'assignment';
  duration: string;
  content: { video?: string; transcript?: string; interactive?: boolean; text?: string };
  isCompleted?: boolean;
  masteryUnlocked?: boolean;
  failedAttempts?: number;
  readinessSignal?: ReadinessSignal;
}

 export interface CourseContentProps {
  currentLesson: Lesson | undefined;
  lessonKey: string;
  offlineMode: boolean;
  bookmarks: Set<string>;
  progress: Record<string, boolean>;
  toggleBookmark: (lessonKey: string) => void;
  toggleLessonComplete: (lessonKey: string) => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  onOpenMasteryQuiz: () => void;
  isFirstLesson: boolean;
  isLastLesson: boolean;
  materials?: Material[];
  openMaterial: (id: string) => void;
  masteryPassingScore?: number;
}

export interface Resource {
  title: string;
  type: string;
  url: string;
  size?: string | number;
  description?: string;
  id: string | number;
  unitId?: string | number;
  topicId?: string | number;
}

// Progress tracking API types (See progressInterface.ts for canonical Progress types)

// Learning Path enums matching Prisma schema
export type LearningPathType = 'STANDARD_STUDY' | 'EXAM_BLUEPRINT' | 'CLINICAL_COMPETENCY';
export type FocusContext = 'THEORY' | 'APPLICATION';

export interface BlueprintMapping {
  id: string;
  learningPathId: string;
  topicId: string;
  weight: number;
  focusContext: FocusContext;
}

export interface BaseLearningPath extends BaseEntity {
  title: string;
  description: string;
  courses: Course[];
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites?: string[];
  progress?: number;
  pathType?: LearningPathType;
  blueprintMappings?: BlueprintMapping[];
}


// Analytics API types (See analyticsInterface.ts for canonical Analytics types)

/* Material is imported from materialInterface.ts to avoid duplicate/ conflicting definitions */

export interface Module {
  id: string;
  title: string;
  description: string;
  duration: number;
  order: number;
  isCompleted?: boolean;
  lessons: Lesson[];
}

export interface FtsSearchResult {
  id: string;
  title: string;
  description?: string;
}

export interface FtsSearchResponse {
  results: Array<Partial<FtsSearchResult>>;
  total: number;
}

// Using shared helper getInstructorDisplayName from '@/lib/utils/utils'

/**
 * Course Statistics Interface
 * Represents aggregate statistics ABOUT user's course enrollment (platform-wide)
 * Changed from CourseStats to CourseStatistics for consistency with backend
 *
 * This is NOT individual course progress - see CourseProgress interface for that.
 * This represents USER-LEVEL statistics derived from all course progress.
 */
export interface CourseStatistics {
  totalEnrolled: number; // Total courses user is enrolled in
  completed: number; // Total courses user completed
  inProgress: number; // Total courses currently in progress
  avgScore: number; // Average score across all courses
  hoursSpent: number; // Total hours spent across all courses
  streak: number; // Current learning streak
}

export interface CourseFilter {
  searchTerm: string;
  difficulty: string;
  category: string;
  status: 'all' | 'enrolled' | 'completed' | 'recommended';
}

export interface CourseData {
  id: string;
  title: string;
  description: string;
  units?: CourseUnit[];
  chapters?: Array<{
    id: string;
    title: string;
    duration: string;
    lessons: Array<{
      id: string;
      title: string;
      type: 'text' | 'video' | 'interactive';
      duration: string;
      content: { text: string };
      isCompleted?: boolean;
      masteryUnlocked?: boolean;
      nextTopicUnlocked?: boolean;
      failedAttempts?: number;
    }>;
  }>;
  resources?: Material[];
  materials?: Material[];
  discussions?: Array<Record<string, unknown>>;
}
export interface Note {
  id: string;
  text: string;
  timestamp: string;
}

export interface CourseProgressState {
  progress: Record<string, boolean>;
  bookmarks: string[]; // persist-friendly
  notes: Record<string, Note[]>;
  markLessonComplete: (lessonKey: string) => void;
  toggleLessonComplete: (lessonKey: string) => void;
  toggleBookmark: (lessonKey: string) => void;
  saveNote: (lessonKey: string, noteText: string) => void;
}

export interface EducationalCourseLayoutProps {
  courseId?: string;
}


export interface Chapter {
  id: string | number;
  title: string;
  duration: string;
  isCompleted?: boolean;
  progressPercentage?: number;
  lessons: {
    id: string | number;
    title: string;
    duration: string;
    isCompleted?: boolean;
    masteryUnlocked?: boolean;
    nextTopicUnlocked?: boolean;
    failedAttempts?: number;
    readinessSignal?: ReadinessSignal;
  }[];
}



export interface CourseSidebarProps {
  chapters: Chapter[];
  resources: Resource[];
  parentUnitId?: string;
  currentChapterIndex: number;
  currentLessonIndex: number;
  navigateTo: (chapterIndex: number, lessonIndex: number) => void;
  progress: Record<string, boolean>;
  toggleCoursePanel: (panel: 'notes' | 'discussion' | 'quiz') => void;
  openMaterial: (id: string) => void;
}