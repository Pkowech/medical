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

    #[derive(sqlx::FromRow)]
    struct DbRecord {
        user_id: String,
        course_id: Option<String>,
        progress: f64,
        updated_at: DateTime<Utc>,
    }

    let records = sqlx::query_as::<_, DbRecord>(
        "SELECT user_id, course_id, progress, updated_at 
         FROM enrollments 
         WHERE updated_at >= $1 AND updated_at <= $2
         ORDER BY updated_at DESC",
    )
    .bind(start_date.and_hms_opt(0, 0, 0).unwrap())
    .bind(end_date.and_hms_opt(23, 59, 59).unwrap())
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(records
        .into_iter()
        .map(|r| ProgressRecord {
            user_id: r.user_id,
            course_id: r.course_id.unwrap_or_default(),
            progress: r.progress,
            date: r.updated_at.format("%Y-%m-%d").to_string(),
        })
        .collect())
}
