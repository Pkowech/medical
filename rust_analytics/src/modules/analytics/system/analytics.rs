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
    pub published_courses: i64,
    pub active_today: i64,
    pub average_course_rating: f64,
    pub average_assessment_score: f64,
    pub total_study_time_minutes: i64,
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

    let published_courses: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM courses WHERE status::text = 'published'",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    let active_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE last_login >= CURRENT_DATE",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    let average_course_rating: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(rating)::double precision
         FROM courses
         WHERE status::text = 'published' AND rating > 0",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    let average_assessment_score: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(percentage)::double precision
         FROM quiz_attempts
         WHERE completed_at IS NOT NULL",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    let total_study_time_minutes: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(duration), 0)::bigint
         FROM study_sessions
         WHERE is_valid = true AND end_time IS NOT NULL",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    let completed_courses: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM course_enrollments WHERE status::text = 'completed' OR status::text = 'COMPLETED'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

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
        published_courses,
        active_today,
        average_course_rating: average_course_rating.unwrap_or(0.0),
        average_assessment_score: average_assessment_score.unwrap_or(0.0),
        total_study_time_minutes,
    })
}
