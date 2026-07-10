//! Learning Analytics Module
//!
//! This module implements the core logic for user learning analytics in Rust.
//! It provides data structures and algorithms for analyzing learning patterns,
//! performance metrics, and generating personalized insights.
//!
//! The module is designed to integrate with web frameworks (Actix-web, Axum)
//! and PostgreSQL databases via ORM clients (sqlx, prisma-client-rust).

use chrono::{Datelike, Local, NaiveDate, NaiveDateTime, TimeZone, Timelike};
use sqlx::{PgPool, Row};
use std::collections::HashMap;

// ============================================================================
// Constants
// ============================================================================

/// Minimum session duration threshold (minutes)
const MIN_SESSION_DURATION_MINUTES: i32 = 20;

/// Threshold for strong subject performance (%)
const STRONG_PERFORMANCE_THRESHOLD: f32 = 80.0;

/// Threshold for weak subject performance (%)
const WEAK_PERFORMANCE_THRESHOLD: f32 = 70.0;

/// Maximum number of subjects to track
const MAX_SUBJECTS_TRACKED: usize = 3;

/// Default session duration estimate (minutes)
const DEFAULT_SESSION_DURATION_MINUTES: i32 = 30;

// Reuse shared data models and errors
use crate::shared::error::{AnalyticsError, Result};

/// Represents a single study session
#[derive(Debug, Clone, PartialEq)]
pub struct StudySession {
    pub user_id: String,
    pub duration: i32,
    pub topic: String,
    pub score: f32,
}

impl StudySession {
    /// Creates a new study session with validation
    ///
    /// # Arguments
    /// * `user_id` - The user identifier
    /// * `duration` - Session duration in minutes
    /// * `topic` - Study topic/subject
    /// * `score` - Performance score (0.0-100.0)
    ///
    /// # Returns
    /// * `Result<Self>` - The session or error
    pub fn new(
        user_id: impl Into<String>,
        duration: i32,
        topic: impl Into<String>,
        score: f32,
    ) -> Result<Self> {
        let user_id_str = user_id.into();

        if user_id_str.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }

        if !(0.0..=100.0).contains(&score) {
            return Err(AnalyticsError::InvalidScore);
        }

        Ok(Self {
            user_id: user_id_str,
            duration: duration.max(0),
            topic: topic.into(),
            score,
        })
    }
}

/// Represents a quiz attempt by a user
#[derive(Debug, Clone, PartialEq)]
pub struct QuizAttempt {
    pub user_id: String,
    pub percentage: f32,
    pub category: String,
}

impl QuizAttempt {
    /// Creates a new quiz attempt with validation
    ///
    /// # Arguments
    /// * `user_id` - The user identifier
    /// * `percentage` - Percentage score (0.0-100.0)
    /// * `category` - Quiz category/subject
    ///
    /// # Returns
    /// * `Result<Self>` - The attempt or error
    pub fn new(
        user_id: impl Into<String>,
        percentage: f32,
        category: impl Into<String>,
    ) -> Result<Self> {
        let user_id_str = user_id.into();

        if user_id_str.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }

        if !(0.0..=100.0).contains(&percentage) {
            return Err(AnalyticsError::InvalidScore);
        }

        Ok(Self {
            user_id: user_id_str,
            percentage,
            category: category.into(),
        })
    }
}

/// Question metadata
#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(dead_code)]
pub struct Question {
    pub category: String,
}

impl Question {
    /// Creates a new question
    pub fn new(category: impl Into<String>) -> Self {
        Self {
            category: category.into(),
        }
    }
}

/// Rapid review answer record
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub struct RapidReviewAnswer {
    pub user_id: String,
    pub is_correct: bool,
    pub question: Question,
    pub time_spent: f32,
}

impl RapidReviewAnswer {
    /// Creates a new rapid review answer with validation
    ///
    /// # Arguments
    /// * `user_id` - The user identifier
    /// * `is_correct` - Whether the answer was correct
    /// * `question` - Question metadata
    /// * `time_spent` - Time spent answering (seconds)
    ///
    /// # Returns
    /// * `Result<Self>` - The answer or error
    pub fn new(
        user_id: impl Into<String>,
        is_correct: bool,
        question: Question,
        time_spent: f32,
    ) -> Result<Self> {
        let user_id_str = user_id.into();

        if user_id_str.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }

        Ok(Self {
            user_id: user_id_str,
            is_correct,
            question,
            time_spent: time_spent.max(0.0),
        })
    }
}

/// Enumeration for progress status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgressStatus {
    NotStarted,
    InProgress,
    Completed,
    Active,
    Skipped,
    Dropped,
    Reviewed,
}

impl ProgressStatus {
    pub fn as_str(&self) -> &str {
        match self {
            ProgressStatus::NotStarted => "notStarted",
            ProgressStatus::InProgress => "inProgress",
            ProgressStatus::Completed => "completed",
            ProgressStatus::Active => "active",
            ProgressStatus::Skipped => "skipped",
            ProgressStatus::Dropped => "dropped",
            ProgressStatus::Reviewed => "reviewed",
        }
    }

    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "notstarted" => Ok(ProgressStatus::NotStarted),
            "inprogress" => Ok(ProgressStatus::InProgress),
            "completed" => Ok(ProgressStatus::Completed),
            "active" => Ok(ProgressStatus::Active),
            "skipped" => Ok(ProgressStatus::Skipped),
            "dropped" => Ok(ProgressStatus::Dropped),
            "reviewed" => Ok(ProgressStatus::Reviewed),
            _ => Err(AnalyticsError::CalculationError(
                "Invalid progress status".to_string(),
            )),
        }
    }
}

// ============================================================================
// Course Progress Types
// ============================================================================

/// Represents a user's progress in a course.
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub struct CourseProgress {
    pub user_id: String,
    pub course_id: String,
    pub status: ProgressStatus,
    pub time_spent: i32,
    pub progress_percentage: f32,
    pub last_accessed_at: NaiveDateTime,
    pub category_id: Option<String>,
}

/// Course statistics result
#[derive(Debug, Clone)]
pub struct CourseStatsResult {
    pub total_courses: usize,
    pub completed_courses: usize,
    pub total_study_time_minutes: i32,
    pub average_course_progress: f32,
}

// ============================================================================
// Learning Path Progress Types
// ============================================================================

/// Represents a user's progress in a learning path.
#[derive(Debug, Clone, PartialEq)]
pub struct LearningPathProgress {
    pub user_id: String,
    pub path_id: String,
    pub status: ProgressStatus,
    pub total_time_spent_minutes: i32,
    pub overall_progress_percentage: f32,
    pub last_activity_date: NaiveDateTime,
    pub category_id: Option<String>,
    pub phase_progress: Option<PhaseProgress>,
}

/// Learning path statistics result
#[derive(Debug, Clone)]
pub struct LearningPathStatsResult {
    pub total_learning_paths: usize,
    pub completed_learning_paths: usize,
    pub total_study_time_minutes: i32,
    pub average_path_progress: f32,
}

/// Represents a phase's progress within a learning path
#[derive(Debug, Clone, PartialEq)]
pub struct PhaseProgress {
    pub phase_id: String,
    pub title: String,
}

// ============================================================================
// Goal Progress Types
// ============================================================================

/// Represents a user's progress for a specific learning goal.
#[derive(Debug, Clone, PartialEq)]
pub struct LearningGoalProgress {
    pub user_id: String,
    pub goal_id: String,
    pub progress_percentage: f32,
    pub recorded_at: NaiveDateTime,
    pub metadata: HashMap<String, String>,
}

// ============================================================================
// Advanced Analytics Data Structures
// ============================================================================

/// Learning analytics for a user or cohort
#[derive(Debug, Clone)]
pub struct LearningAnalytics {
    pub total_courses: usize,
    pub completed_courses: usize,
    pub total_learning_paths: usize,
    pub completed_learning_paths: usize,
    pub total_study_time_minutes: i32,
    pub average_course_progress: f32,
    pub average_path_progress: f32,
    pub engagement_metrics: EngagementMetricsResult,
    pub performance_metrics: PerformanceMetricsResult,
}

/// Comparison of user stats against cohort
#[derive(Debug, Clone)]
pub struct UserStatsComparison {
    pub user_id: String,
    pub percentile_rank: f32,
    pub improvement_areas: Vec<String>,
    pub achievements: Vec<String>,
}

/// Summary of user's learning activities
#[derive(Debug, Clone, PartialEq)]
pub struct UserLearningSummary {
    pub total_study_time: i32,
    pub average_session_length: f32,
    pub average_score: f32,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub strongest_subjects: Vec<String>,
    pub weakest_subjects: Vec<String>,
}

impl UserLearningSummary {
    pub fn new(
        total_study_time: i32,
        average_session_length: f32,
        average_score: f32,
        current_streak: i32,
        longest_streak: i32,
        strongest_subjects: Vec<String>,
        weakest_subjects: Vec<String>,
    ) -> Result<Self> {
        Ok(Self {
            total_study_time,
            average_session_length,
            average_score,
            current_streak,
            longest_streak,
            strongest_subjects,
            weakest_subjects,
        })
    }
}

impl CourseProgress {
    pub fn new(
        user_id: impl Into<String>,
        course_id: impl Into<String>,
        status: ProgressStatus,
        time_spent: i32,
        progress_percentage: f32,
        last_accessed_at: NaiveDateTime,
        category_id: Option<String>,
    ) -> Result<Self> {
        let user_id_str = user_id.into();
        let course_id_str = course_id.into();

        if user_id_str.is_empty() || course_id_str.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }
        if progress_percentage < 0.0 || progress_percentage > 100.0 {
            return Err(AnalyticsError::InvalidScore);
        }

        Ok(Self {
            user_id: user_id_str,
            course_id: course_id_str,
            status,
            time_spent: time_spent.max(0),
            progress_percentage,
            last_accessed_at,
            category_id,
        })
    }
}

impl LearningPathProgress {
    pub fn new(
        user_id: impl Into<String>,
        path_id: impl Into<String>,
        status: ProgressStatus,
        total_time_spent_minutes: i32,
        overall_progress_percentage: f32,
        last_activity_date: NaiveDateTime,
        category_id: Option<String>,
        phase_progress: Option<PhaseProgress>,
    ) -> Result<Self> {
        let user_id_str = user_id.into();
        let path_id_str = path_id.into();

        if user_id_str.is_empty() || path_id_str.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }
        if overall_progress_percentage < 0.0 || overall_progress_percentage > 100.0 {
            return Err(AnalyticsError::InvalidScore);
        }

        Ok(Self {
            user_id: user_id_str,
            path_id: path_id_str,
            status,
            total_time_spent_minutes: total_time_spent_minutes.max(0),
            overall_progress_percentage,
            last_activity_date,
            category_id,
            phase_progress,
        })
    }
}

impl LearningGoalProgress {
    pub fn new(
        user_id: impl Into<String>,
        goal_id: impl Into<String>,
        progress_percentage: f32,
        recorded_at: NaiveDateTime,
        metadata: HashMap<String, String>,
    ) -> Result<Self> {
        let user_id_str = user_id.into();
        let goal_id_str = goal_id.into();

        if user_id_str.is_empty() || goal_id_str.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }
        if progress_percentage < 0.0 || progress_percentage > 100.0 {
            return Err(AnalyticsError::InvalidScore);
        }

        Ok(Self {
            user_id: user_id_str,
            goal_id: goal_id_str,
            progress_percentage,
            recorded_at,
            metadata,
        })
    }
}

impl PhaseProgress {
    pub fn new(phase_id: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            phase_id: phase_id.into(),
            title: title.into(),
        }
    }
}

// ============================================================================
// Public Functions
// ============================================================================

/// Aggregates data to create a summary of a user's learning activities.
///
/// This function processes study sessions and quiz attempts to generate
/// comprehensive learning analytics.
///
/// # Arguments
/// * `user_id` - The user identifier
/// * `sessions` - Vector of study sessions
/// * `attempts` - Vector of quiz attempts
///
/// # Returns
/// * `Result<UserLearningSummary>` - The computed summary or error
///
/// # Example
/// ```no_run
/// use rust_analytics::modules::analytics::learning::learning_analytics::{
///     StudySession, QuizAttempt, calculate_user_learning_summary,
/// };
///
/// let sessions = vec![StudySession::new("user1", 30, "Anatomy", 85.0).unwrap()];
/// let attempts = vec![QuizAttempt::new("user1", 88.0, "Anatomy").unwrap()];
/// let summary = calculate_user_learning_summary("user1", sessions, attempts).unwrap();
/// assert_eq!(summary.total_study_time, 30);
/// assert!(summary.average_score > 0.0);
/// ```
pub fn calculate_user_learning_summary(
    user_id: &str,
    sessions: Vec<StudySession>,
    attempts: Vec<QuizAttempt>,
) -> Result<UserLearningSummary> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    // Filter sessions for the specific user
    let user_sessions: Vec<&StudySession> =
        sessions.iter().filter(|s| s.user_id == user_id).collect();

    if user_sessions.is_empty() && attempts.is_empty() {
        return Err(AnalyticsError::EmptyDataset);
    }

    // Calculate total and average study time
    let total_study_time: i32 = user_sessions.iter().map(|s| s.duration).sum();
    let average_session_length = compute_average_session_length(&user_sessions);

    // Calculate average score from sessions and quiz attempts
    let average_score = compute_average_score(&user_sessions, &attempts, user_id);

    // Identify strengths and weaknesses
    let (strongest_subjects, weakest_subjects) =
        identify_subject_strengths_weaknesses(&user_sessions);

    UserLearningSummary::new(
        total_study_time,
        average_session_length,
        average_score,
        3, // Placeholder: fetch from database in production
        5, // Placeholder: fetch from database in production
        strongest_subjects,
        weakest_subjects,
    )
}

/// Analyzes performance across different subjects to find strengths and weaknesses.
///
/// # Arguments
/// * `sessions` - Vector of study sessions
///
/// # Returns
/// * A tuple of (strongest_subjects, weakest_subjects)
fn identify_subject_strengths_weaknesses(sessions: &[&StudySession]) -> (Vec<String>, Vec<String>) {
    let mut subject_performance: HashMap<&str, (i32, i32)> = HashMap::new();

    for session in sessions {
        let entry = subject_performance
            .entry(session.topic.as_str())
            .or_insert((0, 0));
        entry.1 += 1; // Increment total

        // Count as correct if score >= 70%
        if session.score >= 70.0 {
            entry.0 += 1;
        }
    }

    let mut subject_scores: Vec<(&str, f32)> = subject_performance
        .into_iter()
        .filter(|(_, (_, total))| *total > 0)
        .map(|(subject, (correct, total))| (subject, (correct as f32 / total as f32) * 100.0))
        .collect();

    // Sort by score descending
    subject_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let strongest = subject_scores
        .iter()
        .filter(|(_, score)| *score >= STRONG_PERFORMANCE_THRESHOLD)
        .map(|(subject, _)| subject.to_string())
        .take(MAX_SUBJECTS_TRACKED)
        .collect();

    let weakest = subject_scores
        .iter()
        .rev()
        .filter(|(_, score)| *score < WEAK_PERFORMANCE_THRESHOLD)
        .map(|(subject, _)| subject.to_string())
        .take(MAX_SUBJECTS_TRACKED)
        .collect();

    (strongest, weakest)
}

/// Generates actionable tips based on a user's analytics summary.
///
/// # Arguments
/// * `summary` - User learning summary
///
/// # Returns
/// * Vector of personalized tip strings
///
/// # Example
/// ```no_run
/// use rust_analytics::modules::analytics::learning::learning_analytics::{
///     UserLearningSummary, generate_personalized_tips,
/// };
///
/// let summary = UserLearningSummary::new(
///     600,  // 10 hours total
///     25.0, // 25 min average session
///     85.0, // 85% average score
///     2,    // current streak
///     0,    // best streak
///     vec!["Math".to_string()],
///     vec!["Chemistry".to_string()],
/// ).unwrap();
/// let tips = generate_personalized_tips(&summary);
/// assert!(tips.len() > 0, "Should generate at least one tip");
/// ```
pub fn generate_personalized_tips(summary: &UserLearningSummary) -> Vec<String> {
    let mut tips = Vec::new();

    // Tip: Short study sessions
    if summary.average_session_length > 0.0
        && summary.average_session_length < MIN_SESSION_DURATION_MINUTES as f32
    {
        tips.push(
            "Your study sessions are quite short. Try to find a quiet space for longer, \
             more focused sessions of at least 25 minutes."
                .to_string(),
        );
    }

    // Tip: Weak subjects
    if summary
        .weakest_subjects
        .contains(&"Pharmacology".to_string())
    {
        tips.push(
            "You seem to be finding Pharmacology challenging. Try using the Spaced Repetition \
             flashcards to improve recall speed for key drug names and mechanisms."
                .to_string(),
        );
    }

    // Tip: Streak encouragement
    if summary.current_streak > 2 {
        tips.push(format!(
            "You're on a {}-day streak! Keep up the great work.",
            summary.current_streak
        ));
    } else {
        tips.push(
            "Consistency is key. Try to study a little bit every day to build a strong habit."
                .to_string(),
        );
    }

    // Default tip if no other tips apply
    if tips.is_empty() {
        tips.push(
            "You're doing great! Keep exploring new topics to broaden your knowledge.".to_string(),
        );
    }

    tips
}

/// Calculates course statistics for a user
pub fn calculate_course_statistics(
    user_id: &str,
    course_progress: &[CourseProgress],
) -> Result<CourseStatsResult> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    let user_course_progress: Vec<&CourseProgress> = course_progress
        .iter()
        .filter(|cp| cp.user_id == user_id)
        .collect();

    let total_courses = user_course_progress.len();
    let completed_courses = user_course_progress
        .iter()
        .filter(|cp| cp.status == ProgressStatus::Completed)
        .count();
    let total_study_time_minutes: i32 = user_course_progress.iter().map(|cp| cp.time_spent).sum();
    let average_course_progress = if total_courses > 0 {
        user_course_progress
            .iter()
            .map(|cp| cp.progress_percentage)
            .sum::<f32>()
            / total_courses as f32
    } else {
        0.0
    };

    Ok(CourseStatsResult {
        total_courses,
        completed_courses,
        total_study_time_minutes,
        average_course_progress,
    })
}

/// Calculates learning path statistics for a user
pub fn calculate_learning_path_statistics(
    user_id: &str,
    path_progress: &[LearningPathProgress],
) -> Result<LearningPathStatsResult> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    let user_path_progress: Vec<&LearningPathProgress> = path_progress
        .iter()
        .filter(|lpp| lpp.user_id == user_id)
        .collect();

    let total_learning_paths = user_path_progress.len();
    let completed_learning_paths = user_path_progress
        .iter()
        .filter(|lpp| lpp.status == ProgressStatus::Completed)
        .count();
    let total_study_time_minutes: i32 = user_path_progress
        .iter()
        .map(|lpp| lpp.total_time_spent_minutes)
        .sum();
    let average_path_progress = if total_learning_paths > 0 {
        user_path_progress
            .iter()
            .map(|lpp| lpp.overall_progress_percentage)
            .sum::<f32>()
            / total_learning_paths as f32
    } else {
        0.0
    };

    Ok(LearningPathStatsResult {
        total_learning_paths,
        completed_learning_paths,
        total_study_time_minutes,
        average_path_progress,
    })
}

/// Aggregates user statistics from various sources into a single LearningAnalytics struct.
pub fn aggregate_user_learning_analytics(
    course_stats: CourseStatsResult,
    path_stats: LearningPathStatsResult,
    engagement_metrics: EngagementMetricsResult,
    performance_metrics: PerformanceMetricsResult,
) -> LearningAnalytics {
    LearningAnalytics {
        total_courses: course_stats.total_courses,
        completed_courses: course_stats.completed_courses,
        total_learning_paths: path_stats.total_learning_paths,
        completed_learning_paths: path_stats.completed_learning_paths,
        total_study_time_minutes: course_stats.total_study_time_minutes
            + path_stats.total_study_time_minutes,
        average_course_progress: course_stats.average_course_progress,
        average_path_progress: path_stats.average_path_progress,
        engagement_metrics,
        performance_metrics,
    }
}

/// Calculates performance metrics. (Placeholder for actual implementation)
pub fn calculate_performance_metrics(_user_id: &str) -> PerformanceMetricsResult {
    PerformanceMetricsResult {
        average_assessment_score: 0.0,
        pass_rate: 0.0,
        weakness_areas: vec![],
        strength_areas: vec![],
        improvement_rate: 0.0,
    }
}

/// Identifies strength areas based on progress data.
pub fn identify_strength_areas(
    course_progress: &[CourseProgress],
    path_progress: &[LearningPathProgress],
    goals: &[Goal],
) -> Vec<String> {
    let mut categories = std::collections::HashSet::new();

    course_progress
        .iter()
        .filter(|c| c.status == ProgressStatus::Completed)
        .for_each(|c| {
            if let Some(cat_id) = &c.category_id {
                categories.insert(cat_id.clone());
            }
        });

    path_progress
        .iter()
        .filter(|p| p.status == ProgressStatus::Completed)
        .for_each(|p| {
            if let Some(cat_id) = &p.category_id {
                categories.insert(cat_id.clone());
            }
        });

    goals
        .iter()
        .filter(|g| g.status == ProgressStatus::Completed)
        .for_each(|g| {
            categories.insert(g.category.clone());
        });

    categories.into_iter().collect()
}

/// Identifies improvement areas based on progress data.
pub fn identify_improvement_areas_from_progress(
    course_progress: &[CourseProgress],
    path_progress: &[LearningPathProgress],
    goals: &[Goal],
) -> Vec<String> {
    let mut categories = std::collections::HashSet::new();

    course_progress
        .iter()
        .filter(|c| {
            c.status == ProgressStatus::InProgress
                && c.progress_percentage < WEAK_PERFORMANCE_THRESHOLD
        })
        .for_each(|c| {
            if let Some(cat_id) = &c.category_id {
                categories.insert(cat_id.clone());
            }
        });

    path_progress
        .iter()
        .filter(|p| {
            p.status == ProgressStatus::InProgress
                && p.overall_progress_percentage < WEAK_PERFORMANCE_THRESHOLD
        })
        .for_each(|p| {
            if let Some(cat_id) = &p.category_id {
                categories.insert(cat_id.clone());
            }
        });

    goals
        .iter()
        .filter(|g| g.status == ProgressStatus::Active && g.streak_count < 7) // Assuming progress < 70 similar to streak_count < 7
        .for_each(|g| {
            categories.insert(g.category.clone());
        });

    categories.into_iter().collect()
}

/// Calculates an overall engagement score.
pub fn calculate_engagement_score(
    study_streak: i32,
    average_session_duration: i32,
    courses_completed: usize,
    paths_completed: usize,
    goals_achieved: usize,
    total_study_time: i32,
) -> f32 {
    (study_streak as f32 * 2.0)
        + (average_session_duration as f32 / 10.0)
        + (courses_completed as f32 * 10.0)
        + (paths_completed as f32 * 20.0)
        + (goals_achieved as f32 * 15.0)
        + (total_study_time as f32 / 60.0)
}

/// Extracts popular phases from phase progress data. (Placeholder)
pub fn extract_popular_phases(phase_progress: &[(String, String)]) -> Vec<(String, String)> {
    phase_progress.to_vec()
}

/// Extracts drop-off points from learning path progress. (Placeholder)
pub fn extract_dropoff_points(path_progress: &[LearningPathProgress]) -> Vec<(String, String)> {
    path_progress
        .iter()
        .filter(|p| p.status == ProgressStatus::Dropped)
        .filter_map(|p| {
            p.phase_progress
                .as_ref()
                .map(|pp| (pp.phase_id.clone(), pp.title.clone()))
        })
        .collect()
}

/// Generates course progress trends based on `CourseProgress` data.
pub fn get_course_progress_trends(
    user_id: &str,
    course_progress: &[CourseProgress],
    start_date: NaiveDateTime,
) -> Result<Vec<ProgressTrend>> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }
    let trends = course_progress
        .iter()
        .filter(|p| p.user_id == user_id && p.last_accessed_at >= start_date)
        .map(|p| ProgressTrend {
            date: p.last_accessed_at,
            value: p.progress_percentage,
            trend_type: "course".to_string(),
            metadata: HashMap::new(),
        })
        .collect();
    Ok(trends)
}

/// Generates learning path progress trends based on `LearningPathProgress` data.
pub fn get_path_progress_trends(
    user_id: &str,
    path_progress: &[LearningPathProgress],
    start_date: NaiveDateTime,
) -> Result<Vec<ProgressTrend>> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }
    let trends = path_progress
        .iter()
        .filter(|p| p.user_id == user_id && p.last_activity_date >= start_date)
        .map(|p| ProgressTrend {
            date: p.last_activity_date,
            value: p.overall_progress_percentage,
            trend_type: "path".to_string(),
            metadata: HashMap::new(),
        })
        .collect();
    Ok(trends)
}

/// Generates learning goal progress trends based on `LearningGoalProgress` data.
pub fn get_goal_progress_trends(
    user_id: &str,
    goal_progress: &[LearningGoalProgress],
    start_date: NaiveDateTime,
) -> Result<Vec<ProgressTrend>> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }
    let trends = goal_progress
        .iter()
        .filter(|p| p.user_id == user_id && p.recorded_at >= start_date)
        .map(|p| ProgressTrend {
            date: p.recorded_at,
            value: p.progress_percentage,
            trend_type: "goal".to_string(),
            metadata: p.metadata.clone(),
        })
        .collect();
    Ok(trends)
}

/// Generates study time trends from aggregated session data.
pub fn get_study_time_trends(
    user_id: &str,
    sessions_data: &[(NaiveDateTime, i32)],
    start_date: NaiveDateTime,
) -> Result<Vec<ProgressTrend>> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }
    let trends = sessions_data
        .iter()
        .filter(|(date, _)| *date >= start_date)
        .map(|(date, duration)| ProgressTrend {
            date: *date,
            value: *duration as f32,
            trend_type: "study_time".to_string(),
            metadata: HashMap::from([("hour".to_string(), date.hour().to_string())]),
        })
        .collect();
    Ok(trends)
}

/// SQLx adapter: fetch study sessions for a user from `learning_goal_progress`.
/// Returns tuples of (recorded_at, duration_minutes).
pub async fn get_study_sessions_db(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<(NaiveDateTime, i32)>> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    let query = r#"
        SELECT recorded_at,
               COALESCE((metadata->>'sessionDuration')::int, 30) AS duration
        FROM learning_goal_progress
        WHERE user_id = $1
        ORDER BY recorded_at DESC
    "#;

    let rows = sqlx::query(query)
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;

    let mut sessions = Vec::with_capacity(rows.len());
    for row in rows {
        let ts: NaiveDateTime = row
            .try_get("recorded_at")
            .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;
        let duration: i32 = row
            .try_get("duration")
            .unwrap_or(DEFAULT_SESSION_DURATION_MINUTES);
        sessions.push((ts, duration));
    }

    Ok(sessions)
}

/// SQLx adapter: fetch user IDs for a cohort. Returns an empty vec when cohort_id is None.
pub async fn get_cohort_users_db(
    pool: &PgPool,
    cohort_id: &str,
) -> Result<Vec<String>> {
    if cohort_id.is_empty() {
        return Ok(Vec::new());
    }

    let query = r#"
        SELECT sgm.user_id
        FROM study_group_members sgm
        JOIN study_groups sg ON sgm.study_group_id = sg.id
        WHERE sg.invite_code = $1
    "#;

    let rows = sqlx::query(query)
        .bind(cohort_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;

    let mut ids = Vec::with_capacity(rows.len());
    for row in rows {
        let id: String = row
            .try_get("user_id")
            .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;
        ids.push(id);
    }

    Ok(ids)
}

/// SQLx adapter: aggregate progress data for a user between two datetimes.
pub async fn get_progress_data_for_period_db(
    pool: &PgPool,
    user_id: &str,
    start_date: NaiveDateTime,
    end_date: NaiveDateTime,
) -> Result<(i32, f32, Vec<(NaiveDate, i32)>)> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    // total study time from course_progress
    let total_course_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(time_spent),0) FROM course_progress WHERE user_id = $1 AND last_accessed_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;

    // total path time
    let total_path_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_time_spent_minutes),0) FROM learning_path_progress WHERE user_id = $1 AND last_activity_date BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // total sessions time from learning_goal_progress.metadata
    let total_sessions_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM((metadata->>'sessionDuration')::int),0) FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let total_study_time = (total_course_time + total_path_time + total_sessions_time) as i32;

    // average score from quiz attempts/assessments
    let avg_score: Option<f32> = sqlx::query_scalar(
        "SELECT AVG(percentage) FROM quiz_attempts WHERE user_id = $1 AND completed_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .ok();

    let average_score = avg_score.unwrap_or(0.0);

    // daily stats: total minutes per day from learning_goal_progress
    let daily_rows = sqlx::query(
        "SELECT date(recorded_at) as day, COALESCE(SUM((metadata->>'sessionDuration')::int),0) as total_minutes FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3 GROUP BY day ORDER BY day",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool)
    .await
    .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;

    let mut daily_stats = Vec::with_capacity(daily_rows.len());
    for row in daily_rows {
        let day: NaiveDate = row
            .try_get("day")
            .map_err(|e| AnalyticsError::CalculationError(e.to_string()))?;
        let mins: i32 = row.try_get("total_minutes").unwrap_or(0);
        daily_stats.push((day, mins));
    }

    Ok((total_study_time, average_score, daily_stats))
}

/// SQLx adapter: completion counts for a period
pub async fn get_completion_data_for_period_db(
    pool: &PgPool,
    user_id: &str,
    start_date: NaiveDateTime,
    end_date: NaiveDateTime,
) -> Result<(i32, i32, i32, Vec<String>)> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    let courses_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM course_progress WHERE user_id = $1 AND status = 'completed' AND last_accessed_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let paths_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM learning_path_progress WHERE user_id = $1 AND status = 'completed' AND last_activity_date BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let assessments_passed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1 AND percentage >= 50 AND completed_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // Milestones: return empty list (schema-specific)
    Ok((
        courses_completed as i32,
        paths_completed as i32,
        assessments_passed as i32,
        Vec::new(),
    ))
}

/// SQLx adapter: engagement data for a period
pub async fn get_engagement_data_for_period_db(
    pool: &PgPool,
    user_id: &str,
    start_date: NaiveDateTime,
    end_date: NaiveDateTime,
) -> Result<(i32, f32, i32)> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    let sessions_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let total_minutes: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM((metadata->>'sessionDuration')::int),0) FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3",
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let avg_session: f32 = if sessions_count > 0 {
        total_minutes as f32 / sessions_count as f32
    } else {
        DEFAULT_SESSION_DURATION_MINUTES as f32
    };

    Ok((sessions_count as i32, avg_session, total_minutes as i32))
}

/// Calculates cohort statistics. (Placeholder)
pub fn get_cohort_statistics(
    _cohort_id: Option<&str>,
) -> Result<LearningAnalytics> {
    Ok(LearningAnalytics {
        total_courses: 0,
        completed_courses: 0,
        total_learning_paths: 0,
        completed_learning_paths: 0,
        total_study_time_minutes: 0,
        average_course_progress: 0.0,
        average_path_progress: 0.0,
        engagement_metrics: EngagementMetricsResult {
            user_id: "".to_string(),
            daily_active_streak: 0,
            weekly_active_streak: 0,
            last_activity_date: None,
            session_count: 0,
            average_session_duration: 0,
            most_active_time_of_day: "".to_string(),
            most_active_day_of_week: "".to_string(),
        },
        performance_metrics: PerformanceMetricsResult {
            average_assessment_score: 0.0,
            pass_rate: 0.0,
            weakness_areas: vec![],
            strength_areas: vec![],
            improvement_rate: 0.0,
        },
    })
}

/// Calculates percentile rank.
pub fn calculate_percentile_rank(
    user_score: f32,
    all_scores: &[f32],
) -> Result<f32> {
    if all_scores.is_empty() {
        return Err(AnalyticsError::EmptyDataset);
    }

    let mut sorted_scores = all_scores.to_vec();
    sorted_scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let mut count_less_than_or_equal = 0;
    for &score in &sorted_scores {
        if score <= user_score {
            count_less_than_or_equal += 1;
        }
    }

    Ok((count_less_than_or_equal as f32 / all_scores.len() as f32) * 100.0)
}

/// Calculates trends (increasing, steady, decreasing).
pub fn calculate_trends(data_points: &[ProgressTrend]) -> (String, String, String) {
    if data_points.len() < 2 {
        return (
            "steady".to_string(),
            "steady".to_string(),
            "steady".to_string(),
        );
    }

    let mut increasing = 0;
    let mut decreasing = 0;
    for i in 1..data_points.len() {
        if data_points[i].value > data_points[i - 1].value {
            increasing += 1;
        } else if data_points[i].value < data_points[i - 1].value {
            decreasing += 1;
        }
    }

    let total_changes = (data_points.len() - 1) as f32;
    let trend = if increasing as f32 / total_changes > 0.6 {
        "increasing".to_string()
    } else if decreasing as f32 / total_changes > 0.6 {
        "decreasing".to_string()
    } else {
        "steady".to_string()
    };
    (trend.clone(), trend.clone(), trend)
}

/// Aggregates statistics for a cohort of users.
pub fn aggregate_stats(
    user_stats_list: &[LearningAnalytics],
) -> Result<LearningAnalytics> {
    if user_stats_list.is_empty() {
        return Err(AnalyticsError::EmptyDataset);
    }

    let mut total_courses = 0;
    let mut completed_courses = 0;
    let mut total_learning_paths = 0;
    let mut completed_learning_paths = 0;
    let mut total_study_time_minutes = 0;
    let mut average_course_progress_sum = 0.0;
    let mut average_path_progress_sum = 0.0;

    for stats in user_stats_list {
        total_courses += stats.total_courses;
        completed_courses += stats.completed_courses;
        total_learning_paths += stats.total_learning_paths;
        completed_learning_paths += stats.completed_learning_paths;
        total_study_time_minutes += stats.total_study_time_minutes;
        average_course_progress_sum += stats.average_course_progress;
        average_path_progress_sum += stats.average_path_progress;
    }

    let count = user_stats_list.len();

    Ok(LearningAnalytics {
        total_courses: total_courses / count,
        completed_courses: completed_courses / count,
        total_learning_paths: total_learning_paths / count,
        completed_learning_paths: completed_learning_paths / count,
        total_study_time_minutes: total_study_time_minutes / count as i32,
        average_course_progress: average_course_progress_sum / count as f32,
        average_path_progress: average_path_progress_sum / count as f32,
        engagement_metrics: EngagementMetricsResult {
            user_id: "cohort_aggregated".to_string(),
            daily_active_streak: 0,
            weekly_active_streak: 0,
            last_activity_date: None,
            session_count: 0,
            average_session_duration: 0,
            most_active_time_of_day: "Unknown".to_string(),
            most_active_day_of_week: "Unknown".to_string(),
        },
        performance_metrics: PerformanceMetricsResult {
            average_assessment_score: 0.0,
            pass_rate: 0.0,
            weakness_areas: vec![],
            strength_areas: vec![],
            improvement_rate: 0.0,
        },
    })
}

/// Identifies top performers in a cohort. (Placeholder)
pub fn identify_top_performers(
    _user_stats_list: &[LearningAnalytics],
    _user_ids: &[String],
) -> Vec<(String, f32)> {
    vec![]
}

/// Calculates cohort trends. (Placeholder)
pub fn calculate_cohort_trends(_user_stats_list: &[LearningAnalytics]) -> (String, String, String) {
    (
        "improving".to_string(),
        "stable".to_string(),
        "increasing".to_string(),
    )
}

/// Generates cohort insights. (Placeholder)
pub fn generate_cohort_insights(
    _aggregated_stats: &LearningAnalytics,
    _trends: &(String, String, String),
) -> Vec<String> {
    vec![]
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/// Computes average session length from study sessions
///
/// # Arguments
/// * `sessions` - Vector of session references
///
/// # Returns
/// * Average session length in minutes
#[inline]
fn compute_average_session_length(sessions: &[&StudySession]) -> f32 {
    if sessions.is_empty() {
        return 0.0;
    }

    let total_duration: i32 = sessions.iter().map(|s| s.duration).sum();
    total_duration as f32 / sessions.len() as f32
}

/// Computes average score from sessions and quiz attempts
///
/// # Arguments
/// * `sessions` - Vector of session references
/// * `attempts` - Vector of quiz attempts
/// * `user_id` - User identifier for filtering
///
/// # Returns
/// * Average score across all activities
#[inline]
fn compute_average_score(
    sessions: &[&StudySession],
    attempts: &[QuizAttempt],
    user_id: &str,
) -> f32 {
    let session_scores: Vec<f32> = sessions.iter().map(|s| s.score).collect();

    let quiz_scores: Vec<f32> = attempts
        .iter()
        .filter(|q| q.user_id == user_id)
        .map(|q| q.percentage)
        .collect();

    let all_scores = [session_scores, quiz_scores].concat();

    if all_scores.is_empty() {
        0.0
    } else {
        all_scores.iter().sum::<f32>() / all_scores.len() as f32
    }
}

// ============================================================================
// Goal Analytics Types
// ============================================================================

// GoalStatus intentionally removed — use ProgressStatus for goal lifecycle states

/// Goal object
#[derive(Debug, Clone, PartialEq)]
pub struct Goal {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub status: ProgressStatus,
    pub category: String,
    pub priority: String,
    pub target_date: Option<NaiveDate>,
    pub completed_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub start_date: Option<NaiveDateTime>,
    pub streak_count: i32,
}

/// Goal analytics result
#[derive(Debug, Clone)]
pub struct GoalResult {
    pub total_goals: usize,
    pub active_goals: usize,
    pub completed_goals: usize,
    pub overdue_goals: usize,
    pub completion_rate: f32,
    pub average_completion_time_days: f32,
    pub goals_by_category: HashMap<String, usize>,
    pub goals_by_priority: HashMap<String, usize>,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub streak_goal_ids: Vec<String>,
    pub upcoming_deadlines: Vec<UpcomingDeadline>,
}

/// Upcoming deadline information
#[derive(Debug, Clone)]
pub struct UpcomingDeadline {
    pub goal_id: String,
    pub title: String,
    pub target_date: NaiveDate,
    pub days_remaining: i32,
}

// ============================================================================
// Advanced Analytics Types
// ============================================================================

/// Progress trend data point
#[derive(Debug, Clone)]
pub struct ProgressTrend {
    pub date: NaiveDateTime,
    pub value: f32,
    pub trend_type: String,
    pub metadata: HashMap<String, String>,
}

/// Engagement metrics
#[derive(Debug, Clone)]
pub struct EngagementMetricsResult {
    pub user_id: String,
    pub daily_active_streak: i32,
    pub weekly_active_streak: i32,
    pub last_activity_date: Option<NaiveDateTime>,
    pub session_count: usize,
    pub average_session_duration: i32,
    pub most_active_time_of_day: String,
    pub most_active_day_of_week: String,
}

/// Learning analytics summary
#[derive(Debug, Clone)]
pub struct LearningResult {
    pub total_courses: usize,
    pub completed_courses: usize,
    pub total_learning_paths: usize,
    pub completed_learning_paths: usize,
    pub total_study_time_minutes: i32,
    pub average_course_progress: f32,
    pub average_path_progress: f32,
}

/// Performance metrics
#[derive(Debug, Clone)]
pub struct PerformanceMetricsResult {
    pub average_assessment_score: f32,
    pub pass_rate: f32,
    pub weakness_areas: Vec<String>,
    pub strength_areas: Vec<String>,
    pub improvement_rate: f32,
}

// ============================================================================
// Advanced Analytics Functions
// ============================================================================

/// Analyzes goal-related metrics for a user
///
/// # Arguments
/// * `goals` - Vector of goals
/// * `user_id` - User identifier
///
/// # Returns
/// * `Result<GoalResult>` - Goal analytics or error
pub fn calculate_goal_analytics(
    goals: &[Goal],
    user_id: &str,
) -> Result<GoalResult> {
    if user_id.is_empty() {
        return Err(AnalyticsError::InvalidUserId);
    }

    let user_goals: Vec<&Goal> = goals.iter().filter(|g| g.user_id == user_id).collect();

    let total_goals = user_goals.len();
    let active_goals = user_goals
        .iter()
        .filter(|g| g.status == ProgressStatus::Active)
        .count();
    let completed_goals = user_goals
        .iter()
        .filter(|g| g.status == ProgressStatus::Completed)
        .count();

    let now = Local::now().naive_local();
    let overdue_goals = user_goals
        .iter()
        .filter(|g| {
            g.status == ProgressStatus::Active
                && g.target_date.is_some()
                && g.target_date.unwrap().and_hms_opt(0, 0, 0).unwrap() < now
        })
        .count();

    let completion_rate = if total_goals > 0 {
        (completed_goals as f32 / total_goals as f32) * 100.0
    } else {
        0.0
    };

    let avg_completion_time = calculate_average_completion_time(&user_goals);

    let goals_by_category = categorize_goals(&user_goals, |g| g.category.clone());
    let goals_by_priority = categorize_goals(&user_goals, |g| g.priority.clone());

    let streak_goals: Vec<&Goal> = user_goals
        .iter()
        .filter(|g| g.streak_count > 0)
        .copied()
        .collect();
    let current_streak = streak_goals
        .iter()
        .map(|g| g.streak_count)
        .max()
        .unwrap_or(0);
    let longest_streak = user_goals.iter().map(|g| g.streak_count).max().unwrap_or(0);

    let streak_goal_ids = streak_goals.iter().map(|g| g.id.clone()).collect();

    let upcoming_deadlines = calculate_upcoming_deadlines(&user_goals, 5);

    Ok(GoalResult {
        total_goals,
        active_goals,
        completed_goals,
        overdue_goals,
        completion_rate,
        average_completion_time_days: avg_completion_time,
        goals_by_category,
        goals_by_priority,
        current_streak,
        longest_streak,
        streak_goal_ids,
        upcoming_deadlines,
    })
}

/// Calculates engagement metrics from activity data
///
/// # Arguments
/// * `activities` - Vector of activity timestamps
/// * `user_id` - User identifier
///
/// # Returns
/// * `EngagementMetricsResult` - Calculated engagement metrics
pub fn calculate_engagement_metrics(
    activities: &[NaiveDateTime],
    user_id: &str,
) -> EngagementMetricsResult {
    let daily_streak = calculate_daily_streak(activities);
    let weekly_streak = daily_streak / 7;

    let last_activity = activities.first().copied();
    let session_count = activities.len();

    let most_active_time = find_most_active_time_of_day(activities);
    let most_active_day = find_most_active_day_of_week(activities);

    EngagementMetricsResult {
        user_id: user_id.to_string(),
        daily_active_streak: daily_streak,
        weekly_active_streak: weekly_streak,
        last_activity_date: last_activity,
        session_count,
        average_session_duration: DEFAULT_SESSION_DURATION_MINUTES,
        most_active_time_of_day: most_active_time,
        most_active_day_of_week: most_active_day,
    }
}

/// Calculates daily streak from activity timestamps
///
/// # Arguments
/// * `activities` - Vector of activity timestamps
///
/// # Returns
/// * Daily streak count
fn calculate_daily_streak(activities: &[NaiveDateTime]) -> i32 {
    if activities.is_empty() {
        return 0;
    }

    let mut sorted = activities.to_vec();
    sorted.sort_by(|a, b| b.cmp(a));

    let today = Local::now().naive_local().date();
    let mut streak = 0;
    let mut current_date = today;

    for activity in sorted {
        let activity_date = activity.date();
        let days_diff = (current_date - activity_date).num_days();

        if days_diff == streak as i64 {
            streak += 1;
            current_date = activity_date;
        } else {
            break;
        }
    }

    streak
}

/// Finds the most active hour of day from activities
fn find_most_active_time_of_day(activities: &[NaiveDateTime]) -> String {
    let mut hour_counts: HashMap<u32, usize> = HashMap::new();

    for activity in activities {
        let hour = activity.hour();
        *hour_counts.entry(hour).or_insert(0) += 1;
    }

    let most_active_hour = hour_counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(hour, _)| *hour)
        .unwrap_or(12);

    format!("{:02}:00", most_active_hour)
}

/// Finds the most active day of week from activities
fn find_most_active_day_of_week(activities: &[NaiveDateTime]) -> String {
    let days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    let mut day_counts: HashMap<u32, usize> = HashMap::new();

    for activity in activities {
        let day = activity.weekday().number_from_sunday();
        *day_counts.entry(day).or_insert(0) += 1;
    }

    let most_active_day = day_counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(day, _)| *day as usize)
        .unwrap_or(0);

    days[most_active_day].to_string()
}

/// Calculates average time to complete goals
fn calculate_average_completion_time(goals: &[&Goal]) -> f32 {
    let completed_with_dates: Vec<&Goal> = goals
        .iter()
        .filter(|g| {
            g.status == ProgressStatus::Completed
                && g.completed_at.is_some()
                && (g.start_date.is_some()
                    || g.created_at != chrono::Utc.timestamp_opt(0, 0).single().unwrap_or_else(|| chrono::Utc::now()).naive_utc())
        })
        .copied()
        .collect();

    if completed_with_dates.is_empty() {
        return 0.0;
    }

    let total_days: f32 = completed_with_dates
        .iter()
        .map(|g| {
            let start = g.start_date.unwrap_or(g.created_at);
            let end = g.completed_at.unwrap();
            (end - start).num_days() as f32
        })
        .sum();

    total_days / completed_with_dates.len() as f32
}

/// Categorizes items by a key function
fn categorize_goals<F>(goals: &[&Goal], key_fn: F) -> HashMap<String, usize>
where
    F: Fn(&Goal) -> String,
{
    let mut categories: HashMap<String, usize> = HashMap::new();

    for goal in goals {
        let key = key_fn(goal);
        *categories.entry(key).or_insert(0) += 1;
    }

    categories
}

/// Calculates upcoming deadlines
fn calculate_upcoming_deadlines(goals: &[&Goal], limit: usize) -> Vec<UpcomingDeadline> {
    let today = Local::now().naive_local().date();

    let mut deadlines: Vec<UpcomingDeadline> = goals
        .iter()
        .filter(|g| {
            g.status == ProgressStatus::Active
                && g.target_date.is_some()
                && g.target_date.unwrap() > today
        })
        .map(|g| UpcomingDeadline {
            goal_id: g.id.clone(),
            title: g.title.clone(),
            target_date: g.target_date.unwrap(),
            days_remaining: (g.target_date.unwrap() - today).num_days() as i32,
        })
        .collect();

    deadlines.sort_by_key(|d| d.days_remaining);
    deadlines.truncate(limit);

    deadlines
}

/// Identifies improvement areas based on performance metrics
pub fn identify_improvement_areas(
    current_streak: i32,
    avg_progress: f32,
    threshold: f32,
) -> Vec<String> {
    let mut improvements = Vec::new();

    if avg_progress < threshold {
        improvements.push("Course completion rate needs improvement".to_string());
    }

    if current_streak < 7 {
        improvements
            .push("Consider establishing a more consistent daily study routine".to_string());
    }

    improvements
}

/// Identifies achievements based on performance metrics
pub fn identify_achievements(completed_courses: usize, daily_streak: i32) -> Vec<String> {
    let mut achievements = Vec::new();

    if completed_courses > 0 {
        achievements.push(format!("Completed {} courses", completed_courses));
    }

    if daily_streak >= 7 {
        achievements.push(format!("Maintained {}-day learning streak", daily_streak));
    }

    if completed_courses >= 5 {
        achievements.push("Major milestone: 5 courses completed!".to_string());
    }

    achievements
}

/// Extracts preferred study times from sessions
pub fn extract_preferred_study_times(sessions: &[(NaiveDateTime, i32)]) -> Vec<String> {
    let mut time_slot_counts: HashMap<String, usize> = HashMap::new();

    for (session_time, _) in sessions {
        let hour = session_time.hour();
        let time_slot = get_time_slot(hour);
        *time_slot_counts.entry(time_slot).or_insert(0) += 1;
    }

    let mut slots: Vec<_> = time_slot_counts.into_iter().collect();
    slots.sort_by_key(|(_, count)| std::cmp::Reverse(*count));

    slots.into_iter().take(3).map(|(slot, _)| slot).collect()
}

/// Maps hour to time slot
fn get_time_slot(hour: u32) -> String {
    match hour {
        6..=11 => "morning".to_string(),
        12..=17 => "afternoon".to_string(),
        18..=21 => "evening".to_string(),
        _ => "night".to_string(),
    }
}

/// Calculates learning velocity (progress per hour of study)
pub fn calculate_learning_velocity(total_progress: f32, total_study_time_minutes: i32) -> f32 {
    if total_study_time_minutes == 0 {
        return 0.0;
    }

    let hours = total_study_time_minutes as f32 / 60.0;
    total_progress / hours
}

/// Calculates performance score
pub fn calculate_performance_score(
    completed_courses: usize,
    completed_paths: usize,
    avg_course_progress: f32,
    avg_path_progress: f32,
    daily_streak: i32,
) -> f32 {
    (completed_courses as f32 * 10.0)
        + (completed_paths as f32 * 20.0)
        + avg_course_progress
        + avg_path_progress
        + (daily_streak.min(30) as f32)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_study_session_creation() {
        let session = StudySession::new("user1", 30, "Anatomy", 85.0);
        assert!(session.is_ok());

        let invalid_user = StudySession::new("", 30, "Anatomy", 85.0);
        assert_eq!(invalid_user, Err(AnalyticsError::InvalidUserId));

        let invalid_score = StudySession::new("user1", 30, "Anatomy", 150.0);
        assert_eq!(invalid_score, Err(AnalyticsError::InvalidScore));
    }

    #[test]
    fn test_quiz_attempt_creation() {
        let attempt = QuizAttempt::new("user1", 88.0, "Anatomy");
        assert!(attempt.is_ok());

        let invalid_attempt = QuizAttempt::new("user1", 150.0, "Anatomy");
        assert_eq!(invalid_attempt, Err(AnalyticsError::InvalidScore));
    }

    #[test]
    fn test_calculate_user_learning_summary() {
        let sessions = vec![
            StudySession::new("user1", 30, "Anatomy", 85.0).unwrap(),
            StudySession::new("user1", 45, "Pharmacology", 70.0).unwrap(),
            StudySession::new("user1", 25, "Anatomy", 90.0).unwrap(),
        ];

        let attempts = vec![
            QuizAttempt::new("user1", 88.0, "Anatomy").unwrap(),
            QuizAttempt::new("user1", 72.0, "Pharmacology").unwrap(),
        ];

        let summary = calculate_user_learning_summary("user1", sessions, attempts);
        assert!(summary.is_ok());

        let summary = summary.unwrap();
        assert_eq!(summary.total_study_time, 100);
        assert!(summary.average_score > 0.0);
    }

    #[test]
    fn test_empty_dataset_error() {
        let sessions = vec![];
        let attempts = vec![];
        let result = calculate_user_learning_summary("user1", sessions, attempts);
        assert_eq!(result, Err(AnalyticsError::EmptyDataset));
    }

    #[test]
    fn test_invalid_user_id_error() {
        let sessions = vec![];
        let attempts = vec![];
        let result = calculate_user_learning_summary("", sessions, attempts);
        assert_eq!(result, Err(AnalyticsError::InvalidUserId));
    }

    #[test]
    fn test_generate_personalized_tips() {
        let summary = UserLearningSummary::new(
            100,
            15.0,
            85.0,
            3,
            5,
            vec!["Anatomy".to_string()],
            vec!["Pharmacology".to_string()],
        )
        .unwrap();

        let tips = generate_personalized_tips(&summary);
        assert!(!tips.is_empty());
        assert!(tips.iter().any(|t| t.contains("short")));
    }

    #[test]
    fn test_compute_average_session_length() {
        let sessions = vec![
            StudySession::new("user1", 30, "Anatomy", 85.0).unwrap(),
            StudySession::new("user1", 60, "Anatomy", 90.0).unwrap(),
        ];

        let session_refs: Vec<&StudySession> = sessions.iter().collect();
        let avg = compute_average_session_length(&session_refs);
        assert_eq!(avg, 45.0);
    }

    #[test]
    fn test_identify_improvement_areas() {
        let improvements = identify_improvement_areas(5, 65.0, 75.0);
        assert!(!improvements.is_empty());
        assert!(improvements.iter().any(|i| i.contains("improvement")));
    }

    #[test]
    fn test_identify_achievements() {
        let achievements = identify_achievements(3, 10);
        assert!(!achievements.is_empty());
        assert!(achievements.iter().any(|a| a.contains("courses")));
    }

    #[test]
    fn test_calculate_performance_score() {
        let score = calculate_performance_score(5, 3, 85.0, 75.0, 10);
        assert!(score > 100.0);
    }

    #[test]
    fn test_learning_velocity_calculation() {
        let velocity = calculate_learning_velocity(100.0, 120);
        assert!(velocity > 0.0);
    }
}
