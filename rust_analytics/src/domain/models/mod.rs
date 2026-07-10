pub mod course;
pub mod goal;
pub mod learning_path;
pub mod quiz;

// Re-export models
pub use course::{CourseProgress, CourseStatsResult, UnitProgress};
pub use goal::{Goal, LearningGoalProgress, GoalAnalyticsResult, UpcomingDeadline};
pub use learning_path::{LearningPath, PathProgress, PathUnit, RecommendedPath, LearningPathProgress, LearningPathStatsResult, PhaseProgress};

// domain/models: re-export analytics models so domain-level code can import them
#[cfg(feature = "ml")]
pub use crate::modules::analytics::models::*;

// Also re-export value objects that models depend on
pub use crate::domain::value_objects::ProgressStatus;
