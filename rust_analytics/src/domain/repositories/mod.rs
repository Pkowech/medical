/// Repository trait definitions for domain layer
/// Implementations should live under infrastructure/database/repositories
/// and be injected by application layer

pub mod analytics_repository;
use async_trait::async_trait;
use crate::shared::error::AnalyticsError;

// Re-export repository traits
pub use analytics_repository::{
    SkillStateRepository,
    QuizRepository,
    CourseRepository,
    CourseStats,
    MaterialRepository,
    UnitProgress,
    MaterialInfo,
    ActivityRepository,
    GoalRepository,
    UserProfileRepository,
    AggregateRepository,
    RecommendationRepository,
};

/// Trait for learning path repository (kept here for compatibility)
#[async_trait]
pub trait PathRepository: Send + Sync {
    async fn get_learning_paths(&self, user_id: &str) -> Result<Vec<crate::domain::models::LearningPath>, AnalyticsError>;
    async fn get_path_progress(&self, user_id: &str, path_id: &str) -> Result<Option<crate::domain::models::PathProgress>, AnalyticsError>;
    async fn update_path_progress(&self, user_id: &str, path_id: &str, progress_percentage: f64, status: &str) -> Result<(), AnalyticsError>;
    async fn get_path_units(&self, path_id: &str) -> Result<Vec<crate::domain::models::PathUnit>, AnalyticsError>;
    async fn get_recommended_paths(&self, user_id: &str, limit: i32) -> Result<Vec<crate::domain::models::RecommendedPath>, AnalyticsError>;
}

// Legacy trait - kept for backward compatibility during migration
// TODO: Remove after all code migrated to new repository traits
#[async_trait]
pub trait AnalyticsRepository: Send + Sync {
    async fn fetch_user_learning_analytics(
        &self,
        user_id: &str,
    ) -> Result<Option<serde_json::Value>, String>;

    async fn fetch_quiz_attempts_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<serde_json::Value>, String>;
}
