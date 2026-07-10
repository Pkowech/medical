//! Example queries using sqlx compile-time checking
//! 
//! These queries are verified against the actual database schema at compile time.
//! This ensures type safety and prevents runtime errors from invalid SQL.

use sqlx::{Pool, Postgres, Row};
use chrono::{DateTime, Utc, NaiveDateTime};

/// Fetch a user's course progress
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User identifier
/// * `course_id` - Course identifier
/// 
/// # Returns
/// Result with course progress data or error
pub async fn get_course_progress(
    pool: &Pool<Postgres>,
    user_id: &str,
    course_id: &str,
) -> Result<Option<CourseProgressRecord>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, user_id, course_id, status, time_spent, progress_percentage, 
                completed_units, total_units, started_at, completed_at, last_accessed_at, 
                created_at, updated_at 
         FROM course_progress 
         WHERE user_id = $1 AND course_id = $2"
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| CourseProgressRecord {
        id: r.get("id"),
        user_id: r.get("user_id"),
        course_id: r.get("course_id"),
        status: r.get("status"),
        time_spent: r.get("time_spent"),
        progress_percentage: r.get("progress_percentage"),
        completed_units: r.get("completed_units"),
        total_units: r.get("total_units"),
        started_at: r.get("started_at"),
        completed_at: r.get("completed_at"),
        last_accessed_at: r.get("last_accessed_at"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }))
}

/// Fetch all courses a user is enrolled in
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User identifier
/// 
/// # Returns
/// Vector of user's course enrollments
pub async fn get_user_courses(
    pool: &Pool<Postgres>,
    user_id: &str,
) -> Result<Vec<UserCourseRecord>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT ce.id, ce.user_id, ce.course_id, ce.status, ce.progress_percentage, 
                ce.enrolled_at, ce.completed_at, c.title, c.description, c.level
         FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE ce.user_id = $1
         ORDER BY ce.enrolled_at DESC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| UserCourseRecord {
            enrollment_id: r.get("id"),
            user_id: r.get("user_id"),
            course_id: r.get("course_id"),
            title: r.get("title"),
            description: r.get("description"),
            level: r.get("level"),
            status: r.get("status"),
            progress_percentage: r.get("progress_percentage"),
            enrolled_at: r.get("enrolled_at"),
            completed_at: r.get("completed_at"),
        })
        .collect())
}

/// Update course progress percentage
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `course_progress_id` - Course progress record ID
/// * `progress_percentage` - New progress percentage (0-100)
pub async fn update_course_progress(
    pool: &Pool<Postgres>,
    course_progress_id: &str,
    progress_percentage: i32,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE course_progress 
         SET progress_percentage = $1, updated_at = $2 
         WHERE id = $3"
    )
    .bind(progress_percentage)
    .bind(Utc::now().naive_utc())
    .bind(course_progress_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Fetch user's recent study activity
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User identifier
/// * `limit` - Maximum number of records to fetch
pub async fn get_user_study_activity(
    pool: &Pool<Postgres>,
    user_id: &str,
    limit: i32,
) -> Result<Vec<StudyActivityRecord>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, user_id, type, description, details, created_at 
         FROM user_activity 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2"
    )
    .bind(user_id)
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| StudyActivityRecord {
            id: r.get("id"),
            user_id: r.get("user_id"),
            activity_type: r.get("type"),
            description: r.get("description"),
            created_at: r.get("created_at"),
        })
        .collect())
}

/// Count total courses a user has completed
pub async fn count_completed_courses(
    pool: &Pool<Postgres>,
    user_id: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "SELECT COUNT(*) as count 
         FROM course_progress 
         WHERE user_id = $1 AND status = 'completed'"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result.get::<i64, _>("count"))
}

/// Get learning paths for a specific user
pub async fn get_user_learning_paths(
    pool: &Pool<Postgres>,
    user_id: &str,
) -> Result<Vec<LearningPathRecord>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT lp.id, lp.title, lp.description, lpp.status, lpp.progress_percentage, lpp.started_at
         FROM learning_paths lp
         LEFT JOIN learning_path_progress lpp ON lp.id = lpp.learning_path_id AND lpp.user_id = $1
         WHERE lpp.user_id = $1 OR lpp.id IS NULL
         ORDER BY lpp.started_at DESC NULLS LAST"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| LearningPathRecord {
            id: r.get("id"),
            title: r.get("title"),
            description: r.get("description"),
            status: r.get("status"),
            progress_percentage: r.get("progress_percentage"),
            started_at: r.get("started_at"),
        })
        .collect())
}

// Response types for queries

#[derive(Debug, Clone)]
pub struct CourseProgressRecord {
    pub id: String,
    pub user_id: String,
    pub course_id: String,
    pub status: String,
    pub time_spent: i32,
    pub progress_percentage: i32,
    pub completed_units: i32,
    pub total_units: i32,
    pub started_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
    pub last_accessed_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct UserCourseRecord {
    pub enrollment_id: String,
    pub user_id: String,
    pub course_id: String,
    pub title: String,
    pub description: Option<String>,
    pub level: String,
    pub status: String,
    pub progress_percentage: i32,
    pub enrolled_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct StudyActivityRecord {
    pub id: String,
    pub user_id: String,
    pub activity_type: String,
    pub description: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct LearningPathRecord {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub progress_percentage: Option<i32>,
    pub started_at: Option<NaiveDateTime>,
}
