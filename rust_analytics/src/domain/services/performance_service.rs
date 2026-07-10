use sqlx::{Pool, Postgres};

pub use crate::modules::analytics::performance::analytics::PerformanceAnalytics;
pub use crate::modules::analytics::performance::analytics::QuizPerformance;
pub use crate::modules::analytics::performance::analytics::TimeManagement;

/// Get comprehensive performance analytics for a user
pub async fn get_performance_analytics(
    user_id: &str,
    assessment_id: Option<&str>,
    pool: &Pool<Postgres>,
) -> Result<PerformanceAnalytics, String> {
    crate::modules::analytics::performance::analytics::get_performance_analytics(
        user_id, assessment_id, pool,
    )
    .await
}
