/// Infrastructure layer repository implementations
/// Concrete database implementations of domain repository traits

pub mod skill_state_repository;
pub mod quiz_repository;
pub mod course_repository;
pub mod material_repository;
pub mod activity_repository;
pub mod goal_repository;
pub mod user_profile_repository;
pub mod path_repository;
pub mod recommendation_repository;

// Re-export implementations
pub use skill_state_repository::PostgresSkillStateRepository;
pub use quiz_repository::PostgresQuizRepository;
pub use course_repository::PostgresCourseRepository;
pub use material_repository::PostgresMaterialRepository;
pub use activity_repository::PostgresActivityRepository;
pub use goal_repository::PostgresGoalRepository;
pub use user_profile_repository::PostgresUserProfileRepository;
pub use path_repository::PostgresPathRepository;
pub use recommendation_repository::PostgresRecommendationRepository;

use sqlx::{Pool, Postgres};
use std::sync::Arc;

/// Factory for creating all repository instances
pub struct RepositoryFactory {
    pool: Arc<Pool<Postgres>>,
}

impl RepositoryFactory {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self {
            pool: Arc::new(pool),
        }
    }

    pub fn skill_state_repository(&self) -> Arc<PostgresSkillStateRepository> {
        Arc::new(PostgresSkillStateRepository::new(self.pool.clone()))
    }

    pub fn quiz_repository(&self) -> Arc<PostgresQuizRepository> {
        Arc::new(PostgresQuizRepository::new(self.pool.clone()))
    }

    pub fn course_repository(&self) -> Arc<PostgresCourseRepository> {
        Arc::new(PostgresCourseRepository::new(self.pool.clone()))
    }

    pub fn material_repository(&self) -> Arc<PostgresMaterialRepository> {
        Arc::new(PostgresMaterialRepository::new(self.pool.clone()))
    }

    pub fn path_repository(&self) -> Arc<PostgresPathRepository> {
        Arc::new(PostgresPathRepository::new(self.pool.clone()))
    }

    pub fn recommendation_repository(&self) -> Arc<PostgresRecommendationRepository> {
        Arc::new(PostgresRecommendationRepository::new(self.pool.clone()))
    }

    pub fn activity_repository(&self) -> Arc<PostgresActivityRepository> {
        Arc::new(PostgresActivityRepository::new(self.pool.clone()))
    }

    pub fn goal_repository(&self) -> Arc<PostgresGoalRepository> {
        Arc::new(PostgresGoalRepository::new(self.pool.clone()))
    }

    pub fn user_profile_repository(&self) -> Arc<PostgresUserProfileRepository> {
        Arc::new(PostgresUserProfileRepository::new(self.pool.clone()))
    }
}

