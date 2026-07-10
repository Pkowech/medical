-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('admin', 'instructor', 'moderator', 'student');

-- CreateEnum
CREATE TYPE "CourseDifficulty" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published', 'archived', 'under_review');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'dropped', 'suspended');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'active', 'skipped', 'dropped', 'reviewed');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('pdf', 'video', 'slide', 'quiz_guide', 'notes', 'audio', 'interactive', 'flashcard', 'other');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'essay', 'fill_in_blank', 'matching', 'ordering');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('general', 'anatomy', 'basic_life_support', 'biochemistry', 'chemistry', 'clinical_pharmacy', 'physiology', 'pathology', 'pharmacology', 'pharmaceutics', 'pharmaceutical_chemistry', 'pharmacognosy', 'surgery', 'internal_medicine', 'pediatrics', 'obstetrics', 'psychiatry', 'radiology', 'laboratory', 'emergency_medicine', 'public_health');

-- CreateEnum
CREATE TYPE "CaseComplexity" AS ENUM ('basic', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "CaseSpecialty" AS ENUM ('general', 'cardiology', 'neurology', 'oncology', 'pediatrics', 'surgery', 'emergency', 'psychiatry', 'dermatology', 'orthopedics', 'gynecology', 'urology');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('draft', 'published', 'archived', 'under_review');

-- CreateEnum
CREATE TYPE "CaseAttemptStatus" AS ENUM ('in_progress', 'completed');

-- CreateEnum
CREATE TYPE "StudyGroupType" AS ENUM ('general', 'course_specific', 'exam_prep', 'research', 'clinical_cases');

-- CreateEnum
CREATE TYPE "StudyGroupPrivacy" AS ENUM ('public', 'private', 'invite_only');

-- CreateEnum
CREATE TYPE "StudyGroupStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('admin', 'moderator', 'member');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'inactive', 'banned');

-- CreateEnum
CREATE TYPE "DiscussionType" AS ENUM ('general', 'question', 'announcement', 'study_session', 'poll');

-- CreateEnum
CREATE TYPE "DiscussionStatus" AS ENUM ('active', 'closed', 'pinned');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'file', 'link', 'poll');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "DigestStatus" AS ENUM ('pending', 'sent', 'read', 'failed');

-- CreateEnum
CREATE TYPE "CPDActivityType" AS ENUM ('course_completion', 'quiz_completion', 'reading', 'webinar', 'conference', 'workshop', 'clinical_case', 'research', 'other');

-- CreateEnum
CREATE TYPE "LearningPathType" AS ENUM ('STANDARD_STUDY', 'EXAM_BLUEPRINT', 'CLINICAL_COMPETENCY');

-- CreateEnum
CREATE TYPE "FocusContext" AS ENUM ('THEORY', 'APPLICATION');

-- CreateEnum
CREATE TYPE "GuidanceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PrerequisiteType" AS ENUM ('required', 'optional', 'recommended');

-- CreateEnum
CREATE TYPE "TimeRange" AS ENUM ('day', 'week', 'month', 'quarter', 'year', 'custom');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('USMLE_STEP_1', 'USMLE_STEP_2', 'NCLEX_RN', 'MCAT', 'OTHER');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('full_time', 'part_time', 'self_paced');

-- CreateEnum
CREATE TYPE "AnalyticsMetricType" AS ENUM ('studyTime', 'completionRate', 'engagementScore', 'performanceScore', 'consistencyScore', 'dailyActiveUsers', 'weeklyActiveUsers', 'monthlyActiveUsers', 'sessionDuration', 'pagesPerSession', 'progressRate', 'totalStudyTime', 'averageScore', 'averageProgress');

-- CreateEnum
CREATE TYPE "StudyPattern" AS ENUM ('morningPerson', 'nightOwl', 'consistentDaily', 'weekendWarrior', 'burstLearner', 'steadyPaced', 'spacedRepetition', 'interleaved', 'blocked', 'varied');

-- CreateEnum
CREATE TYPE "PredictionType" AS ENUM ('completionLikelihood', 'dropoutRisk', 'successProbability', 'timeToComplete', 'performanceTrend', 'retention');

-- CreateEnum
CREATE TYPE "PredictionModelType" AS ENUM ('userEngagement', 'contentRecommendation', 'learningPathOptimization', 'performancePrediction', 'dropoutPrevention');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('shortTerm', 'longTerm', 'recurring', 'custom');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('study_time', 'course_completion', 'assessment_score', 'skill_mastery', 'streak_maintenance', 'learning_path', 'clinical_cases', 'personal', 'academic', 'professional', 'custom');

-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('email', 'sms', 'push');

-- CreateEnum
CREATE TYPE "GoalRecommendationSource" AS ENUM ('ai_tutor', 'peer_trends', 'performance_analytics', 'course_content');

-- CreateEnum
CREATE TYPE "LearningPathCategory" AS ENUM ('medicine', 'surgery', 'nursing', 'pharmacy', 'dentistry', 'alliedHealth');

-- CreateEnum
CREATE TYPE "LearningPathStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LearningPathAccess" AS ENUM ('public', 'private', 'invite_only', 'restricted');

-- CreateEnum
CREATE TYPE "LearningPathEntryType" AS ENUM ('module', 'assessment', 'clinicalCase');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('quiz', 'exam', 'practice', 'flashcard');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('notStarted', 'inProgress', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "LearningResourceType" AS ENUM ('article', 'video', 'book', 'website', 'other', 'material');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ProgressEntryType" AS ENUM ('automatic', 'manual', 'milestone');

-- CreateEnum
CREATE TYPE "ProgressUpdateSource" AS ENUM ('user', 'system');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'paused', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('LEARNING', 'login', 'logout', 'course_enrollment', 'course_completion', 'quiz_completion', 'quiz_attempt', 'study_session', 'achievement_earned', 'profile_update', 'goal_created', 'goal_completed', 'flashcard_session', 'flashcard_review');

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'multiple_choice',
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'medium',
    "category" "QuestionCategory" NOT NULL DEFAULT 'general',
    "explanation" TEXT,
    "concepts_covered" TEXT[],
    "tags" TEXT[],
    "points" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "is_multiple_choice" BOOLEAN NOT NULL DEFAULT true,
    "choices" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average_time" INTEGER NOT NULL DEFAULT 0,
    "discrimination_index" DOUBLE PRECISION,
    "difficulty_index" DOUBLE PRECISION,
    "guessing_parameter" DOUBLE PRECISION,
    "discrimination" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "guessing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average_score" DOUBLE PRECISION DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "course_id" TEXT,
    "unit_id" TEXT,
    "topic_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "UserActivityType" NOT NULL,
    "description" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_accesses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_spent" INTEGER DEFAULT 0,

    CONSTRAINT "unit_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "time_limit" INTEGER,
    "max_attempts" INTEGER DEFAULT 3,
    "passing_score" DOUBLE PRECISION DEFAULT 70.0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "show_results" BOOLEAN NOT NULL DEFAULT true,
    "is_adaptive" BOOLEAN NOT NULL DEFAULT false,
    "adaptive_config" JSONB,
    "category_id" TEXT,
    "unit_id" TEXT,
    "topic_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "time_taken" INTEGER,
    "is_passed" BOOLEAN NOT NULL DEFAULT false,
    "correct_answers" INTEGER NOT NULL DEFAULT 0,
    "total_questions" INTEGER NOT NULL DEFAULT 0,
    "answers" JSONB,
    "feedback" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_responses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION DEFAULT 0,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "response_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "question_id" TEXT,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "hints" TEXT[],
    "tags" TEXT[],
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_flashcard_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "flashcard_id" TEXT NOT NULL,
    "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "correct_streak" INTEGER NOT NULL DEFAULT 0,
    "last_review" TIMESTAMP(3),
    "next_review" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_flashcard_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "username" VARCHAR(100),
    "password" VARCHAR(255),
    "phone_number" VARCHAR(50),
    "profile_image" VARCHAR(2048),
    "bio" TEXT,
    "location" VARCHAR(255),
    "year_of_experience" INTEGER,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB,
    "guidance_level" "GuidanceLevel",
    "guidance_level_override" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_until" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rewards" JSONB NOT NULL DEFAULT '[]',
    "specialization" TEXT,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "enrollment_type" "EnrollmentType" NOT NULL DEFAULT 'self_paced',
    "fts" tsvector,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skill_states" (
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "p_known" DOUBLE PRECISION NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_skill_states_pkey" PRIMARY KEY ("user_id","skill_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "color" VARCHAR(50),
    "hierarchy_level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "key" TEXT,
    "hash" TEXT,
    "uploaded_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_security_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "login_notifications" BOOLEAN NOT NULL DEFAULT true,
    "session_timeout" INTEGER NOT NULL DEFAULT 3600,
    "password_last_changed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accept_terms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_accessed" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "eventData" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "severity" VARCHAR(50),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "details" JSONB,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255),
    "code" VARCHAR(50),
    "description" TEXT,
    "difficulty" "CourseDifficulty" NOT NULL DEFAULT 'beginner',
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "category_id" TEXT,
    "created_by_id" TEXT,
    "estimated_hours" INTEGER DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION DEFAULT 0,
    "price" DOUBLE PRECISION DEFAULT 0,
    "enrollment_count" INTEGER DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "course_id" TEXT NOT NULL,
    "prerequisite_id" TEXT NOT NULL,
    "type" "PrerequisiteType" NOT NULL DEFAULT 'required',

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("course_id","prerequisite_id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "content" TEXT,
    "estimated_duration" INTEGER,
    "learning_objectives" JSONB,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "course_id" TEXT NOT NULL,
    "estimated_minutes" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,
    "slug" VARCHAR(255),

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "unit_id" TEXT NOT NULL,
    "category_id" TEXT,
    "estimated_minutes" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,
    "slug" VARCHAR(255),
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "type" "MaterialType" NOT NULL,
    "file_id" TEXT,
    "content" TEXT,
    "description" TEXT,
    "category" TEXT,
    "difficulty" DOUBLE PRECISION DEFAULT 0.5,
    "duration" INTEGER DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "course_id" TEXT,
    "unit_id" TEXT,
    "topic_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_shares" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_page" INTEGER,
    "last_occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,

    CONSTRAINT "material_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xapi_statements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "material_id" TEXT,
    "verb" TEXT NOT NULL,
    "actor" JSONB,
    "object" JSONB,
    "result" JSONB,
    "context" JSONB,
    "raw" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "stored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "statement_id" TEXT,

    CONSTRAINT "xapi_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_engagements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "engagement_score" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT,
    "material_id" TEXT,
    "unit_id" TEXT,
    "course_id" TEXT,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "completion_percentage" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "quiz_scores" JSONB,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "material_version" INTEGER,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "last_studied_at" TIMESTAMP(3),
    "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "next_review_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_updated" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "total_units" INTEGER,
    "completed_units" INTEGER,
    "progress_percentage" DOUBLE PRECISION,
    "last_accessed" TIMESTAMP(3),

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_instructors" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "completion_percentage" INTEGER NOT NULL DEFAULT 0,
    "last_attempted_at" TIMESTAMP(3),
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "best_score" DOUBLE PRECISION DEFAULT 0,
    "is_passed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_cases" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "complexity" "CaseComplexity" NOT NULL DEFAULT 'basic',
    "specialty" "CaseSpecialty" NOT NULL DEFAULT 'general',
    "status" "CaseStatus" NOT NULL DEFAULT 'draft',
    "course_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fts" tsvector,

    CONSTRAINT "clinical_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB,
    "feedback" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" "CaseAttemptStatus" NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "case_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "difficulty" "CourseDifficulty" NOT NULL DEFAULT 'beginner',
    "estimated_hours" INTEGER,
    "estimated_duration_weeks" INTEGER,
    "estimated_hours_per_week" INTEGER,
    "path_structure" JSONB,
    "analytics" JSONB,
    "milestones_achieved" JSONB,
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "category_id" TEXT,
    "specialization" TEXT,
    "path_type" "LearningPathType" NOT NULL DEFAULT 'STANDARD_STUDY',

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_mappings" (
    "id" TEXT NOT NULL,
    "learning_path_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "focusContext" "FocusContext" NOT NULL DEFAULT 'THEORY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blueprint_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "learning_path_id" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
    "overall_progress_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_time_spent_minutes" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "module_progress" JSONB,
    "phase_progress" JSONB,
    "milestones_achieved" JSONB,
    "analytics" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "last_activity_date" TIMESTAMP(3),

    CONSTRAINT "learning_path_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_milestones" (
    "id" TEXT NOT NULL,
    "learning_path_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "criteria" JSONB,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',

    CONSTRAINT "learning_path_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "courseId" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "target_date" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT,
    "completed_at" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "category" TEXT,
    "metadata" JSONB,
    "priority" INTEGER DEFAULT 0,
    "streak_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
    "estimated_remaining_hours" DOUBLE PRECISION,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "last_escalated_at" TIMESTAMP(3),
    "depends_on_goal_id" TEXT,
    "blocked_reason" TEXT,
    "material_id" TEXT,
    "topic_id" TEXT,
    "learning_path_id" TEXT,

    CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_goal_progress" (
    "id" TEXT NOT NULL,
    "learning_goal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "streak_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_goal_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT,
    "details" TEXT,
    "score" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION DEFAULT 0.5,
    "engagement" DOUBLE PRECISION DEFAULT 0,
    "interaction_score" DOUBLE PRECISION DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_suggestions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "algorithm" TEXT DEFAULT 'collaborative_filtering',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "duration" INTEGER,
    "resource_id" TEXT,
    "resource_type" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "type" TEXT,
    "location" TEXT,
    "instructor" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "category" TEXT NOT NULL DEFAULT 'academic',
    "color" TEXT DEFAULT '#6366F1',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrencePattern" JSONB,
    "reminders" INTEGER[] DEFAULT ARRAY[15, 1440]::INTEGER[],
    "attendees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "topic_id" TEXT,
    "course_id" TEXT,
    "learning_path_id" TEXT,

    CONSTRAINT "schedule_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "StudyGroupType" NOT NULL,
    "privacy" "StudyGroupPrivacy" NOT NULL,
    "max_members" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "StudyGroupStatus" NOT NULL,
    "metadata" JSONB,
    "invite_code" TEXT NOT NULL,

    CONSTRAINT "study_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_group_members" (
    "id" TEXT NOT NULL,
    "study_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "status" "MemberStatus" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "study_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_discussions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DiscussionType" NOT NULL,
    "study_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "DiscussionStatus" NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "group_discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "discussion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reply_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "discussion_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT,
    "material_id" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(3),
    "duration" INTEGER,
    "focus_score" INTEGER NOT NULL DEFAULT 0,
    "activities" JSONB,
    "notes" TEXT,
    "metadata" JSONB,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "invalid_reason" TEXT,
    "learning_gain" DOUBLE PRECISION,
    "quiz_attempt_ids" TEXT[],

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "topic" VARCHAR(100),
    "context" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'low',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" VARCHAR(20),
    "throttled" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_push" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_digests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start_date" TIMESTAMP(3) NOT NULL,
    "week_end_date" TIMESTAMP(3) NOT NULL,
    "status" "DigestStatus" NOT NULL DEFAULT 'pending',
    "content" JSONB NOT NULL,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_cycles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "required_points" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpd_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_date" TIMESTAMP(3) NOT NULL,
    "activity_type" "CPDActivityType" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "material_id" TEXT,
    "cycle_id" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpd_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_relations" (
    "id" TEXT NOT NULL,
    "source_unit_id" TEXT NOT NULL,
    "target_unit_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "algorithm" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_interactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "quiz_id" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "flashcard_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recommended_unit_id" TEXT NOT NULL,
    "source_unit_id" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "is_engaged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "training_data_path" TEXT,
    "metrics" JSONB,
    "trained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_evaluated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "priority" VARCHAR(50),
    "course_id" TEXT,
    "unit_id" TEXT,
    "user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_learning_analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
    "averageSessionLength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "strongestSubjects" TEXT[],
    "weakestSubjects" TEXT[],
    "predictedSuccessRate" DOUBLE PRECISION,
    "recommendedStudyTime" DOUBLE PRECISION,
    "personalizedTips" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_learning_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(2048),
    "criteria" JSONB,
    "tier" VARCHAR(50),
    "points" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_analytics" (
    "id" TEXT NOT NULL,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "total_courses" INTEGER NOT NULL DEFAULT 0,
    "total_enrollments" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "completed_units" INTEGER NOT NULL DEFAULT 0,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_updated" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_stats" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "correct_attempts" INTEGER NOT NULL DEFAULT 0,
    "average_time" INTEGER NOT NULL DEFAULT 0,
    "difficulty_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_calculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapid_review_answers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapid_review_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapid_review_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "topics" TEXT[],
    "score" DOUBLE PRECISION NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "averageTimePerQuestion" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapid_review_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaced_repetition_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "easinessFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaced_repetition_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_completions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,

    CONSTRAINT "unit_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_updated" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "unit_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quiz_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "last_attempted" TIMESTAMP(3),
    "best_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',

    CONSTRAINT "user_quiz_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_mappings" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "exam_type" "ExamType" NOT NULL,
    "correlation" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "exam_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_flags" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issueType" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prediction_type" VARCHAR(100) NOT NULL,
    "prediction" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "explanation" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_validations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT,
    "prediction_date" TIMESTAMP(3) NOT NULL,
    "predicted_score" DOUBLE PRECISION NOT NULL,
    "actual_score" DOUBLE PRECISION,
    "precision" DOUBLE PRECISION,
    "recall" DOUBLE PRECISION,
    "is_calibrated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_experiments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "control_group" VARCHAR(100) NOT NULL DEFAULT 'descriptive',
    "treatment_group" VARCHAR(100) NOT NULL DEFAULT 'prescriptive',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metrics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervention_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group" VARCHAR(50) NOT NULL,
    "outcomes" JSONB,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_trajectories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "p_known" DOUBLE PRECISION NOT NULL,
    "trend" VARCHAR(20) NOT NULL DEFAULT 'stable',
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_trajectories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_overrides" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "conflict_type" VARCHAR(50),
    "resolution" VARCHAR(50),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_course_id_idx" ON "questions"("course_id");

-- CreateIndex
CREATE INDEX "questions_unit_id_idx" ON "questions"("unit_id");

-- CreateIndex
CREATE INDEX "questions_category_idx" ON "questions"("category");

-- CreateIndex
CREATE INDEX "questions_type_idx" ON "questions"("type");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- CreateIndex
CREATE INDEX "question_options_question_id_idx" ON "question_options"("question_id");

-- CreateIndex
CREATE INDEX "user_activities_user_id_idx" ON "user_activities"("user_id");

-- CreateIndex
CREATE INDEX "user_activities_type_idx" ON "user_activities"("type");

-- CreateIndex
CREATE INDEX "user_activities_user_id_created_at_idx" ON "user_activities"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "unit_accesses_user_id_idx" ON "unit_accesses"("user_id");

-- CreateIndex
CREATE INDEX "unit_accesses_unit_id_idx" ON "unit_accesses"("unit_id");

-- CreateIndex
CREATE INDEX "quizzes_unit_id_idx" ON "quizzes"("unit_id");

-- CreateIndex
CREATE INDEX "quizzes_topic_id_idx" ON "quizzes"("topic_id");

-- CreateIndex
CREATE INDEX "quizzes_category_id_idx" ON "quizzes"("category_id");

-- CreateIndex
CREATE INDEX "quizzes_created_by_idx" ON "quizzes"("created_by");

-- CreateIndex
CREATE INDEX "quizzes_fts_idx" ON "quizzes" USING GIN ("fts");

-- CreateIndex
CREATE INDEX "quizzes_title_idx" ON "quizzes"("title");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_questions_question_id_idx" ON "quiz_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quiz_id_question_id_key" ON "quiz_questions"("quiz_id", "question_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts"("user_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_started_at_idx" ON "quiz_attempts"("started_at");

-- CreateIndex
CREATE INDEX "quiz_attempts_completed_at_idx" ON "quiz_attempts"("completed_at");

-- CreateIndex
CREATE INDEX "user_responses_user_id_idx" ON "user_responses"("user_id");

-- CreateIndex
CREATE INDEX "user_responses_question_id_idx" ON "user_responses"("question_id");

-- CreateIndex
CREATE INDEX "user_responses_attempt_id_idx" ON "user_responses"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_responses_user_id_question_id_key" ON "user_responses"("user_id", "question_id");

-- CreateIndex
CREATE INDEX "flashcards_question_id_idx" ON "flashcards"("question_id");

-- CreateIndex
CREATE INDEX "user_flashcard_progress_user_id_idx" ON "user_flashcard_progress"("user_id");

-- CreateIndex
CREATE INDEX "user_flashcard_progress_flashcard_id_idx" ON "user_flashcard_progress"("flashcard_id");

-- CreateIndex
CREATE INDEX "user_flashcard_progress_next_review_idx" ON "user_flashcard_progress"("next_review");

-- CreateIndex
CREATE UNIQUE INDEX "user_flashcard_progress_user_id_flashcard_id_key" ON "user_flashcard_progress"("user_id", "flashcard_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_fts_idx" ON "users" USING GIN ("fts");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_name_idx" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_permission_id_idx" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_role_id_idx" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "files_hash_idx" ON "files"("hash");

-- CreateIndex
CREATE INDEX "files_uploaded_by_id_idx" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_security_settings_user_id_key" ON "user_security_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_user_id_key" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_token_idx" ON "user_sessions"("token");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- CreateIndex
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE INDEX "security_audits_user_id_idx" ON "security_audits"("user_id");

-- CreateIndex
CREATE INDEX "security_audits_action_idx" ON "security_audits"("action");

-- CreateIndex
CREATE INDEX "security_audits_created_at_idx" ON "security_audits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_slug_key" ON "course_categories"("slug");

-- CreateIndex
CREATE INDEX "course_categories_slug_idx" ON "course_categories"("slug");

-- CreateIndex
CREATE INDEX "course_categories_parent_id_idx" ON "course_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_code_idx" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_category_id_idx" ON "courses"("category_id");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE INDEX "courses_fts_idx" ON "courses" USING GIN ("fts");

-- CreateIndex
CREATE INDEX "courses_difficulty_idx" ON "courses"("difficulty");

-- CreateIndex
CREATE INDEX "courses_name_idx" ON "courses"("name");

-- CreateIndex
CREATE INDEX "courses_title_idx" ON "courses"("title");

-- CreateIndex
CREATE INDEX "units_course_id_idx" ON "units"("course_id");

-- CreateIndex
CREATE INDEX "units_fts_idx" ON "units" USING GIN ("fts");

-- CreateIndex
CREATE INDEX "units_title_idx" ON "units"("title");

-- CreateIndex
CREATE INDEX "units_name_idx" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "units_course_id_order_key" ON "units"("course_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "units_course_id_slug_key" ON "units"("course_id", "slug");

-- CreateIndex
CREATE INDEX "topics_unit_id_idx" ON "topics"("unit_id");

-- CreateIndex
CREATE INDEX "topics_category_id_idx" ON "topics"("category_id");

-- CreateIndex
CREATE INDEX "topics_fts_idx" ON "topics" USING GIN ("fts");

-- CreateIndex
CREATE INDEX "topics_name_idx" ON "topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topics_unit_id_order_key" ON "topics"("unit_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "topics_unit_id_slug_key" ON "topics"("unit_id", "slug");

-- CreateIndex
CREATE INDEX "materials_file_id_idx" ON "materials"("file_id");

-- CreateIndex
CREATE INDEX "materials_course_id_idx" ON "materials"("course_id");

-- CreateIndex
CREATE INDEX "materials_unit_id_idx" ON "materials"("unit_id");

-- CreateIndex
CREATE INDEX "materials_topic_id_idx" ON "materials"("topic_id");

-- CreateIndex
CREATE INDEX "materials_type_idx" ON "materials"("type");

-- CreateIndex
CREATE INDEX "materials_user_id_idx" ON "materials"("user_id");

-- CreateIndex
CREATE INDEX "materials_fts_idx" ON "materials" USING GIN ("fts");

-- CreateIndex
CREATE INDEX "materials_title_idx" ON "materials"("title");

-- CreateIndex
CREATE UNIQUE INDEX "material_shares_material_id_user_id_key" ON "material_shares"("material_id", "user_id");

-- CreateIndex
CREATE INDEX "material_events_user_id_idx" ON "material_events"("user_id");

-- CreateIndex
CREATE INDEX "material_events_material_id_idx" ON "material_events"("material_id");

-- CreateIndex
CREATE INDEX "material_events_event_type_idx" ON "material_events"("event_type");

-- CreateIndex
CREATE INDEX "material_events_created_at_idx" ON "material_events"("created_at");

-- CreateIndex
CREATE INDEX "material_events_is_override_idx" ON "material_events"("is_override");

-- CreateIndex
CREATE UNIQUE INDEX "material_events_user_id_material_id_event_type_key" ON "material_events"("user_id", "material_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "xapi_statements_statement_id_key" ON "xapi_statements"("statement_id");

-- CreateIndex
CREATE INDEX "xapi_statements_user_id_idx" ON "xapi_statements"("user_id");

-- CreateIndex
CREATE INDEX "xapi_statements_material_id_idx" ON "xapi_statements"("material_id");

-- CreateIndex
CREATE INDEX "xapi_statements_verb_idx" ON "xapi_statements"("verb");

-- CreateIndex
CREATE INDEX "xapi_statements_occurred_at_idx" ON "xapi_statements"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_engagements_user_id_material_id_key" ON "material_engagements"("user_id", "material_id");

-- CreateIndex
CREATE INDEX "topic_progress_user_id_idx" ON "topic_progress"("user_id");

-- CreateIndex
CREATE INDEX "topic_progress_topic_id_idx" ON "topic_progress"("topic_id");

-- CreateIndex
CREATE INDEX "topic_progress_material_id_idx" ON "topic_progress"("material_id");

-- CreateIndex
CREATE INDEX "topic_progress_course_id_idx" ON "topic_progress"("course_id");

-- CreateIndex
CREATE INDEX "topic_progress_unit_id_idx" ON "topic_progress"("unit_id");

-- CreateIndex
CREATE INDEX "topic_progress_status_idx" ON "topic_progress"("status");

-- CreateIndex
CREATE INDEX "topic_progress_last_accessed_at_idx" ON "topic_progress"("last_accessed_at");

-- CreateIndex
CREATE INDEX "topic_progress_user_id_status_idx" ON "topic_progress"("user_id", "status");

-- CreateIndex
CREATE INDEX "topic_progress_user_id_last_updated_idx" ON "topic_progress"("user_id", "last_updated");

-- CreateIndex
CREATE INDEX "topic_progress_next_review_date_idx" ON "topic_progress"("next_review_date");

-- CreateIndex
CREATE UNIQUE INDEX "topic_progress_user_id_topic_id_material_id_unit_id_course__key" ON "topic_progress"("user_id", "topic_id", "material_id", "unit_id", "course_id");

-- CreateIndex
CREATE INDEX "course_enrollments_user_id_idx" ON "course_enrollments"("user_id");

-- CreateIndex
CREATE INDEX "course_enrollments_course_id_idx" ON "course_enrollments"("course_id");

-- CreateIndex
CREATE INDEX "course_enrollments_status_idx" ON "course_enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_user_id_course_id_key" ON "course_enrollments"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_instructors_course_id_user_id_key" ON "course_instructors"("course_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_progress_user_id_assessment_id_key" ON "assessment_progress"("user_id", "assessment_id");

-- CreateIndex
CREATE INDEX "clinical_cases_course_id_idx" ON "clinical_cases"("course_id");

-- CreateIndex
CREATE INDEX "clinical_cases_specialty_idx" ON "clinical_cases"("specialty");

-- CreateIndex
CREATE INDEX "clinical_cases_complexity_idx" ON "clinical_cases"("complexity");

-- CreateIndex
CREATE INDEX "clinical_cases_status_idx" ON "clinical_cases"("status");

-- CreateIndex
CREATE INDEX "clinical_cases_fts_idx" ON "clinical_cases" USING GIN ("fts");

-- CreateIndex
CREATE INDEX "clinical_cases_title_idx" ON "clinical_cases"("title");

-- CreateIndex
CREATE INDEX "case_attempts_user_id_idx" ON "case_attempts"("user_id");

-- CreateIndex
CREATE INDEX "case_attempts_case_id_idx" ON "case_attempts"("case_id");

-- CreateIndex
CREATE INDEX "case_attempts_completed_idx" ON "case_attempts"("completed");

-- CreateIndex
CREATE INDEX "case_attempts_status_idx" ON "case_attempts"("status");

-- CreateIndex
CREATE INDEX "learning_paths_difficulty_idx" ON "learning_paths"("difficulty");

-- CreateIndex
CREATE INDEX "learning_paths_is_template_idx" ON "learning_paths"("is_template");

-- CreateIndex
CREATE INDEX "learning_paths_status_idx" ON "learning_paths"("status");

-- CreateIndex
CREATE INDEX "learning_paths_category_id_idx" ON "learning_paths"("category_id");

-- CreateIndex
CREATE INDEX "learning_paths_path_type_idx" ON "learning_paths"("path_type");

-- CreateIndex
CREATE INDEX "blueprint_mappings_learning_path_id_idx" ON "blueprint_mappings"("learning_path_id");

-- CreateIndex
CREATE INDEX "blueprint_mappings_topic_id_idx" ON "blueprint_mappings"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "blueprint_mappings_learning_path_id_topic_id_key" ON "blueprint_mappings"("learning_path_id", "topic_id");

-- CreateIndex
CREATE INDEX "learning_path_progress_user_id_idx" ON "learning_path_progress"("user_id");

-- CreateIndex
CREATE INDEX "learning_path_progress_learning_path_id_idx" ON "learning_path_progress"("learning_path_id");

-- CreateIndex
CREATE INDEX "learning_path_progress_status_idx" ON "learning_path_progress"("status");

-- CreateIndex
CREATE INDEX "learning_path_progress_user_id_last_accessed_at_idx" ON "learning_path_progress"("user_id", "last_accessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_progress_user_id_learning_path_id_key" ON "learning_path_progress"("user_id", "learning_path_id");

-- CreateIndex
CREATE INDEX "learning_path_milestones_learning_path_id_idx" ON "learning_path_milestones"("learning_path_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_milestones_learning_path_id_order_key" ON "learning_path_milestones"("learning_path_id", "order");

-- CreateIndex
CREATE INDEX "learning_goals_user_id_idx" ON "learning_goals"("user_id");

-- CreateIndex
CREATE INDEX "learning_goals_status_idx" ON "learning_goals"("status");

-- CreateIndex
CREATE INDEX "learning_goals_courseId_idx" ON "learning_goals"("courseId");

-- CreateIndex
CREATE INDEX "learning_goals_user_id_target_date_priority_idx" ON "learning_goals"("user_id", "target_date", "priority");

-- CreateIndex
CREATE INDEX "learning_goals_user_id_status_target_date_priority_idx" ON "learning_goals"("user_id", "status", "target_date", "priority");

-- CreateIndex
CREATE INDEX "learning_goals_depends_on_goal_id_idx" ON "learning_goals"("depends_on_goal_id");

-- CreateIndex
CREATE INDEX "learning_goal_progress_learning_goal_id_idx" ON "learning_goal_progress"("learning_goal_id");

-- CreateIndex
CREATE INDEX "learning_goal_progress_user_id_idx" ON "learning_goal_progress"("user_id");

-- CreateIndex
CREATE INDEX "learning_goal_progress_status_idx" ON "learning_goal_progress"("status");

-- CreateIndex
CREATE INDEX "learning_history_user_id_idx" ON "learning_history"("user_id");

-- CreateIndex
CREATE INDEX "learning_history_material_id_idx" ON "learning_history"("material_id");

-- CreateIndex
CREATE INDEX "learning_history_timestamp_idx" ON "learning_history"("timestamp");

-- CreateIndex
CREATE INDEX "learning_history_category_idx" ON "learning_history"("category");

-- CreateIndex
CREATE INDEX "learning_suggestions_user_id_idx" ON "learning_suggestions"("user_id");

-- CreateIndex
CREATE INDEX "learning_suggestions_material_id_idx" ON "learning_suggestions"("material_id");

-- CreateIndex
CREATE INDEX "learning_suggestions_score_idx" ON "learning_suggestions"("score");

-- CreateIndex
CREATE INDEX "study_events_user_id_idx" ON "study_events"("user_id");

-- CreateIndex
CREATE INDEX "study_events_resource_id_idx" ON "study_events"("resource_id");

-- CreateIndex
CREATE INDEX "study_events_event_type_idx" ON "study_events"("event_type");

-- CreateIndex
CREATE INDEX "schedule_events_user_id_idx" ON "schedule_events"("user_id");

-- CreateIndex
CREATE INDEX "schedule_events_start_date_end_date_idx" ON "schedule_events"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "schedule_events_status_idx" ON "schedule_events"("status");

-- CreateIndex
CREATE INDEX "schedule_events_priority_idx" ON "schedule_events"("priority");

-- CreateIndex
CREATE INDEX "schedule_events_topic_id_idx" ON "schedule_events"("topic_id");

-- CreateIndex
CREATE INDEX "schedule_events_course_id_idx" ON "schedule_events"("course_id");

-- CreateIndex
CREATE INDEX "schedule_events_learning_path_id_idx" ON "schedule_events"("learning_path_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_groups_invite_code_key" ON "study_groups"("invite_code");

-- CreateIndex
CREATE INDEX "study_groups_status_idx" ON "study_groups"("status");

-- CreateIndex
CREATE INDEX "study_groups_type_idx" ON "study_groups"("type");

-- CreateIndex
CREATE INDEX "study_group_members_user_id_idx" ON "study_group_members"("user_id");

-- CreateIndex
CREATE INDEX "study_group_members_study_group_id_idx" ON "study_group_members"("study_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_group_members_user_id_study_group_id_key" ON "study_group_members"("user_id", "study_group_id");

-- CreateIndex
CREATE INDEX "group_discussions_study_group_id_idx" ON "group_discussions"("study_group_id");

-- CreateIndex
CREATE INDEX "group_discussions_status_idx" ON "group_discussions"("status");

-- CreateIndex
CREATE INDEX "discussion_messages_discussion_id_idx" ON "discussion_messages"("discussion_id");

-- CreateIndex
CREATE INDEX "discussion_messages_user_id_idx" ON "discussion_messages"("user_id");

-- CreateIndex
CREATE INDEX "discussion_messages_reply_to_id_idx" ON "discussion_messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_idx" ON "study_sessions"("user_id");

-- CreateIndex
CREATE INDEX "study_sessions_topic_id_idx" ON "study_sessions"("topic_id");

-- CreateIndex
CREATE INDEX "study_sessions_material_id_idx" ON "study_sessions"("material_id");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_start_time_idx" ON "study_sessions"("user_id", "start_time");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_is_active_idx" ON "chat_sessions"("is_active");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_severity_idx" ON "notifications"("severity");

-- CreateIndex
CREATE INDEX "weekly_digests_user_id_idx" ON "weekly_digests"("user_id");

-- CreateIndex
CREATE INDEX "weekly_digests_week_start_date_idx" ON "weekly_digests"("week_start_date");

-- CreateIndex
CREATE INDEX "weekly_digests_status_idx" ON "weekly_digests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_digests_user_id_week_start_date_key" ON "weekly_digests"("user_id", "week_start_date");

-- CreateIndex
CREATE INDEX "cpd_cycles_is_active_idx" ON "cpd_cycles"("is_active");

-- CreateIndex
CREATE INDEX "cpd_cycles_start_date_idx" ON "cpd_cycles"("start_date");

-- CreateIndex
CREATE INDEX "cpd_cycles_end_date_idx" ON "cpd_cycles"("end_date");

-- CreateIndex
CREATE INDEX "cpd_activities_user_id_idx" ON "cpd_activities"("user_id");

-- CreateIndex
CREATE INDEX "cpd_activities_activity_date_idx" ON "cpd_activities"("activity_date");

-- CreateIndex
CREATE INDEX "cpd_activities_cycle_id_idx" ON "cpd_activities"("cycle_id");

-- CreateIndex
CREATE INDEX "cpd_activities_activity_type_idx" ON "cpd_activities"("activity_type");

-- CreateIndex
CREATE INDEX "cpd_activities_is_verified_idx" ON "cpd_activities"("is_verified");

-- CreateIndex
CREATE INDEX "unit_relations_source_unit_id_idx" ON "unit_relations"("source_unit_id");

-- CreateIndex
CREATE INDEX "unit_relations_target_unit_id_idx" ON "unit_relations"("target_unit_id");

-- CreateIndex
CREATE INDEX "unit_relations_relation_type_idx" ON "unit_relations"("relation_type");

-- CreateIndex
CREATE UNIQUE INDEX "unit_relations_source_unit_id_target_unit_id_relation_type_key" ON "unit_relations"("source_unit_id", "target_unit_id", "relation_type");

-- CreateIndex
CREATE INDEX "student_interactions_user_id_idx" ON "student_interactions"("user_id");

-- CreateIndex
CREATE INDEX "student_interactions_unit_id_idx" ON "student_interactions"("unit_id");

-- CreateIndex
CREATE INDEX "student_interactions_interaction_type_idx" ON "student_interactions"("interaction_type");

-- CreateIndex
CREATE INDEX "flashcard_results_user_id_idx" ON "flashcard_results"("user_id");

-- CreateIndex
CREATE INDEX "flashcard_results_unit_id_idx" ON "flashcard_results"("unit_id");

-- CreateIndex
CREATE INDEX "flashcard_results_quiz_id_idx" ON "flashcard_results"("quiz_id");

-- CreateIndex
CREATE INDEX "recommendations_user_id_idx" ON "recommendations"("user_id");

-- CreateIndex
CREATE INDEX "recommendations_recommended_unit_id_idx" ON "recommendations"("recommended_unit_id");

-- CreateIndex
CREATE INDEX "recommendations_source_unit_id_idx" ON "recommendations"("source_unit_id");

-- CreateIndex
CREATE INDEX "recommendations_algorithm_idx" ON "recommendations"("algorithm");

-- CreateIndex
CREATE INDEX "ml_models_name_idx" ON "ml_models"("name");

-- CreateIndex
CREATE INDEX "ml_models_type_idx" ON "ml_models"("type");

-- CreateIndex
CREATE INDEX "ml_models_is_active_idx" ON "ml_models"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "rubrics_quiz_id_key" ON "rubrics"("quiz_id");

-- CreateIndex
CREATE INDEX "deadlines_user_id_idx" ON "deadlines"("user_id");

-- CreateIndex
CREATE INDEX "deadlines_course_id_idx" ON "deadlines"("course_id");

-- CreateIndex
CREATE INDEX "deadlines_unit_id_idx" ON "deadlines"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_analytics_userId_key" ON "user_learning_analytics"("userId");

-- CreateIndex
CREATE INDEX "user_learning_analytics_userId_idx" ON "user_learning_analytics"("userId");

-- CreateIndex
CREATE INDEX "badges_name_idx" ON "badges"("name");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE INDEX "user_badges_badge_id_idx" ON "user_badges"("badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "course_progress_course_id_idx" ON "course_progress"("course_id");

-- CreateIndex
CREATE INDEX "course_progress_status_idx" ON "course_progress"("status");

-- CreateIndex
CREATE INDEX "course_progress_user_id_idx" ON "course_progress"("user_id");

-- CreateIndex
CREATE INDEX "course_progress_user_id_last_accessed_at_idx" ON "course_progress"("user_id", "last_accessed_at");

-- CreateIndex
CREATE INDEX "course_progress_user_id_last_updated_idx" ON "course_progress"("user_id", "last_updated");

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_user_id_course_id_key" ON "course_progress"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_stats_question_id_key" ON "question_stats"("question_id");

-- CreateIndex
CREATE INDEX "rapid_review_answers_sessionId_idx" ON "rapid_review_answers"("sessionId");

-- CreateIndex
CREATE INDEX "rapid_review_sessions_userId_idx" ON "rapid_review_sessions"("userId");

-- CreateIndex
CREATE INDEX "spaced_repetition_cards_nextReviewAt_idx" ON "spaced_repetition_cards"("nextReviewAt");

-- CreateIndex
CREATE INDEX "spaced_repetition_cards_userId_idx" ON "spaced_repetition_cards"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "spaced_repetition_cards_userId_questionId_key" ON "spaced_repetition_cards"("userId", "questionId");

-- CreateIndex
CREATE INDEX "unit_completions_unit_id_idx" ON "unit_completions"("unit_id");

-- CreateIndex
CREATE INDEX "unit_completions_user_id_idx" ON "unit_completions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_completions_user_id_unit_id_key" ON "unit_completions"("user_id", "unit_id");

-- CreateIndex
CREATE INDEX "unit_progress_status_idx" ON "unit_progress"("status");

-- CreateIndex
CREATE INDEX "unit_progress_unit_id_idx" ON "unit_progress"("unit_id");

-- CreateIndex
CREATE INDEX "unit_progress_user_id_idx" ON "unit_progress"("user_id");

-- CreateIndex
CREATE INDEX "unit_progress_user_id_last_accessed_at_idx" ON "unit_progress"("user_id", "last_accessed_at");

-- CreateIndex
CREATE INDEX "unit_progress_user_id_last_updated_idx" ON "unit_progress"("user_id", "last_updated");

-- CreateIndex
CREATE UNIQUE INDEX "unit_progress_user_id_unit_id_key" ON "unit_progress"("user_id", "unit_id");

-- CreateIndex
CREATE INDEX "user_quiz_progress_quiz_id_idx" ON "user_quiz_progress"("quiz_id");

-- CreateIndex
CREATE INDEX "user_quiz_progress_user_id_idx" ON "user_quiz_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_quiz_progress_user_id_quiz_id_key" ON "user_quiz_progress"("user_id", "quiz_id");

-- CreateIndex
CREATE INDEX "exam_mappings_topic_id_idx" ON "exam_mappings"("topic_id");

-- CreateIndex
CREATE INDEX "question_flags_question_id_idx" ON "question_flags"("question_id");

-- CreateIndex
CREATE INDEX "question_flags_user_id_idx" ON "question_flags"("user_id");

-- CreateIndex
CREATE INDEX "question_flags_issueType_idx" ON "question_flags"("issueType");

-- CreateIndex
CREATE INDEX "question_flags_question_id_issueType_idx" ON "question_flags"("question_id", "issueType");

-- CreateIndex
CREATE INDEX "prediction_audits_user_id_idx" ON "prediction_audits"("user_id");

-- CreateIndex
CREATE INDEX "prediction_audits_user_id_created_at_idx" ON "prediction_audits"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "prediction_audits_prediction_type_idx" ON "prediction_audits"("prediction_type");

-- CreateIndex
CREATE INDEX "prediction_validations_user_id_idx" ON "prediction_validations"("user_id");

-- CreateIndex
CREATE INDEX "prediction_validations_prediction_date_idx" ON "prediction_validations"("prediction_date");

-- CreateIndex
CREATE INDEX "prediction_validations_is_calibrated_idx" ON "prediction_validations"("is_calibrated");

-- CreateIndex
CREATE INDEX "intervention_experiments_is_active_idx" ON "intervention_experiments"("is_active");

-- CreateIndex
CREATE INDEX "experiment_assignments_user_id_idx" ON "experiment_assignments"("user_id");

-- CreateIndex
CREATE INDEX "experiment_assignments_experiment_id_idx" ON "experiment_assignments"("experiment_id");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_experiment_id_user_id_key" ON "experiment_assignments"("experiment_id", "user_id");

-- CreateIndex
CREATE INDEX "skill_trajectories_user_id_topic_id_idx" ON "skill_trajectories"("user_id", "topic_id");

-- CreateIndex
CREATE INDEX "skill_trajectories_snapshot_at_idx" ON "skill_trajectories"("snapshot_at");

-- CreateIndex
CREATE INDEX "skill_trajectories_user_id_snapshot_at_idx" ON "skill_trajectories"("user_id", "snapshot_at");

-- CreateIndex
CREATE INDEX "instructor_overrides_question_id_idx" ON "instructor_overrides"("question_id");

-- CreateIndex
CREATE INDEX "instructor_overrides_instructor_id_idx" ON "instructor_overrides"("instructor_id");

-- CreateIndex
CREATE INDEX "sync_logs_user_id_idx" ON "sync_logs"("user_id");

-- CreateIndex
CREATE INDEX "sync_logs_resource_type_resource_id_idx" ON "sync_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_accesses" ADD CONSTRAINT "unit_accesses_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_accesses" ADD CONSTRAINT "unit_accesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flashcard_progress" ADD CONSTRAINT "user_flashcard_progress_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flashcard_progress" ADD CONSTRAINT "user_flashcard_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skill_states" ADD CONSTRAINT "user_skill_states_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skill_states" ADD CONSTRAINT "user_skill_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_security_settings" ADD CONSTRAINT "user_security_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audits" ADD CONSTRAINT "security_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_shares" ADD CONSTRAINT "material_shares_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_shares" ADD CONSTRAINT "material_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_events" ADD CONSTRAINT "material_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xapi_statements" ADD CONSTRAINT "xapi_statements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xapi_statements" ADD CONSTRAINT "xapi_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_engagements" ADD CONSTRAINT "material_engagements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_engagements" ADD CONSTRAINT "material_engagements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_progress" ADD CONSTRAINT "assessment_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_cases" ADD CONSTRAINT "clinical_cases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attempts" ADD CONSTRAINT "case_attempts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "clinical_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attempts" ADD CONSTRAINT "case_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_mappings" ADD CONSTRAINT "blueprint_mappings_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_mappings" ADD CONSTRAINT "blueprint_mappings_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_progress" ADD CONSTRAINT "learning_path_progress_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_progress" ADD CONSTRAINT "learning_path_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_milestones" ADD CONSTRAINT "learning_path_milestones_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_depends_on_goal_id_fkey" FOREIGN KEY ("depends_on_goal_id") REFERENCES "learning_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goal_progress" ADD CONSTRAINT "learning_goal_progress_learning_goal_id_fkey" FOREIGN KEY ("learning_goal_id") REFERENCES "learning_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goal_progress" ADD CONSTRAINT "learning_goal_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_history" ADD CONSTRAINT "learning_history_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_history" ADD CONSTRAINT "learning_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_suggestions" ADD CONSTRAINT "learning_suggestions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_suggestions" ADD CONSTRAINT "learning_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_group_members" ADD CONSTRAINT "study_group_members_study_group_id_fkey" FOREIGN KEY ("study_group_id") REFERENCES "study_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_group_members" ADD CONSTRAINT "study_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_discussions" ADD CONSTRAINT "group_discussions_study_group_id_fkey" FOREIGN KEY ("study_group_id") REFERENCES "study_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "group_discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "discussion_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_messages" ADD CONSTRAINT "discussion_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_cycles" ADD CONSTRAINT "cpd_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cpd_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_relations" ADD CONSTRAINT "unit_relations_source_unit_id_fkey" FOREIGN KEY ("source_unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_relations" ADD CONSTRAINT "unit_relations_target_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_interactions" ADD CONSTRAINT "student_interactions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_interactions" ADD CONSTRAINT "student_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_results" ADD CONSTRAINT "flashcard_results_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_results" ADD CONSTRAINT "flashcard_results_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_results" ADD CONSTRAINT "flashcard_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_recommended_unit_id_fkey" FOREIGN KEY ("recommended_unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_source_unit_id_fkey" FOREIGN KEY ("source_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_analytics" ADD CONSTRAINT "user_learning_analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_stats" ADD CONSTRAINT "question_stats_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapid_review_answers" ADD CONSTRAINT "rapid_review_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapid_review_answers" ADD CONSTRAINT "rapid_review_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "rapid_review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapid_review_sessions" ADD CONSTRAINT "rapid_review_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaced_repetition_cards" ADD CONSTRAINT "spaced_repetition_cards_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaced_repetition_cards" ADD CONSTRAINT "spaced_repetition_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_completions" ADD CONSTRAINT "unit_completions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_completions" ADD CONSTRAINT "unit_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quiz_progress" ADD CONSTRAINT "user_quiz_progress_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quiz_progress" ADD CONSTRAINT "user_quiz_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mappings" ADD CONSTRAINT "exam_mappings_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_audits" ADD CONSTRAINT "prediction_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_validations" ADD CONSTRAINT "prediction_validations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "intervention_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_trajectories" ADD CONSTRAINT "skill_trajectories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_trajectories" ADD CONSTRAINT "skill_trajectories_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_overrides" ADD CONSTRAINT "instructor_overrides_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_overrides" ADD CONSTRAINT "instructor_overrides_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
