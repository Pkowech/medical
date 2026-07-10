use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemAnalytics {
    pub total_users: i64,
    pub active_learners: i64,
    pub total_courses: i64,
    pub completed_courses: i64,
    pub average_completion_rate: f64,
    pub total_paths: i64,
    pub total_enrollments: i64,
    pub overall_completion_rate: f64,
}

pub async fn get_system_analytics(pool: &Pool<Postgres>) -> Result<SystemAnalytics, String> {
    let total_users: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

    let active_learners: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL '30 days'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or(0);

    let total_courses: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM courses")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

    let completed_courses: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM course_progress WHERE status::text = 'completed' OR status::text = 'COMPLETED'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or(0);

    let total_paths: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM learning_paths")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

    let total_enrollments: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM course_enrollments")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

    let average_completion_rate = if total_enrollments > 0 {
        (completed_courses as f64 / total_enrollments as f64) * 100.0
    } else {
        0.0
    };

    Ok(SystemAnalytics {
        total_users,
        active_learners,
        total_courses,
        completed_courses,
        average_completion_rate,
        total_paths,
        total_enrollments,
        overall_completion_rate: average_completion_rate,
    })
}
