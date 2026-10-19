use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressRecord {
    pub user_id: String,
    pub course_id: String,
    pub progress: f64,
    pub date: String,
}

pub async fn get_progress_records(
    start: &str,
    end: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<ProgressRecord>, String> {
    let start_date = NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date: {}", e))?;
    let end_date = NaiveDate::parse_from_str(end, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end date: {}", e))?;

    if start_date > end_date {
        return Err("Invalid date range: start must not be after end".to_string());
    }

    #[derive(sqlx::FromRow)]
    struct DbRecord {
        user_id: String,
        course_id: String,
        progress: f64,
        activity_at: DateTime<Utc>,
    }

    let records = sqlx::query_as::<_, DbRecord>(
        "SELECT user_id, course_id,
                COALESCE(progress_percentage, 0)::double precision AS progress,
                COALESCE(last_accessed, completed_at, enrolled_at) AS activity_at
         FROM course_enrollments
         WHERE COALESCE(last_accessed, completed_at, enrolled_at)::date BETWEEN $1 AND $2
         ORDER BY activity_at DESC",
    )
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(records
        .into_iter()
        .map(|r| ProgressRecord {
            user_id: r.user_id,
            course_id: r.course_id,
            progress: r.progress,
            date: r.activity_at.format("%Y-%m-%d").to_string(),
        })
        .collect())
}
