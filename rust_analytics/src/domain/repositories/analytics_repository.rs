use crate::shared::error::AnalyticsError;
/// Repository traits for analytics domain
/// Provides abstraction over database access for domain services
use async_trait::async_trait;

/// User skill state repository trait
/// Manages persistence of BKT skill knowledge states
#[async_trait]
pub trait SkillStateRepository: Send + Sync {
    /// Get a user's knowledge probability for a specific skill
    async fn get_user_skill_state(
        &self,
        user_id: &str,
        skill_id: &str,
    ) -> Result<Option<f64>, AnalyticsError>;

    /// Update a user's knowledge probability for a skill
    async fn update_user_skill_state(
        &self,
        user_id: &str,
        skill_id: &str,
        p_known: f64,
    ) -> Result<(), AnalyticsError>;

    /// Get all skills and their knowledge states for a user
    async fn get_all_skill_states(
        &self,
        user_id: &str,
    ) -> Result<Vec<(String, f64)>, AnalyticsError>;

    /// Get skills with lowest knowledge (weakest skills)
    async fn get_weakest_skills(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<(String, f64)>, AnalyticsError>;

    /// Increment attempt count for a skill
    async fn increment_attempts(&self, user_id: &str, skill_id: &str)
        -> Result<(), AnalyticsError>;
}

/// Quiz and assessment repository trait
/// Manages quiz attempts and performance data
#[async_trait]
pub trait QuizRepository: Send + Sync {
    /// Get quiz attempt history for a user
    async fn get_quiz_attempt_history(
        &self,
        user_id: &str,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<crate::domain::models::quiz::QuizAttempt>, AnalyticsError>;

    /// Record a new quiz attempt
    async fn record_quiz_attempt(
        &self,
        user_id: &str,
        quiz_id: &str,
        score: f64,
        is_correct: bool,
    ) -> Result<String, AnalyticsError>;

    /// Get recent quiz performance for a skill
    /// Returns (correct_count, total_count)
    async fn get_recent_quiz_performance(
        &self,
        user_id: &str,
        skill_id: &str,
        limit: i64,
    ) -> Result<(i64, i64), AnalyticsError>;

    /// Get average score for a user across all quizzes
    async fn get_average_quiz_score(&self, user_id: &str) -> Result<f32, AnalyticsError>;

    /// Count total quiz attempts for a user
    async fn count_quiz_attempts(&self, user_id: &str) -> Result<i64, AnalyticsError>;
}

/// Course and unit progress repository
#[async_trait]
pub trait CourseRepository: Send + Sync {
    /// Get all units in a course
    async fn get_course_units(
        &self,
        course_id: &str,
    ) -> Result<Vec<crate::domain::repositories::UnitProgress>, AnalyticsError>;

    /// Get total number of materials in a course
    async fn get_total_course_materials(&self, course_id: &str) -> Result<usize, AnalyticsError>;

    /// Get course statistics (total, completed, time spent, avg progress)
    async fn get_course_stats(
        &self,
        user_id: &str,
        course_id: &str,
    ) -> Result<CourseStats, AnalyticsError>;

    /// Count completed courses for a user
    async fn count_completed_courses(&self, user_id: &str) -> Result<i32, AnalyticsError>;

    /// Count total courses for a user
    async fn count_total_courses(&self, user_id: &str) -> Result<i32, AnalyticsError>;
}

#[derive(Debug, Clone)]
pub struct CourseStats {
    pub total_courses: i32,
    pub completed_courses: i32,
    pub total_study_time_minutes: i32,
    pub average_course_progress: f32,
}

/// Material and learning content repository
#[async_trait]
pub trait MaterialRepository: Send + Sync {
    /// Get progress for a specific unit
    async fn get_unit_progress(
        &self,
        user_id: &str,
        unit_id: &str,
    ) -> Result<UnitProgress, AnalyticsError>;

    /// Get candidate materials for recommendation
    async fn get_candidate_materials(
        &self,
        user_id: &str,
        difficulty_range: (f64, f64),
        limit: usize,
    ) -> Result<Vec<MaterialInfo>, AnalyticsError>;

    /// Get completed materials for a user
    async fn get_completed_materials(&self, user_id: &str) -> Result<Vec<String>, AnalyticsError>;

    /// Get materials by difficulty range
    async fn get_materials_by_difficulty(
        &self,
        min_difficulty: f64,
        max_difficulty: f64,
        limit: usize,
    ) -> Result<Vec<MaterialInfo>, AnalyticsError>;
}

/// Recommendation repository trait
#[async_trait]
pub trait RecommendationRepository: Send + Sync {
    /// Get recommendations for a user with optional limit
    async fn get_recommendations(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<
        Vec<crate::modules::analytics::recommendations::service::Recommendation>,
        AnalyticsError,
    >;

    /// Store recommendation scores for a user and material
    async fn store_recommendation_score(
        &self,
        user_id: &str,
        material_id: &str,
        score: f64,
    ) -> Result<(), AnalyticsError>;

    /// Get user preferences used by recommendation engine
    async fn get_user_preferences(
        &self,
        user_id: &str,
    ) -> Result<serde_json::Value, AnalyticsError>;
}

#[derive(Debug, Clone)]
pub struct UnitProgress {
    pub unit_id: String,
    pub completed_count: i32,
    pub total_count: i32,
    pub time_spent: i32,
    pub concurrent_slot_number: Option<i32>,
    pub last_access: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone)]
pub struct MaterialInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub difficulty: f64,
    pub topics: Vec<String>,
}

/// User activity and engagement repository
#[async_trait]
pub trait ActivityRepository: Send + Sync {
    /// Get user activities (course access, path activity)
    async fn get_user_activities(
        &self,
        user_id: &str,
    ) -> Result<Vec<chrono::NaiveDateTime>, AnalyticsError>;

    /// Get course completion statistics
    async fn get_course_completion_stats(
        &self,
        user_id: &str,
    ) -> Result<(i32, i32), AnalyticsError>; // (total, completed)

    /// Get learning path completion statistics
    async fn get_learning_path_completion_stats(
        &self,
        user_id: &str,
    ) -> Result<(i32, i32), AnalyticsError>;

    /// Get last activity timestamp for a user
    async fn get_last_activity_date(
        &self,
        user_id: &str,
    ) -> Result<Option<chrono::NaiveDateTime>, AnalyticsError>;

    /// Get most active hour of day (0-23)
    async fn get_most_active_hour(&self, user_id: &str) -> Result<Option<i32>, AnalyticsError>;

    /// Get active concurrent unit slots (unit_id, slot_number)
    async fn get_active_unit_slots(
        &self,
        user_id: &str,
    ) -> Result<Vec<(String, i32)>, AnalyticsError>;

    /// Get topic mastery stats (total_topics_attempted, mastered_topics)
    async fn get_topic_mastery_stats(&self, user_id: &str) -> Result<(i32, i32), AnalyticsError>;
}

/// Learning goals repository
#[async_trait]
pub trait GoalRepository: Send + Sync {
    /// Get all goals for a user
    async fn get_user_goals(
        &self,
        user_id: &str,
    ) -> Result<Vec<crate::domain::models::Goal>, AnalyticsError>;

    /// Get goals by status
    async fn get_goals_by_status(
        &self,
        user_id: &str,
        status: &str,
    ) -> Result<Vec<crate::domain::models::Goal>, AnalyticsError>;

    /// Get upcoming deadlines
    async fn get_upcoming_deadlines(
        &self,
        user_id: &str,
    ) -> Result<Vec<crate::domain::models::UpcomingDeadline>, AnalyticsError>;

    /// Update a goal
    async fn update_goal(&self, goal: crate::domain::models::Goal) -> Result<(), AnalyticsError>;
}

/// User feature and profile data repository
#[async_trait]
pub trait UserProfileRepository: Send + Sync {
    /// Extract user features for machine learning
    #[cfg(feature = "ml")]
    async fn get_user_features(
        &self,
        user_id: &str,
    ) -> Result<crate::modules::analytics::core::feature_extraction::UserFeatures, AnalyticsError>;

    /// Get user preferences
    async fn get_user_preferences(
        &self,
        user_id: &str,
    ) -> Result<serde_json::Value, AnalyticsError>;

    /// Get user learning history
    #[cfg(feature = "ml")]
    async fn get_learning_history(
        &self,
        user_id: &str,
    ) -> Result<
        Vec<crate::modules::analytics::core::feature_extraction::LearningHistoryItem>,
        AnalyticsError,
    >;
}

/// Aggregate repository for complex queries
/// Combines multiple repository concerns
#[async_trait]
pub trait AggregateRepository:
    SkillStateRepository
    + QuizRepository
    + CourseRepository
    + MaterialRepository
    + ActivityRepository
    + GoalRepository
    + UserProfileRepository
{
}
