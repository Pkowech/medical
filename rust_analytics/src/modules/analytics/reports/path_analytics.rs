use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Error, Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
pub struct PathAnalytics {
    pub path_id: String,
    pub average_completion_rate: f64,
    pub average_time_to_complete: i64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct LearningPathProgressDb {
    pub overall_progress_percentage: Option<f64>,
    pub started_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
}

pub async fn get_path_analytics(
    path_id: &str,
    pool: &Pool<Postgres>,
) -> Result<PathAnalytics, Error> {
    let progress_records = sqlx::query_as::<_, LearningPathProgressDb>(
        "SELECT overall_progress_percentage, started_at, completed_at FROM learning_path_progress WHERE learning_path_id = $1"
    )
    .bind(path_id)
    .fetch_all(pool)
    .await?;

    let total_completed_progress: f64 = progress_records
        .iter()
        .filter_map(|p| p.overall_progress_percentage)
        .sum();
    let average_completion_rate = if progress_records.is_empty() {
        0.0
    } else {
        total_completed_progress / progress_records.len() as f64
    };

    let mut total_time_to_complete_seconds = 0i64;
    let mut completed_paths_count = 0;

    for record in progress_records.iter() {
        if let (Some(started_at), Some(completed_at)) = (record.started_at, record.completed_at) {
            if completed_at > started_at {
                let duration = completed_at.signed_duration_since(started_at);
                total_time_to_complete_seconds += duration.num_seconds();
                completed_paths_count += 1;
            }
        }
    }

    let average_time_to_complete = if completed_paths_count == 0 {
        0
    } else {
        total_time_to_complete_seconds / completed_paths_count
    };

    Ok(PathAnalytics {
        path_id: path_id.to_string(),
        average_completion_rate,
        average_time_to_complete,
    })
}
#[derive(Debug, Serialize, Deserialize)]
pub struct UserPathAnalytics {
    pub user_id: String,
    pub path_id: String,
    pub status: String,
    pub progress_percentage: f64,
    pub time_spent_seconds: i64,
    pub started_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct UserLearningPathProgressDb {
    pub user_id: String,
    pub learning_path_id: String,
    pub status: String,
    pub progress_percentage: i32,
    pub started_at: Option<NaiveDateTime>,
    pub completed_at: Option<NaiveDateTime>,
    pub time_spent_seconds: Option<i64>,
}

pub async fn get_user_path_analytics(
    user_id: &str,
    path_id: &str,
    pool: &Pool<Postgres>,
) -> Result<UserPathAnalytics, Error> {
    let record = sqlx::query_as::<_, UserLearningPathProgressDb>(
        "SELECT user_id, learning_path_id, status, progress_percentage, started_at, completed_at, time_spent_seconds FROM learning_path_progress WHERE user_id = $1 AND learning_path_id = $2"
    )
    .bind(user_id)
    .bind(path_id)
    .fetch_one(pool)
    .await?;

    Ok(UserPathAnalytics {
        user_id: record.user_id,
        path_id: record.learning_path_id,
        status: record.status,
        progress_percentage: record.progress_percentage as f64,
        time_spent_seconds: record.time_spent_seconds.unwrap_or(0),
        started_at: record.started_at,
        completed_at: record.completed_at,
    })
}
